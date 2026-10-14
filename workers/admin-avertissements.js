// ===================== Mails d'avertissement aux contributeurs =====================
// Section du Worker « mapetanque-admin », collée dans son code dans le tableau de bord Cloudflare,
// juste après la ligne  __name(changerStatutSignalement, "changerStatutSignalement");
//
// Ce fichier n'est pas exécuté par le site : c'est la référence de cette partie du Worker (le reste
// de son code n'est que dans le tableau de bord). Il utilise reponseJson(), nettoyerTexte(),
// coordonnee(), jourIso(), FORMAT_EMAIL, LANGUES_SITE, changerStatutSignalement() et modererPhoto()
// du Worker, et les tables de workers/avertissements.sql (à créer avant).
//
// Principe : une décision prise dans l'admin (signalement traité ou refusé, photo d'un compte
// validée ou refusée) range une ligne dans la table avertissements. Une fois par jour, le Cron
// envoie UN mail par adresse, qui reprend toutes ses contributions traitées depuis la veille. Tant
// que le mail n'est pas parti, une nouvelle décision remplace la précédente, et « Remettre à
// traiter » l'efface. Trois choix par décision : mail automatique (avec un mot personnel en
// option), « je réponds moi-même » ou pas de mail (spam) ; seul le premier part.
//
// Réglages du Worker (Settings) :
//   - secret RESEND_API_KEY : clé Resend « Sending access » limitée au domaine mapetanque.be ;
//   - variable EXPEDITEUR (facultative) : par défaut « mapetanque.be <contributions@mapetanque.be> » ;
//   - variable REPONSE_A (facultative) : adresse où arrivent les réponses des contributeurs. Sans
//     elle, le mail demande de ne pas y répondre ;
//   - Trigger Cron supplémentaire : 0 7 * * *  (7 h UTC : 9 h en été, 8 h en hiver ; après la mise
//     à jour OSM de 3 h 17 et la publication des photos de 5 h). Le Cron de 3 h reste pour la purge.
//
// Remplacements dans le code existant (chercher la ligne de gauche, la remplacer par celle de droite) :
//
// 1. Routes POST : la décision passe d'abord par avecAvertissement().
//      return await changerStatutSignalement(request, env, origine);
//   → return await avecAvertissement(request, env, origine, "signalement", changerStatutSignalement);
//
//      return await modererPhoto(request, env, origine);
//   → return await avecAvertissement(request, env, origine, "photo", modererPhoto);
//
// 2. Routes GET : les listes disent en plus si la personne a un compte et où en est le mail.
//      return await listerSignalements(env, origine);
//   → return await listerSignalementsAvecMail(env, origine);
//
//      return await listerModeration(env, origine);
//   → return await listerModerationAvecMail(env, origine);
//
// 3. Nouvelles routes, devant la ligne
//      if (url.pathname === "/admin/stats/notes" && request.method === "GET") {
//   → if (url.pathname === "/admin/avertissements" && request.method === "GET") { return await etatAvertissements(env, origine); } if (url.pathname === "/admin/avertissements/envoyer" && request.method === "POST") { return await envoyerAvertissementsMaintenant(env, origine); } if (url.pathname === "/admin/stats/notes" && request.method === "GET") {
//
// 4. Cron : le passage de 7 h envoie les mails, celui de 3 h purge comme avant.
//      ctx.waitUntil(purger(env));
//   → if (controller.cron === CRON_AVERTISSEMENTS) { ctx.waitUntil(envoyerAvertissements(env).then((r) => console.log("Avertissements : " + JSON.stringify(r))).catch((e) => console.log("Avertissements impossibles : " + e.message))); return; } ctx.waitUntil(purger(env));

var CRON_AVERTISSEMENTS = "0 7 * * *";
// Les avertissements passent après les connexions : on n'en envoie que tant que la journée
// (mails de connexion + avertissements) reste sous ce total, sur les 100 de Resend. Le reste
// part le lendemain, en premier.
var PLAFOND_MAILS_JOUR = 60;
// Le plan gratuit de Cloudflare limite le nombre d'appels sortants par exécution (50).
var MAX_MAILS_PAR_PASSAGE = 40;
var MODES_MAIL = ["auto", "manuel", "aucun"];
var MOTIFS_REFUS = {
  manquant: ["introuvable", "prive", "club", "deja_carte", "deja_signale", "autre"],
  erreur: ["deja_correct", "deja_corrige", "inverifiable", "autre"],
  club: ["deja_correct", "deja_corrige", "inverifiable", "autre"],
  photo: ["floue", "hors_sujet", "doublon", "autre"]
};
var TAILLE_MAX_MOT = 500;
var URL_SITE_MAILS = "https://mapetanque.be";

