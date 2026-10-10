// ===================== Compte du visiteur =====================
// Session de connexion gardée dans ce navigateur (connexion par lien ou code à 6 chiffres, voir
// NOTES_comptes_utilisateurs.md). Autonome comme compteur.js : ne dépend ni de script.js ni de
// translations.js, pour pouvoir être chargé sur toutes les pages.
//
// Le jeton de session part dans l'en-tête Authorization, pas dans un cookie : le Worker est sur
// workers.dev et le site sur mapetanque.be, un cookie y serait un cookie tiers (bloqué par Safari).
// Ce jeton est lisible par le JavaScript de la page : tout texte saisi par les visiteurs doit
// donc rester échappé à l'affichage (echapperAvis).
//
// Ce que les pages utilisent : window.mapetanqueCompte (ci-dessous) et l'événement
// « mapetanque:compte », envoyé à chaque connexion ou déconnexion, y compris depuis un autre
// onglet.
(function () {
    var URL_COMPTES = "https://mapetanque-comptes.mapetanque.workers.dev";
    var CLE_SESSION = 'mapetanque_session';

    // { jeton, email, pseudo, langue } ou null. L'adresse et le pseudo sont gardés ici pour
    // afficher l'en-tête sans requête ; la vérification auprès du Worker est faite par verifier().
    function lire() {
        try {
            var session = JSON.parse(localStorage.getItem(CLE_SESSION) || 'null');
            return session && typeof session.jeton === 'string' ? session : null;
        } catch (e) {
            return null;   // navigation privée stricte ou valeur corrompue : pas de session
        }
    }

    function ecrire(session) {
        try {
            if (session) localStorage.setItem(CLE_SESSION, JSON.stringify(session));
            else localStorage.removeItem(CLE_SESSION);
        } catch (e) { }
        prevenir();
    }

    function prevenir() {
        window.dispatchEvent(new CustomEvent('mapetanque:compte'));
    }

    // Connexion ou déconnexion dans un autre onglet
    window.addEventListener('storage', function (e) {
        if (e.key === CLE_SESSION) prevenir();
    });

    function entetes() {
        var session = lire();
        return session ? { 'Authorization': 'Bearer ' + session.jeton } : {};
    }

    // Requête au Worker des comptes. Ne rejette jamais : renvoie { statut, donnees }, avec
    // statut 0 et l'erreur « reseau » si le Worker est injoignable.
    function appel(methode, chemin, corps) {
        var options = { method: methode, headers: entetes() };
        if (corps) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(corps);
        }
        return fetch(URL_COMPTES + chemin, options)
            .then(function (r) {
                return r.json()
                    .catch(function () { return {}; })
                    .then(function (donnees) { return { statut: r.status, donnees: donnees || {} }; });
            })
            .catch(function () { return { statut: 0, donnees: { erreur: 'reseau' } }; });
    }

    window.mapetanqueCompte = {
        session: lire,
        entetes: entetes,
        appel: appel,

        // Réponse de /compte/connexion ou /compte/code : { jeton, compte: { email, pseudo, langue } }
        ouvrir: function (reponse) {
            ecrire({
                jeton: reponse.jeton,
                email: reponse.compte.email,
                pseudo: reponse.compte.pseudo || null,
                langue: reponse.compte.langue
            });
        },

        // Pseudo enregistré par le Worker (/compte/pseudo) : mis à jour aussi dans la session,
        // pour que l'en-tête et les autres onglets l'affichent sans requête.
        majPseudo: function (pseudo) {
            var session = lire();
            if (!session) return;
            session.pseudo = pseudo || null;
            ecrire(session);
        },

        // La session est oubliée tout de suite ; le Worker l'efface ensuite de son côté.
        deconnecter: function () {
            var avant = entetes();
            ecrire(null);
            if (avant.Authorization) {
                fetch(URL_COMPTES + '/compte/deconnexion', { method: 'POST', headers: avant }).catch(function () { });
            }
        },

        // Compte supprimé (/compte/supprimer) : le Worker a déjà effacé toutes les sessions.
        oublier: function () {
            ecrire(null);
        },

        // Demande au Worker si la session vaut toujours (expirée, effacée depuis un autre appareil…)
        // et met à jour l'adresse et le pseudo. Worker injoignable : la session est gardée.
        verifier: function () {
            var session = lire();
            if (!session) return Promise.resolve(null);
            return appel('GET', '/compte/moi').then(function (reponse) {
                if (reponse.statut === 401) {
                    ecrire(null);
                    return null;
                }
                if (reponse.statut === 200) {
                    session.email = reponse.donnees.email;
                    session.pseudo = reponse.donnees.pseudo || null;
                    session.langue = reponse.donnees.langue;
                    session.cree = reponse.donnees.cree;   // date de création, pour « Mon compte »
                    ecrire(session);
                }
                return lire();
            });
        }
    };
})();
