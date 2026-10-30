// ===================== Passage vers l'espace des clubs =====================
// vers-clubs.html?retour=<adresse de l'espace du club> : « Se connecter avec mapetanque.be »
// depuis l'espace des clubs. L'espace des clubs n'a pas de page Connexion à lui : il envoie ici,
// et cette page lui rend un ticket qui dit qui est connecté (NOTES_demo.md du dépôt
// mapetanque-clubs, « Connexion commune avec mapetanque.be »).
//   - pas connecté (ou session expirée) : détour par connexion.html, qui revient ici une fois
//     connecté (mail, Google ou Facebook) ;
//   - connecté : ticket demandé au Worker des comptes (POST /compte/ticket-clubs → { ticket },
//     ou { erreur: "non_connecte" } en 401, { erreur: "retour_invalide" } en 400), à usage
//     unique et valable 60 secondes, puis départ vers retour#ticket=…. Le ticket va après « # » :
//     il n'est jamais envoyé à un serveur, ni dans l'en-tête Referer.
// Le Worker vérifie lui aussi l'adresse de retour : la liste ci-dessous évite seulement
// d'envoyer quelqu'un se connecter pour rien.
//
// Chargé après compte.js (window.mapetanqueCompte). Ni script.js ni translations.js : page en
// français seulement, sans en-tête.
(function () {
    var zone = document.getElementById('passage');
    var compte = window.mapetanqueCompte;
    if (!zone || !compte) return;

    var ORIGINES_CLUBS = [
        'https://clubs.mapetanque.be',
        'https://mapetanque-clubs.pages.dev',
        'http://127.0.0.1:5500',   // Live Server de l'espace des clubs
        'http://localhost:5500'
    ];
    // Aperçus des branches : https://<branche>.mapetanque-clubs.pages.dev
    var APERCU_CLUBS = /^https:\/\/[a-z0-9-]+\.mapetanque-clubs\.pages\.dev$/;

    // Adresse de retour sans son « # », ou null si ce n'est pas une adresse des clubs.
    function adresseRetour() {
        var brut = new URLSearchParams(window.location.search).get('retour');
        if (!brut) return null;
        var url;
        try {
            url = new URL(brut);
        } catch (e) {
            return null;
        }
        if (url.username || url.password) return null;
        if (ORIGINES_CLUBS.indexOf(url.origin) < 0 && !APERCU_CLUBS.test(url.origin)) return null;
        url.hash = '';
        return url.href;
    }

    function afficher(message, avecBouton) {
        zone.innerHTML = '';
        var p = document.createElement('p');
        p.setAttribute('role', 'status');
        p.textContent = message;
        zone.appendChild(p);
        if (!avecBouton) return;
        p.className = 'erreur';
        var bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = 'Réessayer';
        bouton.addEventListener('click', passer);
        zone.appendChild(bouton);
        bouton.focus();
    }

    // Détour par la page Connexion. Le chemin de retour garde l'adresse des clubs encodée :
    // connexion.js le lit tel quel dans ?retour= (retourDemande) et y revient après la connexion.
    function allerSeConnecter() {
        window.location.replace('/connexion.html?retour=' +
            encodeURIComponent('/vers-clubs.html?retour=' + encodeURIComponent(retour)));
    }

    function passer() {
        var session = compte.session();
        // Sans pseudo, la page Connexion le demande d'abord, puis revient ici.
        if (!session || !session.pseudo) {
            allerSeConnecter();
            return;
        }
        afficher('Connexion…');
        compte.appel('POST', '/compte/ticket-clubs', { retour: retour })
            .then(function (reponse) {
                var ticket = reponse.donnees.ticket;
                if (reponse.statut === 200 && typeof ticket === 'string' && /^[A-Za-z0-9_-]+$/.test(ticket)) {
                    window.location.replace(retour + '#ticket=' + ticket);
                } else if (reponse.statut === 401) {
                    // Session expirée ou effacée depuis un autre appareil : oubliée ici aussi,
                    // sinon la page Connexion nous renverrait tout de suite ici.
                    compte.oublier();
                    allerSeConnecter();
                } else if (reponse.donnees.erreur === 'retour_invalide') {
                    // Adresse refusée par le Worker : réessayer n'y changerait rien
                    lienNonValable();
                } else if (reponse.statut === 0) {
                    afficher('Pas de réponse de mapetanque.be. Vérifiez votre connexion internet.', true);
                } else {
                    afficher('La connexion à l’espace des clubs n’a pas abouti.', true);
                }
            });
    }

    function lienNonValable() {
        afficher('Ce lien vers l’espace des clubs n’est pas valable.');
        zone.firstChild.className = 'erreur';
    }

    var retour = adresseRetour();
    if (!retour) {
        lienNonValable();
    } else {
        passer();
    }
})();
