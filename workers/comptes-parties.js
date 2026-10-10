// ===================== Worker mapetanque-comptes : parties =====================
// Routes de l'étape 2 des comptes (enregistrement des parties du compteur), à coller dans le
// Worker « mapetanque-comptes » du tableau de bord Cloudflare. Voir NOTES_comptes_utilisateurs.md,
// « Étape 2 — enregistrement des parties ».
//
// Ce fichier n'est pas exécuté par le site : c'est la référence du code à mettre dans le Worker
// (le reste de son code n'est que dans le tableau de bord). Il est autonome : il ne dépend
// d'aucune fonction du Worker existant (session, CORS, réponses JSON), pour pouvoir être collé
// tel quel à la fin du fichier.
//
// Branchement, en tête du fetch du Worker, avant ses propres routes :
//
//     const reponseParties = await routesParties(request, env);
//     if (reponseParties) return reponseParties;
//
// Et dans la route /compte/supprimer, avant d'effacer la ligne `comptes` :
//
//     await env.DB.batch([
//         env.DB.prepare('DELETE FROM parties WHERE compte_id = ?').bind(compteId),
//         env.DB.prepare('DELETE FROM joueurs WHERE compte_id = ?').bind(compteId)
//     ]);
//
// Tables : workers/comptes-parties.sql, à coller dans la console D1 de la base mapetanque-notes.
//
// Routes (en-tête Authorization: Bearer <jeton de session>, réponses JSON) :
//
//   POST /compte/parties           partie terminée (voir verifierPartie)   -> { ok, id }
//   POST /compte/parties/retirer   { id }                                   -> { ok }
//   GET  /compte/parties           toutes les parties du compte, de la plus récente à la plus
//                                  ancienne, noms des joueurs compris        -> { parties: [...] }
//   GET  /compte/joueurs           carnet, du plus récemment utilisé au plus ancien
//                                                                            -> { joueurs: [{ nom }] }
//
// Erreurs : 401 { erreur: 'session' } ; 400 { erreur: 'partie_invalide', detail } ;
// 429 { erreur: 'trop_de_parties' } (plus de PARTIES_PAR_JOUR enregistrées en 24 h).

const ORIGINES_PARTIES = ['https://mapetanque.be', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501'];
const PARTIES_PAR_JOUR = 40;        // largement au-dessus d'une vraie journée de jeu
const DUREE_MIN_PARTIE = 5 * 60;    // secondes : en dessous, c'est un essai du compteur
const MENES_MIN_PARTIE = 3;
const LONGUEUR_NOM_JOUEUR = 20;

async function routesParties(request, env) {
    const url = new URL(request.url);
    const chemins = ['/compte/parties', '/compte/parties/retirer', '/compte/joueurs'];
    if (!chemins.includes(url.pathname)) return null;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetesParties(request) });

    const compteId = await compteSessionParties(request, env);
    if (!compteId) return jsonParties(request, { erreur: 'session' }, 401);

    try {
        if (url.pathname === '/compte/parties' && request.method === 'POST') return await enregistrerPartie(request, env, compteId);
        if (url.pathname === '/compte/parties/retirer' && request.method === 'POST') return await retirerPartie(request, env, compteId);
        if (url.pathname === '/compte/parties' && request.method === 'GET') return await listerParties(request, env, compteId);
        if (url.pathname === '/compte/joueurs' && request.method === 'GET') return await listerJoueurs(request, env, compteId);
    } catch (e) {
        return jsonParties(request, { erreur: 'serveur' }, 500);
    }
    return jsonParties(request, { erreur: 'methode' }, 405);
}

function entetesParties(request) {
    const origine = request.headers.get('Origin');
    return {
        'Access-Control-Allow-Origin': ORIGINES_PARTIES.includes(origine) ? origine : ORIGINES_PARTIES[0],
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function jsonParties(request, donnees, statut) {
    const entetes = entetesParties(request);
    entetes['Content-Type'] = 'application/json; charset=utf-8';
    entetes['Cache-Control'] = 'no-store';
    return new Response(JSON.stringify(donnees), { status: statut || 200, headers: entetes });
}

// Même règle que les autres routes du compte : seule l'empreinte SHA-256 du jeton est en base.
async function compteSessionParties(request, env) {
    const entete = request.headers.get('Authorization') || '';
    const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : '';
    if (!jeton) return null;
    const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton));
    const empreinte = [...new Uint8Array(octets)].map(o => o.toString(16).padStart(2, '0')).join('');
    const ligne = await env.DB.prepare("SELECT compte_id FROM sessions WHERE empreinte = ? AND expire > datetime('now')")
        .bind(empreinte).first();
    return ligne ? ligne.compte_id : null;
}

