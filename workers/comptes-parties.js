// ===================== Parties (étape 2 : enregistrement depuis le compteur) =====================
// Section du Worker « mapetanque-comptes », collée à la fin de son code dans le tableau de bord
// Cloudflare. Voir NOTES_comptes_utilisateurs.md, « Étape 2 — enregistrement des parties ».
// Tables : workers/comptes-parties.sql (console D1 de la base mapetanque-notes).
//
// Ce fichier n'est pas exécuté par le site : c'est la référence de cette partie du Worker (le
// reste de son code n'est que dans le tableau de bord). Il utilise les outils du Worker :
// json(), lireJson(), compteDepuisRequete().
//
// Branchement dans le fetch du Worker, avec les autres routes :
//
//   if (request.method === "POST" && chemin === "/compte/parties") return await enregistrerPartie(request, env, origine);
//   if (request.method === "POST" && chemin === "/compte/parties/retirer") return await retirerPartie(request, env, origine);
//   if (request.method === "GET" && chemin === "/compte/parties") return await listerParties(request, env, origine);
//   if (request.method === "GET" && chemin === "/compte/joueurs") return await listerJoueurs(request, env, origine);
//
// Et dans supprimerCompte, dans le batch, avant l'effacement du compte :
//
//   env.DB.prepare("DELETE FROM parties WHERE compte_id = ?").bind(compte.id),
//   env.DB.prepare("DELETE FROM joueurs WHERE compte_id = ?").bind(compte.id),
//
// Routes (jeton de session dans l'en-tête Authorization) :
//   POST /compte/parties           partie terminée (voir verifierPartie)   -> { ok, id }
//   POST /compte/parties/retirer   { id }                                   -> { ok }
//   GET  /compte/parties           toutes les parties du compte, de la plus récente à la plus
//                                  ancienne, noms des joueurs compris        -> { parties: [...] }
//   GET  /compte/joueurs           carnet, du plus récemment utilisé au plus ancien
//                                                                            -> { joueurs: [{ nom }] }
// Erreurs : 401 non_connecte ; 400 partie_invalide (avec detail) ; 429 trop_de_parties.

const PARTIES_PAR_JOUR = 40;        // largement au-dessus d'une vraie journée de jeu
const DUREE_MIN_PARTIE = 5 * 60;    // secondes : en dessous, c'est un essai du compteur
const MENES_MIN_PARTIE = 3;
const LONGUEUR_NOM_JOUEUR = 20;

