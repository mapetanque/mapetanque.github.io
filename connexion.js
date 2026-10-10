// ===================== Page Connexion =====================
// connexion.html (et ses versions nl/, de/, en/), générée par scripts/generer_connexion.py.
// Une seule page pour l'inscription et la connexion : on donne son adresse, on reçoit un mail
// avec un lien et un code à 6 chiffres. Quatre états, dessinés dans #connexion :
//   - adresse   : formulaire « Recevoir un lien de connexion » (avec Turnstile) ;
//   - code      : mail envoyé, saisie du code (le lien peut s'ouvrir dans un autre navigateur,
//                 celui de l'appli mail : le code sert alors à se connecter ici) ;
//   - arrivee   : page ouverte depuis le lien du mail (#lien=…), bouton « Me connecter ». C'est
//                 ce clic qui consomme le lien, pas l'ouverture de la page : les messageries qui
//                 ouvrent les liens toutes seules ne le gâchent pas ;
//   - connecte  : pastille avec l'initiale, adresse du compte, bouton « Me déconnecter ». Tant
//                 que le compte n'a pas de pseudo, il est demandé ici avant tout le reste : il
//                 est obligatoire et unique sur le site (vérifié par le Worker), pour qu'on
//                 sache qui joue avec qui dans les parties.
// Pendant l'attente du code, la boule tourne (boule-tournante.js).
// ?retour=/chemin : page où revenir une fois connecté (par exemple le compteur).
//
// Chargé après script.js (t, currentLang), compte.js (window.mapetanqueCompte) et boule-tournante.js.
(function () {
    var zone = document.getElementById('connexion');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;

    // Clé publique du widget Turnstile « mapetanque.be (Spin) » (tableau de bord Cloudflare).
    // Publique par nature (elle figure dans la page). Vide : pas de widget, le Worker doit alors
    // avoir TURNSTILE_ACTIF à « non ».
    var TURNSTILE_CLE_SITE = '0x4AAAAAAEbmkcpE7Yn7QhEM';

    // Demande en cours, gardée le temps de la validité du code : un téléphone qui recharge la
    // page au retour de l'appli mail retrouve ainsi la saisie du code.
    var CLE_DEMANDE = 'mapetanque_connexion_demande';
    var DUREE_DEMANDE = 15 * 60 * 1000;

    var MESSAGES = {
        email_invalide: 'compte_err_email',
        turnstile: 'compte_err_turnstile',
        trop_de_demandes: 'compte_err_trop',
        quota_journalier: 'compte_err_quota',
        code_invalide: 'compte_err_code',
        trop_d_essais: 'compte_err_essais',
        lien_expire: 'compte_err_expire',
        lien_utilise: 'compte_err_utilise',
        lien_invalide: 'compte_err_lien',
        pseudo_vide: 'compte_err_pseudo_vide',
        pseudo_pris: 'compte_err_pseudo_pris',
        pseudo_invalide: 'compte_err_pseudo_invalide'
    };

    function echapper(texte) {
        return String(texte == null ? '' : texte)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function messageErreur(donnees) {
        var texte = t(MESSAGES[donnees.erreur] || 'compte_err_generique');
        return texte.replace('{n}', donnees.essais_restants);
    }

    // Seulement un chemin du site (« /compteur.html ») : jamais une autre adresse.
    function retourDemande() {
        var retour = new URLSearchParams(window.location.search).get('retour');
        return retour && /^\/(?!\/)/.test(retour) ? retour : null;
    }

    function lireDemande() {
        try {
            var demande = JSON.parse(localStorage.getItem(CLE_DEMANDE) || 'null');
            return demande && demande.expire > Date.now() ? demande : null;
        } catch (e) {
            return null;
        }
    }

    function ecrireDemande(demande) {
        try {
            if (demande) localStorage.setItem(CLE_DEMANDE, JSON.stringify(demande));
            else localStorage.removeItem(CLE_DEMANDE);
        } catch (e) { }
    }

    function afficherStatut(texte, erreur) {
        var statut = zone.querySelector('.connexion-statut');
        if (!statut) return;
        statut.textContent = texte || '';
        statut.classList.toggle('erreur', !!erreur);
    }

    // Connecté : l'état « connecte », qui demande d'abord un pseudo si le compte n'en a pas
    // encore. Avec un pseudo déjà choisi, il n'y a rien à demander : retour direct à la page
    // d'où l'on venait, s'il y en a une. Le retour est gardé avec la demande : après le lien du
    // mail, l'adresse de la page ne le porte plus.
    var retourApresPseudo = null;

    function apresConnexion(reponse, retour) {
        compte.ouvrir(reponse);
        ecrireDemande(null);
        if (retour && compte.session().pseudo) {
            window.location.href = retour;
            return;
        }
        retourApresPseudo = retour || null;
        afficherConnecte();
    }


    // --- Turnstile ------------------------------------------------------------------------
    // Script chargé avec render=explicit et onload=mapetanqueTurnstilePret (voir le <head> de la
    // page) : le widget est posé dès que le script ET le formulaire sont là, dans un ordre ou
    // dans l'autre. Le jeton ne sert qu'une fois : le widget est remis à zéro après chaque envoi.
    var widgetTurnstile = null;
    var jetonTurnstile = null;

    function poserTurnstile() {
        var cadre = zone.querySelector('.connexion-turnstile');
        if (!TURNSTILE_CLE_SITE || !cadre || !window.turnstile || cadre.childElementCount) return;
        jetonTurnstile = null;
        widgetTurnstile = window.turnstile.render(cadre, {
            sitekey: TURNSTILE_CLE_SITE,
            language: currentLang,
            callback: function (jeton) { jetonTurnstile = jeton; },
            'expired-callback': function () { jetonTurnstile = null; },
            'error-callback': function () { jetonTurnstile = null; }
        });
    }
    window.mapetanqueTurnstilePret = poserTurnstile;

    function relancerTurnstile() {
        jetonTurnstile = null;
        if (widgetTurnstile !== null && window.turnstile) window.turnstile.reset(widgetTurnstile);
    }


    // --- États ----------------------------------------------------------------------------
    // Mise en page validée sur maquettes/connexion/index.html. L'état courant est noté dans
    // zone.dataset.etat (adresse, code, arrivee, connecte).

    var PICTO_ENVELOPPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
    var PICTO_ENVOIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
    var PICTO_PARTIES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>';

    function poserEtat(etat, html) {
        zone.dataset.etat = etat;
        zone.innerHTML = html;
    }

    function afficherAdresse(message, emailPrecedent) {
        widgetTurnstile = null;
        poserEtat('adresse',
            '<h2 class="connexion-titre">' + echapper(t('compte_titre_adresse')) + '</h2>' +
            '<form class="connexion-carte" novalidate>' +
            '  <label class="connexion-label" for="connexion-email">' + echapper(t('compte_champ_email')) + '</label>' +
            '  <div class="connexion-champ-picto">' + PICTO_ENVELOPPE +
            '    <input type="email" id="connexion-email" class="connexion-champ" autocomplete="email" required maxlength="254" value="' + echapper(emailPrecedent || '') + '">' +
            '  </div>' +
            '  <div class="connexion-turnstile"></div>' +
            '  <button type="submit" class="connexion-bouton">' + echapper(t('compte_envoyer_lien')) + '</button>' +
            '  <p class="connexion-statut" role="status"></p>' +
            '</form>' +
            pourquoiHtml());
        if (message) afficherStatut(message, true);
        poserTurnstile();

        var formulaire = zone.querySelector('form');
        var champ = zone.querySelector('#connexion-email');
        var bouton = zone.querySelector('.connexion-bouton');
        if (emailPrecedent) bouton.focus();
        formulaire.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = champ.value.trim();
            if (!champ.checkValidity() || !email) {
                afficherStatut(t('compte_err_email'), true);
                champ.focus();
                return;
            }
            bouton.disabled = true;
            afficherStatut(t('compte_envoi_en_cours'));
            compte.appel('POST', '/compte/lien', { email: email, langue: currentLang, turnstile: jetonTurnstile })
                .then(function (reponse) {
                    bouton.disabled = false;
                    if (reponse.statut === 200 && reponse.donnees.demande) {
                        var demande = { demande: reponse.donnees.demande, email: email, retour: retourDemande(), expire: Date.now() + DUREE_DEMANDE };
                        ecrireDemande(demande);
                        afficherCode(demande);
                    } else {
                        relancerTurnstile();
                        afficherStatut(messageErreur(reponse.donnees), true);
                    }
                });
        });
    }

    // Le code se tape dans un seul champ, transparent, posé sur six cases (3 + 3) qui en
    // affichent les chiffres : le collage et la suggestion du clavier du téléphone
    // (autocomplete="one-time-code") remplissent donc tout d'un coup. La validation part toute
    // seule au sixième chiffre.
    function afficherCode(demande, message) {
        var cases = '';
        for (var i = 0; i < 6; i++) {
            if (i === 3) cases += '<span class="connexion-case-tiret">–</span>';
            cases += '<span class="connexion-case"></span>';
        }
        poserEtat('code',
            '<canvas class="connexion-boule" aria-hidden="true"></canvas>' +
            '<h2 class="connexion-titre centre">' + echapper(t('compte_titre_code')) + '</h2>' +
            '<p class="connexion-chapo centre">' + echapper(t('compte_mail_envoye')).replace('{email}', '<br><strong class="connexion-adresse">' + echapper(demande.email) + '</strong>') + '</p>' +
            '<form class="connexion-carte" novalidate>' +
            '  <label class="connexion-label centre" for="connexion-code">' + echapper(t('compte_code_consigne')) + '</label>' +
            '  <div class="connexion-cases">' + cases +
            '    <input type="text" id="connexion-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="' + echapper(t('compte_champ_code')) + '">' +
            '  </div>' +
            '  <button type="submit" class="connexion-bouton">' + echapper(t('compte_valider_code')) + '</button>' +
            '  <p class="connexion-statut centre" role="status"></p>' +
            '  <p class="connexion-mention centre">' + echapper(t('compte_code_validite')) + '<br>' + echapper(t('compte_mail_spam')) + '</p>' +
            '  <div class="connexion-liens">' +
            '    <button type="button" class="connexion-lien-texte" data-action="renvoyer">' + echapper(t('compte_renvoyer')) + '</button>' +
            '    <button type="button" class="connexion-lien-texte" data-action="changer">' + echapper(t('compte_changer_adresse')) + '</button>' +
            '  </div>' +
            '</form>');
        if (message) afficherStatut(message, true);
        if (window.BouleTournante) window.BouleTournante.demarrer(zone.querySelector('.connexion-boule'));

        var champ = zone.querySelector('#connexion-code');
        var bouton = zone.querySelector('.connexion-bouton');
        var boites = zone.querySelectorAll('.connexion-case');

        function dessinerCases() {
            var code = champ.value;
            var actif = document.activeElement === champ;
            for (var i = 0; i < boites.length; i++) {
                boites[i].textContent = code.charAt(i);
                boites[i].classList.toggle('actif', actif && i === Math.min(code.length, 5));
            }
        }

        function valider() {
            var code = champ.value;
            if (code.length !== 6 || bouton.disabled) return;
            bouton.disabled = true;
            compte.appel('POST', '/compte/code', { demande: demande.demande, code: code })
                .then(function (reponse) {
                    bouton.disabled = false;
                    if (reponse.statut === 200 && reponse.donnees.jeton) {
                        apresConnexion(reponse.donnees, demande.retour);
                        return;
                    }
                    // Code faux avec des essais restants : on reste ici. Sinon (trop d'essais,
                    // expiré, déjà utilisé), il faut redemander un mail.
                    if (reponse.donnees.erreur === 'code_invalide' || reponse.statut === 0) {
                        afficherStatut(messageErreur(reponse.donnees), true);
                        champ.value = '';
                        dessinerCases();
                        champ.focus();
                    } else {
                        ecrireDemande(null);
                        afficherAdresse(messageErreur(reponse.donnees), demande.email);
                    }
                });
        }

        champ.addEventListener('input', function () {
            champ.value = champ.value.replace(/\D/g, '').slice(0, 6);
            afficherStatut('');
            dessinerCases();
            if (champ.value.length === 6) valider();
        });
        champ.addEventListener('focus', dessinerCases);
        champ.addEventListener('blur', dessinerCases);
        champ.focus();
        dessinerCases();

        zone.querySelector('form').addEventListener('submit', function (e) {
            e.preventDefault();
            if (champ.value.length !== 6) champ.focus();
            else valider();
        });

        // Les deux reviennent au formulaire, qui porte la vérification anti-robot : avec
        // l'adresse déjà remplie pour renvoyer un mail, vide pour en changer.
        zone.querySelector('[data-action="renvoyer"]').addEventListener('click', function () {
            ecrireDemande(null);
            afficherAdresse(null, demande.email);
        });
        zone.querySelector('[data-action="changer"]').addEventListener('click', function () {
            ecrireDemande(null);
            afficherAdresse();
            zone.querySelector('#connexion-email').focus();
        });
    }

    function afficherArrivee(jetonLien) {
        var demande = lireDemande();
        poserEtat('arrivee',
            '<h2 class="connexion-titre centre connexion-titre-arrivee">' + echapper(t('compte_titre_arrivee')) + '</h2>' +
            '<p class="connexion-chapo centre">' + echapper(t('compte_arrivee')) + '</p>' +
            '<div class="connexion-carte">' +
            '  <button type="button" class="connexion-bouton grand">' + echapper(t('compte_me_connecter')) + '</button>' +
            '  <p class="connexion-statut centre" role="status"></p>' +
            '</div>');
        var bouton = zone.querySelector('.connexion-bouton');
        bouton.focus();
        bouton.addEventListener('click', function () {
            bouton.disabled = true;
            compte.appel('POST', '/compte/connexion', { lien: jetonLien })
                .then(function (reponse) {
                    if (reponse.statut === 200 && reponse.donnees.jeton) {
                        apresConnexion(reponse.donnees, demande ? demande.retour : null);
                    } else if (reponse.statut === 0) {
                        bouton.disabled = false;
                        afficherStatut(messageErreur(reponse.donnees), true);
                    } else if (reponse.donnees.erreur === 'lien_utilise' && compte.session()) {
                        // Lien déjà consommé par le code du même mail, ou ouvert deux fois : la
                        // personne est déjà connectée ici, inutile de lui parler d'erreur.
                        afficherConnecte();
                    } else {
                        afficherAdresse(messageErreur(reponse.donnees));
                    }
                });
        });
    }

    // Sans pseudo (première connexion, ou compte créé avant qu'il soit obligatoire), le
    // formulaire du pseudo remplace « Continuer » : on ne quitte pas la page sans en avoir un.
    // Ensuite, le pseudo se change dans « Mon compte ».
    function afficherConnecte(message) {
        var session = compte.session();
        if (!session) {
            afficherAdresse();
            return;
        }
        var retour = retourDemande() || retourApresPseudo;
        var nom = session.pseudo || session.email;
        var titre = session.pseudo ? t('compte_bonjour').replace('{pseudo}', session.pseudo) : t('compte_titre_connecte');
        var pseudoHtml = !session.pseudo
            ? '  <form class="connexion-pseudo" novalidate>' +
              '    <label class="connexion-label" for="connexion-pseudo">' + echapper(t('compte_pseudo_choisir')) + '</label>' +
              '    <div class="connexion-pseudo-ligne">' +
              '      <input type="text" id="connexion-pseudo" class="connexion-champ" maxlength="20" autocomplete="nickname" required placeholder="' + echapper(t('compte_pseudo_aide')) + '">' +
              '      <button type="submit" class="connexion-bouton">' + echapper(t('compte_pseudo_ok')) + '</button>' +
              '    </div>' +
              '    <p class="connexion-mention">' + echapper(t('compte_pseudo_pourquoi')) + '</p>' +
              '  </form>'
            : '';
        poserEtat('connecte',
            '<div class="connexion-avatar" aria-hidden="true">' + echapper(nom.charAt(0).toUpperCase()) + '</div>' +
            '<h2 class="connexion-titre centre">' + echapper(titre) + '</h2>' +
            '<p class="connexion-chapo centre">' + echapper(t('compte_connecte')).replace('{email}', '<strong class="connexion-adresse">' + echapper(session.email) + '</strong>') + '</p>' +
            '<div class="connexion-carte">' +
            pseudoHtml +
            (retour && session.pseudo ? '  <a class="connexion-bouton" href="' + echapper(retour) + '">' + echapper(t('compte_continuer')) + '</a>' : '') +
            '  <button type="button" class="connexion-bouton secondaire" data-action="deconnecter">' + echapper(t('compte_deconnecter')) + '</button>' +
            '  <p class="connexion-statut centre" role="status"></p>' +
            '</div>');
        if (message) afficherStatut(message);

        zone.querySelector('[data-action="deconnecter"]').addEventListener('click', function () {
            compte.deconnecter();
            afficherAdresse();
            afficherStatut(t('compte_deconnecte'));
        });

        var formPseudo = zone.querySelector('.connexion-pseudo');
        if (!formPseudo) return;
        formPseudo.querySelector('input').focus();
        formPseudo.addEventListener('submit', function (e) {
            e.preventDefault();
            var champ = formPseudo.querySelector('input');
            var bouton = formPseudo.querySelector('button');
            var pseudo = champ.value.trim();
            if (!pseudo) {
                afficherStatut(t('compte_err_pseudo_vide'), true);
                champ.focus();
                return;
            }
            bouton.disabled = true;
            compte.appel('POST', '/compte/pseudo', { pseudo: pseudo })
                .then(function (reponse) {
                    bouton.disabled = false;
                    if (reponse.statut === 200) {
                        // Pseudo tel que le Worker l'a enregistré (nettoyé, 20 caractères au plus)
                        compte.majPseudo(reponse.donnees.pseudo);
                        if (retour) window.location.href = retour;
                        else afficherConnecte(t('compte_pseudo_enregistre'));
                    } else {
                        afficherStatut(messageErreur(reponse.donnees), true);
                        champ.focus();
                    }
                });
        });
    }

    function pourquoiHtml() {
        var prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
        function avantage(picto, titre, texte) {
            return '  <div class="connexion-avantage">' +
                '    <div class="connexion-picto">' + picto + '</div>' +
                '    <div><strong>' + titre + '</strong><span>' + echapper(texte) + '</span></div>' +
                '  </div>';
        }
        return '<section class="connexion-pourquoi">' +
            '  <h2>' + echapper(t('compte_pourquoi_titre')) + '</h2>' +
            avantage(PICTO_ENVOIS, echapper(t('compte_avantage_envois_titre')), t('compte_avantage_envois')) +
            avantage(PICTO_PARTIES, echapper(t('compte_avantage_parties_titre')) + '<span class="connexion-bientot">' + echapper(t('compte_bientot')) + '</span>', t('compte_avantage_parties')) +
            '  <p class="connexion-donnees"><a href="' + prefixe + 'confidentialite.html">' + echapper(t('compte_vos_donnees')) + '</a></p>' +
            '</section>';
    }


    // --- Démarrage ------------------------------------------------------------------------
    // Le jeton du lien est retiré tout de suite de l'adresse : il ne reste ni dans l'historique
    // ni dans un lien partagé par erreur.
    function lienDansAdresse() {
        var lien = /^#lien=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
        if (!lien) return false;
        history.replaceState(null, '', window.location.pathname + window.location.search);
        afficherArrivee(lien[1]);
        return true;
    }

    if (lienDansAdresse()) {
        // rien d'autre : la page attend le clic sur « Me connecter »
    } else if (compte.session()) {
        afficherConnecte();
        // Session expirée ou effacée depuis un autre appareil : retour au formulaire.
        compte.verifier().then(function (session) {
            if (!session) afficherAdresse();
            else if (zone.dataset.etat === 'connecte' && !(zone.querySelector('#connexion-pseudo') || {}).value) afficherConnecte();
        });
    } else if (lireDemande()) {
        afficherCode(lireDemande());
    } else {
        afficherAdresse();
    }

    // Lien du mail ouvert dans un onglet déjà sur cette page : seule l'ancre change.
    window.addEventListener('hashchange', lienDansAdresse);

    // Connexion ou déconnexion dans un autre onglet (par exemple le lien ouvert dans un nouvel
    // onglet pendant que celui-ci attend le code).
    window.addEventListener('mapetanque:compte', function () {
        var etat = zone.dataset.etat;
        if (compte.session() && (etat === 'adresse' || etat === 'code')) {
            ecrireDemande(null);
            afficherConnecte();
        }
    });
})();
