// Service worker de l'application Mapetanque (PWA).
//
// Stratégie « le cache d'abord, mis à jour en arrière-plan » (stale-while-revalidate) : un fichier
// déjà vu est servi tout de suite depuis le cache, et redemandé au serveur en même temps pour
// remplacer la copie. L'application s'ouvre ainsi sans attendre le réseau ; une nouvelle version
// publiée apparaît à l'ouverture suivante, sans numéro de version à changer à chaque publication.
// Un fichier jamais vu part au réseau ; sans connexion, une page jamais visitée affiche
// PAGE_HORS_LIGNE.
//
// Exceptions, toujours redemandées au serveur (le cache ne sert que sans connexion) :
//   - le site servi en local (Live Server) : les tests doivent montrer la dernière modification ;
//   - la page d'administration et tout ce qu'elle charge : on y veut des données fraîches.
//
// Seuls les fichiers du site lui-même passent par ici (Leaflet compris, hébergé dans /lib/) : fonds
// de carte, Nominatim, Mapillary et Worker Cloudflare vont directement au réseau, sans être touchés.
//
// Ce fichier doit rester à la racine du site : un service worker ne contrôle que les pages situées
// dans son dossier et en dessous.

const CACHE = 'mapetanque-v1';

// Message affiché quand on ouvre une page jamais visitée sans connexion.
const PAGE_HORS_LIGNE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mapetanque</title>
<style>
body { font-family: system-ui, sans-serif; background: #f7f9f6; color: #1D2619;
       display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
main { max-width: 26rem; padding: 2rem; text-align: center; }
img { width: 72px; height: 72px; }
p { margin: 0.6rem 0; }
button { margin-top: 1.2rem; padding: 0.6rem 1.4rem; border: 0; border-radius: 999px;
         background: #74c15a; color: white; font-size: 1rem; }
</style>
</head>
<body>
<main>
<img src="/images/icone-192.png" alt="">
<p><strong>Pas de connexion internet.</strong></p>
<p lang="nl">Geen internetverbinding.</p>
<p lang="de">Keine Internetverbindung.</p>
<p lang="en">No internet connection.</p>
<button onclick="location.reload()">↻</button>
</main>
</body>
</html>`;

// À l'installation : met de côté l'icône utilisée par la page hors ligne.
self.addEventListener('install', function (evenement) {
    evenement.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.add('/images/icone-192.png'); })
            .then(function () { return self.skipWaiting(); })
    );
});

// À l'activation : supprime les caches d'une version précédente de ce fichier.
self.addEventListener('activate', function (evenement) {
    evenement.waitUntil(
        caches.keys()
            .then(function (noms) {
                return Promise.all(noms
                    .filter(function (nom) { return nom !== CACHE; })
                    .map(function (nom) { return caches.delete(nom); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

const EN_LOCAL = ['localhost', '127.0.0.1'].indexOf(self.location.hostname) !== -1;

function estAdmin(chemin) {
    return chemin.indexOf('/admin') === 0;
}

// Va chercher la réponse au serveur et en garde une copie pour la prochaine fois.
// `cle` : adresse sous laquelle la ranger (voir cleDeCache). L'écriture dans le cache est
// rattachée à l'événement : le navigateur ne doit pas arrêter le service worker avant qu'elle
// soit finie, mais la réponse, elle, n'a pas à l'attendre.
function telechargerEtGarder(evenement, requete, cle) {
    return fetch(requete).then(function (reponse) {
        if (reponse.ok && reponse.type === 'basic') {
            const copie = reponse.clone();
            evenement.waitUntil(caches.open(CACHE)
                .then(function (cache) { return cache.put(cle, copie); })
                .catch(function () {}));
        }
        return reponse;
    });
}

// Une page est rangée sans ses paramètres d'adresse (?lat=…&lon=… d'un lien partagé) : c'est le
// script qui les lit, la page elle-même est la même. Sans ça, chaque lien partagé ouvert
// ajouterait une copie de la page au cache.
function cleDeCache(requete) {
    if (requete.mode !== 'navigate') return requete;
    const url = new URL(requete.url);
    url.search = '';
    return url.href;
}

function horsLigne(requete) {
    if (requete.mode === 'navigate') {
        return new Response(PAGE_HORS_LIGNE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
    return Response.error();
}

self.addEventListener('fetch', function (evenement) {
    const requete = evenement.request;
    const url = new URL(requete.url);

    // Ne s'occupe que des lectures (GET) de fichiers du site ; le reste suit son cours normal.
    if (requete.method !== 'GET' || url.origin !== self.location.origin) return;

    const cle = cleDeCache(requete);
    const depuisAdmin = estAdmin(url.pathname)
        || (requete.referrer && estAdmin(new URL(requete.referrer).pathname));

    // Le réseau d'abord : le cache ne sert que si le réseau ne répond pas.
    if (EN_LOCAL || depuisAdmin) {
        evenement.respondWith(
            telechargerEtGarder(evenement, requete, cle).catch(function () {
                return caches.match(cle).then(function (enCache) {
                    return enCache || horsLigne(requete);
                });
            })
        );
        return;
    }

    // Le cache d'abord, mis à jour en arrière-plan.
    const reseau = telechargerEtGarder(evenement, requete, cle);
    // Garde le service worker en vie jusqu'à la fin de la mise à jour, même une fois la copie
    // du cache déjà servie ; une erreur réseau ici est sans conséquence.
    evenement.waitUntil(reseau.then(function () {}, function () {}));

    evenement.respondWith(
        caches.match(cle).then(function (enCache) {
            if (enCache) return enCache;
            return reseau.catch(function () { return horsLigne(requete); });
        })
    );
});