// Jointures communes : la contribution, puis le compte de son auteur. Adresse et langue sont lues
// ici au moment de l'envoi, jamais copiées dans avertissements.
var JOINTURES_AVERTISSEMENTS = `
  FROM avertissements a
  LEFT JOIN signalements s ON a.sorte = 'signalement' AND s.id = a.ref_id
  LEFT JOIN photos p ON a.sorte = 'photo' AND p.id = a.ref_id
  LEFT JOIN comptes c ON c.id = COALESCE(s.compte_id, p.compte_id)`;

// Lit la décision envoyée par l'admin et prépare la ligne d'avertissement, AVANT que le statut ne
// change : un choix incomplet (refus sans motif) est refusé sans rien enregistrer.
// Renvoie null (rien à faire), { effacer } ou la ligne à ranger.
async function preparerAvertissement(env, sorte, corps) {
  const refId = Number(corps.id);
  if (!Number.isInteger(refId) || refId <= 0) return null;
  const decision = sorte === "signalement"
    ? (corps.statut === "traite" ? "accepte" : corps.statut === "refuse" ? "refuse" : null)
    : (corps.decision === "valider" ? "accepte" : corps.decision === "refuser" ? "refuse" : null);
  // Remise à traiter, ou décision venue d'ailleurs que la modération (panneau des photos d'un
  // terrain) : un mail pas encore parti ne correspond plus à rien.
  if (!decision || corps.mail === undefined) return { refId, effacer: true };
  if (!MODES_MAIL.includes(corps.mail)) throw new Error("choix du mail invalide");

  let type = "photo";
  if (sorte === "signalement") {
    const s = await env.DB.prepare("SELECT type FROM signalements WHERE id = ?1").bind(refId).first();
    if (!s) return null;
    type = s.type;
  } else {
    // Photo envoyée sans compte : aucune adresse, donc rien à envoyer.
    const p = await env.DB.prepare("SELECT compte_id FROM photos WHERE id = ?1").bind(refId).first();
    if (!p || !p.compte_id) return { refId, effacer: true };
  }
  const motif = decision === "refuse" && (MOTIFS_REFUS[type] || []).includes(corps.motif) ? corps.motif : null;
  const mot = nettoyerTexte(corps.mot, TAILLE_MAX_MOT) || null;
  if (corps.mail === "auto" && decision === "refuse" && !motif) throw new Error("motif du refus manquant");
  if (corps.mail === "auto" && motif === "autre" && !mot) throw new Error("le motif « Autre » demande un mot personnel");
  return {
    refId,
    decision,
    mode: corps.mail,
    motif,
    mot,
    libelle: nettoyerTexte(corps.libelle, 150).replace(/\s+/g, " ") || null,
    lat: coordonnee(corps.lat),
    lon: coordonnee(corps.lon)
  };
}