// « 2026-10-10T14:03:00.000Z » -> « 2026-10-10 14:03:00 », le format des autres tables
function dateBaseParties(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

// Sans accents ni majuscules, espaces simples : « Julie » et « julie » sont le même joueur
function cleNomJoueur(nom) {
  return nom.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function nomJoueurPropre(nom) {
  if (typeof nom !== "string") return null;
  const n = nom.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  return n && Array.from(n).length <= LONGUEUR_NOM_JOUEUR ? n : null;
}

// Vérifie la partie envoyée par le compteur et la ramène à ce qui sera enregistré. Le score est
// recalculé depuis les mènes : la partie doit être allée à son terme (objectif atteint), et
// avoir duré au moins 3 mènes et 5 minutes, comme côté compteur.
//   { id, debut (ms), objectif, format, mon_equipe, nom_a, nom_b, joueurs: { a: [noms], b: [noms] },
//     menes: [{ e: "a"|"b", p: 1..6, t: secondes depuis debut }], terrain }
function verifierPartie(d) {
  const erreur = detail => ({ erreur: detail });
  if (typeof d.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d.id)) return erreur("id");
  if (d.objectif !== 11 && d.objectif !== 13) return erreur("objectif");
  if (![1, 2, 3].includes(d.format)) return erreur("format");
  if (d.mon_equipe !== "a" && d.mon_equipe !== "b") return erreur("mon_equipe");

  const maintenant = Date.now();
  const debut = Number(d.debut);
  if (!Number.isFinite(debut) || debut > maintenant + 10 * 60000 || debut < maintenant - 30 * 86400000) return erreur("debut");

  if (!Array.isArray(d.menes) || d.menes.length < MENES_MIN_PARTIE || d.menes.length > 80) return erreur("menes");
  // 6 points au plus par mène, quel que soit le format : on peut changer de format en fin de
  // partie (le compteur limite les pastilles à +3 en tête-à-tête, pas les mènes déjà jouées).
  let a = 0, b = 0, avant = -1;
  const menes = [];
  for (const m of d.menes) {
    if (!m || (m.e !== "a" && m.e !== "b")) return erreur("menes");
    if (!Number.isInteger(m.p) || m.p < 1 || m.p > 6) return erreur("menes");
    if (!Number.isInteger(m.t) || m.t < avant || m.t > 86400) return erreur("menes");
    if (a >= d.objectif || b >= d.objectif) return erreur("menes");   // mène après la fin
    if (m.e === "a") a = Math.min(d.objectif, a + m.p); else b = Math.min(d.objectif, b + m.p);
    avant = m.t;
    menes.push({ e: m.e, p: m.p, t: m.t });
  }
  if (a !== d.objectif && b !== d.objectif) return erreur("pas_finie");
  if (menes[menes.length - 1].t - menes[0].t < DUREE_MIN_PARTIE) return erreur("trop_courte");

  const joueurs = { a: [], b: [] };
  for (const equipe of ["a", "b"]) {
    const liste = (d.joueurs && Array.isArray(d.joueurs[equipe])) ? d.joueurs[equipe] : [];
    const places = d.format - (d.mon_equipe === equipe ? 1 : 0);
    if (liste.length > places) return erreur("joueurs");
    for (const nom of liste) {
      const n = nomJoueurPropre(nom);
      if (!n) return erreur("joueurs");
      if (!joueurs.a.concat(joueurs.b).some(x => cleNomJoueur(x) === cleNomJoueur(n))) joueurs[equipe].push(n);
    }
  }
  const nomA = d.nom_a ? nomJoueurPropre(d.nom_a) : null;
  const nomB = d.nom_b ? nomJoueurPropre(d.nom_b) : null;
  if ((d.nom_a && !nomA) || (d.nom_b && !nomB)) return erreur("noms");
  const terrain = typeof d.terrain === "string" && /^(node|way|relation)\/[0-9]{1,16}$/.test(d.terrain) ? d.terrain : null;

  return {
    partie: {
      id: d.id,
      debut: dateBaseParties(debut + menes[0].t * 1000),
      fin: dateBaseParties(debut + menes[menes.length - 1].t * 1000),
      objectif: d.objectif, format: d.format, mon_equipe: d.mon_equipe, score_a: a, score_b: b,
      victoire: (d.mon_equipe === "a" ? a : b) === d.objectif ? 1 : 0,
      nom_a: nomA, nom_b: nomB, joueurs, menes, terrain,
    },
  };
}

// Enregistre la partie, ou la remplace si le téléphone la renvoie (même identifiant : équipes
// ou terrain modifiés après coup, victoire annulée puis rejouée, réseau qui hoquette).
async function enregistrerPartie(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const v = verifierPartie(await lireJson(request));
  if (v.erreur) return json({ erreur: "partie_invalide", detail: v.erreur }, 400, origine);
  const p = v.partie;

  // Limite par jour, sauf pour remplacer une partie déjà enregistrée
  const existe = await env.DB.prepare("SELECT compte_id FROM parties WHERE id = ?").bind(p.id).first();
  if (existe && existe.compte_id !== compte.id) return json({ erreur: "partie_invalide", detail: "id" }, 400, origine);
  if (!existe) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM parties WHERE compte_id = ? AND cree > datetime('now', '-1 day')")
      .bind(compte.id).first();
    if (n && n.n >= PARTIES_PAR_JOUR) return json({ erreur: "trop_de_parties" }, 429, origine);
  }

  // Carnet : un joueur par nom (sans tenir compte des majuscules ni des accents), créé au besoin
  const noms = p.joueurs.a.concat(p.joueurs.b);
  const ids = {};
  if (noms.length) {
    await env.DB.batch(noms.map(nom => env.DB.prepare(
      "INSERT INTO joueurs (id, compte_id, nom, cle) VALUES (?, ?, ?, ?)"
      + " ON CONFLICT(compte_id, cle) DO UPDATE SET utilise = datetime('now')"
    ).bind(crypto.randomUUID(), compte.id, nom, cleNomJoueur(nom))));
    const cles = noms.map(cleNomJoueur);
    const { results } = await env.DB.prepare(
      "SELECT id, cle FROM joueurs WHERE compte_id = ? AND cle IN (" + cles.map(() => "?").join(",") + ")"
    ).bind(compte.id, ...cles).all();
    results.forEach(l => { ids[l.cle] = l.id; });
  }
  const joueurs = { a: p.joueurs.a.map(n => ids[cleNomJoueur(n)]), b: p.joueurs.b.map(n => ids[cleNomJoueur(n)]) };

  await env.DB.prepare(
    "INSERT INTO parties (id, compte_id, debut, fin, objectif, format, mon_equipe, score_a, score_b, victoire, nom_a, nom_b, joueurs, menes, terrain)"
    + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    + " ON CONFLICT(id) DO UPDATE SET debut = excluded.debut, fin = excluded.fin, objectif = excluded.objectif, format = excluded.format,"
    + " mon_equipe = excluded.mon_equipe, score_a = excluded.score_a, score_b = excluded.score_b, victoire = excluded.victoire,"
    + " nom_a = excluded.nom_a, nom_b = excluded.nom_b, joueurs = excluded.joueurs, menes = excluded.menes, terrain = excluded.terrain,"
    + " maj = datetime('now') WHERE parties.compte_id = excluded.compte_id"
  ).bind(p.id, compte.id, p.debut, p.fin, p.objectif, p.format, p.mon_equipe, p.score_a, p.score_b, p.victoire,
    p.nom_a, p.nom_b, JSON.stringify(joueurs), JSON.stringify(p.menes), p.terrain).run();

  // Partie partagée : copie chez chaque joueur qui l'a rejointe (section « Parties partagées »)
  await synchroniserCopies(env, p.id);
  return json({ ok: true, id: p.id }, 200, origine);
}

