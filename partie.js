// ===================== Page Partie partagée =====================
// partie.html (et ses versions nl/, de/, en/), générée par scripts/generer_partie.py. Ouverte par
// le QR code ou le lien « Rejoindre cette partie » du compteur (?code=K7P2), ou par le code tapé
// ici. Maquette validée : artefact « Partie partagée Mapetanque » (maquettes/partie-partagee/).
// Voir NOTES_comptes_utilisateurs.md, « Étapes B et C fusionnées : la partie partagée ».
//   - sans code : champ « Code de la partie » ;
//   - connecté, pas encore dans la partie : « Qui êtes-vous ? » parmi les noms saisis par le
//     marqueur ou une place libre, ou « Je regarde seulement ». Scanner vaut accord : la partie
//     arrivera dans ses parties ;
//   - sans compte : « Suivre le score », ou se connecter pour garder la partie ;
//   - dans la partie, ou spectateur : le score en direct (WebSocket vers le Worker
//     mapetanque-direct, workers/direct/) ; si la connexion tombe, « Actualiser » le relit, et
//     la page se reconnecte d'elle-même ; à la fin, « Enregistrée dans vos parties ».
// Routes du Worker des comptes : GET /partage et POST /partage/rejoindre (workers/comptes-parties.js).
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

    var code = codeDemande(new URLSearchParams(window.location.search).get('code'));
    var donnees = null;       // réponse de GET /partage
    var erreur = '';          // 'introuvable' ou 'reseau'
    var statut = '';          // message sous les choix (place prise…)
    var luA = null;           // heure de la dernière lecture
    var envoiEnCours = false;
    var spectateur = lireSpectateur();
    var gain = null;          // dernière mène reçue en direct : « +3 » sur la ligne de l'équipe
    var majConnue = 0;        // heure (ms) de l'état affiché : un état plus ancien reçu ensuite est ignoré

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
        plus: picto('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')
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
        if (direct) return '<span class="pt-etiq direct"><i></i>' + echapper(libelle('partie_en_direct', { n: et.menes.length + 1 })) + '</span>';
        if (!et.menes.length) return '<span class="pt-etiq">' + echapper(t('partie_pas_commencee')) + '</span>';
        return '<span class="pt-etiq"><i></i>' + echapper(libelle('partie_en_cours', { n: et.menes.length + 1 })) + '</span>';
    }

    function tableauScore() {
        var moi = equipeMoi();
        var cote = function (e) {
            return '<div class="pt-eq ' + e + '"><span class="pt-n">' + (moi === e ? '<span class="pt-vous">' + PICTOS.vous + echapper(t('compteur_vous')) + '</span>' : '')
                + '<span class="pt-noms">' + echapper(nomEquipe(e)) + '</span></span>'
                + (gain && gain.e === e ? '<span class="pt-gain" aria-hidden="true">+' + gain.p + '</span>' : '')
                + '<span class="pt-s">' + score(e) + '</span></div>';
        };
        var et = donnees.etat;
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
                + '<a class="pt-lien" href="' + prefixe + 'partie.html">' + echapper(t('partie_autre_code')) + '</a></div>';
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

        var h = '<div class="pt-tete"><h2>' + echapper(libelle('partie_de', { pseudo: donnees.marqueur || '…' })) + '</h2>' + etiquette() + '</div>'
            + tableauScore();
        if (donnees.marqueur_moi) h += blocMarqueur();
        else if (donnees.moi || spectateur) h += blocSuivi();
        else if (compte.session()) h += blocChoix();
        else h += blocInvite();
        zone.innerHTML = h;
        gain = null;   // l'animation ne se rejoue pas au dessin suivant
    }

    function dessinerCode() {
        zone.innerHTML = '<form class="pt-carte pt-code" novalidate>'
            + '<label class="pt-etiquette" for="pt-champ-code">' + echapper(t('partie_code_label')) + '</label>'
            + '<div class="pt-ligne-code"><input type="text" id="pt-champ-code" class="pt-champ" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="K7P2">'
            + '<button type="submit" class="pt-btn vert">' + echapper(t('partie_code_ok')) + '</button></div>'
            + '<p class="pt-mention">' + echapper(t('partie_code_aide')) + '</p></form>';
    }

    function blocMarqueur() {
        return '<div class="pt-carte"><p>' + echapper(t('partie_votre_partie')) + '</p>'
            + '<a class="pt-btn vert" href="' + prefixe + 'compteur.html">' + echapper(t('mesparties_ouvrir_compteur')) + '</a></div>';
    }

    // Dans la partie, ou « Je regarde seulement » : le score à relire, puis la fin
    function blocSuivi() {
        var et = donnees.etat;
        var moi = donnees.moi;
        var h = '<div class="pt-carte">';
        if (!et.termine) {
            if (moi) h += '<p class="pt-ok">' + PICTOS.ok + echapper(libelle(moi.equipe === et.mon_equipe ? 'partie_avec' : 'partie_contre', { pseudo: donnees.marqueur || '…' })) + '</p>';
            else h += '<p>' + echapper(t('partie_spectateur')) + '</p>';
            h += boutonActualiser();
            if (moi) h += '<p class="pt-mention">' + echapper(t('partie_arrivera')) + '</p>';
        } else {
            var g = gagnante();
            h += '<p class="pt-fin">' + echapper(moi && moi.equipe === g ? t('compteur_vous_gagnez') : libelle('compteur_gagne', { equipe: nomEquipe(g) })) + '</p>';
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
        if (!moi && !et.termine) h += '<button type="button" class="pt-lien" data-action="choisir">' + echapper(t(compte.session() ? 'partie_je_joue' : 'partie_connexion')) + '</button>';
        return h + '</div>';
    }

    // « Qui êtes-vous ? » : les noms saisis par le marqueur, puis les places libres de chaque équipe
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
        h += '<p class="pt-statut" role="status">' + echapper(statut) + '</p>'
            + '<p class="pt-compte"><span class="pt-pastille" aria-hidden="true">' + echapper((session.pseudo || session.email || '?').charAt(0).toUpperCase()) + '</span>'
            + echapper(libelle('partie_connecte', { pseudo: session.pseudo || session.email })) + '</p>';
        return h + '</div>';
    }

    function blocInvite() {
        var termine = donnees.etat.termine;
        return '<div class="pt-carte">'
            + (termine ? '' : '<button type="button" class="pt-btn vert" data-action="regarder">' + echapper(t('partie_suivre')) + '</button>')
            + '<button type="button" class="pt-btn ' + (termine ? 'vert' : 'ligne') + '" data-action="connexion">' + echapper(t(termine ? 'partie_connexion_fin' : 'partie_connexion')) + '</button>'
            + '<p class="pt-mention">' + echapper(t('partie_gratuit')) + '</p></div>';
    }


    // --- Actions -----------------------------------------------------------------------------

    function lire() {
        envoiEnCours = true;
        if (donnees) dessiner();
        return compte.appel('GET', '/partage?code=' + encodeURIComponent(code)).then(function (reponse) {
            envoiEnCours = false;
            if (reponse.statut === 200) {
                donnees = reponse.donnees;
                erreur = '';
                luA = new Date();
                // Dernière mise à jour de la partie dans la base (« AAAA-MM-JJ HH:MM:SS », UTC, à la seconde)
                var maj = Date.parse(String(donnees.maj || '').replace(' ', 'T') + 'Z');
                if (maj > majConnue) majConnue = maj;
            } else if (reponse.statut === 404) {
                erreur = 'introuvable';
                donnees = null;
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
        zone.querySelectorAll('.pt-choix').forEach(function (b) { b.disabled = true; });
        compte.appel('POST', '/partage/rejoindre', { code: code, equipe: equipe, nom: nom }).then(function (reponse) {
            if (reponse.statut === 200) { ecrireSpectateur(false); lire(); return; }
            if (reponse.statut === 401) { compte.oublier(); dessiner(); return; }
            if (reponse.statut === 404) { erreur = 'introuvable'; donnees = null; dessiner(); return; }
            statut = t(reponse.donnees.erreur === 'place_prise' ? 'partie_place_prise' : 'compte_err_generique');
            lire();
        });
    }

    zone.addEventListener('click', function (ev) {
        var b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.equipe) { rejoindre(b.dataset.equipe, b.dataset.libre ? null : b.dataset.nom); return; }
        var action = b.dataset.action;
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
