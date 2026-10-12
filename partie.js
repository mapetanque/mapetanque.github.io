// ===================== Page Partie partagée =====================
// partie.html (et ses versions nl/, de/, en/), générée par scripts/generer_partie.py. Ouverte par
// le QR code ou le lien « Rejoindre cette partie » du compteur (?code=K7P2), ou par le code tapé
// ici. Maquette validée : artefact « Partie partagée Mapetanque » (maquettes/partie-partagee/).
// Voir NOTES_comptes_utilisateurs.md, « Étapes B et C fusionnées : la partie partagée ».
//   - sans code : la dernière partie suivie sur ce téléphone, si elle n'est pas finie (« Jouer ›
//     Rejoindre une partie » y ramène directement), sinon le champ « Code de la partie » ;
//     « Entrer un autre code » (?autre=1) y mène toujours ;
//   - connecté, pas encore dans la partie : « Qui êtes-vous ? » parmi les noms saisis par le
//     marqueur ou une place libre, ou « Je regarde seulement ». Scanner vaut accord : la partie
//     arrivera dans ses parties ;
//   - sans compte : le score suivi d'office, et se connecter pour garder la partie ;
//   - dans la partie, ou spectateur : le score en direct (WebSocket vers le Worker
//     mapetanque-direct, workers/direct/) ; si la connexion tombe, « Actualiser » le relit, et
//     la page se reconnecte d'elle-même ; à la fin, « Enregistrée dans vos parties » ;
//   - passer la main : un joueur qui a rejoint peut « Marquer à la place de Rémy », sans
//     confirmation (Rémy reprend la main quand il veut). Son score devient tactile : +1 en
//     touchant une équipe, pastilles +2 à +6, « Annuler la dernière mène », « Rendre la main ».
// Routes du Worker des comptes : GET /partage, POST /partage/rejoindre, /partage/mene et
// /partage/main (workers/comptes-parties.js).
//
// Chargé après script.js (t, currentLang, echapperAvis) et compte.js (window.mapetanqueCompte).
(function () {
    var zone = document.getElementById('partie');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;

    var prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
    var locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    var CLE_SPECTATEUR = 'mapetanque_partie_spectateur';   // codes suivis sans prendre de place (cet onglet)
    var URL_DIRECT = 'wss://mapetanque-direct.mapetanque.workers.dev';
    var PING = 30000;         // ms : garde la connexion ouverte (réponse sans réveiller le serveur)

    var CLE_SUIVIE = 'mapetanque_partie_suivie';           // dernière partie suivie sur ce téléphone : { code, quand }
    var DUREE_SUIVIE = 12 * 3600000;                       // ms : une partie laissée plus longtemps est oubliée

    var parametres = new URLSearchParams(window.location.search);
    var code = codeDemande(parametres.get('code'));
    // « Rejoindre une partie » sans code : la partie suivie sur ce téléphone, retrouvée telle quelle
    // (on ne suit qu'une partie à la fois). Son code passe dans l'adresse, comme si on l'avait tapé.
    var ramenee = false;
    if (!code && !parametres.has('autre')) {
        code = lireSuivie();
        if (code) {
            ramenee = true;
            try { history.replaceState(null, '', window.location.pathname + '?code=' + encodeURIComponent(code)); } catch (e) { }
        }
    }
    var donnees = null;       // réponse de GET /partage
    var erreur = '';          // 'introuvable' ou 'reseau'
    var statut = '';          // message sous les choix (place prise…)
    var luA = null;           // heure de la dernière lecture
    var envoiEnCours = false;
    var spectateur = lireSpectateur();
    var gain = null;          // dernière mène reçue en direct : « +3 » sur la ligne de l'équipe
    var majConnue = 0;        // heure (ms) de l'état affiché : un état plus ancien reçu ensuite est ignoré
    var marquage = false;     // mène ou main en route vers le Worker : les touches attendent
    var statutInfo = false;   // statut qui informe (main reprise) plutôt qu'une erreur

    // Connexion du direct
    var ws = null;
    var direct = false;       // connexion ouverte : le score arrive seul
    var essaisDirect = 0;
    var minuteurDirect = null;
    var minuteurPing = null;

    function picto(chemins) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
    }
    var PICTOS = {
        ok: picto('<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'),
        vous: picto('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
        actualiser: picto('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
        plus: picto('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
        crayon: picto('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
        annuler: picto('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
        // Passer la main (Lucide « hand »)
        main: picto('<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
        // Les trois façons de rejoindre (écran sans code)
        qr: picto('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>'),
        lien: picto('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
        clavier: picto('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>')
    };


    // --- Outils -----------------------------------------------------------------------------

    function codeDemande(texte) {
        return String(texte || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }

    function echapper(texte) {
        return echapperAvis(texte);
    }

    function libelle(cle, valeurs) {
        var texte = t(cle) || translations.fr[cle] || cle;
        for (var nom in valeurs) texte = texte.split('{' + nom + '}').join(valeurs[nom]);
        return texte;
    }

    function listeEt(noms) {
        if (noms.length < 2) return noms.join('');
        return noms.slice(0, -1).join(', ') + ' ' + t('compteur_et') + ' ' + noms[noms.length - 1];
    }

    function cleNom(nom) {
        return String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function lireSuivie() {
        try {
            var s = JSON.parse(localStorage.getItem(CLE_SUIVIE) || 'null');
            return s && typeof s.code === 'string' && Date.now() - s.quand < DUREE_SUIVIE ? codeDemande(s.code) : '';
        } catch (e) { return ''; }
    }

    function retenirSuivie() {
        try { localStorage.setItem(CLE_SUIVIE, JSON.stringify({ code: code, quand: Date.now() })); } catch (e) { }
    }

    // Partie finie ou disparue : « Rejoindre une partie » ne la ramène plus
    function oublierSuivie() {
        try { if (lireSuivie() === code) localStorage.removeItem(CLE_SUIVIE); } catch (e) { }
    }

    function lireSpectateur() {
        try { return (JSON.parse(sessionStorage.getItem(CLE_SPECTATEUR) || '[]') || []).indexOf(code) >= 0; } catch (e) { return false; }
    }

    function ecrireSpectateur(oui) {
        spectateur = oui;
        try {
            var liste = (JSON.parse(sessionStorage.getItem(CLE_SPECTATEUR) || '[]') || []).filter(function (c) { return c !== code; });
            if (oui) liste.push(code);
            sessionStorage.setItem(CLE_SPECTATEUR, JSON.stringify(liste.slice(-20)));
        } catch (e) { }
    }

    function versConnexion() {
        window.location.href = prefixe + 'connexion.html?retour=' + encodeURIComponent(window.location.pathname + window.location.search);
    }


    // --- La partie, vue d'ici ----------------------------------------------------------------

    // Joueurs d'une équipe : le marqueur, les noms qu'il a saisis, les joueurs venus sur une place libre
    function joueursEquipe(e) {
        var et = donnees.etat;
        var noms = [];
        if (et.mon_equipe === e && donnees.marqueur) noms.push(donnees.marqueur);
        (et.joueurs[e] || []).forEach(function (n) { noms.push(n); });
        donnees.rejoints.forEach(function (r) {
            if (r.equipe === e && !r.nom && r.pseudo && !noms.some(function (n) { return cleNom(n) === cleNom(r.pseudo); })) noms.push(r.pseudo);
        });
        return noms;
    }

    function nomEquipe(e) {
        var saisi = donnees.etat['nom_' + e];
        if (saisi) return saisi;
        var noms = joueursEquipe(e);
        return noms.length ? noms.join(' · ') : t('compteur_equipe_' + e);
    }

    function equipeMoi() {
        return donnees.moi ? donnees.moi.equipe : null;
    }

    function score(e) {
        return e === 'a' ? donnees.etat.score_a : donnees.etat.score_b;
    }

    function gagnante() {
        var et = donnees.etat;
        return et.score_a >= et.objectif ? 'a' : 'b';
    }

    function etiquette() {
        var et = donnees.etat;
        if (et.termine) return '<span class="pt-etiq gris">' + echapper(t('partie_terminee')) + '</span>';
        var h;
        if (direct) h = '<span class="pt-etiq direct"><i></i>' + echapper(libelle('partie_en_direct', { n: et.menes.length + 1 })) + '</span>';
        else if (!et.menes.length) h = '<span class="pt-etiq">' + echapper(t('partie_pas_commencee')) + '</span>';
        else h = '<span class="pt-etiq"><i></i>' + echapper(libelle('partie_en_cours', { n: et.menes.length + 1 })) + '</span>';
        // Qui marque, dès que ce n'est plus le créateur
        if (jeMarque()) h += '<span class="pt-etiq fort">' + PICTOS.crayon + echapper(t('partie_vous_marquez')) + '</span>';
        else if (donnees.main) h += '<span class="pt-etiq gris">' + PICTOS.crayon + echapper(libelle('partie_marque', { pseudo: donnees.main })) + '</span>';
        return h;
    }

    // Un joueur qui a la main marque ici (le créateur, lui, marque dans son compteur)
    function jeMarque() {
        return !!donnees.main_moi && !donnees.marqueur_moi;
    }

    // Nom de qui a la main : un joueur, sinon le créateur
    function nomMarqueur() {
        return donnees.main || donnees.marqueur || '…';
    }

    // Score, une ligne par équipe. Tactile pour le joueur qui a la main : toucher la ligne = +1,
    // pastilles +2 à +6 (+3 au plus en tête-à-tête, comme le compteur).
    function tableauScore() {
        var moi = equipeMoi();
        var et = donnees.etat;
        var tactile = jeMarque() && !et.termine;
        var cote = function (e) {
            var contenu = '<span class="pt-n">' + (moi === e ? '<span class="pt-vous">' + PICTOS.vous + echapper(t('compteur_vous')) + '</span>' : '')
                + '<span class="pt-noms">' + echapper(nomEquipe(e)) + '</span></span>'
                + (gain && gain.e === e ? '<span class="pt-gain" aria-hidden="true">+' + gain.p + '</span>' : '')
                + '<span class="pt-s">' + score(e) + '</span>';
            if (!tactile) return '<div class="pt-eq ' + e + '">' + contenu + '</div>';
            var pts = '';
            for (var p = 2; p <= (et.format === 1 ? 3 : 6); p++) pts += '<span class="pt-pt" data-pts="' + p + '">+' + p + '</span>';
            return '<button type="button" class="pt-eq tactile ' + e + '" data-mene="' + e + '" data-pts="1" aria-label="' + echapper(libelle('partie_point_pour', { equipe: nomEquipe(e) })) + '"'
                + (marquage ? ' disabled' : '') + '>' + contenu + '<span class="pt-pts">' + pts + '</span></button>';
        };
        var der = et.menes[et.menes.length - 1];
        return '<div class="pt-score">' + cote('a') + cote('b') + '</div>'
            + '<p class="pt-mention">' + echapper(libelle('partie_format', { format: t('compteur_format_' + et.format + '_nom'), objectif: et.objectif }))
            + (der && !et.termine ? ' · ' + echapper(libelle('partie_derniere', { p: der.p, equipe: nomEquipe(der.e) })) : '') + '</p>';
    }

    function boutonActualiser() {
        if (direct) return '';
        var heure = luA ? luA.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="pt-actualiser"><button type="button" class="pt-btn ligne" data-action="actualiser"' + (envoiEnCours ? ' disabled' : '') + '>'
            + PICTOS.actualiser + echapper(t('partie_actualiser')) + '</button>'
            + (heure ? '<span>' + echapper(libelle('partie_lu_a', { heure: heure })) + '</span>' : '') + '</div>';
    }


    // --- Rendu -------------------------------------------------------------------------------

    function dessiner() {
        if (!code) { dessinerCode(); return; }
        if (erreur === 'introuvable') {
            zone.innerHTML = '<div class="pt-carte"><p><strong>' + echapper(t('partie_introuvable')) + '</strong></p>'
                + '<p class="pt-mention">' + echapper(t('partie_introuvable_aide')) + '</p>'
                + '<a class="pt-lien" href="' + prefixe + 'partie.html?autre=1">' + echapper(t('partie_autre_code')) + '</a></div>';
            return;
        }
        if (erreur === 'reseau' && !donnees) {
            zone.innerHTML = '<div class="pt-carte"><p>' + echapper(t('partie_err')) + '</p>'
                + '<button type="button" class="pt-btn vert" data-action="actualiser">' + echapper(t('compteur_reessayer')) + '</button></div>';
            return;
        }
        if (!donnees) {
            zone.innerHTML = '<p class="pt-mention">' + echapper(t('partie_chargement')) + '</p>';
            return;
        }

        var h = '<div class="pt-tete"><h2>' + echapper(libelle('partie_de', { pseudo: donnees.marqueur || '…' })) + '</h2><div class="pt-etiqs">' + etiquette() + '</div></div>'
            + tableauScore();
        if (donnees.marqueur_moi) h += blocMarqueur();
        else if (donnees.moi || spectateur || !compte.session()) h += blocSuivi();
        else h += blocChoix();
        // « Rejoindre une partie » ramène ici tant que la partie n'est pas finie : de quoi en rejoindre une autre
        if (!donnees.marqueur_moi) h += '<p class="pt-mention"><a class="pt-lien" href="' + prefixe + 'partie.html?autre=1">' + echapper(t('partie_autre_code')) + '</a></p>';
        zone.innerHTML = h;
        gain = null;   // l'animation ne se rejoue pas au dessin suivant
    }

    // Sans code (menu « Jouer › Rejoindre une partie ») : les trois façons d'entrer dans une
    // partie, puis le champ du code, et un lien vers le compteur pour qui marque les points.
    function dessinerCode() {
        var facon = function (picto, titre, aide) {
            return '<li>' + picto + '<span><strong>' + echapper(t(titre)) + '</strong>'
                + '<span class="pt-mention">' + echapper(t(aide)) + '</span></span></li>';
        };
        zone.innerHTML = '<div class="pt-carte pt-facons">'
            + '<p class="pt-question">' + echapper(t('partie_facons_titre')) + '</p>'
            + '<p class="pt-mention">' + echapper(libelle('partie_facons_intro', { bouton: t('compteur_partager') })) + '</p>'
            + '<ol class="pt-facons-liste">'
            + facon(PICTOS.qr, 'partie_facon_qr', 'partie_facon_qr_aide')
            + facon(PICTOS.lien, 'partie_facon_lien', 'partie_facon_lien_aide')
            + facon(PICTOS.clavier, 'partie_facon_code', 'partie_facon_code_aide')
            + '</ol></div>'
            + '<form class="pt-carte pt-code" novalidate>'
            + '<label class="pt-etiquette" for="pt-champ-code">' + echapper(t('partie_code_label')) + '</label>'
            + '<div class="pt-ligne-code"><input type="text" id="pt-champ-code" class="pt-champ" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="K7P2">'
            + '<button type="submit" class="pt-btn vert">' + echapper(t('partie_code_ok')) + '</button></div></form>'
            + '<p class="pt-mention pt-creer">' + echapper(t('partie_creer_question'))
            + ' <a class="pt-lien" href="' + prefixe + 'compteur.html">' + echapper(t('partie_creer')) + '</a></p>';
    }

    function blocMarqueur() {
        return '<div class="pt-carte"><p>' + echapper(donnees.main ? libelle('partie_votre_partie_autre', { pseudo: donnees.main }) : t('partie_votre_partie')) + '</p>'
            + '<a class="pt-btn vert" href="' + prefixe + 'compteur.html">' + echapper(t('mesparties_ouvrir_compteur')) + '</a></div>';
    }

    // Dans la partie, « Je regarde seulement », ou sans compte : le score à relire, puis la fin
    function blocSuivi() {
        var et = donnees.etat;
        var moi = donnees.moi;
        var h = '<div class="pt-carte">';
        if (!et.termine && jeMarque()) {
            // C'est ici qu'on marque : le score ci-dessus est tactile
            h += '<p class="pt-mention">' + echapper(t('partie_aide_marquer')) + '</p>'
                + boutonAnnulerMene()
                + ligneStatut()
                + '<button type="button" class="pt-lien" data-action="rendre">' + echapper(libelle('partie_rendre_main', { pseudo: donnees.marqueur || '…' })) + '</button>';
        } else if (!et.termine) {
            if (moi) h += '<p class="pt-ok">' + PICTOS.ok + echapper(libelle(moi.equipe === et.mon_equipe ? 'partie_avec' : 'partie_contre', { pseudo: donnees.marqueur || '…' })) + '</p>';
            else h += '<p>' + echapper(t('partie_spectateur')) + '</p>';
            h += boutonActualiser();
            if (moi) h += '<p class="pt-mention">' + echapper(t('partie_arrivera')) + '</p>';
            if (statut) h += ligneStatut();
            if (moi) h += '<button type="button" class="pt-lien pt-lien-picto" data-action="prendre"' + (marquage ? ' disabled' : '') + '>' + PICTOS.main + echapper(libelle('partie_prendre_main', { pseudo: nomMarqueur() })) + '</button>';
        } else {
            var g = gagnante();
            h += '<p class="pt-fin">' + echapper(moi && moi.equipe === g ? t('compteur_vous_gagnez') : libelle('compteur_gagne', { equipe: nomEquipe(g) })) + '</p>';
            // La dernière mène marquée ici peut encore être annulée
            if (jeMarque()) h += boutonAnnulerMene() + ligneStatut();
            if (moi && moi.enregistree) {
                h += '<p class="pt-ok">' + PICTOS.ok + echapper(t('partie_enregistree')) + '</p>'
                    + '<a class="pt-btn vert" href="' + prefixe + 'mes-parties.html">' + echapper(t('partie_voir_parties')) + '</a>';
            } else if (moi && moi.retiree) {
                h += '<p class="pt-mention">' + echapper(t('partie_retiree')) + '</p>';
            } else if (moi) {
                h += '<p>' + echapper(libelle('partie_attente', { pseudo: donnees.marqueur || '…' })) + '</p>' + boutonActualiser();
            } else if (!compte.session()) {
                h += '<button type="button" class="pt-btn vert" data-action="connexion">' + echapper(t('partie_connexion_fin')) + '</button>'
                    + '<p class="pt-mention">' + echapper(t('partie_gratuit')) + '</p>';
            } else {
                h += '<button type="button" class="pt-lien" data-action="choisir">' + echapper(t('partie_je_jouais')) + '</button>';
            }
        }
        if (!moi && !et.termine) {
            if (compte.session()) h += '<button type="button" class="pt-lien" data-action="choisir">' + echapper(t('partie_je_joue')) + '</button>';
            else h += '<button type="button" class="pt-btn vert" data-action="connexion">' + echapper(t('partie_connexion')) + '</button>'
                + '<p class="pt-mention">' + echapper(t('partie_gratuit')) + '</p>';
        }
        return h + '</div>';
    }

    // Message sous les choix : erreur (place prise, réseau) ou information (main reprise)
    function ligneStatut() {
        return '<p class="pt-statut' + (statutInfo ? ' info' : '') + '" role="status">' + echapper(statut) + '</p>';
    }

    function boutonAnnulerMene() {
        return '<button type="button" class="pt-btn ligne" data-action="annulerMene"' + (marquage || !donnees.etat.menes.length ? ' disabled' : '') + '>'
            + PICTOS.annuler + echapper(t('partie_annuler_mene')) + '</button>';
    }

    // « Qui êtes-vous ? » : les noms saisis par le créateur, puis les places libres de chaque équipe
    function blocChoix() {
        var et = donnees.etat;
        // Un nom est pris par qui l'a choisi, ou par qui est venu sur une place libre sous ce pseudo
        var pris = donnees.rejoints.map(function (r) { return cleNom(r.nom || r.pseudo || ''); });
        var equipes = [et.mon_equipe, et.mon_equipe === 'a' ? 'b' : 'a'];
        var h = '<div class="pt-carte"><p class="pt-question">' + echapper(t(et.termine ? 'partie_qui_fin' : 'partie_qui')) + '</p>';
        equipes.forEach(function (e) {
            var chips = '';
            if (e === et.mon_equipe && donnees.marqueur) chips += '<button type="button" class="pt-choix pris" disabled>' + echapper(donnees.marqueur) + '</button>';
            (et.joueurs[e] || []).forEach(function (n) {
                var deja = pris.indexOf(cleNom(n)) >= 0;
                chips += '<button type="button" class="pt-choix' + (deja ? ' pris' : '') + '"' + (deja ? ' disabled' : ' data-equipe="' + e + '" data-nom="' + echapper(n) + '"') + '>' + echapper(n) + '</button>';
            });
            var saisis = (et.joueurs[e] || []).map(cleNom);
            var libres = donnees.rejoints.filter(function (r) { return r.equipe === e && !r.nom && saisis.indexOf(cleNom(r.pseudo || '')) < 0; });
            libres.forEach(function (r) { chips += '<button type="button" class="pt-choix pris" disabled>' + echapper(r.pseudo || '') + '</button>'; });
            var places = et.format - (e === et.mon_equipe ? 1 : 0) - (et.joueurs[e] || []).length - libres.length;
            if (places > 0) chips += '<button type="button" class="pt-choix libre" data-equipe="' + e + '" data-libre="1">' + PICTOS.plus + echapper(t('partie_autre')) + '</button>';
            h += '<div class="pt-equipe ' + e + '"><span class="pt-etiquette"><i></i>' + echapper(e === et.mon_equipe ? libelle('partie_equipe_de', { pseudo: donnees.marqueur || '…' }) : t('partie_equipe_adverse')) + '</span>'
                + '<div class="pt-choix-liste">' + chips + '</div></div>';
        });
        if (!et.termine) h += '<button type="button" class="pt-lien" data-action="regarder">' + echapper(t('partie_regarder')) + '</button>';
        else h += '<p class="pt-mention">' + echapper(t('partie_mention_fin')) + '</p>';
        var session = compte.session();
        h += ligneStatut()
            + '<p class="pt-compte"><span class="pt-pastille" aria-hidden="true">' + echapper((session.pseudo || session.email || '?').charAt(0).toUpperCase()) + '</span>'
            + echapper(libelle('partie_connecte', { pseudo: session.pseudo || session.email })) + '</p>';
        return h + '</div>';
    }


    // --- Actions -----------------------------------------------------------------------------

    function lire() {
        envoiEnCours = true;
        if (donnees) dessiner();
        return compte.appel('GET', '/partage?code=' + encodeURIComponent(code)).then(function (reponse) {
            envoiEnCours = false;
            if (reponse.statut === 200) {
                // La main nous a été reprise : on le dit, sinon le score cesse d'être tactile sans raison visible
                if (donnees && jeMarque() && !(reponse.donnees.main_moi && !reponse.donnees.marqueur_moi)) {
                    statut = libelle('partie_marque_maintenant', { pseudo: reponse.donnees.main || reponse.donnees.marqueur || '…' });
                    statutInfo = true;
                }
                donnees = reponse.donnees;
                erreur = '';
                luA = new Date();
                // Le créateur marque dans son compteur : seuls les autres « suivent » la partie
                if (donnees.etat.termine) oublierSuivie();
                else if (!donnees.marqueur_moi) retenirSuivie();
                // Dernière mise à jour de la partie dans la base (« AAAA-MM-JJ HH:MM:SS », UTC, à la seconde)
                var maj = Date.parse(String(donnees.maj || '').replace(' ', 'T') + 'Z');
                if (maj > majConnue) majConnue = maj;
            } else if (reponse.statut === 404) {
                oublierSuivie();
                erreur = 'introuvable';
                donnees = null;
                // Partie retrouvée sur le téléphone mais disparue (code expiré) : l'écran du code, sans message
                if (ramenee) {
                    ramenee = false;
                    code = '';
                    erreur = '';
                    try { history.replaceState(null, '', window.location.pathname); } catch (e) { }
                }
            } else {
                erreur = 'reseau';
            }
            dessiner();
            if (donnees && !fini()) brancherDirect(); else debrancherDirect();
        });
    }


    // --- Score en direct ----------------------------------------------------------------------
    // Une connexion WebSocket par page ouverte, fermée quand la page passe en arrière-plan (le
    // téléphone n'a pas à la garder en poche) et rouverte au retour, avec une relecture complète.
    // Coupée : nouvel essai après 2, 4, 8… secondes (30 au plus), et « Actualiser » en attendant.

    // Plus rien à attendre : partie finie, et sa propre copie enregistrée (ou simple spectateur)
    function fini() {
        if (!donnees.etat.termine) return false;
        return !donnees.moi || donnees.moi.enregistree || donnees.moi.retiree;
    }

    function brancherDirect() {
        if (ws || !code || !('WebSocket' in window) || document.visibilityState !== 'visible') return;
        clearTimeout(minuteurDirect);
        try {
            ws = new WebSocket(URL_DIRECT + '/partie/' + encodeURIComponent(code));
        } catch (e) {
            ws = null;
            return;
        }
        var cette = ws;
        ws.onopen = function () {
            if (ws !== cette) return;
            // Reconnexion après une coupure : des mènes ont pu être jouées entre-temps, on relit tout
            var reprise = essaisDirect > 0;
            direct = true;
            essaisDirect = 0;
            if (reprise) lire();
            minuteurPing = setInterval(function () { try { cette.send('ping'); } catch (e) { } }, PING);
            dessiner();
        };
        ws.onmessage = function (ev) {
            if (ws !== cette || ev.data === 'pong') return;
            var m;
            try { m = JSON.parse(ev.data); } catch (e) { return; }
            recevoir(m);
        };
        ws.onclose = function () {
            if (ws !== cette) return;
            var etaitDirect = direct;
            ws = null;
            direct = false;
            clearInterval(minuteurPing);
            if (etaitDirect) dessiner();
            if (donnees && !fini() && document.visibilityState === 'visible') {
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

    // { type: "etat", etat, rejoints } après chaque mène ou place prise ; { type: "enregistree" }
    // quand le marqueur a enregistré la partie (les copies sont faites : on relit son statut)
    function recevoir(m) {
        if (!donnees) return;
        if (m.type === 'etat' && m.etat && Array.isArray(m.etat.menes)) {
            // Dernier état gardé par le serveur du direct, plus ancien que celui déjà affiché
            if (m.maj && m.maj < majConnue) return;
            if (m.maj) majConnue = m.maj;
            var avant = donnees.etat.menes.length;
            donnees.etat = m.etat;
            if (Array.isArray(m.rejoints)) donnees.rejoints = m.rejoints;
            if (m.etat.termine) oublierSuivie();
            // Main passée : on relit la partie pour savoir si c'est nous qui marquons
            if ('main' in m && (m.main || null) !== (donnees.main || null)) { donnees.main = m.main; lire(); }
            var der = m.etat.menes[m.etat.menes.length - 1];
            gain = m.etat.menes.length > avant && der ? { e: der.e, p: der.p } : null;
            luA = new Date();
            dessiner();
            if (fini()) debrancherDirect();
        } else if (m.type === 'enregistree') {
            lire();
        }
    }

    document.addEventListener('visibilitychange', function () {
        if (!code) return;
        if (document.visibilityState === 'visible') lire();
        else debrancherDirect();
    });

    function rejoindre(equipe, nom) {
        statut = '';
        statutInfo = false;
        zone.querySelectorAll('.pt-choix').forEach(function (b) { b.disabled = true; });
        compte.appel('POST', '/partage/rejoindre', { code: code, equipe: equipe, nom: nom }).then(function (reponse) {
            if (reponse.statut === 200) { ecrireSpectateur(false); lire(); return; }
            if (reponse.statut === 401) { compte.oublier(); dessiner(); return; }
            if (reponse.statut === 404) { erreur = 'introuvable'; donnees = null; dessiner(); return; }
            statut = t(reponse.donnees.erreur === 'place_prise' ? 'partie_place_prise' : 'compte_err_generique');
            lire();
        });
    }

    // Mène marquée (ou dernière mène annulée) par le joueur qui a la main. n : nombre de mènes
    // affichées ; si le score a changé entre-temps, le Worker refuse et la page relit la partie.
    function marquer(mene) {
        if (marquage || !donnees || !jeMarque()) return;
        var corps = { code: code, n: donnees.etat.menes.length };
        if (mene.annuler) corps.annuler = true;
        else { corps.e = mene.e; corps.p = mene.p; }
        marquage = true;
        statut = '';
        statutInfo = false;
        dessiner();
        compte.appel('POST', '/partage/mene', corps).then(function (reponse) {
            marquage = false;
            if (reponse.statut === 200) {
                if (reponse.donnees.maj && reponse.donnees.maj < majConnue) { dessiner(); return; }   // le direct a déjà plus récent
                if (reponse.donnees.maj) majConnue = reponse.donnees.maj;
                donnees.etat = reponse.donnees.etat;
                var der = donnees.etat.menes[donnees.etat.menes.length - 1];
                gain = !mene.annuler && der ? { e: der.e, p: der.p } : null;
                try { if (!mene.annuler && navigator.vibrate) navigator.vibrate(25); } catch (e) { }
                dessiner();
                return;
            }
            if (reponse.statut === 401) { compte.oublier(); lire(); return; }
            if (reponse.statut === 409 && reponse.donnees.erreur === 'decale') statut = t('partie_score_change');
            else if (reponse.statut !== 409) statut = t(reponse.statut === 0 ? 'partie_err' : 'compte_err_generique');
            lire();
        });
    }

    // Prendre la main (« moi ») ou la rendre au créateur (« createur »)
    function changerMain(vers) {
        if (marquage) return;
        marquage = true;
        statut = '';
        statutInfo = false;
        dessiner();
        compte.appel('POST', '/partage/main', { code: code, vers: vers }).then(function (reponse) {
            marquage = false;
            if (reponse.statut === 401) { compte.oublier(); dessiner(); return; }
            if (reponse.statut !== 200) statut = t(reponse.statut === 0 ? 'partie_err' : 'compte_err_generique');
            lire();
        });
    }

    zone.addEventListener('click', function (ev) {
        var b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.equipe) { rejoindre(b.dataset.equipe, b.dataset.libre ? null : b.dataset.nom); return; }
        // Ligne d'une équipe : +1, ou la pastille touchée (+2 à +6)
        if (b.dataset.mene) {
            var pastille = ev.target.closest('.pt-pt');
            marquer({ e: b.dataset.mene, p: Number((pastille || b).dataset.pts) });
            return;
        }
        var action = b.dataset.action;
        if (action === 'annulerMene') marquer({ annuler: true });
        if (action === 'prendre') changerMain('moi');
        if (action === 'rendre') changerMain('createur');
        if (action === 'actualiser') lire();
        if (action === 'regarder') { ecrireSpectateur(true); dessiner(); }
        if (action === 'choisir') {
            if (!compte.session()) { versConnexion(); return; }
            ecrireSpectateur(false);
            dessiner();
        }
        if (action === 'connexion') versConnexion();
    });

    zone.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var saisi = codeDemande(document.getElementById('pt-champ-code').value);
        if (saisi.length < 4) { document.getElementById('pt-champ-code').focus(); return; }
        window.location.search = '?code=' + encodeURIComponent(saisi);
    });

    // Connexion ou déconnexion dans un autre onglet : la page se redessine
    window.addEventListener('mapetanque:compte', function () { if (code) lire(); });

    dessiner();
    if (code) {
        lire();   // session expirée : le Worker répond 401 au choix de la place, et la page propose la connexion
    } else {
        var champ = document.getElementById('pt-champ-code');
        if (champ) champ.focus();
    }
})();