// Retirer sa partie efface aussi les copies des joueurs qui l'avaient rejointe (victoire annulée
// dans le compteur) ; elles reviendront si la partie est de nouveau enregistrée. Un joueur qui
// retire sa copie ne la reverra pas (partage_joueurs.copie reste renseignée).
async function retirerPartie(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const corps = await lireJson(request);
  const id = typeof corps.id === "string" ? corps.id : "";
  const partie = await env.DB.prepare("SELECT origine FROM parties WHERE id = ? AND compte_id = ?").bind(id, compte.id).first();
  const requetes = [env.DB.prepare("DELETE FROM parties WHERE id = ? AND compte_id = ?").bind(id, compte.id)];
  if (partie && !partie.origine) {
    const { results: copies } = await env.DB.prepare("SELECT id FROM parties WHERE origine = ?").bind(id).all();
    if (copies.length) {
      requetes.push(env.DB.prepare("DELETE FROM parties WHERE origine = ?").bind(id));
      requetes.push(env.DB.prepare("UPDATE partage_joueurs SET copie = NULL WHERE partie_id = ? AND copie IN ("
        + copies.map(() => "?").join(",") + ")").bind(id, ...copies.map(c => c.id)));
    }
  }
  await env.DB.batch(requetes);
  return json({ ok: true }, 200, origine);
}

// Pour la page « Mes parties » (phase 2) : les statistiques sont calculées dans le navigateur.
async function listerParties(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const [parties, joueurs] = await env.DB.batch([
    env.DB.prepare("SELECT id, debut, fin, objectif, format, mon_equipe, score_a, score_b, victoire, nom_a, nom_b, joueurs, menes, terrain"
      + " FROM parties WHERE compte_id = ? ORDER BY fin DESC").bind(compte.id),
    env.DB.prepare("SELECT id, nom FROM joueurs WHERE compte_id = ?").bind(compte.id),
  ]);
  const noms = {};
  joueurs.results.forEach(j => { noms[j.id] = j.nom; });
  const liste = parties.results.map(p => {
    const j = JSON.parse(p.joueurs || "{}");
    p.joueurs = { a: (j.a || []).map(id => noms[id]).filter(Boolean), b: (j.b || []).map(id => noms[id]).filter(Boolean) };
    p.menes = JSON.parse(p.menes || "[]");
    return p;
  });
  return json({ parties: liste }, 200, origine);
}

// « Vos joueurs récents » du compteur
async function listerJoueurs(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const { results } = await env.DB.prepare("SELECT nom FROM joueurs WHERE compte_id = ? ORDER BY utilise DESC LIMIT 60")
    .bind(compte.id).all();
  return json({ joueurs: results.map(j => ({ nom: j.nom })) }, 200, origine);
}

// ===================== Parties, phase 2 : page « Mes parties » =====================
// Deux routes de plus pour la page mes-parties.html (fiche d'une partie et carnet de joueurs).
// Section à coller à la suite de la précédente. Branchement dans le fetch du Worker :
//
//   if (request.method === "POST" && chemin === "/compte/parties/modifier") return await modifierPartie(request, env, origine);
//   if (request.method === "POST" && chemin === "/compte/joueurs/renommer") return await renommerJoueur(request, env, origine);
//
// Routes (jeton de session dans l'en-tête Authorization) :
//   POST /compte/parties/modifier   { id, format, mon_equipe, joueurs: { a: [noms], b: [noms] }, terrain }
//                                   équipes ou terrain d'une partie déjà enregistrée ; le score et
//                                   les mènes ne changent pas, la victoire suit l'équipe du
//                                   titulaire                                -> { ok }
//   POST /compte/joueurs/renommer   { ancien, nouveau }  corrige un nom du carnet ; si le nouveau
//                                   nom est déjà dans le carnet, les deux joueurs n'en font plus
//                                   qu'un                                    -> { ok, fusion }
// Erreurs : 401 non_connecte ; 404 partie_introuvable, joueur_introuvable ; 400 partie_invalide
// (avec detail), nom_invalide.

// Identifiants du carnet pour ces noms, créés au besoin. Contrairement à l'enregistrement d'une
// partie, corriger une partie ancienne ne fait pas remonter ses joueurs dans les « récents ».
async function idsCarnetParties(env, compteId, noms) {
  const ids = {};
  if (!noms.length) return ids;
  await env.DB.batch(noms.map(nom => env.DB.prepare(
    "INSERT INTO joueurs (id, compte_id, nom, cle) VALUES (?, ?, ?, ?) ON CONFLICT(compte_id, cle) DO NOTHING"
  ).bind(crypto.randomUUID(), compteId, nom, cleNomJoueur(nom))));
  const cles = noms.map(cleNomJoueur);
  const { results } = await env.DB.prepare(
    "SELECT id, cle FROM joueurs WHERE compte_id = ? AND cle IN (" + cles.map(() => "?").join(",") + ")"
  ).bind(compteId, ...cles).all();
  results.forEach(l => { ids[l.cle] = l.id; });
  return ids;
}