// Enveloppe des routes POST /admin/signalements et POST /admin/moderation : la route d'origine
// change le statut comme avant, puis la ligne d'avertissement est rangée (ou effacée).
async function avecAvertissement(request, env, origine, sorte, traiter) {
  let corps = null;
  try {
    corps = await request.clone().json();
  } catch (e) {
    // corps illisible : la route d'origine répondra elle-même 400
  }
  let ligne = null;
  if (corps) {
    try {
      ligne = await preparerAvertissement(env, sorte, corps);
    } catch (e) {
      return reponseJson({ erreur: e.message }, origine, 400);
    }
  }
  const reponse = await traiter(request, env, origine);
  if (!reponse.ok || !ligne) return reponse;
  try {
    if (ligne.effacer) {
      await env.DB.prepare("DELETE FROM avertissements WHERE sorte = ?1 AND ref_id = ?2 AND envoye IS NULL").bind(sorte, ligne.refId).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO avertissements (sorte, ref_id, decision, mode, motif, mot, libelle, lat, lon)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(sorte, ref_id) DO UPDATE
          SET decision = excluded.decision, mode = excluded.mode, motif = excluded.motif,
              mot = excluded.mot, libelle = excluded.libelle, lat = excluded.lat,
              lon = excluded.lon, cree = datetime('now')
          WHERE avertissements.envoye IS NULL
      `).bind(sorte, ligne.refId, ligne.decision, ligne.mode, ligne.motif, ligne.mot, ligne.libelle, ligne.lat, ligne.lon).run();
    }
  } catch (e) {
    console.log("Avertissement non enregistré : " + e.message);
    return reponseJson({ erreur: "décision enregistrée, mais pas le mail : " + e.message }, origine, 500);
  }
  return reponse;
}

// Même liste que listerSignalements, avec l'adresse du compte s'il y en a un et l'état du mail.
async function listerSignalementsAvecMail(env, origine) {
  const { results } = await env.DB.prepare(`
        SELECT s.id, s.type, s.statut, s.osm_id, s.titre, s.lat, s.lon, s.nb_pistes, s.commentaire,
               s.langue, COALESCE(c.email, s.email) AS email, s.cree, s.maj,
               (s.compte_id IS NOT NULL) AS avec_compte, c.pseudo,
               a.decision AS mail_decision, a.mode AS mail_mode, a.motif AS mail_motif,
               a.mot AS mail_mot, a.envoye AS mail_envoye
          FROM signalements s
          LEFT JOIN comptes c ON c.id = s.compte_id
          LEFT JOIN avertissements a ON a.sorte = 'signalement' AND a.ref_id = s.id
         ORDER BY (s.statut = 'nouveau') DESC, s.cree DESC
         LIMIT 500
    `).all();
  return reponseJson(results, origine);
}

// Même file que listerModeration, avec en plus : la photo vient-elle d'un compte (seules
// celles-là peuvent recevoir un mail), son adresse (pour « je réponds moi-même ») et l'état du mail.
async function listerModerationAvecMail(env, origine) {
  const { results } = await env.DB.prepare(`
        SELECT p.id, p.osm_id, p.statut, p.credit_nom, p.date_prise, p.nom_fichier, p.cree, p.maj,
               p.erreur, (p.compte_id IS NOT NULL) AS avec_compte, c.pseudo, c.email,
               a.decision AS mail_decision, a.mode AS mail_mode, a.envoye AS mail_envoye
          FROM photos p
          LEFT JOIN comptes c ON c.id = p.compte_id
          LEFT JOIN avertissements a ON a.sorte = 'photo' AND a.ref_id = p.id
         WHERE p.origine = 'visiteur' AND p.statut IN ('en_attente', 'validee', 'envoyee')
         ORDER BY p.cree
    `).all();
  return reponseJson(results, origine);
}

// Mails de la journée (UTC) : connexions + avertissements.
async function mailsDuJour(env, jour) {
  const [connexions, avertis] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS nombre FROM liens_connexion WHERE cree >= ?1").bind(jour),
    env.DB.prepare("SELECT nombre FROM mails_jour WHERE jour = ?1").bind(jour)
  ]);
  return { connexions: connexions.results[0].nombre, avertissements: avertis.results.length ? avertis.results[0].nombre : 0 };
}

// GET /admin/avertissements : ce qui attend le prochain envoi, et le compte du jour.
async function etatAvertissements(env, origine) {
  const attente = await env.DB.prepare(`
        SELECT COUNT(*) AS contributions,
               COUNT(DISTINCT lower(COALESCE(c.email, s.email))) AS destinataires
        ${JOINTURES_AVERTISSEMENTS}
         WHERE a.envoye IS NULL AND a.mode = 'auto'
    `).first();
  const jour = await mailsDuJour(env, jourIso(new Date()));
  return reponseJson({
    contributions: attente.contributions,
    destinataires: attente.destinataires,
    connexions_du_jour: jour.connexions,
    avertissements_du_jour: jour.avertissements,
    plafond: PLAFOND_MAILS_JOUR
  }, origine);
}

// POST /admin/avertissements/envoyer : le même envoi que le Cron, tout de suite (bouton de l'admin).
async function envoyerAvertissementsMaintenant(env, origine) {
  try {
    return reponseJson(await envoyerAvertissements(env), origine);
  } catch (e) {
    return reponseJson({ erreur: e.message }, origine, 500);
  }
}

// Envoi groupé : un mail par adresse, toutes ses contributions traitées dedans.
async function envoyerAvertissements(env) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY absent du Worker");
  const { results } = await env.DB.prepare(`
        SELECT a.id, a.decision, a.motif, a.mot, a.libelle,
               COALESCE(a.lat, s.lat) AS lat, COALESCE(a.lon, s.lon) AS lon,
               CASE a.sorte WHEN 'photo' THEN 'photo' ELSE s.type END AS type,
               COALESCE(s.cree, p.cree) AS recu,
               COALESCE(c.email, s.email) AS email,
               COALESCE(c.langue, s.langue) AS langue,
               c.pseudo
        ${JOINTURES_AVERTISSEMENTS}
         WHERE a.envoye IS NULL AND a.mode = 'auto'
         ORDER BY a.id
    `).all();

  // Regroupement par adresse ; sans adresse (compte supprimé entre-temps), la ligne est effacée.
  const groupes = new Map();
  const sansAdresse = [];
  for (const ligne of results) {
    const email = String(ligne.email || "").trim().toLowerCase();
    if (!FORMAT_EMAIL.test(email) || !TEXTES_AVERTISSEMENT.fr.quoi[ligne.type]) {
      sansAdresse.push(ligne.id);
      continue;
    }
    if (!groupes.has(email)) groupes.set(email, []);
    groupes.get(email).push(ligne);
  }
  if (sansAdresse.length) {
    await env.DB.prepare("DELETE FROM avertissements WHERE id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(sansAdresse)).run();
  }

  const jour = jourIso(new Date());
  const compte = await mailsDuJour(env, jour);
  let total = compte.connexions + compte.avertissements;
  let envoyes = 0, echecs = 0;
  for (const [email, lignes] of groupes) {
    if (total >= PLAFOND_MAILS_JOUR || envoyes + echecs >= MAX_MAILS_PAR_PASSAGE) break;
    const mail = composerAvertissement(lignes, env);
    try {
      await envoyerMail(env, email, mail.sujet, mail.texte, mail.html);
    } catch (e) {
      console.log("Avertissement non envoyé : " + e.message);
      echecs++;
      continue;
    }
    total++;
    envoyes++;
    await env.DB.batch([
      env.DB.prepare("UPDATE avertissements SET envoye = datetime('now') WHERE id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(lignes.map((l) => l.id))),
      env.DB.prepare("INSERT INTO mails_jour (jour, nombre) VALUES (?1, 1) ON CONFLICT(jour) DO UPDATE SET nombre = nombre + 1").bind(jour)
    ]);
  }
  await env.DB.prepare("DELETE FROM mails_jour WHERE jour < date('now', '-30 days')").run();
  return { envoyes, echecs, reportes: groupes.size - envoyes - echecs, total_du_jour: total, plafond: PLAFOND_MAILS_JOUR };
}

async function envoyerMail(env, a, sujet, texte, html) {
  const corps = {
    from: env.EXPEDITEUR || "mapetanque.be <contributions@mapetanque.be>",
    to: [a],
    subject: sujet,
    text: texte,
    html
  };
  if (env.REPONSE_A) corps.reply_to = env.REPONSE_A;
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(corps)
  });
  if (!reponse.ok) throw new Error("Resend HTTP " + reponse.status + " " + (await reponse.text()).slice(0, 200));
}

function echapperHtml(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Date de réception lisible (« 12 octobre »), à l'heure belge.
function dateAvertissement(dateBase, locale) {
  try {
    return new Date(String(dateBase).replace(" ", "T") + "Z").toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "Europe/Brussels" });
  } catch (e) {
    return String(dateBase || "").slice(0, 10);
  }
}

// Lien vers la carte, dans la langue du mail ; seulement pour ce qui a été accepté.
function lienAvertissement(langue, ligne) {
  if (ligne.decision !== "accepte" || ligne.lat === null || ligne.lon === null) return null;
  const prefixe = langue === "fr" ? "" : "/" + langue;
  const position = "lat=" + Number(ligne.lat).toFixed(6) + "&lon=" + Number(ligne.lon).toFixed(6);
  return URL_SITE_MAILS + prefixe + (ligne.type === "club" ? "/?club=1&" + position : "/carte.html?" + position);
}

function composerAvertissement(lignes, env) {
  const premiere = lignes.find((l) => LANGUES_SITE.includes(l.langue));
  const langue = premiere ? premiere.langue : "fr";
  const T = TEXTES_AVERTISSEMENT[langue];
  const pseudo = (lignes.find((l) => l.pseudo) || {}).pseudo || null;
  const n = lignes.length;

  const elements = lignes.map((l) => {
    const quoi = T.quoi[l.type](l.libelle, dateAvertissement(l.recu, T.locale));
    const suite = l.decision === "accepte"
      ? T.accepte[l.type]
      : T.refus[l.type] + (l.motif && T.motifs[l.motif] ? T.car + T.motifs[l.motif] + "." : ".");
    return { quoi, suite, mot: l.mot, lien: lienAvertissement(langue, l) };
  });

  const bonjour = T.bonjour(pseudo);
  const intro = T.intro(n);
  const pied = T.pied(!!env.REPONSE_A);

  const texte = [bonjour, "", intro, ""]
    .concat(elements.map((e) => "• " + e.quoi + T.dp + e.suite
      + (e.mot ? "\n  " + T.note + T.dp + e.mot.replace(/\n/g, "\n  ") : "")
      + (e.lien ? "\n  " + T.lien + T.dp + e.lien : "")).join("\n\n"))
    .concat(["", T.fin, T.signature, "", "—", pied])
    .join("\n");

  const h = echapperHtml;
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">'
    + "<p>" + h(bonjour) + "</p><p>" + h(intro) + '</p><ul style="padding-left:20px">'
    + elements.map((e) => '<li style="margin-bottom:12px"><strong>' + h(e.quoi) + "</strong>" + h(T.dp) + h(e.suite)
      + (e.mot ? "<br><em>" + h(T.note) + h(T.dp) + "</em>" + h(e.mot).replace(/\n/g, "<br>") : "")
      + (e.lien ? '<br><a href="' + h(e.lien) + '">' + h(T.lien) + "</a>" : "")
      + "</li>").join("")
    + "</ul><p>" + h(T.fin) + "<br>" + h(T.signature) + "</p>"
    + '<p style="font-size:12px;color:#777">' + h(pied) + "</p></div>";

  return { sujet: T.sujet(n), texte, html };
}

// Textes des mails. « quoi » nomme la contribution ; « accepte » / « refus » + motif disent la
// suite. Les motifs se lisent après « car » (want, denn, because) : phrase principale sans point.
var TEXTES_AVERTISSEMENT = {
  fr: {
    locale: "fr-BE",
    dp: " : ",
    car: ", car ",
    sujet: (n) => n > 1 ? "Vos contributions à mapetanque.be" : "Votre contribution à mapetanque.be",
    bonjour: (p) => p ? "Bonjour " + p + "," : "Bonjour,",
    intro: (n) => "Merci pour votre aide ! Voici la suite donnée à " + (n > 1 ? "vos envois." : "votre envoi."),
    quoi: {
      manquant: (l, d) => "Terrain manquant signalé le " + d,
      erreur: (l, d) => l ? "Erreur signalée sur « " + l + " »" : "Erreur signalée le " + d,
      club: (l, d) => l ? "Erreur signalée sur le club « " + l + " »" : "Erreur de club signalée le " + d,
      photo: (l, d) => l ? "Photo du terrain « " + l + " »" : "Photo envoyée le " + d
    },
    accepte: {
      manquant: "ajouté à la carte. Il y apparaîtra au plus tard demain.",
      erreur: "corrigée. La correction apparaîtra sur la carte au plus tard demain.",
      club: "corrigée sur le site.",
      photo: "acceptée, merci ! Elle sera visible sur la fiche du terrain d'ici quelques jours."
    },
    refus: { manquant: "pas retenu", erreur: "pas retenue", club: "pas retenue", photo: "pas retenue" },
    motifs: {
      introuvable: "nous n'avons pas trouvé de terrain à l'endroit indiqué",
      prive: "il s'agit d'un terrain privé ; la carte ne montre que les terrains accessibles à tous",
      club: "il s'agit d'un terrain de club réservé à ses membres",
      deja_carte: "ce terrain est déjà sur la carte",
      deja_signale: "ce terrain nous avait déjà été signalé",
      deja_correct: "après vérification, l'information affichée est correcte",
      deja_corrige: "la correction avait déjà été faite",
      inverifiable: "nous n'avons pas pu vérifier cette information",
      floue: "la photo est floue ou trop sombre",
      hors_sujet: "la photo ne montre pas le terrain",
      doublon: "une photo très semblable est déjà en ligne"
    },
    note: "Précision",
    lien: "Voir sur la carte",
    fin: "Merci encore et bonne partie !",
    signature: "Rémy pour Mapetanque.be",
    pied: (rep) => "Vous recevez ce message parce que vous avez contribué à mapetanque.be."
      + (rep ? " Vous pouvez y répondre directement." : " Merci de ne pas y répondre : cette adresse ne reçoit pas de courrier.")
  },
  nl: {
    locale: "nl-BE",
    dp: ": ",
    car: ", want ",
    sujet: (n) => n > 1 ? "Uw bijdragen aan mapetanque.be" : "Uw bijdrage aan mapetanque.be",
    bonjour: (p) => p ? "Hallo " + p + "," : "Hallo,",
    intro: (n) => "Bedankt voor uw hulp! Dit is er met uw " + (n > 1 ? "inzendingen" : "inzending") + " gebeurd.",
    quoi: {
      manquant: (l, d) => "Ontbrekend terrein gemeld op " + d,
      erreur: (l, d) => l ? "Fout gemeld bij “" + l + "”" : "Fout gemeld op " + d,
      club: (l, d) => l ? "Fout gemeld bij de club “" + l + "”" : "Fout bij een club gemeld op " + d,
      photo: (l, d) => l ? "Foto van het terrein “" + l + "”" : "Foto verstuurd op " + d
    },
    accepte: {
      manquant: "toegevoegd aan de kaart. Het verschijnt er uiterlijk morgen op.",
      erreur: "verbeterd. De correctie verschijnt uiterlijk morgen op de kaart.",
      club: "verbeterd op de site.",
      photo: "aanvaard, bedankt! Ze is binnen enkele dagen te zien op de fiche van het terrein."
    },
    refus: { manquant: "niet aanvaard", erreur: "niet aanvaard", club: "niet aanvaard", photo: "niet aanvaard" },
    motifs: {
      introuvable: "we hebben op de aangegeven plaats geen terrein gevonden",
      prive: "het gaat om een privéterrein; de kaart toont alleen terreinen die voor iedereen toegankelijk zijn",
      club: "het gaat om een clubterrein dat alleen voor leden toegankelijk is",
      deja_carte: "dit terrein staat al op de kaart",
      deja_signale: "dit terrein werd ons al gemeld",
      deja_correct: "na controle blijkt de getoonde informatie te kloppen",
      deja_corrige: "de correctie was al gebeurd",
      inverifiable: "we konden deze informatie niet controleren",
      floue: "de foto is onscherp of te donker",
      hors_sujet: "de foto toont het terrein niet",
      doublon: "er staat al een zeer gelijkaardige foto online"
    },
    note: "Toelichting",
    lien: "Bekijk op de kaart",
    fin: "Nogmaals bedankt en veel speelplezier!",
    signature: "Rémy voor Mapetanque.be",
    pied: (rep) => "U ontvangt dit bericht omdat u hebt bijgedragen aan mapetanque.be."
      + (rep ? " U kunt er gewoon op antwoorden." : " Gelieve niet te antwoorden: dit adres ontvangt geen post.")
  },
  de: {
    locale: "de-BE",
    dp: ": ",
    car: ", denn ",
    sujet: (n) => n > 1 ? "Ihre Beiträge zu mapetanque.be" : "Ihr Beitrag zu mapetanque.be",
    bonjour: (p) => p ? "Hallo " + p + "," : "Guten Tag,",
    intro: (n) => "Vielen Dank für Ihre Hilfe! So ging es mit " + (n > 1 ? "Ihren Einsendungen" : "Ihrer Einsendung") + " weiter.",
    quoi: {
      manquant: (l, d) => "Fehlender Platz, gemeldet am " + d,
      erreur: (l, d) => l ? "Fehler gemeldet zu „" + l + "“" : "Fehler gemeldet am " + d,
      club: (l, d) => l ? "Fehler gemeldet zum Verein „" + l + "“" : "Fehler zu einem Verein gemeldet am " + d,
      photo: (l, d) => l ? "Foto des Platzes „" + l + "“" : "Foto gesendet am " + d
    },
    accepte: {
      manquant: "zur Karte hinzugefügt. Er erscheint dort spätestens morgen.",
      erreur: "korrigiert. Die Korrektur erscheint spätestens morgen auf der Karte.",
      club: "auf der Website korrigiert.",
      photo: "angenommen, danke! Es ist in einigen Tagen auf der Seite des Platzes zu sehen."
    },
    refus: { manquant: "nicht übernommen", erreur: "nicht übernommen", club: "nicht übernommen", photo: "nicht angenommen" },
    motifs: {
      introuvable: "wir haben an der angegebenen Stelle keinen Platz gefunden",
      prive: "es handelt sich um einen privaten Platz; die Karte zeigt nur Plätze, die für alle frei zugänglich sind",
      club: "es handelt sich um einen Vereinsplatz, der nur Mitgliedern offensteht",
      deja_carte: "dieser Platz ist bereits auf der Karte",
      deja_signale: "dieser Platz wurde uns bereits gemeldet",
      deja_correct: "nach Prüfung ist die angezeigte Information korrekt",
      deja_corrige: "die Korrektur war bereits erfolgt",
      inverifiable: "wir konnten diese Information nicht überprüfen",
      floue: "das Foto ist unscharf oder zu dunkel",
      hors_sujet: "das Foto zeigt den Platz nicht",
      doublon: "ein sehr ähnliches Foto ist bereits online"
    },
    note: "Anmerkung",
    lien: "Auf der Karte ansehen",
    fin: "Nochmals vielen Dank und viel Spaß beim Spielen!",
    signature: "Rémy für Mapetanque.be",
    pied: (rep) => "Sie erhalten diese Nachricht, weil Sie zu mapetanque.be beigetragen haben."
      + (rep ? " Sie können direkt darauf antworten." : " Bitte antworten Sie nicht: Diese Adresse empfängt keine Nachrichten.")
  },
  en: {
    locale: "en-GB",
    dp: ": ",
    car: ", because ",
    sujet: (n) => n > 1 ? "Your contributions to mapetanque.be" : "Your contribution to mapetanque.be",
    bonjour: (p) => p ? "Hello " + p + "," : "Hello,",
    intro: (n) => "Thank you for your help! Here's what became of your " + (n > 1 ? "submissions." : "submission."),
    quoi: {
      manquant: (l, d) => "Missing court reported on " + d,
      erreur: (l, d) => l ? "Error reported on “" + l + "”" : "Error reported on " + d,
      club: (l, d) => l ? "Error reported on the club “" + l + "”" : "Club error reported on " + d,
      photo: (l, d) => l ? "Photo of the court “" + l + "”" : "Photo sent on " + d
    },
    accepte: {
      manquant: "added to the map. It will show up by tomorrow at the latest.",
      erreur: "fixed. The correction will show up on the map by tomorrow at the latest.",
      club: "fixed on the site.",
      photo: "accepted, thank you! It will be visible on the court's page within a few days."
    },
    refus: { manquant: "not accepted", erreur: "not accepted", club: "not accepted", photo: "not accepted" },
    motifs: {
      introuvable: "we couldn't find a court at the location given",
      prive: "it's a private court; the map only shows courts open to everyone",
      club: "it's a club court reserved for its members",
      deja_carte: "this court is already on the map",
      deja_signale: "this court had already been reported to us",
      deja_correct: "after checking, the information shown is correct",
      deja_corrige: "the correction had already been made",
      inverifiable: "we couldn't verify this information",
      floue: "the photo is blurry or too dark",
      hors_sujet: "the photo doesn't show the court",
      doublon: "a very similar photo is already online"
    },
    note: "Note",
    lien: "See it on the map",
    fin: "Thanks again, and enjoy your game!",
    signature: "Rémy for Mapetanque.be",
    pied: (rep) => "You're receiving this because you contributed to mapetanque.be."
      + (rep ? " You can reply directly to this message." : " Please don't reply: this address doesn't receive mail.")
  }
};
