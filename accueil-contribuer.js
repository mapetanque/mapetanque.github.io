// ===================== Accueil : bande « Aidez-nous à compléter la carte ! » =====================
// Section #contribuer des quatre index.html (styles : /style-accueil-contribuer.css). Maquette
// validée le 17/10/2026 : maquettes/contribuer-accueil/index.html. Elle prend la place de la
// bande « respiration » une visite sur deux (petit script dans index.html, juste après elle).
//   - Le nombre de terrains sans photo et la jauge sont posés par mettreAJourStats (script.js).
//   - « Terrains sans photo près de moi » : les trois plus proches de la position du visiteur
//     (Bruxelles si elle n'est pas disponible), avec un lien vers la carte filtrée.
//   - Les cartes « action » : photo (lance la recherche ci-dessus), terrain manquant (formulaire
//     de signalement), erreur (page carte, où l'on ouvre la fiche à corriger).
//   - Connecté : le badge Cartographe du compte (GET /compte/contributions, comme Mon compte)
//     remplace l'invitation à créer un compte.
//
// Chargé après script.js (t, currentLang, terrainsGeojson, photosMapillaryPret, terrainAUnePhoto,
// calculDistance, formaterDistanceKm, formaterNombre, communeOfficielle, urlPageCarte,
// medaillonBadge, BADGES_VIDES, sessionCompte, entetesCompte, MAPETANQUE_URL_COMPTES).
(function () {
    var zone = document.getElementById('contribuer');
    if (!zone) return;

    var NB_PROCHES = 3;
    var BRUXELLES = [50.8467, 4.3525];
    var POINTS_PREMIERE_PHOTO = 5;      // photo (2) + bonus première photo (3), voir NOTES_badges.md

    var bouton = zone.querySelector('.contribuer-chercher');
    var libelleBouton = bouton.querySelector('span');
    var cadreProches = zone.querySelector('.contribuer-proches');
    var derniereRecherche = null;       // { position, repli } pour redessiner si la langue change
    var badgeCompte = null;             // badge Cartographe du compte connecté

    var PICTO_PHOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

    function echapper(texte) {
        return echapperAvis(String(texte));
    }

    // « 1 point » / « 12 points » : clé_1 pour un, clé sinon (comme Mon compte).
    function avecNombre(cle, n) {
        return t(cle + (n === 1 ? '_1' : '')).replace('{n}', formaterNombre(n));
    }

    // --- Terrains sans photo les plus proches -----------------------------------------------

    // Terrains et photos : déjà demandés par script.js (pied de page). Si script.js est une
    // version plus ancienne restée en cache, on attend simplement les photos de la même façon.
    function terrainsSansPhoto() {
        var photos = window.photosMapillaryPret || Promise.resolve();
        return Promise.all([terrainsGeojson, photos]).then(function (res) {
            return res[0].features.filter(function (f) { return !terrainAUnePhoto(f.properties); });
        });
    }

    function nomTerrain(p) {
        return p.nearest_street ? t('popup_terrain_prefix') + ' ' + p.nearest_street : t('popup_terrain_default');
    }

    function nomCommune(p) {
        var commune = typeof communeOfficielle === 'function' ? communeOfficielle(p) : null;
        return commune ? commune.nom : (p.commune || '');
    }

    function dessinerProches() {
        if (!derniereRecherche) return;
        var position = derniereRecherche.position;
        terrainsSansPhoto().then(function (liste) {
            var proches = liste.map(function (f) {
                var c = f.geometry.coordinates;
                return { f: f, d: calculDistance(position[0], position[1], c[1], c[0]) };
            }).sort(function (a, b) { return a.d - b.d; }).slice(0, NB_PROCHES);

            zone.querySelector('.contribuer-proches-info').textContent =
                t(derniereRecherche.repli ? 'contribuer_position_refusee' : 'contribuer_proches_info');
            zone.querySelector('.contribuer-proches-liste').innerHTML = proches.map(function (x) {
                var p = x.f.properties, c = x.f.geometry.coordinates;
                var lieu = [nomCommune(p), formaterDistanceKm(x.d)].filter(Boolean).join(' · ');
                return '<li><a class="contribuer-proche-lien" href="' + urlPageCarte('?lat=' + c[1] + '&lon=' + c[0] + '&voir=1') + '">'
                    + '<span class="contribuer-rond">' + PICTO_PHOTO + '</span>'
                    + '<span><span class="contribuer-proche-nom">' + echapper(nomTerrain(p)) + '</span>'
                    + '<span class="contribuer-proche-lieu">' + echapper(lieu) + '</span></span>'
                    + '<span class="contribuer-pastille-points">' + echapper(t('contribuer_pts').replace('{n}', POINTS_PREMIERE_PHOTO)) + '</span>'
                    + '</a></li>';
            }).join('');
            cadreProches.hidden = false;
            bouton.disabled = false;
            bouton.classList.replace('principal', 'clair');
            libelleBouton.textContent = t('contribuer_actualiser');
        });
    }

    function chercherProches() {
        bouton.disabled = true;
        libelleBouton.textContent = t('contribuer_recherche');
        var repli = function () {
            derniereRecherche = { position: BRUXELLES, repli: true };
            dessinerProches();
        };
        if (!navigator.geolocation) return repli();
        navigator.geolocation.getCurrentPosition(function (pos) {
            derniereRecherche = { position: [pos.coords.latitude, pos.coords.longitude], repli: false };
            dessinerProches();
        }, repli, { timeout: 10000, maximumAge: 300000 });
    }

    bouton.addEventListener('click', chercherProches);

    // --- Cartes « action » --------------------------------------------------------------------

    zone.querySelector('[data-action="photo"]').addEventListener('click', function () {
        zone.querySelector('.contribuer-proche').scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!bouton.disabled) chercherProches();
    });
    zone.querySelector('[data-action="terrain"]').addEventListener('click', function () {
        if (window.mapetanqueSignalerTerrain) window.mapetanqueSignalerTerrain();
    });

    // --- Badge Cartographe ---------------------------------------------------------------------

    function dessinerBadges() {
        if (typeof medaillonBadge !== 'function') return;
        zone.querySelector('.contribuer-badge.visiteur .contribuer-badge-medaillon').innerHTML =
            medaillonBadge('cartographe', 0, 'contribuer');
        if (!badgeCompte) return;

        var b = badgeCompte;
        var connecte = zone.querySelector('.contribuer-badge.connecte');
        connecte.querySelector('.contribuer-badge-medaillon').innerHTML = medaillonBadge('cartographe', b.niveau, 'contribuer');
        connecte.querySelector('.contribuer-badge-resume').textContent =
            (b.niveau ? t('badge_niveau').replace('{n}', b.niveau) : t('badge_sans_niveau')) + ' · ' + avecNombre('badge_points', b.valeur);
        var reste = connecte.querySelector('.contribuer-badge-reste');
        var astuce = connecte.querySelector('.contribuer-badge-astuce');
        var barre = connecte.querySelector('.contribuer-badge-barre span');
        if (b.suivant === null) {
            reste.textContent = t('badge_max');
            astuce.textContent = '';
            barre.style.width = '100%';
        } else {
            var manque = b.suivant - b.valeur;
            reste.textContent = avecNombre('badge_reste_points', manque).replace('{niveau}', b.niveau + 1);
            astuce.textContent = avecNombre('contribuer_astuce', Math.ceil(manque / POINTS_PREMIERE_PHOTO));
            barre.style.width = Math.round(100 * (b.valeur - b.seuil) / (b.suivant - b.seuil)) + '%';
        }
    }

    // Connecté : l'invitation à créer un compte disparaît tout de suite ; le badge du compte
    // s'affiche quand le Worker a répondu (rien en cas d'erreur ou de session expirée).
    function chargerBadgeCompte() {
        if (typeof sessionCompte !== 'function' || !sessionCompte()) return;
        zone.querySelector('.contribuer-badge.visiteur').hidden = true;
        fetch(MAPETANQUE_URL_COMPTES + '/compte/contributions', { headers: entetesCompte() })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (donnees) {
                if (!donnees) return;
                badgeCompte = (donnees.badges || BADGES_VIDES).cartographe || BADGES_VIDES.cartographe;
                zone.querySelector('.contribuer-badge.connecte').hidden = false;
                dessinerBadges();
            });
    }

    // --- Démarrage --------------------------------------------------------------------------

    dessinerBadges();
    chargerBadgeCompte();

    // Retour en arrière vers une autre langue : les textes écrits ici suivent (les data-i18n
    // sont réécrits par appliquerTraductions dans script.js).
    window.addEventListener('popstate', function () {
        dessinerBadges();
        dessinerProches();
        if (!bouton.disabled) {
            libelleBouton.textContent = t(derniereRecherche ? 'contribuer_actualiser' : 'contribuer_proches');
        }
    });
})();