async function modifierPartie(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const d = await lireJson(request);
  const p = await env.DB.prepare("SELECT id, objectif, score_a, score_b FROM parties WHERE id = ? AND compte_id = ?")
    .bind(typeof d.id === "string" ? d.id : "", compte.id).first();
  if (!p) return json({ erreur: "partie_introuvable" }, 404, origine);

  const invalide = detail => json({ erreur: "partie_invalide", detail }, 400, origine);
  if (![1, 2, 3].includes(d.format)) return invalide("format");
  if (d.mon_equipe !== "a" && d.mon_equipe !== "b") return invalide("mon_equipe");
  // Mêmes règles que verifierPartie : places selon le format, un nom une seule fois
  const joueurs = { a: [], b: [] };
  for (const equipe of ["a", "b"]) {
    const liste = (d.joueurs && Array.isArray(d.joueurs[equipe])) ? d.joueurs[equipe] : [];
    if (liste.length > d.format - (d.mon_equipe === equipe ? 1 : 0)) return invalide("joueurs");
    for (const nom of liste) {
      const n = nomJoueurPropre(nom);
      if (!n) return invalide("joueurs");
      if (!joueurs.a.concat(joueurs.b).some(x => cleNomJoueur(x) === cleNomJoueur(n))) joueurs[equipe].push(n);
    }
  }
  if (d.terrain !== null && !(typeof d.terrain === "string" && /^(node|way|relation)\/[0-9]{1,16}$/.test(d.terrain))) return invalide("terrain");

  const ids = await idsCarnetParties(env, compte.id, joueurs.a.concat(joueurs.b));
  const parId = { a: joueurs.a.map(n => ids[cleNomJoueur(n)]), b: joueurs.b.map(n => ids[cleNomJoueur(n)]) };
  const victoire = (d.mon_equipe === "a" ? p.score_a : p.score_b) === p.objectif ? 1 : 0;
  await env.DB.prepare(
    "UPDATE parties SET format = ?, mon_equipe = ?, victoire = ?, joueurs = ?, terrain = ?, maj = datetime('now') WHERE id = ? AND compte_id = ?"
  ).bind(d.format, d.mon_equipe, victoire, JSON.stringify(parId), d.terrain, p.id, compte.id).run();
  // Le marqueur corrige sa partie : les copies des joueurs qui l'ont rejointe suivent
  await synchroniserCopies(env, p.id);
  return json({ ok: true }, 200, origine);
}

async function renommerJoueur(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const d = await lireJson(request);
  const nouveau = nomJoueurPropre(d.nouveau);
  if (!nouveau || typeof d.ancien !== "string") return json({ erreur: "nom_invalide" }, 400, origine);
  const ancien = await env.DB.prepare("SELECT id, compte_lie FROM joueurs WHERE compte_id = ? AND cle = ?")
    .bind(compte.id, cleNomJoueur(d.ancien)).first();
  if (!ancien) return json({ erreur: "joueur_introuvable" }, 404, origine);
  const cible = await env.DB.prepare("SELECT id FROM joueurs WHERE compte_id = ? AND cle = ?")
    .bind(compte.id, cleNomJoueur(nouveau)).first();

  // Simple correction, y compris des majuscules ou des accents (« julie » → « Julie »)
  if (!cible || cible.id === ancien.id) {
    await env.DB.prepare("UPDATE joueurs SET nom = ?, cle = ? WHERE id = ?").bind(nouveau, cleNomJoueur(nouveau), ancien.id).run();
    return json({ ok: true, fusion: false }, 200, origine);
  }

  // Fusion (« Julei » → « Julie ») : les parties de l'ancien passent au joueur déjà présent, qui
  // garde son nom ; l'ancien disparaît du carnet. Une entrée reliée à un compte (étape B) garde
  // son lien.
  const { results } = await env.DB.prepare("SELECT id, joueurs FROM parties WHERE compte_id = ? AND joueurs LIKE ?")
    .bind(compte.id, '%"' + ancien.id + '"%').all();
  const requetes = results.map(partie => {
    const j = JSON.parse(partie.joueurs || "{}");
    const a = j.a || [], b = j.b || [];
    // Les deux noms dans la même partie, chacun dans une équipe : le joueur reste là où il était
    const ailleurs = a.includes(ancien.id) ? b.includes(cible.id) : a.includes(cible.id);
    const changer = l => (ailleurs ? l.filter(x => x !== ancien.id) : l.map(x => x === ancien.id ? cible.id : x))
      .filter((x, i, t) => t.indexOf(x) === i);
    return env.DB.prepare("UPDATE parties SET joueurs = ? WHERE id = ?").bind(JSON.stringify({ a: changer(a), b: changer(b) }), partie.id);
  });
  requetes.push(env.DB.prepare("UPDATE joueurs SET compte_lie = COALESCE(compte_lie, ?), utilise = datetime('now') WHERE id = ?").bind(ancien.compte_lie, cible.id));
  requetes.push(env.DB.prepare("DELETE FROM joueurs WHERE id = ?").bind(ancien.id));
  await env.DB.batch(requetes);
  return json({ ok: true, fusion: true }, 200, origine);
}


