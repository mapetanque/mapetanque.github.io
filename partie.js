// ===================== Page Partie en ligne =====================
// partie.html (et ses versions nl/, de/, en/), générée par scripts/generer_partie.py. La partie
// commune des connectés : une seule partie, vue par chaque inscrit de son côté, créée, rejointe,
// marquée et suivie sur le même écran par tous (NOTES_parties_communes.md du dépôt privé des
// Workers ; maquette validée le 18/10/2026 : maquettes/parties-communes/, onglet « Partie en ligne »).
//   - sans compte : aucun accès, même pas pour suivre le score ; la connexion, puis retour ici ;
//   - sans paramètre : la partie en cours sur ce téléphone, sinon « Nouvelle partie » (format, 11
//     ou 13, terrain facultatif ; le code se tape dans « Rejoindre une partie ») ; ?nouvelle=1
//     mène toujours à la création ;
//     ?rejoindre=1 (menu « Rejoindre une partie », lien sous le compteur) : le champ du code d'abord ;
//   - ?code=K7P2 (QR code, lien, code tapé) : « Rejoindre une équipe » ou « Je regarde
//     seulement » ; déjà inscrit, la partie ;
//   - une seule partie en cours à la fois comme joueur : déjà joueur dans une partie pas finie
//     (moins de 24 h), la création et les équipes à rejoindre cèdent la place à « Vous avez déjà
//     une partie en cours » (Reprendre, Abandonner) ;
//   - ?id=… : une partie où l'on a une place (l'adresse passe à l'id une fois inscrit) ;
//   - la partie : celui qui a la main touche les moitiés (+1, pastilles +2 à +6), les autres ont
//     « Prendre la main ». Les mènes tapées sans réseau attendent dans le téléphone et partent au
//     retour du réseau avec le nombre de mènes que l'on voyait ; si quelqu'un a pris la main
//     entre-temps, le Worker les refuse et la page le dit ;
//   - la victoire : la partie est déjà dans les historiques ; revanche, nouvelle partie,
//     « Annuler le dernier point » (5 minutes au plus).
// Routes /parties/… du Worker des comptes (section « Parties communes » de comptes/src/worker.js).
// Direct : le Worker mapetanque-direct envoie { type: "partie", maj } à chaque modification ; la
// page relit alors la partie (le message ne contient ni score ni pseudo).
//
// Chargé après script.js (t, currentLang, echapperAvis, translations) et compte.js
// (window.mapetanqueCompte).
(function () {
    var zone = document.getElementById('partie');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;

    var langue = currentLang;
    var prefixe = langue === 'fr' ? '/' : '/' + langue + '/';
    var locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[langue] || 'fr-BE';
    var URL_DIRECT = 'wss://mapetanque-direct.mapetanque.workers.dev';
    var PING = 30000;                 // ms : garde la connexion du direct ouverte
    var RELECTURE = 15000;            // ms : sans direct, la partie est relue toutes les 15 s
    var RELECTURE_DIRECT = 60000;     // ms : avec le direct aussi, au cas où un message se perdrait
    var RENVOI = 8000;                // ms : mènes en attente du réseau, nouvel essai
    var CLE_EN_COURS = 'mapetanque_partie_en_cours';   // { id, quand } : la partie à rouvrir ici
    var CLE_ATTENTE = 'mapetanque_menes_attente';      // { id, n, menes: [{ e, p, quand }] }
    var DUREE_EN_COURS = 12 * 3600000;                 // ms : une partie laissée plus longtemps n'est plus rouverte d'office
    var RAYON_PROPOSE = 500;          // m : terrain proposé d'office à la création
    var RAYON_LISTE = 5000;           // m : « Terrains proches »
    var QR_LIB = '/lib/qrcode-generator-1.4.4/qrcode.js';

    var parametres = new URLSearchParams(window.location.search);
    var idDemande = /^[0-9a-f-]{36}$/.test(parametres.get('id') || '') ? parametres.get('id') : '';
    var codeDemande = nettoyerCode(parametres.get('code'));
    var arriveeRevanche = parametres.has('revanche');
    var modeRejoindre = parametres.has('rejoindre');   // menu « Rejoindre une partie » : le code d'abord

    // Arrivée depuis l'espace des clubs (« + » de Mes parties) : ?retour=<adresse de Mes parties>.
    // Gardée pour cet onglet (sessionStorage), car l'adresse de la page change pendant la partie
    // (?id=, ?code=, revanche, nouvelle partie). Elle ajoute « Retour à Mes parties » au-dessus de
    // la partie, et « Voir mes parties » de la victoire mène à l'espace du club. Seules les adresses
    // des clubs sont acceptées (mêmes origines que vers-clubs.js).
    var CLE_RETOUR_CLUBS = 'mapetanque_retour_clubs';
    var ORIGINES_CLUBS = [
        'https://clubs.mapetanque.be',
        'https://mapetanque-clubs.pages.dev',
        'http://127.0.0.1:5500',   // Live Server de l'espace des clubs
        'http://localhost:5500'
    ];
    var APERCU_CLUBS = /^https:\/\/[a-z0-9-]+\.mapetanque-clubs\.pages\.dev$/;
    var retourClubs = lireRetourClubs();
    var ramenee = false;              // partie en cours retrouvée sur ce téléphone (pas demandée dans l'adresse)

    var vue = null;                   // la partie, telle que la renvoie le Worker
    var erreur = '';                  // 'introuvable' ou 'reseau'
    var avis = null;                  // { texte, alerte, partir } : en haut de l'écran
    var feuille = '';                 // '', 'partie', 'partager', 'aide', 'terrains'
    var reglages = false;             // feuille « La partie » : second écran « Modifier la partie »
    var pleinEcran = false;           // la carte occupe tout l'écran (classe plein-ecran de la zone)
    var lienCopie = false;            // « Lien copié » sous les boutons de la feuille « Partager »
    var depart = false;               // confirmation de « Quitter la partie »
    var refus = '';                   // refus dans la feuille (format, objectif…)
    var occupe = false;               // requête en cours : les boutons attendent
    var gain = null;                  // dernière mène tapée ici : « +3 » sur la moitié
    var horsLigne = navigator.onLine === false;
    var attente = lireAttente();      // mènes pas encore envoyées
    var envoiMenes = false;
    var minuteurRenvoi = null;
    var creation = { format: 2, objectif: 13, terrain: null };   // terrain : { o, nom }
    var messageTerrain = '';
    var proches = [];                 // liste de la feuille « Terrains proches »
    var terrainPour = '';             // 'creation' ou 'partie'
    var nomsTerrains = null;          // identifiant OSM -> nom affiché, une fois data/recherche.json lu
    var enCours = null;               // parties en cours où l'on est joueur (encadré), null tant que pas lues
    var abandon = '';                 // id de la partie dont « Abandonner » attend la confirmation

    // Direct
    var ws = null;
    var direct = false;
    var essaisDirect = 0;
    var minuteurDirect = null;
    var minuteurPing = null;

    function picto(chemins) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
    }
    // Pictos Lucide (licence ISC), comme le reste du site
    var PICTOS = {
        personne: picto('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
        qr: picto('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>'),
        equipes: picto('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
        ok: picto('<circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9.5"/>'),
        main: picto('<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
        crayon: picto('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
        annuler: picto('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
        info: picto('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
        croix: picto('<path d="M18 6 6 18M6 6l12 12"/>'),
        precedent: picto('<path d="m15 18-6-6 6-6"/>'),
        coche: picto('<polyline points="20 6 9 17 4 12"/>'),
        oeil: picto('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
        horsligne: picto('<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20"/>'),
        revanche: picto('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
        sortir: picto('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
        echanger: picto('<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'),
        historique: picto('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
        liste: picto('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
        ajout: picto('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
        envoyer: picto('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>'),
        lien: picto('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
        plus: picto('<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>'),
        aide: picto('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
        agrandir: picto('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
        reduire: picto('<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'),
        lieu: picto('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>')
    };


    // --- Outils -----------------------------------------------------------------------------

    function nettoyerCode(texte) {
        return String(texte || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }

    function echapper(texte) {
        return echapperAvis(texte == null ? '' : String(texte));
    }

    function libelle(cle, valeurs) {
        var texte = t(cle);
        if (!texte || texte === cle) texte = translations.fr[cle] || cle;
        for (var nom in valeurs) texte = texte.split('{' + nom + '}').join(valeurs[nom]);
        return texte;
    }

    function listeEt(noms) {
        if (noms.length < 2) return noms.join('');
        return noms.slice(0, -1).join(', ') + ' ' + libelle('compteur_et') + ' ' + noms[noms.length - 1];
    }

    function nomFormat(f) {
        return libelle('compteur_format_' + f + '_nom');
    }

    function autre(e) {
        return e === 'a' ? 'b' : 'a';
    }

    function lireStockage(cle) {
        try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { return null; }
    }

    function ecrireStockage(cle, valeur) {
        try {
            if (valeur) localStorage.setItem(cle, JSON.stringify(valeur));
            else localStorage.removeItem(cle);
        } catch (e) { }
    }

    // Adresse de Mes parties de l'espace des clubs : celle de ?retour= si elle est valable (gardée
    // pour l'onglet), sinon celle déjà gardée ; '' si l'on n'arrive pas de là
    function lireRetourClubs() {
        var brut = parametres.get('retour');
        var url = null;
        try { url = brut ? new URL(brut) : null; } catch (e) { }
        if (url && !url.username && !url.password && (ORIGINES_CLUBS.indexOf(url.origin) >= 0 || APERCU_CLUBS.test(url.origin))) {
            try { sessionStorage.setItem(CLE_RETOUR_CLUBS, url.href); } catch (e) { }
            return url.href;
        }
        try { return sessionStorage.getItem(CLE_RETOUR_CLUBS) || ''; } catch (e) { return ''; }
    }

    function lireEnCours() {
        var s = lireStockage(CLE_EN_COURS);
        return s && typeof s.id === 'string' && Date.now() - s.quand < DUREE_EN_COURS ? s.id : '';
    }

    function lireAttente() {
        var s = lireStockage(CLE_ATTENTE);
        return s && typeof s.id === 'string' && Array.isArray(s.menes) ? s : { id: '', n: 0, menes: [] };
    }

    function ecrireAttente() {
        ecrireStockage(CLE_ATTENTE, attente.menes.length ? attente : null);
    }

    // Adresse de la page sans recharger : ?id= une fois inscrit (le code ne sert qu'à rejoindre)
    function adresse(recherche) {
        try { history.replaceState(null, '', window.location.pathname + (recherche ? '?' + recherche : '')); } catch (e) { }
    }

    function versConnexion() {
        window.location.href = prefixe + 'connexion.html?retour=' + encodeURIComponent(window.location.pathname + window.location.search);
    }

    function lienCode(code) {
        return window.location.origin + prefixe + 'partie.html?code=' + encodeURIComponent(code);
    }

    // « AAAA-MM-JJ HH:MM:SS » (UTC, comme dans la base) ou millisecondes -> « à l'instant », « il y a 5 min »…
    function quandRelatif(texte) {
        var ms = typeof texte === 'number' ? texte : Date.parse(String(texte || '').replace(' ', 'T') + 'Z');
        if (!ms) return '';
        var ecart = Date.now() - ms;
        if (ecart < 60000) return libelle('pc_instant');
        if (ecart < 3600000) return libelle('pc_il_y_a', { n: Math.round(ecart / 60000) });
        var date = new Date(ms);
        var heure = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        var jour = new Date(); jour.setHours(0, 0, 0, 0);
        if (date >= jour) return libelle('pc_aujourdhui', { heure: heure });
        if (date >= jour.getTime() - 86400000) return libelle('pc_hier', { heure: heure });
        return libelle('pc_le', { date: date.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) });
    }


    // --- La partie, vue d'ici ----------------------------------------------------------------

    // Les mènes affichées : celles du serveur, puis celles qui attendent le réseau
    function menesAffichees() {
        if (!vue) return [];
        return attente.id === vue.id ? vue.menes.concat(attente.menes) : vue.menes;
    }

    function score(menes) {
        var s = { a: 0, b: 0 };
        menes.forEach(function (m) { s[m.e] = Math.min(vue.objectif, s[m.e] + m.p); });
        return s;
    }

    function finie(s) {
        return s.a >= vue.objectif || s.b >= vue.objectif;
    }

    function jeMarque() {
        return !!(vue && vue.main && vue.main.moi);
    }

    function nomPersonne(x) {
        return x.moi ? libelle('pc_vous') : (x.pseudo || '?');
    }

    // Les joueurs d'une équipe : les comptes (« Vous » pour soi), puis les invités
    function nomsEquipe(e, sansVous) {
        var noms = vue.joueurs[e].filter(function (x) { return !(sansVous && x.moi); }).map(nomPersonne);
        var invites = vue.invites[e];
        if (invites) noms.push(invites === 1 ? libelle('pc_un_invite') : libelle('pc_n_invites', { n: invites }));
        return noms;
    }

    function titreEquipe(e) {
        return vue['nom_' + e] || libelle('pc_equipe', { x: e.toUpperCase() });
    }

    function phraseGagnante(e) {
        if (vue['nom_' + e]) return libelle('pc_gagne', { equipe: vue['nom_' + e] });
        var c = vue.joueurs[e].filter(function (x) { return !x.moi; });
        return c.length ? libelle('pc_gagne_equipe_de', { pseudo: c[0].pseudo || '?' }) : libelle('pc_gagne', { equipe: libelle('pc_equipe', { x: e.toUpperCase() }) });
    }

    function nomTerrain(o) {
        if (!o) return '';
        if (nomsTerrains && nomsTerrains[o]) return nomsTerrains[o];
        if (!nomsTerrains) chargerTerrains().then(dessiner, function () { });
        return libelle('popup_terrain_default');
    }

    // « Dernière modification : terrain changé par Julie, ce matin. »
    function phraseModification(m) {
        if (!m) return '';
        var quoi;
        switch (m.champ) {
            case 'format': quoi = libelle('pc_j_format', { format: nomFormat(Number(m.apres)).toLowerCase() }); break;
            case 'objectif': quoi = libelle('pc_j_objectif', { n: m.apres }); break;
            case 'nom_a':
            case 'nom_b': quoi = libelle(m.apres ? 'pc_j_nom' : 'pc_j_nom_efface', { x: m.champ.slice(-1).toUpperCase() }); break;
            case 'terrain': quoi = libelle(m.apres ? 'pc_j_terrain' : 'pc_j_terrain_retire'); break;
            case 'equipe': quoi = libelle('pc_j_equipe'); break;
            case 'role': quoi = libelle(m.apres === 'spectateur' ? 'pc_j_spectateur' : 'pc_j_place'); break;
            case 'depart': quoi = libelle('pc_j_depart'); break;
            case 'rejoint_apres_fin': quoi = libelle('pc_j_apres_fin'); break;
            case 'annulation_fin': quoi = libelle('pc_j_annulation'); break;
            default: return '';
        }
        return libelle('pc_derniere_modif', { quoi: quoi, qui: m.moi ? libelle('pc_par_vous') : (m.pseudo || '?'), quand: quandRelatif(m.quand) });
    }


    // --- Rendu -------------------------------------------------------------------------------

    function dessiner() {
        // Un nom d'équipe en cours de saisie survit au dessin (une mène arrivée en direct, par exemple)
        var actif = document.activeElement;
        var saisie = actif && zone.contains(actif) && actif.dataset && actif.dataset.champ
            ? { champ: actif.dataset.champ, valeur: actif.value, debut: actif.selectionStart, fin: actif.selectionEnd } : null;
        var defile = zone.querySelector('.pc-feuille');
        var hauteur = defile ? defile.scrollTop : 0;

        var h;
        var ajuste = true;   // cadre à la hauteur du contenu ; le jeu, la victoire et le chargement gardent la hauteur fixe
        if (!compte.session()) h = ecranConnexion();
        else if (erreur === 'introuvable') h = ecranIntrouvable();
        else if (erreur === 'reseau' && !vue) h = ecranReseau();
        else if (!vue && (idDemande || codeDemande)) { h = '<div class="pc-page"><p class="pc-discret">' + echapper(libelle('pc_chargement')) + '</p></div>'; ajuste = false; }
        else if (!vue) h = modeRejoindre ? ecranCode() : ecranCreation();
        else if (!vue.moi) h = ecranRejoindre();
        else if (vue.fin) { h = ecranVictoire(); ajuste = false; }
        else { h = ecranJeu(); ajuste = false; }
        zone.classList.toggle('ajuste', ajuste);
        // Le plein écran ne sert qu'à l'écran de jeu, le seul qui a le bouton pour en sortir
        if (pleinEcran && !(compte.session() && vue && vue.moi && !vue.fin)) {
            pleinEcran = false;
            zone.classList.remove('plein-ecran');
            document.body.classList.remove('pc-verrou');
        }
        if (compte.session() && feuille === 'terrains') h += feuilleTerrains();
        else if (vue && vue.moi && !vue.fin && feuille === 'partie') h += reglages ? feuilleReglages() : feuillePartie();
        else if (vue && vue.moi && !vue.fin && feuille === 'partager') h += feuillePartager();
        else if (vue && vue.moi && !vue.fin && feuille === 'aide') h += feuilleAide();
        zone.innerHTML = h;
        gain = null;   // l'animation ne se rejoue pas au dessin suivant

        defile = zone.querySelector('.pc-feuille');
        if (defile) defile.scrollTop = hauteur;
        if (saisie) {
            var champ = zone.querySelector('[data-champ="' + saisie.champ + '"]');
            if (champ) {
                champ.value = saisie.valeur;
                champ.focus();
                try { champ.setSelectionRange(saisie.debut, saisie.fin); } catch (e) { }
            }
        }
        if (feuille === 'partager' && vue && vue.code) dessinerQr();
    }

    function blocAvis() {
        if (!avis) return '';
        return '<div class="pc-avis' + (avis.alerte ? ' alerte' : '') + '">' + (avis.alerte ? PICTOS.horsligne : PICTOS.info)
            + '<span>' + echapper(avis.texte) + '</span>'
            + (avis.partir ? '<button type="button" class="pc-lien" data-action="partir-ok">' + echapper(libelle('pc_partir_ok')) + '</button>' : '') + '</div>';
    }

    function avatar() {
        var session = compte.session();
        return '<i class="pc-avatar" aria-hidden="true">' + echapper((session.pseudo || session.email || '?').charAt(0).toUpperCase()) + '</i>';
    }

    function pseudoSession() {
        var session = compte.session();
        return session.pseudo || session.email || '';
    }

    // Champ du code en grand, bouton dessous (écran « Rejoindre une partie », partie introuvable)
    function formulaireCode() {
        return '<form class="pc-form-code" data-form="code" novalidate>'
            + '<input type="text" class="pc-champ pc-champ-code" id="pc-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7P2" aria-label="' + echapper(libelle('pc_code_titre')) + '">'
            + '<button type="submit" class="pc-btn plein large">' + echapper(libelle('pc_code_ok')) + '</button></form>';
    }

    // Séparation « ou », un trait de chaque côté
    function separationOu() {
        return '<p class="pc-ou">' + echapper(libelle('pc_ou')) + '</p>';
    }

    // Sans compte : aucun accès ; la connexion ramène ici (même adresse, code compris)
    function ecranConnexion() {
        return '<div class="pc-page">'
            + '<span class="pc-tl">' + echapper(codeDemande ? libelle('pc_partie_code', { code: codeDemande }) : libelle('pc_compter')) + '</span>'
            + '<h2>' + echapper(libelle('pc_connexion_titre')) + '</h2>'
            + '<p class="pc-discret">' + echapper(libelle('pc_connexion_aide')) + '</p>'
            + '<button type="button" class="pc-btn plein large" data-action="connexion">' + echapper(libelle('pc_connexion_bouton')) + '</button>'
            + separationOu()
            + '<p class="pc-discret">' + echapper(libelle('pc_sans_compte')) + '</p>'
            + '<a class="pc-btn ligne large" href="' + prefixe + 'compteur.html">' + echapper(libelle('pc_compteur_simple')) + '</a></div>';
    }

    function ecranIntrouvable() {
        return '<div class="pc-page">' + blocAvis()
            + '<h2>' + echapper(libelle('pc_introuvable')) + '</h2>'
            + '<p class="pc-discret">' + echapper(libelle('pc_introuvable_aide')) + '</p>'
            + '<div class="pc-carte"><span class="pc-lbl">' + echapper(libelle('pc_code_titre')) + '</span>' + formulaireCode() + '</div>'
            + separationOu()
            + '<button type="button" class="pc-btn ligne large" data-action="nouvelle">' + echapper(libelle('pc_nouvelle')) + '</button></div>';
    }

    function ecranReseau() {
        return '<div class="pc-page"><p class="pc-discret">' + echapper(libelle('pc_err_reseau')) + '</p>'
            + '<button type="button" class="pc-btn plein large" data-action="relire">' + echapper(libelle('pc_reessayer')) + '</button></div>';
    }

    // « Rejoindre une partie » (menu, lien sous le compteur) : le QR code, le lien reçu ou le code
    function ecranCode() {
        return '<div class="pc-page">' + blocAvis()
            + '<h2>' + echapper(libelle('pc_rejoindre_partie')) + '</h2>'
            + '<p class="pc-discret">' + echapper(libelle('pc_rejoindre_aide')) + '</p>'
            + '<span class="pc-connecte">' + avatar() + echapper(libelle('pc_connecte', { pseudo: pseudoSession() })) + '</span>'
            + '<div class="pc-carte"><span class="pc-lbl">' + echapper(libelle('pc_code_titre')) + '</span>' + formulaireCode() + '</div>'
            + separationOu()
            + '<button type="button" class="pc-btn ligne large" data-action="nouvelle">' + echapper(libelle('pc_nouvelle')) + '</button></div>';
    }

    // Une seule partie en cours à la fois comme joueur (Worker : listerPartiesEnCours) : les autres
    // parties où l'on joue, modifiées depuis moins de 24 h ; null tant qu'elles ne sont pas lues
    function autresEnCours(sauf) {
        if (!enCours) { chargerEnCours(); return null; }
        return enCours.filter(function (v) { return v.id !== sauf; });
    }

    // « Vous avez déjà une partie en cours » : à la place du formulaire de création, ou au-dessus des
    // équipes à rejoindre (désactivées). Reprendre l'ouvre ; Abandonner rend sa place.
    function blocEnCours(liste, aide) {
        var lignes = liste.map(function (v) {
            var mien = v.moi && v.moi.equipe ? v.moi.equipe : 'a';
            var titre = (v.revanche_de ? libelle('pc_en_cours_revanche') + ' · ' : '') + nomFormat(v.format) + ' · '
                + (v.menes.length ? (mien === 'a' ? v.score_a + ' – ' + v.score_b : v.score_b + ' – ' + v.score_a) : libelle('pc_en_cours_vide'));
            var adversaires = v.joueurs[autre(mien)].map(function (x) { return x.pseudo || '?'; });
            if (v.invites[autre(mien)]) adversaires.push(v.invites[autre(mien)] === 1 ? libelle('pc_un_invite') : libelle('pc_n_invites', { n: v.invites[autre(mien)] }));
            var details = [];
            if (adversaires.length) details.push(libelle('pc_contre', { noms: listeEt(adversaires) }));
            details.push(quandRelatif(v.maj));
            var confirme = abandon === v.id;
            return '<div class="pc-ec"><div class="pc-ec-texte"><b>' + echapper(titre) + '</b><small>' + echapper(details.join(' · ')) + '</small></div>'
                + '<div class="pc-ec-actions"><button type="button" class="pc-btn plein" data-reprendre="' + echapper(v.id) + '">' + echapper(libelle('pc_reprendre')) + '</button>'
                + '<button type="button" class="pc-lien danger" data-abandonner="' + echapper(v.id) + '"' + (occupe ? ' disabled' : '') + '>'
                + echapper(libelle(confirme ? 'pc_abandonner_ok' : 'pc_abandonner')) + '</button></div>'
                + (confirme && v.menes.length ? '<p class="pc-petit">' + echapper(libelle('pc_abandon_aide')) + '</p>' : '') + '</div>';
        }).join('');
        return '<div class="pc-en-cours"><span class="pc-lbl">' + echapper(libelle('pc_en_cours_titre')) + '</span>' + lignes
            + '<p class="pc-petit">' + echapper(libelle(aide)) + '</p></div>';
    }

    // Choix à pastilles (format, points) : création et « Modifier la partie »
    function choixPastilles(attr, valeurs, actuel, nom, etiquette, bloque) {
        return '<div class="pc-seg" role="group"' + (etiquette ? ' aria-label="' + echapper(etiquette) + '"' : '') + '>' + valeurs.map(function (v) {
            return '<button type="button" data-' + attr + '="' + v + '" aria-pressed="' + (actuel === v) + '"' + (bloque ? ' disabled' : '') + '>' + echapper(nom(v)) + '</button>';
        }).join('') + '</div>';
    }

    // Terrain : son nom, puis Changer / Retirer dessous ; sans terrain, un bouton pour l'ajouter
    function blocTerrain(nom, pour, retirer) {
        if (!nom) {
            return '<button type="button" class="pc-btn ligne large" data-action="terrains" data-pour="' + pour + '">' + PICTOS.lieu + echapper(libelle('pc_ajouter_terrain')) + '</button>';
        }
        return '<div class="pc-terrain">' + PICTOS.lieu + '<span>' + echapper(nom) + '</span></div>'
            + '<div class="pc-terrain-actions"><button type="button" class="pc-lien vert" data-action="terrains" data-pour="' + pour + '">' + echapper(libelle('pc_changer')) + '</button>'
            + '<button type="button" class="pc-lien" data-action="' + retirer + '"' + (occupe ? ' disabled' : '') + '>' + echapper(libelle('pc_retirer')) + '</button></div>';
    }

    // « Nouvelle partie » : format, 11 ou 13, terrain facultatif ; « Commencer » mène au compteur
    function ecranCreation() {
        var ailleurs = autresEnCours('');
        return '<div class="pc-page">' + blocAvis()
            + '<span class="pc-tl">' + echapper(libelle('pc_compter')) + '</span>'
            + '<h2>' + echapper(libelle('pc_nouvelle')) + '</h2>'
            + '<span class="pc-connecte">' + avatar() + echapper(libelle('pc_connecte', { pseudo: pseudoSession() })) + '</span>'
            + (ailleurs && ailleurs.length ? blocEnCours(ailleurs, 'pc_en_cours_aide') : formulaireCreation(!ailleurs)) + '</div>';
    }

    // attendre : parties en cours pas encore lues, « Commencer » attend
    function formulaireCreation(attendre) {
        return '<div class="pc-carte">'
            + '<span class="pc-lbl">' + echapper(libelle('pc_format')) + '</span>' + choixPastilles('creation-format', [1, 2, 3], creation.format, nomFormat)
            + '<span class="pc-lbl">' + echapper(libelle('pc_en')) + '</span>' + choixPastilles('creation-objectif', [11, 13], creation.objectif, function (v) { return libelle('pc_points', { n: v }); })
            + '<span class="pc-lbl">' + echapper(libelle('pc_terrain')) + ' <small>' + echapper(libelle('pc_facultatif')) + '</small></span>'
            + blocTerrain(creation.terrain ? creation.terrain.nom : '', 'creation', 'sans-terrain-creation')
            + (messageTerrain && !creation.terrain ? '<span class="pc-petit">' + echapper(messageTerrain) + '</span>' : '')
            + '</div>'
            + '<p class="pc-discret">' + echapper(libelle('pc_creation_aide')) + '</p>'
            + '<button type="button" class="pc-btn plein large grand" data-action="commencer"' + (occupe || attendre ? ' disabled' : '') + '>' + echapper(libelle('pc_commencer')) + '</button>';
    }

    // La partie en une tuile vert tendre : format et points, terrain, puis une ligne de plus
    // (score avant de rejoindre, code dans la feuille « La partie »)
    function tuilePartie(suite) {
        return '<div class="pc-tuile"><b>' + echapper(libelle('pc_format_en', { format: nomFormat(vue.format), n: vue.objectif })) + '</b>'
            + '<span>' + (vue.terrain ? PICTOS.lieu + echapper(nomTerrain(vue.terrain)) : echapper(libelle('pc_sans_terrain'))) + '</span>'
            + suite + '</div>';
    }

    // « Rejoindre une équipe » (une carte par équipe, un participant par ligne) ou « Je regarde
    // seulement ». Après la fin : une place d'invité seulement.
    function ecranRejoindre() {
        var s = score(vue.menes);
        var ailleurs = vue.fin ? [] : autresEnCours(vue.id);
        var bloque = !ailleurs || ailleurs.length > 0;
        var carte = function (e) {
            var libres = vue.invites[e];
            var membres = vue.joueurs[e].map(function (x) { return '<span class="pc-membre">' + echapper(nomPersonne(x)) + '</span>'; }).join('');
            for (var i = 0; i < libres; i++) membres += '<span class="pc-membre libre">' + echapper(libelle('pc_place_libre')) + '</span>';
            return '<button type="button" class="pc-choix equipe" data-rejoindre="' + e + '"' + (libres && !occupe && !bloque ? '' : ' disabled') + '>'
                + '<span class="pc-eq-tete"><i class="' + e + '"></i><b>' + echapper(titreEquipe(e)) + '</b><small>' + echapper(libelle(libres ? 'pc_rejoindre' : 'pc_complete')) + '</small></span>'
                + '<span class="pc-membres">' + membres + '</span></button>';
        };
        return '<div class="pc-page">' + blocAvis()
            + '<span class="pc-tl">' + echapper(libelle('pc_partie_code', { code: vue.code || codeDemande })) + '</span>'
            + '<h2>' + echapper(libelle(vue.revanche_de ? 'pc_rejoindre_revanche' : 'pc_rejoindre_titre')) + '</h2>'
            + tuilePartie('<span class="pc-tuile-score">' + s.a + ' – ' + s.b + '</span>')
            + (vue.fin ? '<p class="pc-discret">' + echapper(libelle('pc_apres_fin')) + '</p>' : '')
            + (ailleurs && ailleurs.length ? blocEnCours(ailleurs, 'pc_en_cours_aide_rejoindre') : '')
            + '<span class="pc-lbl">' + echapper(libelle('pc_rejoindre_equipe')) + '</span>' + carte('a') + carte('b')
            + (vue.fin ? '' : separationOu()
                + '<button type="button" class="pc-lien vert" data-rejoindre="spectateur"' + (occupe ? ' disabled' : '') + '>' + PICTOS.oeil + echapper(libelle('pc_regarder')) + '</button>'
                + '<p class="pc-discret pc-sous-lien">' + echapper(libelle('pc_regarder_aide')) + '</p>')
            + '<span class="pc-connecte pc-bas-page">' + avatar() + echapper(libelle('pc_votre_compte', { pseudo: pseudoSession() })) + '</span>'
            + '</div>';
    }

    function moitie(e, s, tactile) {
        var moi = vue.moi.role === 'joueur' && vue.moi.equipe === e;
        var noms = vue['nom_' + e] || nomsEquipe(e, true).join(' · ');
        var etiquette = (moi ? '<span class="pc-vous">' + echapper(libelle('pc_vous')) + '</span>' : '')
            + '<span class="pc-noms">' + echapper(noms) + '</span>';
        var pastilles = '';
        if (tactile) {
            for (var p = 2; p <= (vue.format === 1 ? 3 : 6); p++) pastilles += '<span data-pts="' + p + '">+' + p + '</span>';
            pastilles = '<span class="pc-plus">' + pastilles + '</span><span class="pc-toucher">' + echapper(libelle('compteur_toucher')) + '</span>';
        }
        var contenu = '<span class="pc-nom-eq">' + etiquette + '</span><span class="pc-sc">' + s[e] + '</span>' + pastilles
            + (gain && gain.e === e ? '<span class="pc-gain" aria-hidden="true">+' + gain.p + '</span>' : '');
        if (!tactile) return '<div class="pc-moitie ' + e + '">' + contenu + '</div>';
        return '<button type="button" class="pc-moitie ' + e + '" data-mene="' + e + '" aria-label="' + echapper(libelle('pc_point_pour', { equipe: noms || titreEquipe(e) })) + '">' + contenu + '</button>';
    }

    // Écran de jeu : en haut, le réseau, l'aide et le plein écran ; qui marque ; les deux moitiés ;
    // en bas « Partie », le bouton rond Annuler (ou « Prendre la main ») et « Partager »
    function ecranJeu() {
        var menes = menesAffichees();
        var s = score(menes);
        var marque = jeMarque();
        var tactile = marque && !finie(s);
        var statut = marque
            ? '<p class="pc-statut">' + PICTOS.crayon + echapper(libelle('pc_vous_marquez')) + '</p>'
            : '<p class="pc-statut autre">' + PICTOS.crayon + echapper(vue.main ? libelle('pc_marque', { pseudo: vue.main.pseudo || '?' }) : libelle('pc_personne_marque')) + '</p>';
        var enAttente = attente.id === vue.id ? attente.menes.length : 0;
        var message = '';
        if (horsLigne && enAttente) {
            message = '<div class="pc-avis alerte">' + PICTOS.horsligne + '<span>' + echapper(enAttente === 1 ? libelle('pc_attente_1') : libelle('pc_attente_n', { n: enAttente })) + '</span></div>';
        } else {
            message = blocAvis();
        }
        var reseau = horsLigne ? '<span class="pc-hors">' + PICTOS.horsligne + echapper(libelle('pc_hors_ligne')) + '</span>'
            : (direct ? '<span class="pc-direct">' + echapper(libelle('pc_direct')) + '</span>' : '<span></span>');
        // Annuler : d'abord les mènes en attente (dans le téléphone), sinon la dernière mène du serveur
        var centre = marque
            ? '<button type="button" class="pc-annuler" data-action="annuler" aria-label="' + echapper(libelle('pc_annuler')) + '" title="' + echapper(libelle('pc_annuler')) + '"'
                + (!menes.length || occupe || (envoiMenes && enAttente) ? ' disabled' : '') + '>' + PICTOS.annuler + '</button>'
            : '<button type="button" class="pc-prendre" data-action="prendre"' + (horsLigne || occupe ? ' disabled' : '') + '>' + PICTOS.main + echapper(libelle('pc_prendre_main')) + '</button>';
        return '<div class="pc-jeu' + (marque ? '' : ' suit') + '">'
            + '<div class="pc-haut">' + reseau + '<span class="pc-droite">'
            + '<button type="button" class="pc-icone" data-action="aide" aria-label="' + echapper(libelle('compteur_aide')) + '" title="' + echapper(libelle('compteur_aide')) + '">' + PICTOS.aide + '</button>'
            + '<button type="button" class="pc-icone" data-action="plein-ecran" aria-label="' + echapper(libelle(pleinEcran ? 'fullscreen_exit' : 'fullscreen_enter')) + '" title="' + echapper(libelle(pleinEcran ? 'fullscreen_exit' : 'fullscreen_enter')) + '">' + (pleinEcran ? PICTOS.reduire : PICTOS.agrandir) + '</button>'
            + '</span></div>'
            + statut + message
            + '<div class="pc-moities">' + moitie('a', s, tactile) + moitie('b', s, tactile) + '</div>'
            + '<div class="pc-bas">'
            + '<button type="button" class="pc-cote" data-action="feuille">' + PICTOS.equipes + '<span>' + echapper(libelle('pc_partie')) + '</span></button>'
            + centre
            + '<button type="button" class="pc-cote" data-action="partager">' + PICTOS.qr + '<span>' + echapper(libelle('pc_partager')) + '</span></button></div></div>';
    }

    // Feuille du bas : poignée, titre centré, croix à droite (et retour à gauche si besoin)
    function enveloppeFeuille(titre, corps, retour) {
        return '<div class="pc-voile" data-action="fermer-fond"><div class="pc-feuille" role="dialog" aria-modal="true" aria-label="' + echapper(titre) + '">'
            + '<span class="pc-poignee" aria-hidden="true"></span>'
            + '<div class="pc-f-tete">'
            + (retour ? '<button type="button" class="pc-precedent" data-action="' + retour + '" aria-label="' + echapper(libelle('pc_retour')) + '">' + PICTOS.precedent + '</button>' : '')
            + '<h3>' + echapper(titre) + '</h3><button type="button" class="pc-fermer" data-action="fermer" aria-label="' + echapper(libelle('pc_fermer')) + '">' + PICTOS.croix + '</button></div>'
            + corps + '</div></div>';
    }

    // Feuille « La partie » : la tuile (format, terrain, code), les deux équipes l'une sous l'autre,
    // spectateurs, « Modifier la partie », « Quitter la partie », dernière modification
    function feuillePartie() {
        var moi = vue.moi;
        var equipe = function (e) {
            var noms = vue.joueurs[e].map(function (x) {
                return '<span class="pc-qui">' + echapper(nomPersonne(x))
                    + (vue.main && vue.main.cle === x.cle ? '<span class="pc-a-la-main">' + PICTOS.crayon + echapper(libelle('pc_a_la_main')) + '</span>' : '') + '</span>';
            });
            for (var i = 0; i < vue.invites[e]; i++) noms.push('<span class="pc-qui invite">' + echapper(libelle('pc_joueur_invite')) + '</span>');
            var action = '';
            if (moi.role === 'joueur' && moi.equipe !== e && vue.invites[e]) action = '<button type="button" class="pc-lien vert" data-action="changer-equipe"' + (occupe ? ' disabled' : '') + '>' + PICTOS.echanger + echapper(libelle('pc_passer_equipe')) + '</button>';
            if (moi.role === 'spectateur' && vue.invites[e]) action = '<button type="button" class="pc-lien vert" data-prendre-place="' + e + '"' + (occupe ? ' disabled' : '') + '>' + PICTOS.ajout + echapper(libelle('pc_prendre_place')) + '</button>';
            return '<p class="pc-m-lbl ' + e + '">' + echapper(titreEquipe(e)) + '</p><p class="pc-m-noms">' + noms.join('<span class="pc-point"> · </span>') + '</p>' + action;
        };
        var modif = phraseModification(vue.derniere_modification);
        var joueur = moi.role === 'joueur';
        var partir = depart
            ? '<div class="pc-confirme"><p>' + echapper(libelle(joueur ? 'pc_partir_joueur' : 'pc_partir_spectateur')) + '</p>'
                + '<div class="pc-boutons"><button type="button" class="pc-btn plein danger" data-action="partir-ok"' + (occupe ? ' disabled' : '') + '>' + echapper(libelle(joueur ? 'pc_partir_ok' : 'pc_partir_ok_spectateur')) + '</button>'
                + '<button type="button" class="pc-btn ligne" data-action="partir-non">' + echapper(libelle('pc_rester')) + '</button></div></div>'
            : '<button type="button" class="pc-lien" data-action="partir">' + PICTOS.sortir + echapper(libelle(joueur ? 'pc_partir' : 'pc_ne_plus_suivre')) + '</button>';
        return enveloppeFeuille(libelle('pc_feuille_titre'),
            tuilePartie(vue.code ? '<span class="pc-tuile-code">' + echapper(vue.code) + '</span>' : '')
            + '<div class="pc-match">' + equipe('a') + '<p class="pc-ou">' + echapper(libelle('pc_contre_seul')) + '</p>' + equipe('b') + '</div>'
            + (refus ? '<p class="pc-refus" role="status">' + echapper(refus) + '</p>' : '')
            + (vue.spectateurs.length ? '<p class="pc-discret">' + echapper(libelle('pc_regardent_noms', { noms: listeEt(vue.spectateurs.map(nomPersonne)) })) + '</p>' : '')
            + '<button type="button" class="pc-btn ligne large" data-action="reglages">' + PICTOS.crayon + echapper(libelle('pc_modifier_partie')) + '</button>'
            + partir
            + (modif ? '<p class="pc-journal">' + echapper(modif) + '</p>' : ''));
    }

    // Second écran de la feuille : format, points, noms des équipes et terrain, enregistrés à chaque
    // changement (comme avant) ; « Terminé » ramène à « La partie »
    function feuilleReglages() {
        var noms = ['a', 'b'].map(function (e) {
            return '<input class="pc-champ" data-champ="nom_' + e + '" value="' + echapper(vue['nom_' + e] || '') + '" maxlength="20"'
                + ' placeholder="' + echapper(libelle('pc_nom_placeholder', { x: e.toUpperCase(), noms: nomsEquipe(e, false).join(' · ') })) + '"'
                + ' aria-label="' + echapper(libelle('pc_nom_aria', { x: e.toUpperCase() })) + '">';
        }).join('');
        return enveloppeFeuille(libelle('pc_modifier_partie'),
            '<div class="pc-bloc"><span class="pc-lbl">' + echapper(libelle('pc_format')) + '</span>'
            + choixPastilles('format', [1, 2, 3], vue.format, nomFormat, libelle('pc_format'), occupe) + '</div>'
            + '<div class="pc-bloc"><span class="pc-lbl">' + echapper(libelle('pc_en')) + '</span>'
            + choixPastilles('objectif', [11, 13], vue.objectif, function (o) { return libelle('pc_points', { n: o }); }, libelle('pc_en'), occupe) + '</div>'
            + (refus ? '<p class="pc-refus" role="status">' + echapper(refus) + '</p>' : '')
            + '<div class="pc-bloc"><span class="pc-lbl">' + echapper(libelle('pc_noms_equipes')) + ' <small>' + echapper(libelle('pc_facultatifs')) + '</small></span>' + noms + '</div>'
            + '<div class="pc-bloc"><span class="pc-lbl">' + echapper(libelle('pc_terrain')) + '</span>'
            + blocTerrain(vue.terrain ? nomTerrain(vue.terrain) : '', 'partie', 'sans-terrain')
            + (messageTerrain && terrainPour === 'partie' ? '<span class="pc-petit">' + echapper(messageTerrain) + '</span>' : '') + '</div>'
            + '<p class="pc-enregistre">' + PICTOS.coche + echapper(libelle('pc_enregistre')) + '</p>'
            + '<button type="button" class="pc-btn plein large" data-action="reglages-fin">' + echapper(libelle('pc_termine')) + '</button>',
            'reglages-fin');
    }

    // Feuille « Partager » : QR code à scanner, le code à taper, et le lien à envoyer (comme
    // l'ancien compteur) : partage du téléphone s'il existe, sinon copie
    function feuillePartager() {
        var envoi = navigator.share ? '<button type="button" class="pc-btn plein large" data-action="envoyer-lien">' + PICTOS.envoyer + echapper(libelle('compteur_envoyer_lien')) + '</button>' : '';
        return enveloppeFeuille(libelle('compteur_partager_titre'),
            (vue.code ? '<div class="pc-partage"><div class="pc-qr" id="pc-qr"></div><div class="pc-code-court">' + echapper(vue.code) + '<small>' + echapper(libelle('pc_code_aide')) + '</small></div></div>' : '')
            + envoi
            + '<button type="button" class="pc-btn ' + (envoi ? 'ligne' : 'plein') + ' large" data-action="copier-lien">' + PICTOS.lien + echapper(libelle('share_copy')) + '</button>'
            + (lienCopie ? '<p class="pc-copie" role="status">' + echapper(libelle('compteur_lien_copie')) + '</p>' : ''));
    }

    // Feuille « Comment ça marche ? » : les gestes de la partie en ligne. Les noms des boutons sont
    // repris de leurs propres libellés.
    function feuilleAide() {
        var noms = {
            annuler: libelle('pc_annuler'), prendre: libelle('pc_prendre_main'),
            partager: libelle('pc_partager'), partie: libelle('pc_partie'), mesparties: libelle('moncompte_parties_titre')
        };
        var lignes = [
            [PICTOS.plus, 'pc_aide_marquer'],
            [PICTOS.main, 'pc_aide_main'],
            [PICTOS.qr, 'pc_aide_partager'],
            [PICTOS.equipes, 'pc_aide_partie'],
            [PICTOS.horsligne, 'pc_aide_reseau'],
            [PICTOS.ok, 'pc_aide_fin'],
            [PICTOS.agrandir, 'compteur_aide_plein_ecran']
        ].map(function (x) {
            return '<li>' + x[0] + '<span><b>' + echapper(libelle(x[1])) + '</b>' + echapper(libelle(x[1] + '_texte', noms)) + '</span></li>';
        }).join('');
        return enveloppeFeuille(libelle('compteur_aide'),
            '<ul class="pc-aide-liste">' + lignes + '</ul>'
            + '<button type="button" class="pc-btn plein large" data-action="fermer">' + echapper(libelle('pc_ok')) + '</button>');
    }

    // Plein écran : une classe sur la zone (gardée d'un dessin à l'autre) et la page bloquée derrière
    function definirPleinEcran(actif) {
        pleinEcran = actif;
        zone.classList.toggle('plein-ecran', actif);
        document.body.classList.toggle('pc-verrou', actif);
        dessiner();
    }

    function feuilleTerrains() {
        var corps = messageTerrain
            ? '<p class="pc-discret">' + echapper(messageTerrain) + '</p>'
            : (proches.length
                ? proches.slice(0, 8).map(function (x, i) {
                    return '<button type="button" class="pc-terrain-choix" data-terrain="' + i + '">' + PICTOS.lieu + '<span>' + echapper(x.nom) + '</span><small>' + echapper(formatDistance(x.d)) + '</small></button>';
                }).join('')
                : '<p class="pc-discret">' + echapper(libelle('compteur_aucun_terrain')) + '</p>');
        return enveloppeFeuille(libelle('compteur_terrains_proches'), corps);
    }

    // Victoire : la partie est déjà dans les historiques des joueurs. Le score en grand, « Nous » et
    // « Eux » dessous pour un joueur (les noms des équipes pour un spectateur).
    function ecranVictoire() {
        var s = score(vue.menes);
        var g = s.a >= vue.objectif ? 'a' : 'b';
        var moi = vue.moi;
        var joueur = moi.role === 'joueur';
        var mien = joueur ? moi.equipe : 'a';
        var fs = s[mien] + ' – ' + s[autre(mien)];
        var cote = function (e, libelleCote) {
            return '<span class="' + e + '">' + s[e] + '<small>' + echapper(libelleCote) + '</small></span>';
        };
        var tableau = '<p class="pc-fs">' + cote(mien, joueur ? libelle('pc_nous') : titreEquipe(mien))
            + '<span class="pc-tiret" aria-hidden="true">–</span>' + cote(autre(mien), joueur ? libelle('pc_eux') : titreEquipe(autre(mien))) + '</p>';
        var carte;
        if (joueur && !vue.comptee) {
            // Moins de 2 minutes : une démonstration ou un essai, hors des historiques
            carte = '<div class="pc-carte-fin neutre"><b>' + PICTOS.info + echapper(libelle('pc_trop_courte')) + '</b><span>' + echapper(libelle('pc_trop_courte_aide')) + '</span></div>';
        } else if (joueur) {
            var avec = nomsEquipe(mien, true);
            var contre = nomsEquipe(autre(mien), false);
            var autres = vue.joueurs.a.concat(vue.joueurs.b).filter(function (x) { return !x.moi; }).map(nomPersonne);
            var ligne = [libelle(mien === g ? 'pc_victoire' : 'pc_defaite') + ' ' + fs];
            if (avec.length) ligne.push(libelle('pc_avec', { noms: listeEt(avec) }));
            if (contre.length) ligne.push(libelle('pc_contre', { noms: listeEt(contre) }));
            carte = '<div class="pc-carte-fin"><b>' + PICTOS.ok + echapper(libelle('pc_dans_vos_parties')) + '</b><span>' + echapper(ligne.join(' · ')) + '</span>'
                + (autres.length ? '<span class="pc-gris">' + echapper(libelle('pc_aussi_chez', { noms: listeEt(autres) })) + '</span>' : '')
                + '<a href="' + (retourClubs ? echapper(retourClubs) : prefixe + 'mes-parties.html') + '">' + echapper(libelle('pc_voir_parties')) + '</a></div>';
        } else {
            carte = '<div class="pc-carte-fin neutre"><b>' + PICTOS.oeil + echapper(libelle('pc_regardiez')) + '</b><span>' + echapper(libelle('pc_regardiez_aide')) + '</span></div>';
        }
        var bas;
        if (vue.revanche) {
            var vers = joueur ? 'aller-revanche' : (vue.revanche.code ? 'rejoindre-revanche' : '');
            bas = '<div class="pc-avis">' + PICTOS.revanche + '<span>' + echapper(libelle('pc_revanche_lancee')) + '</span></div>'
                + (vers ? '<button type="button" class="pc-btn plein large grand" data-action="' + vers + '">' + echapper(libelle(joueur ? 'pc_aller_revanche' : 'pc_rejoindre_revanche')) + '</button>' : '')
                + '<button type="button" class="pc-btn ligne large" data-action="nouvelle">' + echapper(libelle('pc_nouvelle')) + '</button>';
        } else {
            bas = (joueur ? '<button type="button" class="pc-btn plein large grand" data-action="revanche"' + (occupe ? ' disabled' : '') + '>' + PICTOS.revanche + echapper(libelle('pc_revanche')) + '</button>' : '')
                + '<button type="button" class="pc-btn ligne large" data-action="nouvelle">' + echapper(libelle('pc_nouvelle')) + '</button>'
                + (vue.annulable ? '<button type="button" class="pc-lien" data-action="annuler-point"' + (occupe ? ' disabled' : '') + '>' + PICTOS.annuler + echapper(libelle('pc_annuler_point')) + '</button>' : '');
        }
        return '<div class="pc-victoire">' + blocAvis()
            + '<span class="pc-tl">' + echapper(libelle('pc_terminee')) + '</span>'
            + '<span class="pc-gagne">' + echapper(joueur && mien === g ? libelle('pc_vous_gagnez') : phraseGagnante(g)) + '</span>'
            + tableau + carte + bas + '</div>';
    }


    // --- QR code ----------------------------------------------------------------------------

    var qrCharge = null;

    function chargerQr() {
        if (!qrCharge) {
            qrCharge = new Promise(function (ok, refusQr) {
                var script = document.createElement('script');
                script.src = QR_LIB;
                script.onload = function () { if (window.qrcode) ok(window.qrcode); else refusQr(new Error('qr')); };
                script.onerror = function () { qrCharge = null; refusQr(new Error('qr')); };
                document.head.appendChild(script);
            });
        }
        return qrCharge;
    }

    function dessinerQr() {
        var code = vue.code;
        chargerQr().then(function (qrcode) {
            var cadre = document.getElementById('pc-qr');
            if (!cadre || !vue || vue.code !== code) return;
            var qr = qrcode(0, 'M');
            qr.addData(lienCode(code));
            qr.make();
            cadre.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true, alt: libelle('compteur_qr_alt') });
        }).catch(function () {
            var cadre = document.getElementById('pc-qr');
            if (cadre) cadre.hidden = true;   // le code suffit
        });
    }


    // --- Lien à envoyer ---------------------------------------------------------------------

    async function envoyerLien() {
        if (!vue || !vue.code) return;
        try {
            await navigator.share({ title: libelle('compteur_partage_message'), text: libelle('compteur_partage_message'), url: lienCode(vue.code) });
            return;
        } catch (e) {
            if (e && e.name === 'AbortError') return;   // fermé sans choisir
        }
        copierLien();
    }

    async function copierLien() {
        if (!vue || !vue.code) return;
        var lien = lienCode(vue.code);
        try {
            await navigator.clipboard.writeText(lien);
        } catch (e) {
            // Sans presse-papiers (page non sécurisée, vieux navigateur) : copie à l'ancienne
            var champ = document.createElement('textarea');
            champ.value = lien;
            champ.setAttribute('readonly', '');
            champ.style.position = 'fixed';
            champ.style.opacity = '0';
            document.body.appendChild(champ);
            champ.select();
            try { document.execCommand('copy'); } catch (e2) { }
            champ.remove();
        }
        lienCopie = true;
        if (feuille === 'partager') dessiner();
    }


    // --- Terrains (data/recherche.json, comme le compteur) ------------------------------------

    var terrains = null;

    function chargerTerrains() {
        if (!terrains) {
            terrains = fetch('/data/recherche.json')
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(function (d) {
                    var communes = {};
                    d.communes.forEach(function (c) { communes[c.s] = typeof c.n === 'string' ? c.n : (c.n[langue] || c.n.fr); });
                    var liste = d.lieux.map(function (l) {
                        return {
                            o: l.o, lat: l.lat, lon: l.lon,
                            nom: (l.r ? libelle('popup_terrain_prefix') + ' ' + l.r : libelle('popup_terrain_default')) + ' · ' + (l.l || communes[l.c] || '')
                        };
                    });
                    nomsTerrains = {};
                    liste.forEach(function (x) { nomsTerrains[x.o] = x.nom; });
                    return liste;
                })
                .catch(function (e) { terrains = null; throw e; });
        }
        return terrains;
    }

    function distance(lat1, lon1, lat2, lon2) {
        var r = Math.PI / 180;
        var x = (lon2 - lon1) * r * Math.cos((lat1 + lat2) / 2 * r);
        var y = (lat2 - lat1) * r;
        return 6371000 * Math.sqrt(x * x + y * y);
    }

    function position() {
        return new Promise(function (ok, refusPos) {
            if (!navigator.geolocation) { refusPos(new Error('geo')); return; }
            navigator.geolocation.getCurrentPosition(function (p) { ok(p.coords); }, refusPos, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
        });
    }

    function terrainsAutour(coords, rayon) {
        return chargerTerrains().then(function (liste) {
            return liste.map(function (x) { return Object.assign({}, x, { d: distance(coords.latitude, coords.longitude, x.lat, x.lon) }); })
                .filter(function (x) { return x.d <= rayon; })
                .sort(function (x, y) { return x.d - y.d; });
        });
    }

    function formatDistance(d) {
        return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (Math.round(d / 100) / 10).toLocaleString(locale) + ' km';
    }

    // Création : le terrain le plus proche proposé d'office, si la position est déjà autorisée
    function proposerTerrain() {
        if (!navigator.permissions || !navigator.geolocation) return;
        navigator.permissions.query({ name: 'geolocation' }).then(function (permission) {
            if (permission.state !== 'granted') return;
            return position().then(function (coords) { return terrainsAutour(coords, RAYON_PROPOSE); }).then(function (liste) {
                if (liste.length && !creation.terrain && !vue) { creation.terrain = { o: liste[0].o, nom: liste[0].nom }; dessiner(); }
            });
        }).catch(function () { });
    }

    function ouvrirTerrains(pour) {
        terrainPour = pour;
        feuille = 'terrains';
        messageTerrain = libelle('compteur_recherche_position');
        dessiner();
        position().then(function (coords) { return terrainsAutour(coords, RAYON_LISTE); }).then(function (liste) {
            proches = liste;
            messageTerrain = '';
            dessiner();
        }, function () {
            messageTerrain = libelle('compteur_position_refusee');
            dessiner();
        });
    }

    function choisirTerrain(x) {
        feuille = terrainPour === 'partie' ? 'partie' : '';
        messageTerrain = '';
        if (terrainPour === 'creation') { creation.terrain = { o: x.o, nom: x.nom }; dessiner(); return; }
        modifier({ terrain: x.o });
    }


    // --- Échanges avec le Worker -------------------------------------------------------------

    function messageErreur(code) {
        return libelle({
            place_prise: 'pc_place_prise', trop_tard: 'pc_trop_tard', finie: 'pc_finie', pas_finie: 'pc_err',
            trop_de_parties: 'pc_trop_de_parties', revanche: 'pc_revanche_deja', introuvable: 'pc_introuvable',
            deja_en_partie: 'pc_deja_en_partie'
        }[code] || 'pc_err');
    }

    // Refus « déjà dans une partie » : les parties renvoyées par le Worker remplacent l'encadré
    // (lu trop tôt, ou une partie commencée sur un autre téléphone entre-temps)
    function refusEnCours(r) {
        if (r.statut !== 409 || r.donnees.erreur !== 'deja_en_partie') return false;
        enCours = Array.isArray(r.donnees.parties) ? r.donnees.parties : [];
        lectureEnCours = true;
        abandon = '';
        return true;
    }

    // Nouvelle version de la partie reçue du Worker
    function prendreVue(nouvelle) {
        if (!nouvelle || !nouvelle.id) return;
        // La main nous a été prise : on le dit, sinon les moitiés cessent d'être tactiles sans raison visible
        if (vue && vue.id === nouvelle.id && jeMarque() && !nouvelle.fin && nouvelle.main && !nouvelle.main.moi) {
            avis = { texte: libelle('pc_main_prise', { pseudo: nouvelle.main.pseudo || '?' }) };
        }
        // Un autre joueur s'en va (« Quitter la partie », ou une autre partie commencée avant la revanche) :
        // on le dit, sinon on se croirait encore à plusieurs
        if (vue && vue.id === nouvelle.id && !nouvelle.fin) {
            var partis = joueursComptes(vue).filter(function (x) {
                return !joueursComptes(nouvelle).concat(nouvelle.spectateurs).some(function (y) { return y.cle === x.cle; });
            });
            if (partis.length) avis = { texte: libelle('pc_avis_depart', { pseudo: listeEt(partis.map(nomPersonne)) }) };
        }
        if (vue && vue.id !== nouvelle.id) debrancherDirect();
        // Partie qui vient de se terminer : les messages de la partie en cours n'ont plus lieu d'être
        if (vue && vue.id === nouvelle.id && !vue.fin && nouvelle.fin) avis = null;
        vue = nouvelle;
        erreur = '';
        if (vue.moi) {
            // Inscrit ici : d'autres parties ont pu être quittées d'office, l'encadré sera relu
            enCours = null;
            lectureEnCours = false;
            idDemande = vue.id;
            adresse('id=' + vue.id);
            if (vue.fin) ecrireStockage(CLE_EN_COURS, null);
            else ecrireStockage(CLE_EN_COURS, { id: vue.id, quand: Date.now() });
        }
        if (vue.terrain && !nomsTerrains) chargerTerrains().then(dessiner, function () { });
        // Mènes restées dans le téléphone (page rechargée, réseau revenu) : elles repartent
        if (attente.id === vue.id && attente.menes.length) {
            if (vue.fin || !jeMarque()) {
                var n = attente.menes.length;
                viderAttente();
                if (!vue.fin && vue.main) avis = { texte: refusMenes('pc_refus_main', n, vue.main.pseudo), alerte: true };
            } else {
                envoyerMenes();
            }
        }
        brancherDirect();
    }

    // Les autres joueurs avec un compte (pas les invités, pas soi)
    function joueursComptes(v) {
        return v.joueurs.a.concat(v.joueurs.b).filter(function (x) { return !x.moi; });
    }

    function refusMenes(base, n, pseudo) {
        return libelle(base + (n === 1 ? '_1' : '_n'), { n: n, pseudo: pseudo || '?' });
    }

    function viderAttente() {
        attente = { id: '', n: 0, menes: [] };
        ecrireAttente();
    }

    function lire() {
        derniereLecture = Date.now();
        var requete = vue ? 'id=' + vue.id : (idDemande ? 'id=' + idDemande : 'code=' + encodeURIComponent(codeDemande));
        return compte.appel('GET', '/parties/partie?' + requete).then(function (r) {
            if (r.statut === 200) {
                horsLigne = false;
                prendreVue(r.donnees);
                if (arriveeRevanche && vue.moi && vue.revanche_de && !vue.fin) avis = { texte: libelle('pc_revanche_gardee'), partir: true };
                arriveeRevanche = false;
            } else if (r.statut === 401) {
                compte.oublier();
            } else if (r.statut === 404) {
                // Partie quittée, effacée ou code expiré. Retrouvée sur ce téléphone : la création, sans message.
                ecrireStockage(CLE_EN_COURS, null);
                debrancherDirect();
                vue = null;
                if (ramenee) { ramenee = false; idDemande = ''; erreur = ''; adresse(''); }
                else erreur = 'introuvable';
            } else if (r.statut === 0) {
                horsLigne = true;
                if (!vue) erreur = 'reseau';
            } else if (!vue) {
                erreur = 'reseau';
            }
            dessiner();
        });
    }

    // Requête d'un bouton : les boutons attendent la réponse. suite(r) traite une réponse 200 ou
    // un refus ; par défaut, la partie renvoyée remplace l'ancienne et un refus s'affiche en avis.
    function envoyer(chemin, corps, suite) {
        if (occupe) return;
        occupe = true;
        refus = '';
        dessiner();
        compte.appel('POST', chemin, corps).then(function (r) {
            occupe = false;
            if (r.statut === 401) { compte.oublier(); dessiner(); return; }
            if (r.statut === 0) {
                horsLigne = true;
                avis = { texte: libelle('pc_err_reseau_action'), alerte: true };
                dessiner();
                return;
            }
            horsLigne = false;
            if (suite && suite(r) === true) { dessiner(); return; }
            if (r.statut === 200) prendreVue(r.donnees);
            else {
                if (r.donnees.vue) prendreVue(r.donnees.vue);
                avis = { texte: messageErreur(r.donnees.erreur), alerte: true };
            }
            dessiner();
        });
    }

    function creer() {
        avis = null;
        envoyer('/parties/creer', { format: creation.format, objectif: creation.objectif, terrain: creation.terrain ? creation.terrain.o : null }, refusEnCours);
    }

    function rejoindre(role, equipe) {
        avis = null;
        var corps = vue.moi ? { id: vue.id, role: role, equipe: equipe } : { code: vue.code || codeDemande, role: role, equipe: equipe };
        envoyer('/parties/rejoindre', corps, function (r) {
            if (r.statut === 404) { vue = null; erreur = 'introuvable'; return true; }
            if (feuille !== 'partie' && refusEnCours(r)) return true;
            if (r.statut !== 200 && feuille === 'partie') { refus = messageErreur(r.donnees.erreur); lire(); return true; }
        });
    }

    function prendreMain() {
        avis = null;
        envoyer('/parties/main', { id: vue.id });
    }

    function modifier(champs) {
        champs.id = vue.id;
        envoyer('/parties/modifier', champs, function (r) {
            var e = r.donnees.erreur;
            if (e === 'format_trop_petit') {
                var plein = ['a', 'b'].filter(function (x) { return vue.joueurs[x].length > champs.format; })[0] || 'a';
                refus = libelle('pc_refus_format', { format: nomFormat(champs.format).toLowerCase(), x: plein.toUpperCase(), n: vue.joueurs[plein].length });
                return true;
            }
            if (e === 'objectif_atteint') {
                var s = score(vue.menes);
                refus = libelle('pc_refus_objectif', { n: champs.objectif, score: Math.max(s.a, s.b) });
                return true;
            }
        });
    }

    function changerEquipe() {
        envoyer('/parties/equipe', { id: vue.id }, function (r) {
            if (r.statut !== 200 && r.donnees.erreur === 'place_prise') { refus = messageErreur('place_prise'); lire(); return true; }
        });
    }

    function partir() {
        var joueur = vue.moi.role === 'joueur';
        var id = vue.id;
        envoyer('/parties/quitter', { id: id }, function (r) {
            if (r.statut !== 200 && r.statut !== 403 && r.statut !== 404) return;
            ecrireStockage(CLE_EN_COURS, null);
            if (attente.id === id) viderAttente();
            debrancherDirect();
            vue = null;
            feuille = '';
            depart = false;
            idDemande = '';
            codeDemande = '';
            erreur = '';
            adresse('');
            avis = { texte: libelle(joueur ? 'pc_parti_joueur' : 'pc_parti_spectateur') };
            return true;
        });
    }

    // Le Worker ne réinscrit pas un joueur déjà passé à une autre partie : sa place reste libre,
    // et la page le dit (les clés changent d'une partie à l'autre, d'où la comparaison des pseudos)
    function revanche() {
        avis = null;
        var avant = joueursComptes(vue).map(function (x) { return x.pseudo || '?'; });
        envoyer('/parties/revanche', { id: vue.id }, function (r) {
            if (r.statut === 200) {
                debrancherDirect();
                vue = null;
                prendreVue(r.donnees);
                var restes = joueursComptes(vue).map(function (x) { return x.pseudo || '?'; });
                var absents = avant.filter(function (p) {
                    var i = restes.indexOf(p);
                    if (i < 0) return true;
                    restes.splice(i, 1);
                    return false;
                });
                avis = { texte: absents.length ? libelle(absents.length === 1 ? 'pc_revanche_sans_1' : 'pc_revanche_sans_n', { noms: listeEt(absents) }) : libelle('pc_revanche_avis') };
                return true;
            }
        });
    }

    function annulerPoint() {
        avis = null;
        envoyer('/parties/annuler-point', { id: vue.id }, function (r) {
            if (r.statut !== 200 && r.donnees.erreur === 'trop_tard') {
                avis = { texte: libelle('pc_trop_tard'), alerte: true };
                lire();
                return true;
            }
        });
    }

    // Parties en cours de l'encadré : lues une fois, au premier dessin d'un écran qui le montre
    var lectureEnCours = false;
    function chargerEnCours() {
        if (lectureEnCours || !compte.session()) return;
        lectureEnCours = true;
        compte.appel('GET', '/parties/en-cours').then(function (r) {
            if (r.statut === 401) { compte.oublier(); return; }
            enCours = r.statut === 200 && Array.isArray(r.donnees.parties) ? r.donnees.parties : [];
            dessiner();
        });
    }

    // « Abandonner » : premier toucher, la confirmation ; second, la place est rendue (comme
    // « Quitter la partie ») et la partie sort de l'encadré
    function abandonner(id) {
        if (abandon !== id) { abandon = id; dessiner(); return; }
        if (occupe) return;
        occupe = true;
        dessiner();
        compte.appel('POST', '/parties/quitter', { id: id }).then(function (r) {
            occupe = false;
            abandon = '';
            if (r.statut === 401) { compte.oublier(); dessiner(); return; }
            if (r.statut === 0) avis = { texte: libelle('pc_err_reseau_action'), alerte: true };
            else {
                enCours = enCours.filter(function (v) { return v.id !== id; });
                if (lireEnCours() === id) ecrireStockage(CLE_EN_COURS, null);
                if (attente.id === id) viderAttente();
            }
            dessiner();
        });
    }

    // Mène tapée : elle part tout de suite ; sans réseau, elle attend dans le téléphone et les
    // suivantes s'ajoutent, avec le nombre de mènes que l'on voyait à la première
    function marquer(e, p) {
        if (!jeMarque()) return;
        var s = score(menesAffichees());
        if (finie(s)) return;
        if (attente.id !== vue.id) attente = { id: vue.id, n: vue.menes.length, menes: [] };
        attente.menes.push({ e: e, p: Math.min(p, vue.objectif - s[e]), quand: Date.now() });
        ecrireAttente();
        gain = { e: e, p: p };
        avis = null;
        dessiner();
        envoyerMenes();
    }

    function envoyerMenes() {
        clearTimeout(minuteurRenvoi);
        if (envoiMenes || !vue || attente.id !== vue.id || !attente.menes.length) return;
        envoiMenes = true;
        var lot = attente.menes.slice();
        var etaitHorsLigne = horsLigne;
        compte.appel('POST', '/parties/mene', { id: attente.id, n: attente.n, menes: lot }).then(function (r) {
            envoiMenes = false;
            if (r.statut === 0) {
                horsLigne = true;
                minuteurRenvoi = setTimeout(envoyerMenes, RENVOI);
                dessiner();
                return;
            }
            horsLigne = false;
            if (r.statut === 401) { compte.oublier(); dessiner(); return; }
            if (r.statut === 200) {
                attente.menes = attente.menes.slice(lot.length);
                attente.n = r.donnees.menes.length;
                ecrireAttente();
                prendreVue(r.donnees);
                if (etaitHorsLigne) avis = { texte: lot.length === 1 ? libelle('pc_parties_1') : libelle('pc_parties_n', { n: lot.length }) };
                dessiner();
                return;
            }
            // Refusées : la main a changé ou d'autres mènes sont arrivées entre-temps. Jamais en silence.
            var n = attente.menes.length;
            viderAttente();
            if (r.statut === 409 && r.donnees.vue) {
                prendreVue(r.donnees.vue);
                if (r.donnees.erreur === 'main') avis = { texte: refusMenes('pc_refus_main', n, vue.main && vue.main.pseudo), alerte: true };
                else if (r.donnees.erreur === 'decale') avis = { texte: refusMenes('pc_refus_decale', n), alerte: true };
            } else {
                avis = { texte: libelle('pc_err'), alerte: true };
                lire();
            }
            dessiner();
        });
    }

    // Annuler : la dernière mène en attente (rien n'est parti), sinon la dernière mène du serveur
    function annuler() {
        if (!jeMarque()) return;
        if (attente.id === vue.id && attente.menes.length) {
            if (envoiMenes) return;
            attente.menes.pop();
            ecrireAttente();
            dessiner();
            return;
        }
        if (!vue.menes.length) return;
        avis = null;
        envoyer('/parties/mene', { id: vue.id, n: vue.menes.length, annuler: true }, function (r) {
            if (r.statut === 409 && r.donnees.vue) {
                prendreVue(r.donnees.vue);
                if (r.donnees.erreur === 'main') avis = { texte: libelle('pc_main_prise', { pseudo: vue.main ? vue.main.pseudo || '?' : '?' }), alerte: true };
                return true;
            }
        });
    }


    // --- Direct ------------------------------------------------------------------------------
    // Une connexion WebSocket tant que la partie a un code et que la page est visible ; coupée,
    // nouvel essai après 2, 4, 8… secondes (30 au plus), et relecture régulière en attendant.

    function brancherDirect() {
        if (ws || !vue || !vue.code || !('WebSocket' in window) || document.visibilityState !== 'visible') return;
        clearTimeout(minuteurDirect);
        var code = vue.code;
        try {
            ws = new WebSocket(URL_DIRECT + '/partie/' + encodeURIComponent(code));
        } catch (e) {
            ws = null;
            return;
        }
        var cette = ws;
        ws.onopen = function () {
            if (ws !== cette) return;
            var reprise = essaisDirect > 0;
            direct = true;
            essaisDirect = 0;
            if (reprise) lire();   // des modifications ont pu arriver pendant la coupure
            minuteurPing = setInterval(function () { try { cette.send('ping'); } catch (e) { } }, PING);
            dessiner();
        };
        ws.onmessage = function (ev) {
            if (ws !== cette || ev.data === 'pong') return;
            var m;
            try { m = JSON.parse(ev.data); } catch (e) { return; }
            if (m && m.type === 'partie' && vue && (!m.maj || m.maj > vue.maj)) lire();
        };
        ws.onclose = function () {
            if (ws !== cette) return;
            var etaitDirect = direct;
            ws = null;
            direct = false;
            clearInterval(minuteurPing);
            if (etaitDirect) dessiner();
            if (vue && vue.code && document.visibilityState === 'visible') {
                minuteurDirect = setTimeout(brancherDirect, Math.min(30000, 2000 * Math.pow(2, essaisDirect++)));
            }
        };
    }

    function debrancherDirect() {
        clearTimeout(minuteurDirect);
        clearInterval(minuteurPing);
        if (!ws) return;
        var ancienne = ws;
        ws = null;
        direct = false;
        try { ancienne.close(); } catch (e) { }
    }

    var derniereLecture = 0;
    setInterval(function () {
        if (!vue || document.visibilityState !== 'visible' || envoiMenes || occupe) return;
        if (Date.now() - derniereLecture >= (direct ? RELECTURE_DIRECT : RELECTURE)) lire();
    }, 5000);

    document.addEventListener('visibilitychange', function () {
        if (!vue) return;
        if (document.visibilityState === 'visible') { lire(); brancherDirect(); }
        else debrancherDirect();
    });

    window.addEventListener('online', function () {
        horsLigne = false;
        if (vue) { envoyerMenes(); lire(); }
    });

    window.addEventListener('offline', function () {
        horsLigne = true;
        dessiner();
    });


    // --- Clics et saisies --------------------------------------------------------------------

    zone.addEventListener('click', function (ev) {
        var b = ev.target.closest('button, [data-action="fermer-fond"]');
        if (!b) return;
        var action = b.dataset.action;
        // Toucher le voile autour d'une feuille la ferme (pas un clic dans la feuille elle-même)
        if (action === 'fermer-fond') {
            if (ev.target !== b) return;
            action = 'fermer';
        }
        if (b.dataset.creationFormat) { creation.format = Number(b.dataset.creationFormat); dessiner(); return; }
        if (b.dataset.creationObjectif) { creation.objectif = Number(b.dataset.creationObjectif); dessiner(); return; }
        if (b.dataset.rejoindre) { b.dataset.rejoindre === 'spectateur' ? rejoindre('spectateur', null) : rejoindre('joueur', b.dataset.rejoindre); return; }
        if (b.dataset.prendrePlace) { rejoindre('joueur', b.dataset.prendrePlace); return; }
        if (b.dataset.mene) {
            var pastille = ev.target.closest('[data-pts]');
            marquer(b.dataset.mene, pastille ? Number(pastille.dataset.pts) : 1);
            return;
        }
        if (b.dataset.format) { if (Number(b.dataset.format) !== vue.format) modifier({ format: Number(b.dataset.format) }); return; }
        if (b.dataset.objectif) { if (Number(b.dataset.objectif) !== vue.objectif) modifier({ objectif: Number(b.dataset.objectif) }); return; }
        if (b.dataset.terrain) { choisirTerrain(proches[Number(b.dataset.terrain)]); return; }
        if (b.dataset.reprendre) { window.location.href = prefixe + 'partie.html?id=' + encodeURIComponent(b.dataset.reprendre); return; }
        if (b.dataset.abandonner) { abandonner(b.dataset.abandonner); return; }
        switch (action) {
            case 'connexion': versConnexion(); break;
            case 'commencer': creer(); break;
            case 'relire': erreur = ''; lire(); break;
            case 'nouvelle': window.location.href = prefixe + 'partie.html?nouvelle=1'; break;
            case 'terrains': ouvrirTerrains(b.dataset.pour); break;
            case 'sans-terrain-creation': creation.terrain = null; dessiner(); break;
            case 'sans-terrain': modifier({ terrain: null }); break;
            case 'annuler': annuler(); break;
            case 'prendre': prendreMain(); break;
            case 'aide': feuille = 'aide'; dessiner(); break;
            case 'plein-ecran': definirPleinEcran(!pleinEcran); break;
            case 'feuille': feuille = 'partie'; reglages = false; refus = ''; depart = false; dessiner(); break;
            case 'reglages': reglages = true; refus = ''; depart = false; dessiner(); break;
            case 'reglages-fin': reglages = false; refus = ''; messageTerrain = ''; dessiner(); break;
            case 'partager': feuille = 'partager'; lienCopie = false; dessiner(); break;
            case 'envoyer-lien': envoyerLien(); break;
            case 'copier-lien': copierLien(); break;
            case 'fermer':
                feuille = feuille === 'terrains' && terrainPour === 'partie' ? 'partie' : '';
                if (!feuille) reglages = false;
                depart = false;
                messageTerrain = '';
                dessiner();
                break;
            case 'changer-equipe': changerEquipe(); break;
            case 'partir': depart = true; dessiner(); break;
            case 'partir-non': depart = false; dessiner(); break;
            case 'partir-ok': partir(); break;
            case 'revanche': revanche(); break;
            // Par le code tant qu'il existe : un joueur pas réinscrit (déjà passé à une autre partie)
            // ne verrait pas la revanche par son id ; avec le code, il y trouve sa place libre
            case 'aller-revanche':
                window.location.href = prefixe + 'partie.html?' + (vue.revanche.code ? 'code=' + encodeURIComponent(vue.revanche.code) : 'id=' + encodeURIComponent(vue.revanche.id)) + '&revanche=1';
                break;
            case 'rejoindre-revanche': window.location.href = prefixe + 'partie.html?code=' + encodeURIComponent(vue.revanche.code); break;
            case 'annuler-point': annulerPoint(); break;
        }
    });

    // Noms des équipes : enregistrés en quittant le champ (ou avec Entrée)
    zone.addEventListener('change', function (ev) {
        var champ = ev.target.dataset && ev.target.dataset.champ;
        if (!champ || !vue) return;
        var valeur = ev.target.value.replace(/\s+/g, ' ').trim();
        if (valeur === (vue[champ] || '')) return;
        var champs = {};
        champs[champ] = valeur || null;
        modifier(champs);
    });

    zone.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.champ) ev.target.blur();
        if (ev.key === 'Escape' && feuille) { feuille = ''; reglages = false; depart = false; dessiner(); }
        else if (ev.key === 'Escape' && pleinEcran) definirPleinEcran(false);
    });

    zone.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var champ = document.getElementById('pc-code');
        var saisi = nettoyerCode(champ && champ.value);
        if (saisi.length < 4) { if (champ) champ.focus(); return; }
        window.location.href = prefixe + 'partie.html?code=' + encodeURIComponent(saisi);
    });

    // Connexion ou déconnexion dans un autre onglet
    window.addEventListener('mapetanque:compte', function () {
        if (compte.session() && (vue || idDemande || codeDemande)) lire(); else dessiner();
    });


    // --- Départ ------------------------------------------------------------------------------

    // Venu de l'espace des clubs : « Retour à Mes parties », au-dessus de la partie (hors du cadre
    // redessiné ; caché par le plein écran, qui a son propre bouton pour en sortir)
    if (retourClubs) {
        zone.insertAdjacentHTML('beforebegin', '<a class="pc-retour-clubs" href="' + echapper(retourClubs) + '">'
            + picto('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>') + '<span>' + echapper(libelle('pc_retour_clubs')) + '</span></a>');
    }

    if (!compte.session()) {
        dessiner();
    } else if (idDemande || codeDemande) {
        dessiner();
        lire();
    } else if (!parametres.has('nouvelle') && lireEnCours()) {
        idDemande = lireEnCours();
        ramenee = true;
        dessiner();
        lire();
    } else if (modeRejoindre) {
        dessiner();
        var champCode = document.getElementById('pc-code');
        if (champCode) champCode.focus();
    } else {
        if (parametres.has('nouvelle')) adresse('');
        dessiner();
        proposerTerrain();
    }
})();
