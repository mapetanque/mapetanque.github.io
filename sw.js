// Service worker de l'application Mapetanque (PWA).
//
// Stratégie « le réseau d'abord » : chaque fichier du site est toujours redemandé au serveur,
// et la copie gardée en cache ne sert que si le réseau ne répond pas (pas de connexion). Le site
// installé reste donc toujours à jour, sans numéro de version à changer à chaque publication.
//
// Seuls les fichiers du site lui-même passent par ici : fonds de carte, Leaflet (unpkg), Nominatim,
// Mapillary et Worker Cloudflare vont directement au réseau, sans être touchés.
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
body { font-family: system-ui, sans-serif; background: #f7f9f6; color: #1b2218;
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

self.addEventListener('fetch', function (evenement) {
    const requete = evenement.request;
    const url = new URL(requete.url);

    // Ne s'occupe que des lectures (GET) de fichiers du site ; le reste suit son cours normal.
    if (requete.method !== 'GET' || url.origin !== self.location.origin) return;

    evenement.respondWith(
        fetch(requete)
            .then(function (reponse) {
                // Garde une copie des réponses valides pour pouvoir les resservir hors ligne.
                if (reponse.ok && reponse.type === 'basic') {
                    const copie = reponse.clone();
                    caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
                }
                return reponse;
            })
            .catch(function () {
                // Pour une page, ignore les paramètres d'adresse (?lat=…&lon=… d'un lien partagé) :
                // la page déjà visitée sans eux fait l'affaire.
                return caches.match(requete, { ignoreSearch: requete.mode === 'navigate' }).then(function (enCache) {
                    if (enCache) return enCache;
                    if (requete.mode === 'navigate') {
                        return new Response(PAGE_HORS_LIGNE, {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        });
                    }
                    return Response.error();
                });
            })
    );
});
