// ===================== Pages commune : fiche du terrain sur place =====================
// Pages commune/<slug>.html (écrites par scripts/generer_communes.py). Chargé avec defer, donc
// après script.js, dont il réutilise les briques.
//
// Chaque carte de terrain est un lien vers la carte de l'accueil (?lat=…&lon=…) : c'est sa
// destination sans JavaScript, et celle d'un Ctrl+clic ou d'un clic du milieu. Un clic simple
// ouvre plutôt la fiche complète ici même (photos, itinéraire, partage, notes, avis), dans la
// fenêtre qu'utilise déjà la carte (voir ouvrirFicheMobileTerrain dans script.js). La fiche est
// construite par les mêmes fonctions, sur un marqueur posé sur la carte masquée de la page.
//
// L'adresse prend le terrain (#way-123) : le bouton retour du téléphone ferme la fiche au lieu
// de quitter la page, et une adresse partagée rouvre la page avec la fiche.
//
// Les cartes reçoivent aussi la note des joueurs (★ 4,5 (12 notes)) dès qu'elle arrive du Worker.

(function () {
    var cartes = document.querySelectorAll('.commune-terrain[data-osm]');
    if (!cartes.length || typeof window.brancherPopupTerrain !== 'function') return;

    var marqueurs = {};   // osm_id -> marqueur Leaflet, créé à la première ouverture
    var ouvert = null;    // osm_id de la fiche affichée

    var PICTO_CARTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>'
        + '<circle cx="12" cy="10" r="3"/></svg>';

    // « way/123 » <-> « #way-123 » (une barre oblique dans l'ancre serait mal comprise)
    function ancre(osmId) { return '#' + osmId.replace('/', '-'); }
    function terrainDeLAdresse() {
        var m = /^#(node|way|relation)-(\d+)$/.exec(window.location.hash);
        return m ? m[1] + '/' + m[2] : null;
    }
    function carteDuTerrain(osmId) {
        return document.querySelector('.commune-terrain[data-osm="' + osmId + '"]');
    }

    // Lien « Voir sur la carte », juste au-dessus du pied de la fiche : même bloc que « Voir les
    // N terrains de … » sur la carte (.fiche-lien-bloc), qui n'apparaît pas ici puisqu'on est
    // déjà sur la page de la commune. Après coup (setTimeout) : la fiche n'est déplacée dans sa
    // fenêtre qu'une fois tous les écouteurs « popupopen » passés.
    function ajouterLienCarte(feature) {
        setTimeout(function () {
            var c = feature.geometry.coordinates;
            var racine = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
            document.querySelectorAll('#mobile-sheet-content .fiche-pied, #desktop-modal-content .fiche-pied')
                .forEach(function (pied) {
                    if (pied.parentElement.querySelector('.fiche-lien-bloc')) return;
                    var lien = document.createElement('a');
                    lien.className = 'fiche-lien-bloc';
                    lien.href = racine + '?lat=' + c[1] + '&lon=' + c[0];
                    lien.innerHTML = PICTO_CARTE + '<span>' + t('commune_voir_carte') + '</span>'
                        + '<span aria-hidden="true">→</span>';
                    pied.before(lien);
                });
        }, 0);
    }

    function ouvrir(osmId) {
        terrainsGeojson.then(function (data) {
            var feature = data.features.find(function (f) { return f.properties.osm_id === osmId; });
            if (!feature) {
                // Terrain disparu des données depuis l'écriture de la page : la carte, en secours.
                var carte = carteDuTerrain(osmId);
                if (carte) window.location.href = carte.href;
                return;
            }
            var marqueur = marqueurs[osmId];
            if (!marqueur) {
                var c = feature.geometry.coordinates;
                marqueur = L.marker([c[1], c[0]], { icon: terrainMarkerIcon });
                marqueur.feature = feature;
                window.brancherPopupTerrain(marqueur, feature);
                marqueur.on('popupopen', function () {
                    ouvert = osmId;
                    ajouterLienCarte(feature);
                });
                marqueur.on('popupclose', function () {
                    ouvert = null;
                    // Fermée par la croix ou le voile : on retire le terrain de l'adresse en
                    // revenant à l'entrée d'avant, celle de la page sans fiche.
                    if (terrainDeLAdresse() === osmId) history.back();
                });
                marqueur.addTo(map);
                marqueurs[osmId] = marqueur;
            }
            marqueur.openPopup();
        });
    }

    cartes.forEach(function (carte) {
        carte.addEventListener('click', function (e) {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            var osmId = carte.dataset.osm;
            if (terrainDeLAdresse() !== osmId) history.pushState(null, '', ancre(osmId));
            ouvrir(osmId);
        });
    });

    // Boutons précédent / suivant : l'adresse décide si une fiche est ouverte.
    window.addEventListener('popstate', function () {
        var osmId = terrainDeLAdresse();
        if (osmId && osmId !== ouvert && carteDuTerrain(osmId)) {
            ouvrir(osmId);
        } else if (!osmId && ouvert) {
            map.closePopup();
        }
    });

    // Arrivée par une adresse avec terrain : on glisse d'abord dessous l'entrée de la page sans
    // fiche, pour que fermer la fiche ramène à la page et non au site d'où l'on vient.
    var depart = terrainDeLAdresse();
    if (depart && carteDuTerrain(depart)) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        history.pushState(null, '', ancre(depart));
        ouvrir(depart);
    }

    // ----- Notes des joueurs sur les cartes -----
    // Cumulées par groupe de pistes (voir cumulerNotes dans script.js), comme dans la fiche.
    // Rien tant que personne n'a voté : une étoile grise sur chaque carte n'apprendrait rien.
    function afficherNotes() {
        cartes.forEach(function (carte) {
            var resume = window.mapetanqueResumeNote(carte.dataset.osm);
            var zone = carte.querySelector('.commune-terrain-note');
            if (!resume) {
                if (zone) zone.remove();
                return;
            }
            if (!zone) {
                zone = document.createElement('span');
                zone.className = 'commune-terrain-note';
                carte.querySelector('.commune-terrain-nom').after(zone);
            }
            zone.innerHTML = window.mapetanqueEtoileHtml(resume.moyenne) + ' ' + resume.texte;
        });
    }
    window.addEventListener('mapetanque:notes', afficherNotes);
    afficherNotes();
})();
