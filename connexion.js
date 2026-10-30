// ===================== Page Connexion =====================
// connexion.html (et ses versions nl/, de/, en/), générée par scripts/generer_connexion.py.
// Une seule page pour l'inscription et la connexion : on donne son adresse, on reçoit un mail
// avec un lien et un code à 6 chiffres. Ou bien on passe par son compte Google ou Facebook
// (boutons au-dessus du formulaire) : même compte si l'adresse est la même. États, dessinés dans
// #connexion :
//   - adresse   : boutons Google et Facebook, puis formulaire « Recevoir un lien de connexion »
//                 (avec Turnstile) ; après Facebook sans adresse mail, le même formulaire seul,
//                 qui joint le ticket Facebook à la demande ;
//   - attente   : retour de Facebook, le temps que le Worker réponde ;
//   - code      : mail envoyé, saisie du code (le lien peut s'ouvrir dans un autre navigateur,
//                 celui de l'appli mail : le code sert alors à se connecter ici) ;
//   - arrivee   : page ouverte depuis le lien du mail (#lien=…), bouton « Me connecter ». C'est
//                 ce clic qui consomme le lien, pas l'ouverture de la page : les messageries qui
//                 ouvrent les liens toutes seules ne le gâchent pas ;
//   - connecte  : seulement tant que le compte n'a pas de pseudo, demandé ici avant tout le
//                 reste : il est obligatoire et unique sur le site (vérifié par le Worker), pour
//                 qu'on sache qui joue avec qui dans les parties.
// Une fois connecté avec un pseudo, on quitte la page, comme sur la plupart des sites : retour à
// la page d'où l'on venait (?retour=), sinon l'accueil. Déjà connecté en arrivant ici : « Mon
// compte ».
// Pendant l'attente du code, la boule tourne (boule-tournante.js).
// ?retour=/chemin : page où revenir une fois connecté (par exemple le compteur).
//
// Chargé après script.js (t, currentLang), compte.js (window.mapetanqueCompte) et boule-tournante.js.
(function () {
    var zone = document.getElementById('connexion');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;
    var prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';

    // Clé publique du widget Turnstile « mapetanque.be (Spin) » (tableau de bord Cloudflare).
    // Publique par nature (elle figure dans la page). Vide : pas de widget, le Worker doit alors
    // avoir TURNSTILE_ACTIF à « non ».
    var TURNSTILE_CLE_SITE = '0x4AAAAAAEbmkcpE7Yn7QhEM';

    // Identifiant client OAuth « Web » de Google Cloud (publique par nature, comme la clé
    // Turnstile). Vide : pas de bouton Google, et la page ne contacte pas Google. Le Worker doit
    // avoir le même identifiant dans GOOGLE_CLIENT_ID.
    var GOOGLE_CLIENT_ID = '91669499037-s7vrh0tvulprac4f9lgrihqhpjofaqu7.apps.googleusercontent.com';

    // Application Meta « mapetanque.be » (identifiant public, comme celui de Google ; le Worker a
    // le même dans FACEBOOK_APP_ID). Vide : pas de bouton Facebook. Facebook revient toujours sur
    // la page française (seules adresses de retour déclarées chez Meta, et vérifiées par le
    // Worker) ; ailleurs (aperçus *.pages.dev, 127.0.0.1) : pas de bouton.
    var FACEBOOK_APP_ID = '1144278294774305';
    var FACEBOOK_DIALOGUE = 'https://www.facebook.com/v26.0/dialog/oauth';
    var FACEBOOK_RETOUR = {
        'https://mapetanque.be': 'https://mapetanque.be/connexion.html',
        'http://localhost:5501': 'http://localhost:5501/connexion.html'   // Live Server (.vscode/settings.json)
    }[window.location.origin] || null;
    // { state, langue, retour } pendant l'aller-retour chez Facebook, puis { code, retour } ou
    // { annule } le temps de passer sur la page de la bonne langue (sessionStorage : cet onglet seul)
    var CLE_FACEBOOK = 'mapetanque_connexion_facebook';

    // Demande en cours, gardée le temps de la validité du code : un téléphone qui recharge la
    // page au retour de l'appli mail retrouve ainsi la saisie du code.
    var CLE_DEMANDE = 'mapetanque_connexion_demande';
    var DUREE_DEMANDE = 15 * 60 * 1000;

    var MESSAGES = {
        email_invalide: 'compte_err_email',
        turnstile: 'compte_err_turnstile',
        trop_de_demandes: 'compte_err_trop',
        trop_de_demandes_jour: 'compte_err_trop_jour',   // 10 demandes par connexion internet et par jour
        quota_journalier: 'compte_err_quota',
        code_invalide: 'compte_err_code',
        trop_d_essais: 'compte_err_essais',
        lien_expire: 'compte_err_expire',
        lien_utilise: 'compte_err_utilise',
        lien_invalide: 'compte_err_lien',
        google_invalide: 'compte_err_google',      // jeton Google refusé par le Worker
        google_non_verifie: 'compte_err_google',   // adresse non vérifiée chez Google
        facebook_invalide: 'compte_err_facebook',  // code Facebook refusé (expiré, déjà servi…)
        facebook_indisponible: 'compte_err_facebook',
        ticket_facebook: 'compte_err_facebook_delai',   // ticket de 15 minutes expiré
        compte_autre_facebook: 'compte_err_compte_autre_facebook',
        facebook_autre_compte: 'compte_err_facebook_autre_compte',
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

    // Connecté : direction la page d'où l'on venait, sinon l'accueil ; mais d'abord le pseudo si
    // le compte n'en a pas encore (état « connecte »). Le retour est gardé avec la demande :
    // après le lien du mail, l'adresse de la page ne le porte plus.
    var retourApresPseudo = null;

    function apresConnexion(reponse, retour) {
        compte.ouvrir(reponse);
        ecrireDemande(null);
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


    // --- Google -----------------------------------------------------------------------------
    // Bouton « Se connecter avec Google » (Google Identity Services). Google renvoie un jeton
    // signé (credential) que le Worker vérifie avec les clés publiques de Google avant d'ouvrir
    // la session (/compte/google) : la page ne voit jamais rien d'autre. La bibliothèque n'est
    // chargée qu'à l'affichage du formulaire : une personne déjà connectée ne contacte pas Google.
    // Bibliothèque bloquée (bloqueur de publicité…) : pas de bouton, le mail reste possible.
    var googleCharge = false;
    var googleInitialise = false;

    function chargerGoogle() {
        if (!GOOGLE_CLIENT_ID || googleCharge) return;
        googleCharge = true;
        var script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = poserGoogle;
        script.onerror = function () {
            googleBloque = true;
            poserGoogle();
        };
        document.head.appendChild(script);
    }

    // Bibliothèque bloquée : la place réservée au bouton disparaît (et tout le bloc s'il n'y a pas
    // non plus Facebook).
    var googleBloque = false;

    function poserGoogle() {
        var bloc = zone.querySelector('.connexion-tiers');
        var cadre = bloc && bloc.querySelector('.connexion-google-bouton');
        if (cadre && googleBloque) {
            cadre.remove();
            if (!bloc.querySelector('.connexion-facebook')) bloc.hidden = true;
            return;
        }
        if (!cadre || cadre.childElementCount || !window.google || !window.google.accounts) return;
        if (!googleInitialise) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: connexionGoogle,
                context: 'signin',
                ux_mode: 'popup'
            });
            googleInitialise = true;
        }
        window.google.accounts.id.renderButton(cadre, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            logo_alignment: 'center',
            locale: currentLang,
            width: Math.min(400, cadre.offsetWidth || 300)   // Google : 400 px au plus
        });
    }

    function connexionGoogle(reponseGoogle) {
        afficherStatut(t('compte_connexion_en_cours'));
        compte.appel('POST', '/compte/google', { credential: reponseGoogle.credential, langue: currentLang })
            .then(function (reponse) {
                if (reponse.statut === 200 && reponse.donnees.jeton) {
                    apresConnexion(reponse.donnees, retourDemande());
                } else {
                    afficherStatut(messageErreur(reponse.donnees), true);
                }
            });
    }


    // --- Facebook ---------------------------------------------------------------------------
    // Sans script de Meta : le bouton mène à la boîte de dialogue de Facebook (aucune requête vers
    // Facebook avant le clic). Facebook revient sur connexion.html avec ?code=…&state=… (ou
    // ?error=… si la personne refuse). La page vérifie state (tiré au hasard au clic, gardé dans
    // sessionStorage), efface tout ça de l'adresse et passe le code au Worker (/compte/facebook),
    // qui l'échange avec la clé secrète de l'application. Si Facebook ne donne pas d'adresse mail,
    // le Worker répond adresse_requise avec un ticket : la page demande l'adresse, puis lien et
    // code comme d'habitude, ticket joint ; Facebook est relié au compte quand le code est validé.
    var PICTO_FACEBOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0866FF" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07"/></svg>';

    function lireFacebook() {
        try {
            return JSON.parse(sessionStorage.getItem(CLE_FACEBOOK) || 'null');
        } catch (e) {
            return null;
        }
    }

    function ecrireFacebook(valeur) {
        try {
            if (valeur) sessionStorage.setItem(CLE_FACEBOOK, JSON.stringify(valeur));
            else sessionStorage.removeItem(CLE_FACEBOOK);
            return true;
        } catch (e) {
            return false;
        }
    }

    function allerChezFacebook() {
        var octets = new Uint8Array(16);
        crypto.getRandomValues(octets);
        var state = Array.prototype.map.call(octets, function (o) { return ('0' + o.toString(16)).slice(-2); }).join('');
        if (!ecrireFacebook({ state: state, langue: currentLang, retour: retourDemande() })) {
            afficherStatut(t('compte_err_facebook'), true);
            return;
        }
        window.location.assign(FACEBOOK_DIALOGUE + '?' + new URLSearchParams({
            client_id: FACEBOOK_APP_ID,
            redirect_uri: FACEBOOK_RETOUR,
            scope: 'email',
            response_type: 'code',
            state: state
        }).toString());
    }

    // Retour de Facebook. Renvoie true si la page s'en occupe (rien d'autre à afficher).
    function retourFacebook() {
        var params = new URLSearchParams(window.location.search);
        if (params.has('state') && (params.has('code') || params.has('error'))) {
            // Code et state effacés de l'adresse (et le « #_=_ » qu'ajoute Facebook)
            history.replaceState(null, '', window.location.pathname);
            var aller = lireFacebook();
            ecrireFacebook(null);
            if (!aller || !aller.state || aller.state !== params.get('state')) {
                afficherAdresse(t('compte_err_facebook'));
                return true;
            }
            var suite = params.get('code') ? { code: params.get('code'), retour: aller.retour } : { annule: true };
            // Facebook revient sur la page française : on passe sur celle de la langue de départ
            if (aller.langue && aller.langue !== currentLang && ecrireFacebook(suite)) {
                window.location.replace((aller.langue === 'fr' ? '/' : '/' + aller.langue + '/') + 'connexion.html');
                return true;
            }
            traiterFacebook(suite);
            return true;
        }
        var enAttente = lireFacebook();
        if (!enAttente || !(enAttente.code || enAttente.annule)) return false;
        ecrireFacebook(null);
        traiterFacebook(enAttente);
        return true;
    }

    function traiterFacebook(suite) {
        if (!suite.code) {
            afficherAdresse(t('compte_facebook_annule'));
            return;
        }
        poserEtat('attente',
            '<div class="connexion-carte">' +
            '  <p class="connexion-statut centre" role="status">' + echapper(t('compte_connexion_en_cours')) + '</p>' +
            '</div>');
        compte.appel('POST', '/compte/facebook', { code: suite.code, redirect_uri: FACEBOOK_RETOUR, langue: currentLang })
            .then(function (reponse) {
                if (reponse.statut === 200 && reponse.donnees.jeton) {
                    apresConnexion(reponse.donnees, suite.retour);
                } else if (reponse.statut === 200 && reponse.donnees.adresse_requise) {
                    afficherAdresse(null, null, { ticket: reponse.donnees.ticket, retour: suite.retour });
                } else {
                    afficherAdresse(messageErreur(reponse.donnees));
                }
            });
    }


    // --- États ----------------------------------------------------------------------------
    // Mise en page validée sur maquettes/connexion/index.html. L'état courant est noté dans
    // zone.dataset.etat (adresse, code, arrivee, connecte).

    var PICTO_ENVELOPPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
    var PICTO_ENVOIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
    var PICTO_PARTIES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>';
    var PICTO_DIRECT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3"/><path d="M21 14v.01"/><path d="M14 21h.01"/><path d="M21 21h-4v-4"/></svg>';

    function poserEtat(etat, html) {
        zone.dataset.etat = etat;
        zone.innerHTML = html;
    }

    // facebook : { ticket, retour } après une connexion Facebook sans adresse mail. Le formulaire
    // est alors seul (ni Google ni Facebook) et la demande porte le ticket.
    function afficherAdresse(message, emailPrecedent, facebook) {
        widgetTurnstile = null;
        var avecGoogle = !facebook && !!GOOGLE_CLIENT_ID && !googleBloque;
        var avecFacebook = !facebook && !!FACEBOOK_APP_ID && !!FACEBOOK_RETOUR;
        var titre = facebook ? 'compte_titre_facebook_adresse'
            : (GOOGLE_CLIENT_ID || avecFacebook ? 'compte_titre_choix' : 'compte_titre_adresse');
        poserEtat('adresse',
            '<h2 class="connexion-titre">' + echapper(t(titre)) + '</h2>' +
            (facebook ? '<p class="connexion-chapo">' + echapper(t('compte_facebook_adresse')) + '</p>' : '') +
            '<form class="connexion-carte" novalidate>' +
            (avecGoogle || avecFacebook
                ? '  <div class="connexion-tiers">' +
                  (avecGoogle ? '    <div class="connexion-google-bouton"></div>' : '') +
                  (avecFacebook ? '    <button type="button" class="connexion-facebook">' + PICTO_FACEBOOK +
                      '<span>' + echapper(t('compte_continuer_facebook')) + '</span></button>' : '') +
                  '    <p class="connexion-ou"><span>' + echapper(t('compte_ou')) + '</span></p>' +
                  '  </div>'
                : '') +
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
        if (avecGoogle) {
            chargerGoogle();
            poserGoogle();
        }
        var boutonFacebook = zone.querySelector('.connexion-facebook');
        if (boutonFacebook) boutonFacebook.addEventListener('click', allerChezFacebook);

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
            var corps = { email: email, langue: currentLang, turnstile: jetonTurnstile };
            if (facebook) corps.ticket_facebook = facebook.ticket;
            compte.appel('POST', '/compte/lien', corps)
                .then(function (reponse) {
                    bouton.disabled = false;
                    if (reponse.statut === 200 && reponse.donnees.demande) {
                        var demande = {
                            demande: reponse.donnees.demande, email: email, expire: Date.now() + DUREE_DEMANDE,
                            retour: facebook ? facebook.retour : retourDemande(), facebook: facebook || null
                        };
                        ecrireDemande(demande);
                        afficherCode(demande);
                    } else if (reponse.donnees.erreur === 'ticket_facebook') {
                        // Ticket expiré : formulaire normal, avec Google et Facebook
                        afficherAdresse(messageErreur(reponse.donnees), email);
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
            afficherAdresse(null, demande.email, demande.facebook);
        });
        zone.querySelector('[data-action="changer"]').addEventListener('click', function () {
            ecrireDemande(null);
            afficherAdresse(null, null, demande.facebook);
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
            // Identifiant de la demande : seulement dans le navigateur qui l'a faite. Le Worker ne
            // relie un compte Facebook (demande avec ticket) qu'avec lui.
            compte.appel('POST', '/compte/connexion', { lien: jetonLien, demande: demande ? demande.demande : undefined })
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
    // destination : où aller si le compte a déjà un pseudo, à défaut de ?retour= (l'accueil, ou
    // « Mon compte » quand on arrive ici déjà connecté).
    function afficherConnecte(message, destination) {
        var session = compte.session();
        if (!session) {
            afficherAdresse();
            return;
        }
        var retour = retourDemande() || retourApresPseudo;
        if (session.pseudo) {
            window.location.replace(retour || destination || prefixe);
            return;
        }
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
                        window.location.href = retour || prefixe;
                    } else {
                        afficherStatut(messageErreur(reponse.donnees), true);
                        champ.focus();
                    }
                });
        });
    }

    function pourquoiHtml() {
        function avantage(picto, titre, texte) {
            return '  <div class="connexion-avantage">' +
                '    <div class="connexion-picto">' + picto + '</div>' +
                '    <div><strong>' + titre + '</strong><span>' + echapper(texte) + '</span></div>' +
                '  </div>';
        }
        return '<section class="connexion-pourquoi">' +
            '  <h2>' + echapper(t('compte_pourquoi_titre')) + '</h2>' +
            avantage(PICTO_PARTIES, echapper(t('compte_avantage_parties_titre')), t('compte_avantage_compteur')) +
            avantage(PICTO_DIRECT, echapper(t('compte_avantage_direct_titre')), t('compte_avantage_direct')) +
            avantage(PICTO_ENVOIS, echapper(t('compte_avantage_envois_titre')), t('compte_avantage_envois')) +
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
    } else if (retourFacebook()) {
        // rien d'autre : retour de Facebook, traité par traiterFacebook
    } else if (compte.session()) {
        afficherConnecte(null, prefixe + 'mon-compte.html');
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