// ===================== Parties partagées (étapes B et C fusionnées, étape 1) =====================
// Un seul QR code « Rejoindre cette partie » : voir NOTES_comptes_utilisateurs.md, « Étapes B et C
// fusionnées : la partie partagée ». Le compteur du marqueur crée le partage (code de 4 lettres)
// et envoie l'état de la partie après chaque mène ; les autres joueurs ouvrent
// partie.html?code=…, choisissent leur place, et la partie arrive dans leurs parties quand le
// marqueur l'enregistre (synchroniserCopies). Pas de direct à cette étape : la page de l'ami relit
// le score quand on touche « Actualiser ». Tables : workers/comptes-partages.sql.
//
// Branchement dans le fetch du Worker :
//
//   if (request.method === "POST" && chemin === "/compte/partage") return await creerPartage(request, env, origine);
//   if (request.method === "POST" && chemin === "/compte/partage/etat") return await majPartage(request, env, origine);
//   if (request.method === "GET" && chemin === "/partage") return await lirePartage(request, env, origine);
//   if (request.method === "POST" && chemin === "/partage/rejoindre") return await rejoindrePartage(request, env, origine);
//
// Et dans supprimerCompte, dans le batch, avant l'effacement du compte :
//
//   env.DB.prepare("DELETE FROM partages WHERE compte_id = ?").bind(compte.id),
//   env.DB.prepare("DELETE FROM partage_joueurs WHERE compte_id = ?").bind(compte.id),
//
// Routes :
//   POST /compte/partage        { partie_id, etat }   crée le partage de la partie (ou le
//                               retrouve)                                -> { code, rejoints }
//   POST /compte/partage/etat   { code, etat }        score après une mène -> { ok, rejoints }
//   GET  /partage?code=K7P2     jeton facultatif      -> { code, marqueur, etat, rejoints, moi,
//                                                          marqueur_moi }
//                               moi : { equipe, nom, enregistree, retiree } si l'on a rejoint
//   POST /partage/rejoindre     { code, equipe, nom } nom : un des noms saisis par le marqueur,
//                               ou null pour une place libre             -> { ok }
//   etat : { objectif, format, mon_equipe, nom_a, nom_b, joueurs: { a, b }, menes: [{ e, p, t }], debut }
//   rejoints : [{ equipe, nom, pseudo }]
// Erreurs : 401 non_connecte ; 404 introuvable ; 400 etat_invalide, place_invalide, place_prise,
// marqueur ; 429 trop_de_partages.

const PARTAGES_PAR_JOUR = 40;
const DUREE_PARTAGE = "-7 days";   // un code sert encore 7 jours après la dernière mène
const LETTRES_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // sans O/0, I/1/L : se lit et se tape sans erreur
const UUID_PARTIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function codePartage() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), x => LETTRES_CODE[x % LETTRES_CODE.length]).join("");
}

