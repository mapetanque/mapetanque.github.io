// ===================== Comptes des visiteurs (onglet « Utilisateurs » de admin.html) =====================
// Section du Worker « mapetanque-admin », collée dans son code dans le tableau de bord Cloudflare,
// juste après la ligne  __name(statsVisites, "statsVisites");
// La table `comptes` est dans la même base D1 que le reste : pas besoin du Worker des comptes.
//
// Ce fichier n'est pas exécuté par le site : c'est la référence de cette partie du Worker (le reste
// de son code n'est que dans le tableau de bord). Il utilise reponseJson() et TABLE_VOTES du Worker.
//
// Routes, à brancher dans fetch() avec les autres routes /admin/ (après la vérification de session),
// juste avant la ligne  if (url.pathname === "/admin/stats/visites" && request.method === "GET") {
//
//   if (url.pathname === "/admin/comptes" && request.method === "GET") { return await listerComptes(env, origine); } if (url.pathname === "/admin/comptes/detail" && request.method === "GET") { return await detailCompte(request, env, origine); } if (url.pathname === "/admin/comptes/supprimer" && request.method === "POST") { return await supprimerCompteAdmin(request, env, origine); }

var FORMAT_COMPTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Liste des comptes, du plus récent au plus ancien, avec le nombre d'envois et de parties de chacun
// (sous-requêtes sur les index compte_id), et les inscriptions par semaine (lundi de la semaine).
// Les avis remplacés ne comptent pas : ils ne sont plus visibles nulle part.
async function listerComptes(env, origine) {
  const [comptes, semaines] = await env.DB.batch([
    env.DB.prepare(`
            SELECT c.id, c.email, c.pseudo, c.langue, c.cree, c.derniere_connexion,
                   (SELECT COUNT(*) FROM ${TABLE_VOTES} WHERE compte_id = c.id) AS votes,
                   (SELECT COUNT(*) FROM avis WHERE compte_id = c.id AND statut != 'remplace') AS avis,
                   (SELECT COUNT(*) FROM photos WHERE compte_id = c.id) AS photos,
                   (SELECT COUNT(*) FROM signalements WHERE compte_id = c.id) AS signalements,
                   (SELECT COUNT(*) FROM parties WHERE compte_id = c.id) AS parties
              FROM comptes c
             ORDER BY c.cree DESC`),
    env.DB.prepare(`
            SELECT date(cree, '-6 days', 'weekday 1') AS semaine, COUNT(*) AS comptes
              FROM comptes
             WHERE cree >= date('now', '-190 days')
             GROUP BY semaine ORDER BY semaine`)
  ]);
  return reponseJson({ comptes: comptes.results, par_semaine: semaines.results }, origine);
}
__name(listerComptes, "listerComptes");

// Fiche d'un compte : ses envois avec leur statut, ses parties (nombre et dernière) et le nombre
// d'appareils encore connectés.
async function detailCompte(request, env, origine) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!FORMAT_COMPTE.test(id)) {
    return reponseJson({ erreur: "id invalide" }, origine, 400);
  }
  const [compte, votes, avis, photos, signalements, parties, sessions] = await env.DB.batch([
    env.DB.prepare("SELECT id, email, pseudo, langue, cree, derniere_connexion FROM comptes WHERE id = ?1").bind(id),
    env.DB.prepare(`SELECT osm_id, note, date FROM ${TABLE_VOTES} WHERE compte_id = ?1 ORDER BY date DESC`).bind(id),
    env.DB.prepare("SELECT id, osm_id, texte, statut, cree FROM avis WHERE compte_id = ?1 AND statut != 'remplace' ORDER BY cree DESC").bind(id),
    env.DB.prepare("SELECT id, osm_id, statut, cree FROM photos WHERE compte_id = ?1 ORDER BY cree DESC").bind(id),
    env.DB.prepare("SELECT id, type, osm_id, titre, statut, cree FROM signalements WHERE compte_id = ?1 ORDER BY cree DESC").bind(id),
    env.DB.prepare("SELECT COUNT(*) AS nombre, MAX(fin) AS derniere FROM parties WHERE compte_id = ?1").bind(id),
    env.DB.prepare("SELECT COUNT(*) AS nombre FROM sessions WHERE compte_id = ?1 AND expire > datetime('now')").bind(id)
  ]);
  if (!compte.results.length) {
    return reponseJson({ erreur: "compte introuvable" }, origine, 404);
  }
  return reponseJson({
    compte: compte.results[0],
    votes: votes.results,
    avis: avis.results,
    photos: photos.results,
    signalements: signalements.results,
    parties: parties.results[0],
    appareils: sessions.results[0].nombre
  }, origine);
}
__name(detailCompte, "detailCompte");

// Suppression d'un compte depuis l'admin : exactement la même que « Supprimer mon compte »
// (supprimerCompte du Worker mapetanque-comptes), tout ou rien. GARDER LES DEUX IDENTIQUES : une
// table ajoutée aux comptes doit l'être ici aussi. Les contributions restent mais deviennent
// vraiment anonymes (avis sans pseudo, auteur remplacé, photos sans crédit, signalements sans
// adresse) ; le compte, ses parties, son carnet, ses parties partagées, ses sessions et ses demandes
// de connexion sont effacés ; son pseudo redevient libre.
async function supprimerCompteAdmin(request, env, origine) {
  let corps;
  try {
    corps = await request.json();
  } catch (e) {
    return reponseJson({ erreur: "corps illisible" }, origine, 400);
  }
  const id = String(corps.id || "");
  if (!FORMAT_COMPTE.test(id)) {
    return reponseJson({ erreur: "id invalide" }, origine, 400);
  }
  if (corps.confirmation !== true) {
    return reponseJson({ erreur: "confirmation manquante" }, origine, 400);
  }
  const compte = await env.DB.prepare("SELECT id, email FROM comptes WHERE id = ?1").bind(id).first();
  if (!compte) {
    return reponseJson({ erreur: "compte introuvable" }, origine, 404);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE avis SET pseudo = NULL, auteur = 'anonyme:' || lower(hex(randomblob(8))), compte_id = NULL WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("UPDATE photos SET credit_nom = NULL, compte_id = NULL WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("UPDATE signalements SET email = NULL, compte_id = NULL WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("UPDATE votes SET compte_id = NULL WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM parties WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM joueurs WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM partages WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM partage_joueurs WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM sessions WHERE compte_id = ?").bind(compte.id),
    env.DB.prepare("DELETE FROM liens_connexion WHERE email = ?").bind(compte.email),
    env.DB.prepare("DELETE FROM comptes WHERE id = ?").bind(compte.id)
  ]);
  return reponseJson({ ok: true }, origine);
}
__name(supprimerCompteAdmin, "supprimerCompteAdmin");