// « 2026-10-10T14:03:00.000Z » -> « 2026-10-10 14:03:00 », le format des autres tables
function dateBaseParties(ms) {
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

// Même normalisation que pseudo_cle : sans accents, sans majuscules, espaces simples
function cleNomJoueur(nom) {
    return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function nomJoueurPropre(nom) {
    if (typeof nom !== 'string') return null;
    const n = nom.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
    return n && n.length <= LONGUEUR_NOM_JOUEUR ? n : null;
}

// Vérifie la partie envoyée par le compteur et la ramène à ce qui sera enregistré. Le score est
// recalculé depuis les mènes : la partie doit être allée à son terme (objectif atteint), et
// avoir duré au moins 3 mènes et 5 minutes, comme côté compteur.
//   { id, debut (ms), objectif, format, mon_equipe, nom_a, nom_b, joueurs: { a: [noms], b: [noms] },
//     menes: [{ e: 'a'|'b', p: 1..6, t: secondes depuis debut }], terrain }
function verifierPartie(d) {
    const erreur = detail => ({ erreur: detail });
    if (!d || typeof d !== 'object') return erreur('corps');
    if (typeof d.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d.id)) return erreur('id');
    if (d.objectif !== 11 && d.objectif !== 13) return erreur('objectif');
    if (![1, 2, 3].includes(d.format)) return erreur('format');
    if (d.mon_equipe !== 'a' && d.mon_equipe !== 'b') return erreur('mon_equipe');

    const maintenant = Date.now();
    const debut = Number(d.debut);
    if (!Number.isFinite(debut) || debut > maintenant + 10 * 60000 || debut < maintenant - 30 * 86400000) return erreur('debut');

    if (!Array.isArray(d.menes) || d.menes.length < MENES_MIN_PARTIE || d.menes.length > 80) return erreur('menes');
    // 6 points au plus par mène, quel que soit le format : on peut changer de format en fin de
    // partie (le compteur limite les pastilles à +3 en tête-à-tête, mais pas les mènes déjà jouées).
    let a = 0, b = 0, avant = -1;
    const menes = [];
    for (const m of d.menes) {
        if (!m || (m.e !== 'a' && m.e !== 'b')) return erreur('menes');
        if (!Number.isInteger(m.p) || m.p < 1 || m.p > 6) return erreur('menes');
        if (!Number.isInteger(m.t) || m.t < avant || m.t > 86400) return erreur('menes');
        if (a >= d.objectif || b >= d.objectif) return erreur('menes');   // mène après la fin
        if (m.e === 'a') a = Math.min(d.objectif, a + m.p); else b = Math.min(d.objectif, b + m.p);
        avant = m.t;
        menes.push({ e: m.e, p: m.p, t: m.t });
    }
    if (a !== d.objectif && b !== d.objectif) return erreur('pas_finie');
    const duree = menes[menes.length - 1].t - menes[0].t;
    if (duree < DUREE_MIN_PARTIE) return erreur('trop_courte');

    const joueurs = { a: [], b: [] };
    for (const equipe of ['a', 'b']) {
        const liste = (d.joueurs && Array.isArray(d.joueurs[equipe])) ? d.joueurs[equipe] : [];
        const places = d.format - (d.mon_equipe === equipe ? 1 : 0);
        if (liste.length > places) return erreur('joueurs');
        for (const nom of liste) {
            const n = nomJoueurPropre(nom);
            if (!n) return erreur('joueurs');
            if (!joueurs.a.concat(joueurs.b).some(x => cleNomJoueur(x) === cleNomJoueur(n))) joueurs[equipe].push(n);
        }
    }
    const nomA = d.nom_a ? nomJoueurPropre(d.nom_a) : null;
    const nomB = d.nom_b ? nomJoueurPropre(d.nom_b) : null;
    if ((d.nom_a && !nomA) || (d.nom_b && !nomB)) return erreur('noms');
    const terrain = typeof d.terrain === 'string' && /^(node|way|relation)\/\d{1,15}$/.test(d.terrain) ? d.terrain : null;

    return {
        partie: {
            id: d.id, debut: dateBaseParties(debut + menes[0].t * 1000), fin: dateBaseParties(debut + menes[menes.length - 1].t * 1000),
            objectif: d.objectif, format: d.format, mon_equipe: d.mon_equipe, score_a: a, score_b: b,
            victoire: (d.mon_equipe === 'a' ? a : b) === d.objectif ? 1 : 0,
            nom_a: nomA, nom_b: nomB, joueurs, menes, terrain
        }
    };
}

async function enregistrerPartie(request, env, compteId) {
    const corps = await request.json().catch(() => null);
    const v = verifierPartie(corps);
    if (v.erreur) return jsonParties(request, { erreur: 'partie_invalide', detail: v.erreur }, 400);
    const p = v.partie;

    // Limite par jour, sauf pour remplacer une partie déjà enregistrée
    const existe = await env.DB.prepare('SELECT compte_id FROM parties WHERE id = ?').bind(p.id).first();
    if (existe && existe.compte_id !== compteId) return jsonParties(request, { erreur: 'partie_invalide', detail: 'id' }, 400);
    if (!existe) {
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM parties WHERE compte_id = ? AND cree > datetime('now', '-1 day')")
            .bind(compteId).first();
        if (n && n.n >= PARTIES_PAR_JOUR) return jsonParties(request, { erreur: 'trop_de_parties' }, 429);
    }

    // Carnet : un joueur par nom (sans tenir compte des majuscules ni des accents), créé au besoin
    const noms = p.joueurs.a.concat(p.joueurs.b);
    const ids = {};
    if (noms.length) {
        await env.DB.batch(noms.map(nom => env.DB.prepare(
            "INSERT INTO joueurs (id, compte_id, nom, cle) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(compte_id, cle) DO UPDATE SET utilise = datetime('now')"
        ).bind(crypto.randomUUID(), compteId, nom, cleNomJoueur(nom))));
        const cles = noms.map(cleNomJoueur);
        const lignes = await env.DB.prepare('SELECT id, cle FROM joueurs WHERE compte_id = ? AND cle IN (' + cles.map(() => '?').join(',') + ')')
            .bind(compteId, ...cles).all();
        (lignes.results || []).forEach(l => { ids[l.cle] = l.id; });
    }
    const joueurs = { a: p.joueurs.a.map(n => ids[cleNomJoueur(n)]), b: p.joueurs.b.map(n => ids[cleNomJoueur(n)]) };

    await env.DB.prepare(
        'INSERT INTO parties (id, compte_id, debut, fin, objectif, format, mon_equipe, score_a, score_b, victoire, nom_a, nom_b, joueurs, menes, terrain) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        "ON CONFLICT(id) DO UPDATE SET debut = excluded.debut, fin = excluded.fin, objectif = excluded.objectif, format = excluded.format, " +
        'mon_equipe = excluded.mon_equipe, score_a = excluded.score_a, score_b = excluded.score_b, victoire = excluded.victoire, ' +
        'nom_a = excluded.nom_a, nom_b = excluded.nom_b, joueurs = excluded.joueurs, menes = excluded.menes, terrain = excluded.terrain, ' +
        "maj = datetime('now') WHERE parties.compte_id = excluded.compte_id"
    ).bind(p.id, compteId, p.debut, p.fin, p.objectif, p.format, p.mon_equipe, p.score_a, p.score_b, p.victoire,
        p.nom_a, p.nom_b, JSON.stringify(joueurs), JSON.stringify(p.menes), p.terrain).run();

    return jsonParties(request, { ok: true, id: p.id });
}

async function retirerPartie(request, env, compteId) {
    const corps = await request.json().catch(() => null);
    const id = corps && typeof corps.id === 'string' ? corps.id : '';
    await env.DB.prepare('DELETE FROM parties WHERE id = ? AND compte_id = ?').bind(id, compteId).run();
    return jsonParties(request, { ok: true });
}

async function listerParties(request, env, compteId) {
    const [parties, joueurs] = await env.DB.batch([
        env.DB.prepare('SELECT id, debut, fin, objectif, format, mon_equipe, score_a, score_b, victoire, nom_a, nom_b, joueurs, menes, terrain ' +
            'FROM parties WHERE compte_id = ? ORDER BY fin DESC').bind(compteId),
        env.DB.prepare('SELECT id, nom FROM joueurs WHERE compte_id = ?').bind(compteId)
    ]);
    const noms = {};
    (joueurs.results || []).forEach(j => { noms[j.id] = j.nom; });
    const liste = (parties.results || []).map(p => {
        const j = JSON.parse(p.joueurs || '{}');
        p.joueurs = { a: (j.a || []).map(id => noms[id]).filter(Boolean), b: (j.b || []).map(id => noms[id]).filter(Boolean) };
        p.menes = JSON.parse(p.menes || '[]');
        return p;
    });
    return jsonParties(request, { parties: liste });
}

async function listerJoueurs(request, env, compteId) {
    const r = await env.DB.prepare('SELECT nom FROM joueurs WHERE compte_id = ? ORDER BY utilise DESC LIMIT 60').bind(compteId).all();
    return jsonParties(request, { joueurs: (r.results || []).map(j => ({ nom: j.nom })) });
}