function codeDemande(texte) {
  return String(texte || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

// État d'une partie en cours, envoyé par le compteur : mêmes règles que verifierPartie, sans
// exiger une partie finie. Le score est recalculé depuis les mènes.
function verifierEtatPartage(d) {
  if (!d || typeof d !== "object") return null;
  if (d.objectif !== 11 && d.objectif !== 13) return null;
  if (![1, 2, 3].includes(d.format)) return null;
  if (d.mon_equipe !== "a" && d.mon_equipe !== "b") return null;
  if (!Array.isArray(d.menes) || d.menes.length > 80) return null;
  let a = 0, b = 0;
  const menes = [];
  for (const m of d.menes) {
    if (!m || (m.e !== "a" && m.e !== "b") || !Number.isInteger(m.p) || m.p < 1 || m.p > 6) return null;
    if (a >= d.objectif || b >= d.objectif) return null;
    if (m.e === "a") a = Math.min(d.objectif, a + m.p); else b = Math.min(d.objectif, b + m.p);
    menes.push({ e: m.e, p: m.p, t: Number.isInteger(m.t) && m.t >= 0 && m.t <= 86400 ? m.t : 0 });
  }
  const joueurs = { a: [], b: [] };
  for (const equipe of ["a", "b"]) {
    const liste = (d.joueurs && Array.isArray(d.joueurs[equipe])) ? d.joueurs[equipe] : [];
    if (liste.length > d.format - (d.mon_equipe === equipe ? 1 : 0)) return null;
    for (const nom of liste) {
      const n = nomJoueurPropre(nom);
      if (!n) return null;
      if (!joueurs.a.concat(joueurs.b).some(x => cleNomJoueur(x) === cleNomJoueur(n))) joueurs[equipe].push(n);
    }
  }
  const nomA = d.nom_a ? nomJoueurPropre(d.nom_a) : null;
  const nomB = d.nom_b ? nomJoueurPropre(d.nom_b) : null;
  const debut = Number(d.debut);
  return {
    objectif: d.objectif, format: d.format, mon_equipe: d.mon_equipe, nom_a: nomA, nom_b: nomB,
    joueurs, menes, score_a: a, score_b: b, termine: a === d.objectif || b === d.objectif,
    debut: Number.isFinite(debut) && debut > 0 ? debut : null,
  };
}

// Joueurs qui ont rejoint la partie, dans l'ordre d'arrivée, avec leur pseudo
async function rejointsPartage(env, partieId) {
  const { results } = await env.DB.prepare(
    "SELECT pj.compte_id, pj.equipe, pj.nom, pj.copie, c.pseudo FROM partage_joueurs pj"
    + " LEFT JOIN comptes c ON c.id = pj.compte_id WHERE pj.partie_id = ? ORDER BY pj.rejoint, pj.rowid"
  ).bind(partieId).all();
  return results;
}

// Ce qui est montré aux autres : jamais les identifiants de compte
function rejointsPublics(liste) {
  return liste.map(r => ({ equipe: r.equipe, nom: r.nom || null, pseudo: r.pseudo || null }));
}

async function partageActif(env, code) {
  return await env.DB.prepare(
    "SELECT code, partie_id, compte_id, etat, maj FROM partages WHERE code = ? AND maj > datetime('now', ?)"
  ).bind(code, DUREE_PARTAGE).first();
}

async function creerPartage(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const d = await lireJson(request);
  const etat = verifierEtatPartage(d.etat);
  if (typeof d.partie_id !== "string" || !UUID_PARTIE.test(d.partie_id) || !etat) return json({ erreur: "etat_invalide" }, 400, origine);

  // Partie déjà partagée (le compteur a été rechargé) : même code
  const existant = await env.DB.prepare("SELECT code, compte_id FROM partages WHERE partie_id = ?").bind(d.partie_id).first();
  if (existant) {
    if (existant.compte_id !== compte.id) return json({ erreur: "etat_invalide" }, 400, origine);
    await env.DB.prepare("UPDATE partages SET etat = ?, maj = datetime('now') WHERE code = ?").bind(JSON.stringify(etat), existant.code).run();
    return json({ code: existant.code, rejoints: rejointsPublics(await rejointsPartage(env, d.partie_id)) }, 200, origine);
  }

  // Les codes expirés sont libérés ; les places prises (partage_joueurs) restent, pour les copies
  await env.DB.prepare("DELETE FROM partages WHERE maj < datetime('now', ?)").bind(DUREE_PARTAGE).run();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM partages WHERE compte_id = ? AND cree > datetime('now', '-1 day')")
    .bind(compte.id).first();
  if (n && n.n >= PARTAGES_PAR_JOUR) return json({ erreur: "trop_de_partages" }, 429, origine);

  for (let essai = 0; essai < 12; essai++) {
    const code = codePartage();
    if (await env.DB.prepare("SELECT 1 AS pris FROM partages WHERE code = ?").bind(code).first()) continue;
    await env.DB.prepare("INSERT INTO partages (code, partie_id, compte_id, etat) VALUES (?, ?, ?, ?)")
      .bind(code, d.partie_id, compte.id, JSON.stringify(etat)).run();
    return json({ code, rejoints: [] }, 200, origine);
  }
  return json({ erreur: "code_indisponible" }, 503, origine);
}

// Score après une mène (ou équipes changées) ; la réponse dit qui a rejoint entre-temps
async function majPartage(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const d = await lireJson(request);
  const etat = verifierEtatPartage(d.etat);
  if (!etat) return json({ erreur: "etat_invalide" }, 400, origine);
  const p = await env.DB.prepare("SELECT code, partie_id FROM partages WHERE code = ? AND compte_id = ?")
    .bind(codeDemande(d.code), compte.id).first();
  if (!p) return json({ erreur: "introuvable" }, 404, origine);
  await env.DB.prepare("UPDATE partages SET etat = ?, maj = datetime('now') WHERE code = ?").bind(JSON.stringify(etat), p.code).run();
  return json({ ok: true, rejoints: rejointsPublics(await rejointsPartage(env, p.partie_id)) }, 200, origine);
}

// Page de l'ami (partie.html) : la partie, qui a rejoint, et sa propre place s'il est connecté
async function lirePartage(request, env, origine) {
  const code = codeDemande(new URL(request.url).searchParams.get("code"));
  const p = code ? await partageActif(env, code) : null;
  if (!p) return json({ erreur: "introuvable" }, 404, origine);
  const compte = await compteDepuisRequete(request, env);
  const marqueur = await env.DB.prepare("SELECT pseudo FROM comptes WHERE id = ?").bind(p.compte_id).first();
  const rejoints = await rejointsPartage(env, p.partie_id);
  let moi = null;
  const r = compte ? rejoints.find(x => x.compte_id === compte.id) : null;
  if (r) {
    const copie = r.copie ? await env.DB.prepare("SELECT id FROM parties WHERE id = ? AND compte_id = ?").bind(r.copie, compte.id).first() : null;
    moi = { equipe: r.equipe, nom: r.nom || null, enregistree: !!copie, retiree: !!r.copie && !copie };
  }
  return json({
    code: p.code, marqueur: marqueur ? marqueur.pseudo : null, etat: JSON.parse(p.etat),
    rejoints: rejointsPublics(rejoints), moi, marqueur_moi: !!compte && compte.id === p.compte_id, maj: p.maj,
  }, 200, origine);
}

// Rejoindre : choisir un des noms saisis par le marqueur, ou une place libre de l'équipe.
// Scanner vaut accord : la partie arrive dans ses parties, sans autre question.
async function rejoindrePartage(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const d = await lireJson(request);
  const p = await partageActif(env, codeDemande(d.code));
  if (!p) return json({ erreur: "introuvable" }, 404, origine);
  if (p.compte_id === compte.id) return json({ erreur: "marqueur" }, 400, origine);
  if (d.equipe !== "a" && d.equipe !== "b") return json({ erreur: "place_invalide" }, 400, origine);
  const etat = JSON.parse(p.etat);
  const autres = (await rejointsPartage(env, p.partie_id)).filter(r => r.compte_id !== compte.id);

  // Un nom saisi est pris par qui l'a choisi, ou par qui est venu sur une place libre sous ce
  // pseudo (le compteur du marqueur l'ajoute alors à l'équipe)
  const saisis = etat.joueurs[d.equipe] || [];
  const nomPris = n => autres.some(r => cleNomJoueur(r.nom || r.pseudo || "") === cleNomJoueur(n));
  let nom = null;
  if (d.nom !== null && d.nom !== undefined) {
    nom = typeof d.nom === "string" ? saisis.find(x => cleNomJoueur(x) === cleNomJoueur(d.nom)) : null;
    if (!nom) return json({ erreur: "place_invalide" }, 400, origine);
    if (nomPris(nom)) return json({ erreur: "place_prise" }, 400, origine);
  } else {
    const occupees = saisis.length + (etat.mon_equipe === d.equipe ? 1 : 0)
      + autres.filter(r => !r.nom && r.equipe === d.equipe && !saisis.some(x => cleNomJoueur(x) === cleNomJoueur(r.pseudo || ""))).length;
    if (occupees >= etat.format) return json({ erreur: "place_prise" }, 400, origine);
  }

  await env.DB.prepare(
    "INSERT INTO partage_joueurs (partie_id, compte_id, equipe, nom) VALUES (?, ?, ?, ?)"
    + " ON CONFLICT(partie_id, compte_id) DO UPDATE SET equipe = excluded.equipe, nom = excluded.nom"
  ).bind(p.partie_id, compte.id, d.equipe, nom).run();
  // Partie déjà enregistrée par le marqueur (scannée après la fin) : la copie arrive tout de suite
  await synchroniserCopies(env, p.partie_id);
  return json({ ok: true }, 200, origine);
}

// Partie du marqueur enregistrée (ou corrigée) : chaque joueur qui l'a rejointe en reçoit une
// copie, vue de son côté (son équipe, ses partenaires, ses adversaires), dans ses parties.
//   - un joueur venu sur une place libre entre dans la partie du marqueur sous son pseudo ;
//   - chaque carnet relie les noms aux comptes des joueurs qui ont rejoint (joueurs.compte_lie) ;
//   - une copie retirée par son joueur ne revient pas.
async function synchroniserCopies(env, partieId) {
  const p = await env.DB.prepare(
    "SELECT id, compte_id, debut, fin, objectif, format, mon_equipe, score_a, score_b, nom_a, nom_b, joueurs, menes, terrain"
    + " FROM parties WHERE id = ? AND origine IS NULL"
  ).bind(partieId).first();
  if (!p) return;
  const rejoints = await rejointsPartage(env, partieId);
  if (!rejoints.length) return;

  const marqueur = await env.DB.prepare("SELECT pseudo FROM comptes WHERE id = ?").bind(p.compte_id).first();
  const pseudoMarqueur = marqueur && marqueur.pseudo ? marqueur.pseudo : null;
  const { results: carnet } = await env.DB.prepare("SELECT id, nom FROM joueurs WHERE compte_id = ?").bind(p.compte_id).all();
  const nomDe = {};
  carnet.forEach(j => { nomDe[j.id] = j.nom; });
  const ids = JSON.parse(p.joueurs || "{}");
  const noms = { a: (ids.a || []).map(i => nomDe[i]).filter(Boolean), b: (ids.b || []).map(i => nomDe[i]).filter(Boolean) };
  const nomDans = r => r.nom || r.pseudo;   // nom du joueur dans la partie du marqueur
  const lots = [];

  // 1. Places libres : le pseudo du joueur entre dans la partie du marqueur, s'il reste de la place
  let ajout = false;
  for (const r of rejoints) {
    const n = nomDans(r);
    if (!n || noms.a.concat(noms.b).some(x => cleNomJoueur(x) === cleNomJoueur(n))) continue;
    if (noms[r.equipe].length < p.format - (p.mon_equipe === r.equipe ? 1 : 0)) { noms[r.equipe].push(n); ajout = true; }
  }
  if (ajout) {
    const nouveaux = await idsCarnetParties(env, p.compte_id, noms.a.concat(noms.b));
    lots.push(env.DB.prepare("UPDATE parties SET joueurs = ? WHERE id = ?").bind(JSON.stringify({
      a: noms.a.map(n => nouveaux[cleNomJoueur(n)]), b: noms.b.map(n => nouveaux[cleNomJoueur(n)]),
    }), p.id));
  }

  // 2. Carnet du marqueur : chaque nom relié au compte de qui a pris la place
  const relier = (titulaire, nom, compteLie) => env.DB.prepare(
    "UPDATE joueurs SET compte_lie = COALESCE(compte_lie, ?) WHERE compte_id = ? AND cle = ?"
  ).bind(compteLie, titulaire, cleNomJoueur(nom));
  rejoints.forEach(r => { if (nomDans(r)) lots.push(relier(p.compte_id, nomDans(r), r.compte_id)); });

  // 3. Une copie par joueur
  for (const r of rejoints) {
    let copieId = r.copie;
    if (copieId) {
      const existe = await env.DB.prepare("SELECT id FROM parties WHERE id = ? AND compte_id = ?").bind(copieId, r.compte_id).first();
      if (!existe) continue;   // retirée par le joueur : on ne la remet pas
    } else {
      copieId = crypto.randomUUID();
    }
    const moi = nomDans(r);
    const vue = {};
    for (const e of ["a", "b"]) {
      let liste = (e === p.mon_equipe && pseudoMarqueur ? [pseudoMarqueur] : []).concat(noms[e]);
      if (e === r.equipe && moi) {
        const i = liste.findIndex(x => cleNomJoueur(x) === cleNomJoueur(moi));
        if (i >= 0) liste.splice(i, 1);
      }
      liste = liste.filter((x, i, t) => t.findIndex(y => cleNomJoueur(y) === cleNomJoueur(x)) === i);
      vue[e] = liste.slice(0, p.format - (e === r.equipe ? 1 : 0));
    }
    const sesIds = await idsCarnetParties(env, r.compte_id, vue.a.concat(vue.b));
    const victoire = (r.equipe === "a" ? p.score_a : p.score_b) === p.objectif ? 1 : 0;
    lots.push(env.DB.prepare(
      "INSERT INTO parties (id, compte_id, debut, fin, objectif, format, mon_equipe, score_a, score_b, victoire, nom_a, nom_b, joueurs, menes, terrain, origine)"
      + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      + " ON CONFLICT(id) DO UPDATE SET debut = excluded.debut, fin = excluded.fin, objectif = excluded.objectif, format = excluded.format,"
      + " mon_equipe = excluded.mon_equipe, score_a = excluded.score_a, score_b = excluded.score_b, victoire = excluded.victoire,"
      + " nom_a = excluded.nom_a, nom_b = excluded.nom_b, joueurs = excluded.joueurs, menes = excluded.menes, terrain = excluded.terrain,"
      + " maj = datetime('now') WHERE parties.compte_id = excluded.compte_id"
    ).bind(copieId, r.compte_id, p.debut, p.fin, p.objectif, p.format, r.equipe, p.score_a, p.score_b, victoire, p.nom_a, p.nom_b,
      JSON.stringify({ a: vue.a.map(n => sesIds[cleNomJoueur(n)]), b: vue.b.map(n => sesIds[cleNomJoueur(n)]) }), p.menes, p.terrain, p.id));
    if (!r.copie) lots.push(env.DB.prepare("UPDATE partage_joueurs SET copie = ? WHERE partie_id = ? AND compte_id = ?").bind(copieId, p.id, r.compte_id));
    // Son carnet : le marqueur et les autres joueurs qui ont rejoint, reliés à leur compte
    if (pseudoMarqueur) lots.push(relier(r.compte_id, pseudoMarqueur, p.compte_id));
    rejoints.forEach(autre => { if (autre.compte_id !== r.compte_id && nomDans(autre)) lots.push(relier(r.compte_id, nomDans(autre), autre.compte_id)); });
  }
  if (lots.length) await env.DB.batch(lots);
}
