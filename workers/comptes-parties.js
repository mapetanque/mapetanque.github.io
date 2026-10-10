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

  return json({ ok: true, id: p.id }, 200, origine);
}

async function retirerPartie(request, env, origine) {
  const compte = await compteDepuisRequete(request, env);
  if (!compte) return json({ erreur: "non_connecte" }, 401, origine);
  const corps = await lireJson(request);
  const id = typeof corps.id === "string" ? corps.id : "";
  await env.DB.prepare("DELETE FROM parties WHERE id = ? AND compte_id = ?").bind(id, compte.id).run();
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
