// ===================== Icônes SVG réutilisables (popups des terrains) =====================

const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
const ICON_ROUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>';
const ICON_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
const ICON_MAP_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
const ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>';

// Icône des marqueurs de terrain sur la carte (pin vert personnalisé, remplace le pin bleu par défaut de Leaflet)
const terrainMarkerIcon = L.divIcon({
    className: 'terrain-marker-icon',
    html: '<svg width="29" height="45" viewBox="0 0 29 45" xmlns="http://www.w3.org/2000/svg">' +
          '<g transform="translate(2,2)">' +
          '<path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#74C15A" stroke="white" stroke-width="2"/>' +
          '<circle cx="12.5" cy="12.5" r="5" fill="white"/>' +
          '</g>' +
          '</svg>',
    iconSize: [29, 45],
    iconAnchor: [14, 43],
    popupAnchor: [0, -36]
});


// ===================== Gestion de la langue =====================

const LANGUES_DISPONIBLES = ['fr', 'nl', 'de'];

function detecterLanguePreferee() {
    const sauvegardee = localStorage.getItem('mapetanque_lang');
    if (sauvegardee && LANGUES_DISPONIBLES.includes(sauvegardee)) {
        return sauvegardee;
    }

    const navigateur = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return LANGUES_DISPONIBLES.includes(navigateur) ? navigateur : 'fr';
}

let currentLang = detecterLanguePreferee();

function t(cle) {
    return translations[currentLang][cle];
}

// Piste du panneau d'info actuellement ouvert, pour le régénérer si la langue change
let panneauOuvertActuel = null;

function appliquerTraductions() {

    const dict = translations[currentLang];

    document.documentElement.lang = dict.html_lang;

    // Textes simples
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = dict[el.dataset.i18n];
    });

    // Attributs aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        el.setAttribute('aria-label', dict[el.dataset.i18nAria]);
    });

    // Attributs placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        el.setAttribute('placeholder', dict[el.dataset.i18nPlaceholder]);
    });

    // (le tagline sous le H1 a été retiré : remplacé par le grand titre "hero_headline" au-dessus
    // des contrôles, pris en charge automatiquement par la boucle [data-i18n] ci-dessus)

    // (le crédit OpenStreetMap a été retiré du footer, pour tenir sur une seule ligne en mobile)

    // Bouton actif dans le sélecteur de langue (nav desktop + menu burger mobile)
    document.querySelectorAll('.lang-link').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });

    // Reconstruire le contenu (statique) des panneaux À propos/FAQ/Contact dans la nouvelle langue
    construireContenuPanneaux();

    // Régénérer les statistiques du footer
    mettreAJourStats();

    // Régénérer le bandeau chiffré de la section statistiques
    mettreAJourBandeauStats();

    // Reconstruire l'entonnoir région/province/commune dans la nouvelle langue (sans re-télécharger
    // les données, déjà en cache dans statsGeoData ; ne fait rien si le fetch n'est pas encore arrivé)
    construireStatsGeo();

    // Actualiser les liens de partage du site dans le footer (texte traduit)
    if (typeof actualiserLiensPartageFooter === 'function') {
        actualiserLiensPartageFooter();
    }

    // Régénérer le titre par défaut d'un éventuel marqueur de recherche déjà ouvert
    if (typeof searchMarker !== 'undefined' && searchMarker && searchMarker.isPopupOpen()) {
        searchMarker.getPopup().setContent(searchMarker._displayName || '');
    }
}

function changerLangue(langue) {
    if (!LANGUES_DISPONIBLES.includes(langue)) return;
    currentLang = langue;
    localStorage.setItem('mapetanque_lang', langue);
    appliquerTraductions();
}

document.querySelectorAll('.lang-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
        changerLangue(btn.dataset.lang);
    });
});


// ===================== Carte =====================

// Création de la carte centrée sur la Belgique
const map = L.map('map').setView([50.8503, 4.3517], 8);

let userPosition = null;

// Fond OpenStreetMap
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
});

// Fond satellite
const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles &copy; Esri'
    }
);

// Afficher OpenStreetMap par défaut
osm.addTo(map);

// Sélecteur de couches
const baseMaps = {
    "🗺️ Plan": osm,
    "🛰️ Satellite": satellite
};

L.control.layers(baseMaps).addTo(map);

// Sécurité : recalcule la taille de la carte une fois la page pleinement chargée
window.addEventListener('load', function () {
    map.invalidateSize();
});


// ===================== Flèche vers le terrain le plus proche (hors écran) =====================

// Liste plate de tous les terrains (indépendante des clusters), pour un calcul rapide du plus proche
let listeTousLesTerrains = [];

// Commune -> liste de ses terrains {lat, lon, rue}, et commune -> position moyenne {lat, lon}.
// Remplis au chargement de terrains.geojson (voir plus bas), utilisés par la page "Liste des terrains".
const terrainsParCommune = {};
const communesCentres = {};
let terrainLePlusProche = null;

// Élément de la flèche, créé dynamiquement et ajouté à l'intérieur du conteneur de la carte
const flecheProche = document.createElement('div');
flecheProche.id = 'nearest-terrain-arrow';
flecheProche.className = 'nearest-arrow';
flecheProche.style.display = 'none';
flecheProche.innerHTML =
    '<span class="nearest-arrow-icon">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>' +
    '</svg></span>' +
    '<span class="nearest-arrow-label" data-i18n="nearest_terrain_label">Terrain le plus proche</span>';
document.getElementById('map').appendChild(flecheProche);

function trouverTerrainLePlusProche(lat, lon) {
    let plusProche = null;
    let distanceMin = Infinity;

    listeTousLesTerrains.forEach(function (t) {
        const d = calculDistance(lat, lon, t.lat, t.lon);
        if (d < distanceMin) {
            distanceMin = d;
            plusProche = t;
        }
    });

    return plusProche;
}

function mettreAJourFlecheTerrainProche() {

    if (!userPosition || !terrainLePlusProche) {
        flecheProche.style.display = 'none';
        return;
    }

    const latlngCible = L.latLng(terrainLePlusProche.lat, terrainLePlusProche.lon);

    // Le terrain le plus proche est déjà visible à l'écran : pas besoin de flèche
    if (map.getBounds().contains(latlngCible)) {
        flecheProche.style.display = 'none';
        return;
    }

    const tailleCarte = map.getSize();
    const centre = { x: tailleCarte.x / 2, y: tailleCarte.y / 2 };
    const pointCible = map.latLngToContainerPoint(latlngCible);

    const dx = pointCible.x - centre.x;
    const dy = pointCible.y - centre.y;

    // Position de la flèche sur le bord de la carte, en direction de la cible
    const marge = 55;
    const halfW = tailleCarte.x / 2 - marge;
    const halfH = tailleCarte.y / 2 - marge;

    let echelle;
    if (dx === 0) {
        echelle = halfH / Math.abs(dy);
    } else if (dy === 0) {
        echelle = halfW / Math.abs(dx);
    } else {
        echelle = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
    }

    const pointBord = {
        x: centre.x + dx * echelle,
        y: centre.y + dy * echelle
    };

    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    flecheProche.style.left = pointBord.x + 'px';
    flecheProche.style.top = pointBord.y + 'px';
    flecheProche.querySelector('.nearest-arrow-icon').style.transform = 'rotate(' + angle + 'deg)';
    flecheProche.style.display = 'flex';
}

// Recalcule la position/visibilité de la flèche à chaque déplacement ou zoom de la carte
map.on('move zoomend', mettreAJourFlecheTerrainProche);

// Cliquer sur la flèche centre directement la carte sur le terrain visé
flecheProche.addEventListener('click', function () {
    if (terrainLePlusProche) {
        map.setView([terrainLePlusProche.lat, terrainLePlusProche.lon], 17);
    }
});

// Appelé à chaque nouvelle localisation (géolocalisation ou recherche d'adresse)
function definirPositionUtilisateur(lat, lon) {
    userPosition = [lat, lon];
    terrainLePlusProche = trouverTerrainLePlusProche(lat, lon);
    mettreAJourFlecheTerrainProche();
}

// Icône réutilisée pour marquer une position (localisation ou résultat de recherche)
const positionIcon = L.divIcon({
    className: 'user-location',
    html: '<div></div>',
    iconSize: [20, 20]
});


// ===================== Géolocalisation =====================

document.getElementById("locateBtn").addEventListener("click", function () {

    if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(function(position) {

            let lat = position.coords.latitude;
            let lon = position.coords.longitude;

            definirPositionUtilisateur(lat, lon);

            map.setView([lat, lon], 15);

            L.marker([lat, lon], {
                icon: positionIcon
            })
            .addTo(map)
            .bindPopup(function () { return t('popup_here'); })
            .openPopup();

        }, function() {
            alert("Impossible de récupérer votre position.");
        });

    } else {
        alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }

});


// ===================== Recherche d'adresse =====================

let searchMarker = null;

document.getElementById('searchForm').addEventListener('submit', function (e) {

    e.preventDefault();

    const input = document.getElementById('searchInput');
    const errorEl = document.getElementById('searchError');
    const query = input.value.trim();

    errorEl.textContent = '';

    if (!query) return;

    // Recherche biaisée vers la Belgique (sans l'exclure strictement, utile pour les communes frontalières)
    const url = 'https://nominatim.openstreetmap.org/search'
        + '?format=jsonv2'
        + '&q=' + encodeURIComponent(query)
        + '&limit=1'
        + '&viewbox=2.5,51.6,6.5,49.4'
        + '&bounded=0';

    fetch(url)
        .then(function (response) {
            if (!response.ok) throw new Error('Réponse Nominatim invalide');
            return response.json();
        })
        .then(function (resultats) {

            if (!resultats || resultats.length === 0) {
                errorEl.textContent = t('search_no_result');
                return;
            }

            const resultat = resultats[0];
            const lat = parseFloat(resultat.lat);
            const lon = parseFloat(resultat.lon);

            // Le point trouvé devient la référence pour le calcul de distance dans les popups des terrains
            definirPositionUtilisateur(lat, lon);

            // Zoom adapté à la nature du résultat (adresse précise, ville, région...)
            if (resultat.boundingbox) {
                const bbox = resultat.boundingbox.map(parseFloat);
                map.fitBounds([
                    [bbox[0], bbox[2]],
                    [bbox[1], bbox[3]]
                ]);
            } else {
                map.setView([lat, lon], 15);
            }

            if (searchMarker) {
                map.removeLayer(searchMarker);
            }

            searchMarker = L.marker([lat, lon], { icon: positionIcon })
                .addTo(map)
                .bindPopup(resultat.display_name)
                .openPopup();

            searchMarker._displayName = resultat.display_name;

        })
        .catch(function () {
            errorEl.textContent = t('search_failed');
        });

});


// ===================== Partage (site ou terrain précis) =====================

const sharePanel = document.getElementById('share-panel');
const shareOverlay = document.getElementById('share-overlay');
const shareTitleEl = document.getElementById('share-title');
const shareWhatsapp = document.getElementById('share-whatsapp');
const shareFacebook = document.getElementById('share-facebook');
const shareTwitter = document.getElementById('share-twitter');
const shareEmail = document.getElementById('share-email');
const shareCopyBtn = document.getElementById('share-copy');
const shareCopyLabel = document.getElementById('share-copy-label');

function ouvrirPartage(url, titre) {

    shareTitleEl.textContent = titre;

    const urlEncodee = encodeURIComponent(url);
    const texteEncode = encodeURIComponent(titre);

    shareWhatsapp.href = `https://wa.me/?text=${texteEncode}%20${urlEncodee}`;
    shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${urlEncodee}`;
    shareTwitter.href = `https://twitter.com/intent/tweet?url=${urlEncodee}&text=${texteEncode}`;
    shareEmail.href = `mailto:?subject=${texteEncode}&body=${urlEncodee}`;

    // Réinitialiser le libellé du bouton copier (au cas où il affichait "Lien copié !")
    shareCopyLabel.textContent = t('share_copy');
    shareCopyBtn.dataset.url = url;

    sharePanel.classList.add('open');
    shareOverlay.classList.add('visible');
}

function fermerPartage() {
    sharePanel.classList.remove('open');
    shareOverlay.classList.remove('visible');
}

document.getElementById('share-close').addEventListener('click', fermerPartage);
shareOverlay.addEventListener('click', fermerPartage);

shareCopyBtn.addEventListener('click', function () {
    const url = shareCopyBtn.dataset.url || window.location.href;

    navigator.clipboard.writeText(url).then(function () {
        shareCopyLabel.textContent = t('share_copied');
    }).catch(function () {
        // Navigateur trop ancien ou contexte non sécurisé : on sélectionne le texte via un prompt de secours
        window.prompt('Ctrl+C / Cmd+C :', url);
    });
});

// Fonction globale appelée depuis le lien "Partager" de chaque popup de terrain
window.partagerTerrain = function (lat, lon, titre) {
    const url = window.location.origin + window.location.pathname
        + `?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&z=18`;
    ouvrirPartage(url, titre);
};


// ===================== Icônes de partage du site (footer) =====================

const footerShareWhatsapp = document.getElementById('footer-share-whatsapp');
const footerShareFacebook = document.getElementById('footer-share-facebook');
const footerShareTwitter = document.getElementById('footer-share-twitter');
const footerShareEmail = document.getElementById('footer-share-email');
const footerShareCopy = document.getElementById('footer-share-copy');

function actualiserLiensPartageFooter() {

    const url = window.location.origin + window.location.pathname;
    const urlEncodee = encodeURIComponent(url);
    const texteEncode = encodeURIComponent(t('share_site_title'));

    footerShareWhatsapp.href = `https://wa.me/?text=${texteEncode}%20${urlEncodee}`;
    footerShareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${urlEncodee}`;
    footerShareTwitter.href = `https://twitter.com/intent/tweet?url=${urlEncodee}&text=${texteEncode}`;
    footerShareEmail.href = `mailto:?subject=${texteEncode}&body=${urlEncodee}`;
}

const copyTooltip = document.getElementById('copy-tooltip');
let copyTooltipTimeout = null;

footerShareCopy.addEventListener('click', function () {

    const url = window.location.origin + window.location.pathname;

    navigator.clipboard.writeText(url).then(function () {
        footerShareCopy.classList.add('footer-share-copied');

        copyTooltip.textContent = t('share_copied');
        copyTooltip.classList.add('visible');

        clearTimeout(copyTooltipTimeout);
        copyTooltipTimeout = setTimeout(function () {
            footerShareCopy.classList.remove('footer-share-copied');
            copyTooltip.classList.remove('visible');
        }, 2000);

    }).catch(function () {
        // Navigateur trop ancien ou contexte non sécurisé : on sélectionne le texte via un prompt de secours
        window.prompt('Ctrl+C / Cmd+C :', url);
    });
});


// ===================== Calcul de distance =====================

function calculDistance(lat1, lon1, lat2, lon2) {

    const R = 6371; // rayon de la Terre en km

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) *
        Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}


// ===================== Chargement des terrains =====================

const markers = L.markerClusterGroup({
    disableClusteringAtZoom: 16
});

fetch('data/terrains.geojson')
    .then(response => response.json())
    .then(data => {

        // Nombre de terrains recensés (pour le footer)
        afficherNombreTerrains(data.features.length);

        // Liste plate de tous les terrains, pour le calcul du plus proche (flèche hors écran)
        listeTousLesTerrains = data.features.map(function (feature) {
            return {
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0]
            };
        });

        // Index commune -> liste de ses terrains (coordonnées + rue), et commune -> position moyenne
        // de ses terrains (pour centrer la carte dessus) : utilisés par la page "Liste des terrains"
        // (voir construireStatsGeo). Construits ici pour réutiliser les données déjà chargées, sans
        // dupliquer ces informations dans data/stats_geo.json (qui ne contient que des comptages).
        data.features.forEach(function (feature) {
            const commune = feature.properties.commune;
            if (!commune) return;

            const lat = feature.geometry.coordinates[1];
            const lon = feature.geometry.coordinates[0];

            if (!terrainsParCommune[commune]) terrainsParCommune[commune] = [];
            terrainsParCommune[commune].push({ lat: lat, lon: lon, rue: feature.properties.nearest_street || null });
        });

        Object.keys(terrainsParCommune).forEach(function (commune) {
            const terrains = terrainsParCommune[commune];
            const sommeLat = terrains.reduce(function (acc, t) { return acc + t.lat; }, 0);
            const sommeLon = terrains.reduce(function (acc, t) { return acc + t.lon; }, 0);
            communesCentres[commune] = { lat: sommeLat / terrains.length, lon: sommeLon / terrains.length };
        });

        // Les données croisées commune/terrain sont prêtes : (re)construit l'entonnoir si les
        // comptages (data/stats_geo.json) sont eux aussi déjà arrivés
        construireStatsGeo();

        L.geoJSON(data, {

            pointToLayer: function(feature, latlng) {

                return L.marker(latlng, { icon: terrainMarkerIcon });

            },

            onEachFeature: function(feature, layer) {

                let tags = feature.properties;

                function genererContenuPopup() {

                    let acces = (tags.access === "public" || tags.access === "yes")
                        ? t('popup_access_public')
                        : t('popup_access_probable');

                    let titre = tags.nearest_street
                        ? t('popup_terrain_prefix') + " " + tags.nearest_street
                        : t('popup_terrain_default');

                    let distance = "";

                    if (userPosition) {

                        let terrainLat = layer.getLatLng().lat;
                        let terrainLon = layer.getLatLng().lng;

                        let km = calculDistance(
                            userPosition[0],
                            userPosition[1],
                            terrainLat,
                            terrainLon
                        );

                        let valeurDistance = km < 1
                            ? `${Math.round(km * 1000)} m`
                            : `${km.toFixed(1)} km`;

                        distance = `<br><span class="popup-icon">${ICON_PIN}</span> ${t('popup_distance_label')} : ${valeurDistance}`;

                    } else {

                        distance = `<br><span class="popup-icon">${ICON_PIN}</span> ${t('popup_distance_hint')}`;

                    }

                    let terrainLat = layer.getLatLng().lat;
                    let terrainLon = layer.getLatLng().lng;

                    let itineraire = `
                    <br><br>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${terrainLat},${terrainLon}" target="_blank">
                    <span class="popup-link-icon">${ICON_ROUTE}</span> <span class="popup-link-text">${t('popup_itinerary')}</span>
                    </a>
                    `;

                    let partager = `
                    <br>
                    <a href="#" class="popup-share-btn">
                    <span class="popup-link-icon">${ICON_SHARE}</span> <span class="popup-link-text">${t('popup_share')}</span>
                    </a>
                    `;

                    return `
                    <b>${titre}</b><br><br>
                    <span class="popup-icon">${ICON_UNLOCK}</span> ${t('popup_access_label')} : ${acces}
                    ${distance}
                    ${itineraire}
                    ${partager}
                    `;

                }

                layer.bindPopup(genererContenuPopup);

                // Bouton "Partager" du popup : branché à chaque ouverture pour éviter
                // tout souci d'échappement de caractères spéciaux dans le nom de rue
                layer.on('popupopen', function (e) {
                    const boutonPartage = e.popup.getElement().querySelector('.popup-share-btn');
                    if (!boutonPartage) return;

                    boutonPartage.onclick = function (evt) {
                        evt.preventDefault();

                        const titreActuel = tags.nearest_street
                            ? t('popup_terrain_prefix') + " " + tags.nearest_street
                            : t('popup_terrain_default');

                        window.partagerTerrain(layer.getLatLng().lat, layer.getLatLng().lng, titreActuel);
                    };
                });

            }

        }).addTo(markers);

        map.addLayer(markers);

        // Lien de partage d'un terrain précis (?lat=...&lon=...) : centrer et ouvrir son popup
        const urlParams = new URLSearchParams(window.location.search);
        const paramLat = parseFloat(urlParams.get('lat'));
        const paramLon = parseFloat(urlParams.get('lon'));

        if (!isNaN(paramLat) && !isNaN(paramLon)) {
            allerVersTerrain(paramLat, paramLon);
        }

    });


// ===================== Menu burger =====================

const menuButton = document.getElementById("menu-button");
const sideMenu = document.getElementById("side-menu");
const closeMenu = document.getElementById("close-menu");
const menuOverlay = document.getElementById("menu-overlay");

menuButton.addEventListener("click", function () {
    sideMenu.classList.add("open");
    menuOverlay.classList.add("visible");
});

closeMenu.addEventListener("click", function () {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("visible");
});

menuOverlay.addEventListener("click", function () {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("visible");
});


// ===================== Panneau d'info (À propos / Contact / FAQ) =====================

const infoPanel = document.getElementById("info-panel");
const infoOverlay = document.getElementById("info-overlay");
const closeInfo = document.getElementById("close-info");
const infoNavLinks = document.querySelectorAll('.info-nav-link');

function construireContenuAbout(dict) {
    const p = document.createElement('p');
    p.textContent = dict.about_text;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(p);
    return fragment;
}

function construireContenuContact(dict) {
    const p = document.createElement('p');
    p.textContent = dict.contact_text + " ";

    const icone = document.createElement('span');
    icone.className = 'popup-icon';
    icone.innerHTML = ICON_MAIL;
    p.appendChild(icone);
    p.appendChild(document.createTextNode(' '));

    const lien = document.createElement('a');
    lien.href = "mailto:" + dict.contact_email;
    lien.textContent = dict.contact_email;
    p.appendChild(lien);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(p);
    return fragment;
}

function construireContenuFaq(dict) {
    const fragment = document.createDocumentFragment();

    dict.faq_items.forEach(function (item, index) {
        const details = document.createElement('details');
        details.className = 'faq-item';
        details.id = 'faq-item-' + index;

        const summary = document.createElement('summary');
        summary.textContent = item.q;

        const p = document.createElement('p');
        // Remplace les emoji par les icônes SVG cohérentes avec le reste du site
        p.innerHTML = item.a
            .split('📧').join('<span class="popup-icon">' + ICON_MAIL + '</span>')
            .split('📍').join('<span class="popup-icon">' + ICON_PIN + '</span>');

        details.appendChild(summary);
        details.appendChild(p);
        fragment.appendChild(details);
    });

    return fragment;
}

// Construit le contenu des 3 pages du panneau et les injecte dans le DOM.
// Appelée au chargement de la page ET à chaque changement de langue (jamais au clic) :
// le contenu existe donc dans le HTML dès le rendu initial, indépendamment de toute interaction.
function construireContenuPanneaux() {
    const dict = translations[currentLang];

    const pageAbout = document.getElementById('info-page-about');
    pageAbout.innerHTML = "";
    pageAbout.appendChild(construireContenuAbout(dict));

    const pageFaq = document.getElementById('info-page-faq');
    pageFaq.innerHTML = "";
    pageFaq.appendChild(construireContenuFaq(dict));

    const pageContact = document.getElementById('info-page-contact');
    pageContact.innerHTML = "";
    pageContact.appendChild(construireContenuContact(dict));
}

// Le clic ne fait plus que basculer quelle page est visible (le contenu existe déjà)
function ouvrirPanneauInfo(targetId) {

    document.querySelectorAll('.info-page').forEach(function (page) {
        page.classList.toggle('active', page.id === 'info-page-' + targetId);
    });

    panneauOuvertActuel = targetId;

    // Mettre en évidence l'onglet correspondant dans la mini-navigation
    infoNavLinks.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.target === targetId);
    });

    infoPanel.classList.add("open");
    infoOverlay.classList.add("visible");
}

function fermerPanneauInfo() {
    infoPanel.classList.remove("open");
    infoOverlay.classList.remove("visible");
    panneauOuvertActuel = null;
}

// Lien "Ajouter un terrain de pétanque" (sous les contrôles de recherche) : ouvre directement le
// panneau FAQ à la question sur les terrains manquants (index 3 de faq_items dans translations.js —
// "Un terrain accessible au public près de chez moi n'apparaît pas sur la carte, que faire ?").
const INDEX_FAQ_TERRAIN_MANQUANT = 3;

const addTerrainLink = document.getElementById('add-terrain-link');
if (addTerrainLink) {
    addTerrainLink.addEventListener('click', function (e) {
        e.preventDefault();
        ouvrirPanneauInfo('faq');

        const item = document.getElementById('faq-item-' + INDEX_FAQ_TERRAIN_MANQUANT);
        if (item) {
            item.open = true;
            // Laisse le panneau finir son animation d'ouverture avant de scroller vers la question
            setTimeout(function () {
                item.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    });
}

document.querySelectorAll('#side-menu a').forEach(function (link) {
    link.addEventListener('click', function (e) {
        e.preventDefault();

        // Fermer le menu burger
        sideMenu.classList.remove('open');
        menuOverlay.classList.remove('visible');

        // Ouvrir le panneau avec le contenu correspondant
        const targetId = this.getAttribute('href').replace('#', '');
        ouvrirPanneauInfo(targetId);
    });
});

// Navigation desktop (barre du header) : ouvre directement le panneau d'info
// (le sélecteur [data-target] exclut le lien "Statistiques", qui partage la même classe
// visuelle .info-nav-trigger mais pointe vers une vraie ancre de page, pas vers le panneau)
document.querySelectorAll('.info-nav-trigger[data-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        ouvrirPanneauInfo(btn.dataset.target);
    });
});

// Mini-navigation en haut du panneau : change de contenu sans le fermer
infoNavLinks.forEach(function (btn) {
    btn.addEventListener('click', function () {
        ouvrirPanneauInfo(btn.dataset.target);
    });
});

closeInfo.addEventListener('click', fermerPanneauInfo);
infoOverlay.addEventListener('click', fermerPanneauInfo);


// ===================== Section statistiques =====================

// Le lien au-dessus de la carte est une vraie ancre HTML (href="#stats-section") :
// le scroll fluide est géré nativement par le navigateur (scroll-behavior: smooth en CSS),
// aucun JS n'est nécessaire pour la navigation elle-même.

// Affiche le nombre total de terrains dans le bandeau chiffré de la section stats
function mettreAJourBandeauStats() {
    const el = document.querySelector('.stats-headline-number');
    if (!el) return;
    el.textContent = terrainsCount !== null ? terrainsCount : '…';
}

// Ordre d'affichage fixe des régions (pas d'ordre "naturel" dans un objet JS/JSON)
const ORDRE_REGIONS = ['wallonie', 'flandre', 'bruxelles'];

// Superficies officielles (Statbel/SPF Finances, données 2024-2025), en km². Référence géographique
// statique : contrairement au nombre de terrains, elle ne nécessite pas de régénération régulière,
// d'où un objet fixe ici plutôt qu'un fichier de données séparé. Vérifié : la somme des provinces de
// chaque région correspond au total officiel de la région (16901 km² Wallonie, 13626 km² Flandre).
const SUPERFICIES_KM2 = {
    wallonie: 16901,
    flandre: 13626,
    bruxelles: 162.4,

    brabant_wallon: 1097,
    hainaut: 3813,
    liege: 3857,
    luxembourg: 4459,
    namur: 3675,
    anvers: 2876,
    brabant_flamand: 2118,
    limbourg: 2427,
    flandre_orientale: 3007,
    flandre_occidentale: 3197
};

// Densité formatée avec virgule décimale (convention belge), pour 100 km² plutôt que pour 1 km² :
// au km², les valeurs réelles sont très inférieures à 1 (ex. 0,06/km²), peu lisibles en un coup
// d'œil. Ramenées à 100 km², les mêmes valeurs deviennent des nombres proches de l'unité (ex. 6/100km²).
function formaterDensite(nombreTerrains, cleGeo) {
    const superficie = SUPERFICIES_KM2[cleGeo];
    if (!superficie) return null;
    return (nombreTerrains / superficie * 100).toFixed(1).replace('.', ',') + '/100km²';
}

// Filigranes discrets pour les tuiles région (silhouette officielle, en gris clair) : coq wallon,
// lion flamand, iris bruxellois. Tracés extraits des fichiers officiels du domaine public
// (Wikimedia Commons) : Coq_wallon.svg et Flag_of_Flanders.svg rastérisés puis vectorisés par
// contour (OpenCV) pour obtenir un tracé fidèle ; Flag_of_the_Brussels-Capital_Region.svg dont
// le tracé du cœur et des deux pétales est repris tel quel (SVG déjà simple).
const FILIGRANE_REGIONS = {
    wallonie:
        '<svg viewBox="0 0 682 722" class="stats-region-tile-watermark" aria-hidden="true"><path fill-rule="evenodd" fill="currentColor" d="M380,569 347,563 335,581 318,628 303,646 301,653 288,661 240,666 232,682 237,679 246,681 254,674 263,672 289,675 291,679 288,685 272,697 271,706 275,712 287,702 289,694 308,678 318,676 333,663 340,667 347,682 361,691 358,676 340,659 332,646 343,625 367,627 353,623 348,617 348,612ZM584,481 555,495 515,499 499,515 489,519 461,521 471,525 494,526 496,531 490,537 450,555 473,556 514,543 519,546 513,574 514,604 519,630 526,584 537,542 541,540 545,545 549,561 554,537 559,533 569,565 570,534 578,513 568,514 566,511ZM11,492 14,498 20,494 27,495 43,485 61,486 63,491 48,509 48,513 54,519 57,513 64,511 63,495 69,489 80,485 99,486 109,494 106,514 119,522 110,487 116,485 147,493 153,501 153,507 164,501 222,521 202,489 137,479 88,466 72,467 20,483ZM268,474 297,501 308,517 327,528 354,551 363,556 386,559 390,549 390,504 373,515 366,512 375,482 340,476 313,465 293,473ZM210,463 219,491 229,501 234,515 242,524 247,525 289,513 286,506 272,492 245,471ZM382,434 363,456 358,454 357,447 336,457 331,451 288,445 326,461 378,472ZM267,428 337,441 339,435 292,426ZM297,417 341,424 344,420 344,415 328,416 316,412 304,412ZM420,400 423,413 441,442 452,454 469,463 442,437 423,401ZM152,395 183,428 225,454 261,463 292,461 254,432 242,431 208,410 174,405ZM336,381 317,404 345,406 345,403 337,404 335,401ZM402,366 416,389 433,381 441,382 453,398 454,412 475,397 477,404 474,413 479,408 485,392 491,390 495,395 495,408 485,433 497,432 515,423 517,428 512,437 533,423 539,424 542,434 536,460 547,453 554,441 559,443 562,412 565,410 569,413 562,379 552,361 540,349 514,333 492,328 461,331 434,342ZM519,296 532,308 515,311 527,325 558,350 576,378 582,403 581,427 571,450 553,467 537,474 520,477 492,475 511,487 542,488 568,478 609,450 610,461 595,494 619,466 629,441 630,408 622,378 603,342 584,322 555,305ZM507,300 494,296 474,296 449,303 413,327 393,345 391,351 396,355 423,336 457,321 482,317 510,319 502,308 502,304ZM287,290 301,300 317,319 326,339 329,367 339,358 343,361 345,389 355,392 348,440 363,428 368,429 369,436 384,406 390,406 394,428 394,458 387,493 401,486 404,500 409,491 417,487 414,522 419,543 420,509 424,494 429,491 443,498 430,474 434,472 453,485 463,486 454,480 434,457 419,430 403,389 372,346 347,322 326,307ZM169,325 168,333 172,344 194,380 215,401 239,416 264,419 278,415 309,395 319,385 312,381 317,352 310,333 289,307 266,293 246,288 227,289 222,293 217,307 212,312 177,320ZM503,284 553,292 591,312 616,337 635,373 641,392 645,424 644,462 628,500 592,557 585,582 584,612 587,622 595,588 619,563 622,569 622,592 628,627 638,652 646,660 641,595 669,478 672,454 669,404 656,352 635,314 617,298 602,290 551,280ZM591,274 562,262 535,257 499,256 469,261 440,273 407,295 381,319 375,332 385,342 413,313 431,300 452,290 475,286 502,275 534,270ZM413,244 396,267 386,288 382,305 404,284ZM486,247 505,248 507,242 492,241ZM245,241 219,269 212,268 212,258 206,265 216,280 238,277 260,279 248,257ZM584,254 566,237 551,228 532,221 500,215 499,211 510,189 484,193 461,204 436,224 425,244 419,272 440,260 469,249 482,234 498,230 530,234ZM542,188 526,188 513,210 528,209ZM173,176 148,184 133,195 120,210 111,235 110,265 105,294 112,329 130,359 167,390 192,396 162,357 156,343 155,327 166,310 198,301 206,293 202,281 190,265 195,228 174,223 165,216 172,210 190,203 195,192 207,183 192,184ZM219,135 206,142 181,144 172,155 170,167 174,168 179,157 185,154 190,173 204,172 213,158ZM632,178 619,164 592,147 563,138 532,133 478,135 444,144 423,154 395,178 375,211 363,251 357,318 365,323 372,292 382,267 400,241 422,217 459,191 502,179 552,177 575,183 602,197 621,214 634,233 640,248 646,280 653,254 652,230 645,209 625,182ZM591,11 573,38 559,47 536,70 443,131 497,121 545,121 604,79 611,72 560,91 544,91 577,47ZM275,10 251,39 244,35 240,21 225,50 220,42 219,30 216,30 209,40 207,59 199,62 193,54 177,86 177,99 183,114 173,126 173,132 180,126 186,126 199,134 209,132 210,125 199,107 199,93 207,82 212,86 223,82 222,89 210,103 210,109 220,126 220,131 225,128 228,132 220,162 220,169 225,177 212,192 214,197 188,218 207,218 213,221 205,236 203,250 216,238 221,240 223,248 241,221 252,215 258,250 265,247 271,263 273,233 283,183 285,147 276,117 258,95 277,86 287,77 293,58 288,35ZM218,99 227,102 230,108 228,113 215,109 214,104Z"/></svg>',
    flandre:
        '<svg viewBox="0 0 960 640" class="stats-region-tile-watermark" aria-hidden="true"><path fill-rule="evenodd" fill="currentColor" d="M679,135 630,207 619,243 619,261 627,283 664,328 677,349 669,331 642,300 625,275 620,260 620,245 624,228 635,204 674,147ZM369,114 363,125 368,142 375,148 399,156 414,165 408,149 393,135 396,128 394,115 384,109ZM380,111 385,111 384,114 389,117 375,119 371,125 372,132 379,141 396,149 391,152 390,149 382,149 366,134 368,132 365,130 365,124ZM677,70 657,60 634,58 617,61 597,72 584,86 574,104 562,167 558,177 547,190 554,192 575,184 573,217 584,237 582,214 585,200 606,159 609,161 609,196 622,170 624,137 640,134 653,125 642,115 643,104 651,97 666,96 676,104 681,114 677,102 668,93 681,101 686,113 686,129 682,142 639,206 631,222 625,246 626,265 632,278 674,330 683,347 682,365 680,367 678,363 670,371 652,367 634,351 588,280 552,241 505,214 523,206 538,208 540,205 532,197 532,190 536,187 530,186 526,178 534,183 540,183 541,186 550,177 549,175 538,179 533,175 545,166 539,165 535,160 534,134 546,125 550,117 550,111 543,118 537,118 533,114 544,94 544,78 540,68 524,76 466,76 443,92 428,94 425,104 422,99 425,95 421,96 422,109 418,115 417,136 425,134 435,140 437,155 433,165 420,176 405,178 395,165 378,164 369,171 366,188 360,187 347,172 336,147 336,129 351,110 345,101 346,85 343,78 331,93 321,94 318,105 313,101 313,86 306,85 300,75 289,67 285,67 289,84 282,90 287,103 284,108 281,108 273,98 247,94 258,110 257,121 260,127 274,128 278,135 271,140 259,140 257,148 242,142 245,155 254,162 267,165 284,157 288,162 287,171 281,177 269,181 277,185 293,185 293,193 288,201 273,201 275,205 288,212 283,216 270,213 274,226 285,232 306,227 307,233 302,241 328,237 322,262 314,272 300,272 295,265 295,256 286,274 290,287 302,296 323,296 333,292 345,280 367,267 374,281 368,290 346,307 315,322 303,322 298,317 298,304 286,305 277,295 265,293 272,307 267,315 271,330 266,333 253,328 246,337 233,342 227,349 246,350 254,358 267,350 273,353 268,362 255,367 250,383 251,397 264,383 272,389 280,388 284,369 288,364 291,365 292,379 296,384 289,399 306,393 320,378 321,359 329,360 330,374 334,379 335,370 345,352 349,350 354,354 351,344 356,346 358,352 354,363 352,358 351,371 353,372 361,359 368,340 372,345 372,365 383,344 387,327 393,326 395,344 401,331 401,321 407,321 404,316 406,314 411,318 410,327 405,330 407,338 414,313 417,312 419,315 417,306 423,311 422,320 418,320 422,331 432,294 436,295 433,290 436,289 440,293 440,301 437,301 439,309 448,291 450,273 506,292 522,307 519,310 508,311 523,312 526,315 519,316 522,322 520,332 514,318 510,317 514,326 511,335 508,322 502,319 507,326 504,337 501,324 494,322 500,329 499,337 494,328 483,327 456,349 451,350 479,323 500,312 490,315 476,323 442,355 407,357 391,362 347,404 331,406 321,402 320,415 326,422 335,425 348,424 373,412 388,426 391,435 397,441 394,453 382,464 366,468 356,466 354,452 345,451 329,441 319,441 332,458 327,467 339,478 334,483 313,480 309,489 298,496 290,508 311,505 314,510 319,511 329,504 334,506 334,510 322,520 325,529 323,542 330,554 335,537 343,536 347,532 350,520 354,517 359,521 359,532 363,536 357,552 368,548 385,524 381,512 385,504 395,523 394,514 399,493 402,498 402,515 408,504 410,488 414,494 415,507 418,509 417,502 427,476 429,492 434,499 434,491 446,458 452,458 457,462 450,480 451,486 468,469 475,458 474,448 450,420 446,405 452,395 471,388 515,389 526,425 528,443 524,448 517,449 506,437 504,448 507,456 518,466 539,468 546,465 555,455 565,459 576,459 609,449 612,456 609,480 604,489 590,501 583,500 573,484 561,487 549,481 538,481 549,498 547,509 557,512 560,519 556,522 538,522 520,549 521,555 530,548 541,545 544,551 549,553 567,537 568,542 563,550 567,558 567,568 572,578 583,586 580,564 587,564 593,560 592,547 596,541 601,544 603,558 608,562 605,577 620,569 630,549 627,538 635,531 637,508 642,509 649,528 649,516 656,503 663,519 668,522 668,481 673,484 677,500 682,504 682,479 674,460 678,450 682,449 689,455 691,475 697,484 696,469 702,443 695,433 687,430 667,432 657,422 642,418 627,407 603,401 610,379 610,355 650,396 703,411 708,420 710,440 716,445 716,402 701,386 715,366 717,343 711,326 694,300 694,292 702,280 713,278 721,285 720,278 712,267 694,265 682,274 675,291 669,279 671,256 681,244 695,238 716,242 711,236 697,229 678,230 654,242 693,208 714,184 726,157 730,128 713,161 724,145 724,151 705,180 678,204 660,211 677,199 661,205 689,153 699,121 695,92ZM572,559 575,564 575,576 571,574 571,568 568,566ZM602,538 606,539 609,551 625,552 607,557ZM572,533 575,536 572,549 576,555 567,552ZM540,534 540,537 528,542 533,533ZM541,529 546,533 549,543 554,546 550,550 544,544ZM325,523 334,524 344,532 339,534ZM359,518 363,519 365,526 382,526 363,531ZM550,504 562,507 566,511 565,517ZM641,500 648,506 647,515 643,505 638,503ZM657,491 664,495 663,513ZM315,482 319,496 317,510 314,507 312,487ZM412,481 418,487 416,497ZM668,474 676,476 678,490ZM428,468 435,474 432,487ZM453,453 461,455 464,461 456,475 459,462ZM613,449 618,458 617,479 608,495 596,503 613,477ZM507,447 509,446 522,460 540,463 533,467 522,466 512,458ZM326,446 331,446 338,456 335,458ZM402,443 403,449 398,459 387,469 378,471 378,468 385,466 394,458ZM677,444 683,442 693,448 693,465 689,451 684,447 677,447ZM645,441 654,462 638,490 638,482 648,464 647,455 642,447 642,442ZM546,410 552,422 562,430 575,430 588,422 588,439 580,452 566,455 561,451 576,448 584,433 576,436 559,435 548,424ZM434,409 442,433 424,457 425,449 437,432 432,415ZM323,404 329,421 322,415ZM699,403 706,405 713,414 712,437 708,415ZM376,409 394,421 408,422 418,415 405,416 397,412 389,401 390,397 397,407 412,412 426,407 422,419 408,427 388,423ZM258,368 265,370 275,381 281,383 273,386ZM294,367 297,368 299,376 317,378 297,381ZM421,359 390,370 354,406 351,405 390,365 407,359ZM614,354 616,353 640,378 656,390 689,402 675,403 652,393 629,373ZM370,335 377,340 377,351 374,356ZM255,331 257,348 254,354 252,333ZM528,312 532,318 532,333 523,360 523,387 535,430 535,442 532,447 530,427 520,396 517,376 519,357 529,325ZM519,297 542,305 531,307ZM504,288 534,291 517,295ZM378,289 372,297 348,315 328,323 320,323 347,310 376,287ZM484,280 487,278 500,282 513,279 525,281 506,286 493,286ZM492,272 482,278 463,275 465,272ZM451,270 453,267 468,269 456,273ZM704,266 704,269 690,277 681,293 680,288 685,276 693,268ZM291,264 294,280 300,292 292,286 289,279ZM494,254 485,250 462,252 456,247 486,245ZM696,232 676,237 653,252 661,242 678,231ZM436,225 437,235 431,260 445,244 450,229 452,237 432,274 426,258ZM458,225 488,227 493,234 485,231 464,232ZM373,211 361,232 354,266 347,276 355,233 362,221ZM297,206 297,212 286,220 285,217ZM477,205 479,203 488,214 497,216 494,219 486,219ZM405,202 407,214 402,227ZM392,199 392,221 372,254 372,245 388,218ZM367,196 343,219 330,257 319,273 337,219 350,204ZM492,196 513,209 500,207ZM412,194 429,227 424,258 421,263 411,250 395,250 390,256 390,267 405,283 396,288 388,288 377,280 370,264 374,263 384,281 396,283 385,266 389,249 398,243 407,243 420,252 424,239 424,225 411,202ZM522,194 524,193 535,206 527,205ZM428,189 435,206 434,214 426,197ZM355,185 356,192 346,203ZM297,184 298,197 292,205 286,206 285,204 292,200ZM436,181 439,183 443,201 442,210 435,190ZM349,179 349,188 340,197ZM445,170 448,173 451,191 449,203 444,180ZM343,170 345,178 339,187ZM380,165 371,186 371,173ZM338,163 339,172 331,181ZM453,154 461,177 460,191 452,164ZM246,154 262,158 261,161 255,161ZM463,145 471,168 470,181 462,156ZM441,143 441,163 425,177 438,159ZM262,140 270,163 266,162 261,149ZM475,135 483,163 480,171 473,140ZM593,119 594,129 585,170 591,169 580,189 577,222 574,213 575,189ZM427,107 422,123 424,131 420,133 419,118ZM627,89 632,90 620,104 620,120 631,135 623,133 615,120 616,102ZM535,83 526,104 526,92ZM462,82 465,93 493,114 493,124 486,115 480,117 484,119 480,122 468,122 463,119 456,121 460,116 462,102 465,103 464,112 468,117 477,109 462,97 459,89ZM618,78 608,96 605,108 606,124 615,158 615,175 612,179 600,113 607,88ZM612,66 593,85 582,103 571,156 560,179 579,99 587,86 601,72Z"/></svg>',
    bruxelles:
        '<svg viewBox="142 108 615 384" class="stats-region-tile-watermark" aria-hidden="true"><path fill="currentColor" d="m436.5 465.19c-0.0491 7.0149-2.7854 12.616-9.6576 12.614-7.2644-2e-3 -15.488-14.137-35.871-23.848-18.222-8.6818-36.068-12.586-52.23-12.614-19.969-0.0347-53.649 9.6343-85.539 10.052-30.08 0.39384-57.29-13.939-74.502-32.718-12.846-14.016-21.77-36.238-21.68-56.369 0.11311-25.378 9.9407-50.264 32.324-68.983 16.294-13.627 35.116-19.246 56.96-19.315 32.721-0.10341 65.657 16.73 86.525 33.309 30.609 24.319 58.744 56.638 78.247 91.649 11.101 19.929 25.516 53.222 25.425 66.224z"/><path fill="currentColor" transform="matrix(-1,0,0,1,900,0)" d="m436.5 465.19c-0.0491 7.0149-2.7854 12.616-9.6576 12.614-7.2644-2e-3 -15.488-14.137-35.871-23.848-18.222-8.6818-36.068-12.586-52.23-12.614-19.969-0.0347-53.649 9.6343-85.539 10.052-30.08 0.39384-57.29-13.939-74.502-32.718-12.846-14.016-21.77-36.238-21.68-56.369 0.11311-25.378 9.9407-50.264 32.324-68.983 16.294-13.627 35.116-19.246 56.96-19.315 32.721-0.10341 65.657 16.73 86.525 33.309 30.609 24.319 58.744 56.638 78.247 91.649 11.101 19.929 25.516 53.222 25.425 66.224z"/><path fill="currentColor" d="m507.06 123.03c26.469-0.15281 45.029 10.159 60.393 25.228 16.558 16.24 24.63 37.548 24.752 61.691 0.11823 23.288-7.9523 39.95-17.032 52.509-14.835 20.519-31.873 33.736-49.341 49.783-28.278 25.979-45.83 49.119-60.556 78.05-3.6335 7.1382-6.7536 17.776-15.279 17.776-8.5251 0-11.645-10.638-15.279-17.776-14.726-28.93-32.278-52.071-60.556-78.05-17.468-16.048-34.507-29.265-49.341-49.783-9.0795-12.558-17.15-29.221-17.032-52.509 0.12263-24.143 8.1946-45.451 24.752-61.691 15.364-15.069 33.924-25.381 60.393-25.228 27.318 0.15772 44.667 9.595 57.063 25.425 12.395-15.83 29.745-25.268 57.063-25.425z"/></svg>'
};

// Rempli une seule fois par le fetch de data/stats_geo.json, puis réutilisé à chaque
// reconstruction de l'affichage (changement de langue) sans re-télécharger le fichier
let statsGeoData = null;

// Minuscules + accents retirés, pour une recherche de commune insensible à la casse/aux accents
function normaliserRecherche(texte) {
    return texte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

// Trie une liste de clés (régions ou provinces) selon leur libellé traduit, dans la langue active
function trierParLibelleTraduit(cles, prefixe, dict) {
    return cles.slice().sort(function (a, b) {
        const libelleA = dict[prefixe + a] || a;
        const libelleB = dict[prefixe + b] || b;
        return libelleA.localeCompare(libelleB, currentLang);
    });
}

// Centre la carte sur un terrain précis et ouvre son popup (si le marqueur correspondant est
// trouvé dans les données chargées), puis remonte en haut de page pour voir la carte.
// Réutilisée à la fois par le lien de partage (?lat=&lon=) et par la page "Liste des terrains".
function allerVersTerrain(lat, lon) {
    let layerCorrespondant = null;

    markers.eachLayer(function (layer) {
        if (layerCorrespondant) return;
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001) {
            layerCorrespondant = layer;
        }
    });

    if (layerCorrespondant) {
        markers.zoomToShowLayer(layerCorrespondant, function () {
            layerCorrespondant.openPopup();
        });
    } else {
        // Terrain introuvable (peut-être retiré depuis) : on centre quand même sur les coordonnées
        map.setView([lat, lon], 18);
    }

    const top = document.getElementById('top');
    if (top) top.scrollIntoView({ behavior: 'smooth' });
}

// Centre la carte sur la position moyenne des terrains d'une commune (pas de coordonnée officielle
// de commune dans les données ; cette moyenne suffit pour repérer visuellement la zone concernée).
function allerVersCommune(nomCommune) {
    const centre = communesCentres[nomCommune];
    if (!centre) return;

    map.setView([centre.lat, centre.lon], 13);

    const top = document.getElementById('top');
    if (top) top.scrollIntoView({ behavior: 'smooth' });
}

// Construit la liste des communes d'une province (ou d'une région sans province, cas de Bruxelles),
// avec un champ de recherche qui filtre les lignes déjà présentes dans le DOM (aucune ligne n'est
// ajoutée/retirée du DOM par la recherche, seulement masquée : le contenu reste indexable).
function construireListeCommunes(communes, dict) {
    const wrapper = document.createElement('div');
    wrapper.className = 'stats-commune-list-wrapper';

    const recherche = document.createElement('input');
    recherche.type = 'text';
    recherche.className = 'stats-commune-search';
    recherche.placeholder = dict.stats_search_commune_placeholder;
    wrapper.appendChild(recherche);

    const liste = document.createElement('div');
    liste.className = 'stats-commune-list';

    const aucunResultat = document.createElement('p');
    aucunResultat.className = 'stats-commune-no-result';
    aucunResultat.textContent = dict.stats_no_results;
    aucunResultat.style.display = 'none';

    const nomsTries = Object.keys(communes).sort(function (a, b) {
        return a.localeCompare(b, currentLang);
    });

    nomsTries.forEach(function (nom) {
        const ligne = document.createElement('div');
        ligne.className = 'stats-commune-row';
        ligne.dataset.rechercheClef = normaliserRecherche(nom);

        // La ligne entière (nom + compte) est un lien : clic = centrer la carte sur cette commune
        const lienCommune = document.createElement('a');
        lienCommune.href = '#top';
        lienCommune.className = 'stats-commune-link';

        const nomSpan = document.createElement('span');
        nomSpan.textContent = nom;

        const compteSpan = document.createElement('span');
        compteSpan.className = 'stats-details-count';
        compteSpan.textContent = communes[nom] + ' ' + dict.stats_terrains_unit;

        lienCommune.appendChild(nomSpan);
        lienCommune.appendChild(compteSpan);
        lienCommune.addEventListener('click', function (e) {
            e.preventDefault();
            allerVersCommune(nom);
        });
        ligne.appendChild(lienCommune);

        // Bouton séparé (n'active pas la navigation) : déplie la liste des terrains de cette commune
        const terrainsCommune = terrainsParCommune[nom];
        if (terrainsCommune && terrainsCommune.length > 0) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'stats-commune-toggle';
            toggle.setAttribute('aria-label', dict.stats_show_terrains || 'Afficher les terrains');
            toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            ligne.appendChild(toggle);

            const listeTerrains = document.createElement('div');
            listeTerrains.className = 'stats-terrain-list';
            listeTerrains.hidden = true;

            terrainsCommune
                .slice()
                .sort(function (a, b) {
                    const nomA = a.rue ? dict.popup_terrain_prefix + ' ' + a.rue : dict.popup_terrain_default;
                    const nomB = b.rue ? dict.popup_terrain_prefix + ' ' + b.rue : dict.popup_terrain_default;
                    return nomA.localeCompare(nomB, currentLang);
                })
                .forEach(function (terrain) {
                    const nomTerrain = terrain.rue
                        ? dict.popup_terrain_prefix + ' ' + terrain.rue
                        : dict.popup_terrain_default;

                    const lienTerrain = document.createElement('a');
                    lienTerrain.href = '#top';
                    lienTerrain.className = 'stats-terrain-link';
                    lienTerrain.textContent = nomTerrain;
                    lienTerrain.addEventListener('click', function (e) {
                        e.preventDefault();
                        allerVersTerrain(terrain.lat, terrain.lon);
                    });
                    listeTerrains.appendChild(lienTerrain);
                });

            toggle.addEventListener('click', function () {
                listeTerrains.hidden = !listeTerrains.hidden;
                toggle.classList.toggle('open', !listeTerrains.hidden);
            });

            ligne.appendChild(listeTerrains);
        }

        liste.appendChild(ligne);
    });

    liste.appendChild(aucunResultat);
    wrapper.appendChild(liste);

    recherche.addEventListener('input', function () {
        const terme = normaliserRecherche(recherche.value);
        let visibles = 0;
        liste.querySelectorAll('.stats-commune-row').forEach(function (ligne) {
            const correspond = ligne.dataset.rechercheClef.indexOf(terme) !== -1;
            ligne.style.display = correspond ? 'flex' : 'none';
            if (correspond) visibles++;
        });
        aucunResultat.style.display = visibles === 0 ? 'block' : 'none';
    });

    return wrapper;
}

function construireDetailsProvince(cleProvince, donneesProvince, dict) {
    const details = document.createElement('details');
    details.className = 'stats-province-details';

    const summary = document.createElement('summary');
    const nomSpan = document.createElement('span');
    nomSpan.textContent = dict['geo_province_' + cleProvince] || cleProvince;
    const compteSpan = document.createElement('span');
    compteSpan.className = 'stats-details-count';
    const densite = formaterDensite(donneesProvince.total, cleProvince);
    compteSpan.textContent = donneesProvince.total + ' ' + dict.stats_terrains_unit + (densite ? ' · ' + densite : '');
    summary.appendChild(nomSpan);
    summary.appendChild(compteSpan);
    details.appendChild(summary);

    details.appendChild(construireListeCommunes(donneesProvince.communes, dict));

    return details;
}

function construireDetailsRegion(cleRegion, donneesRegion, dict) {
    const details = document.createElement('details');
    details.className = 'stats-region-details';
    details.id = 'stats-region-' + cleRegion;

    const summary = document.createElement('summary');
    const nomSpan = document.createElement('span');
    nomSpan.textContent = dict['geo_region_' + cleRegion] || cleRegion;
    const compteSpan = document.createElement('span');
    compteSpan.className = 'stats-details-count';
    const densite = formaterDensite(donneesRegion.total, cleRegion);
    compteSpan.textContent = donneesRegion.total + ' ' + dict.stats_terrains_unit + (densite ? ' · ' + densite : '');
    summary.appendChild(nomSpan);
    summary.appendChild(compteSpan);
    details.appendChild(summary);

    const contenu = document.createElement('div');
    contenu.className = 'stats-region-content';

    // Bruxelles n'a structurellement aucune province (le script Python force déjà province=null
    // pour cette région) : on affiche donc toujours ses communes directement, sans jamais passer
    // par un niveau province intermédiaire — même si des données plus anciennes (générées avant
    // ce correctif) contiennent encore un reliquat de province erronée pour Bruxelles. Dans ce
    // cas, on fusionne ces communes égarées dans la liste plutôt que de les faire disparaître.
    if (cleRegion === 'bruxelles') {
        const communesFusionnees = Object.assign({}, donneesRegion.communes);
        Object.values(donneesRegion.provinces || {}).forEach(function (donneesProvince) {
            Object.entries(donneesProvince.communes || {}).forEach(function ([nom, compte]) {
                communesFusionnees[nom] = (communesFusionnees[nom] || 0) + compte;
            });
        });
        contenu.appendChild(construireListeCommunes(communesFusionnees, dict));
        details.appendChild(contenu);
        return details;
    }

    const clesProvinces = Object.keys(donneesRegion.provinces);
    if (clesProvinces.length > 0) {
        trierParLibelleTraduit(clesProvinces, 'geo_province_', dict).forEach(function (cleProvince) {
            contenu.appendChild(construireDetailsProvince(cleProvince, donneesRegion.provinces[cleProvince], dict));
        });
    } else {
        // Cas d'une région sans provinces dans les données (ne devrait plus arriver que pour
        // Bruxelles, déjà traité ci-dessus, mais on garde ce repli par sécurité)
        contenu.appendChild(construireListeCommunes(donneesRegion.communes, dict));
    }

    details.appendChild(contenu);
    return details;
}

// Tuile résumé d'une région : lien-ancre natif vers son accordéon plus bas, qu'il ouvre
// automatiquement au clic (en plus du scroll natif de l'ancre)
function construireTuileRegion(cleRegion, donneesRegion, dict) {
    const tuile = document.createElement('a');
    tuile.href = '#stats-region-' + cleRegion;
    tuile.className = 'stats-region-tile';

    if (FILIGRANE_REGIONS[cleRegion]) {
        tuile.insertAdjacentHTML('afterbegin', FILIGRANE_REGIONS[cleRegion]);
    }

    const nombre = document.createElement('span');
    nombre.className = 'stats-region-tile-number';
    nombre.textContent = donneesRegion.total;

    const nom = document.createElement('span');
    nom.className = 'stats-region-tile-name';
    nom.textContent = dict['geo_region_' + cleRegion] || cleRegion;

    tuile.appendChild(nombre);
    tuile.appendChild(nom);

    const densite = formaterDensite(donneesRegion.total, cleRegion);
    if (densite) {
        const densiteSpan = document.createElement('span');
        densiteSpan.className = 'stats-region-tile-density';
        densiteSpan.textContent = densite;
        tuile.appendChild(densiteSpan);
    }

    tuile.addEventListener('click', function () {
        const cible = document.getElementById('stats-region-' + cleRegion);
        if (cible) cible.open = true;
    });

    return tuile;
}

// Reconstruit l'intégralité des tuiles + de l'entonnoir région > province > commune, à partir des
// données déjà téléchargées (statsGeoData) et de la langue active. Appelée une fois les données
// arrivées, puis à chaque changement de langue (voir appliquerTraductions) — jamais au clic.
function construireStatsGeo() {
    if (!statsGeoData) return;

    const dict = translations[currentLang];

    const tuilesConteneur = document.getElementById('stats-regions-tiles');
    const arbreConteneur = document.getElementById('stats-geo-tree');
    if (!tuilesConteneur || !arbreConteneur) return;

    tuilesConteneur.innerHTML = "";
    arbreConteneur.innerHTML = "";

    ORDRE_REGIONS.forEach(function (cleRegion) {
        const donneesRegion = statsGeoData[cleRegion];
        if (!donneesRegion) return;

        tuilesConteneur.appendChild(construireTuileRegion(cleRegion, donneesRegion, dict));
        arbreConteneur.appendChild(construireDetailsRegion(cleRegion, donneesRegion, dict));
    });
}

// Petit état de chargement immédiat, remplacé dès que les données arrivent (ou par un message
// d'erreur en cas d'échec) — évite un vide silencieux pendant le téléchargement de stats_geo.json
const arbreInitial = document.getElementById('stats-geo-tree');
if (arbreInitial) {
    arbreInitial.innerHTML = '<p class="stats-geo-loading">' + translations[currentLang].stats_geo_loading + '</p>';
}

fetch('data/stats_geo.json')
    .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    })
    .then(function (data) {
        statsGeoData = data;
        construireStatsGeo();
    })
    .catch(function (e) {
        console.error('Erreur de chargement de data/stats_geo.json :', e);
        const arbreConteneur = document.getElementById('stats-geo-tree');
        if (arbreConteneur) {
            arbreConteneur.innerHTML = '<p class="stats-geo-error">' + translations[currentLang].stats_geo_error + '</p>';
        }
    });

// ===================== Statistiques du footer =====================

let terrainsCount = null;
let lastUpdateRaw = null; // objet Date brut, reformaté selon la langue active
let comptageTermine = false;
let dateTermine = false;

function mettreAJourStats() {
    const statsEl = document.getElementById('site-stats');
    if (!statsEl) return;

    let parts = [];

    if (terrainsCount !== null) {
        parts.push(`<span class="footer-stats-icon">${ICON_MAP_PIN}</span> ${t('stats_count')(terrainsCount)}`);
    }

    if (lastUpdateRaw !== null) {
        // Format compact JJ-MM-AA (plutôt que le format long "6 août 2026"), pour que la ligne
        // tienne sur un seul écran de smartphone. Volontairement identique dans les 3 langues :
        // un format numérique court reste lisible sans ambiguïté, inutile de le localiser.
        const jour = String(lastUpdateRaw.getDate()).padStart(2, '0');
        const mois = String(lastUpdateRaw.getMonth() + 1).padStart(2, '0');
        const annee = String(lastUpdateRaw.getFullYear()).slice(-2);
        const dateFormatee = `${jour}-${mois}-${annee}`;
        parts.push(`<span class="footer-stats-icon">${ICON_CLOCK}</span> ${t('stats_last_update')} : ${dateFormatee}`);
    }

    if (parts.length > 0) {
        statsEl.innerHTML = parts.join(' · ');
    } else if (!comptageTermine && !dateTermine) {
        statsEl.textContent = t('stats_loading');
    } else {
        statsEl.textContent = t('stats_unavailable');
    }
}

function afficherNombreTerrains(count) {
    terrainsCount = count;
    comptageTermine = true;
    mettreAJourStats();
    mettreAJourBandeauStats();
}

// Date du dernier commit ayant modifié terrains.geojson, via l'API GitHub
fetch('https://api.github.com/repos/mapetanque/mapetanque.github.io/commits?path=data/terrains.geojson&page=1&per_page=1')
    .then(function (response) {
        if (!response.ok) throw new Error('Réponse API GitHub invalide');
        return response.json();
    })
    .then(function (commits) {
        if (commits.length > 0) {
            lastUpdateRaw = new Date(commits[0].commit.author.date);
        }
        dateTermine = true;
        mettreAJourStats();
    })
    .catch(function () {
        dateTermine = true;
        mettreAJourStats();
    });


// ===================== Footer toujours visible (position fixed) =====================

// Le footer est en position fixed ; on mesure sa hauteur réelle pour que .map-view et le bas de
// page lui réservent toujours exactement la bonne place (variable CSS --footer-height).
// ResizeObserver capte tous les cas qui changent cette hauteur : chargement, redimensionnement de
// la fenêtre, changement de langue (texte plus ou moins long), passage à la ligne du contenu, etc.
const footerEl = document.querySelector('footer');
if (footerEl) {
    if (window.ResizeObserver) {
        new ResizeObserver(function (entries) {
            for (const entry of entries) {
                document.documentElement.style.setProperty('--footer-height', entry.contentRect.height + 'px');
                // La hauteur de .map-view dépend de --footer-height : Leaflet doit recalculer
                // ses dimensions internes à chaque fois qu'elle change (sinon les tuiles/contrôles
                // peuvent rester positionnés sur l'ancienne taille du conteneur).
                map.invalidateSize();
            }
        }).observe(footerEl);
    } else {
        // Repli pour les navigateurs sans ResizeObserver
        const ajusterHauteurFooter = function () {
            document.documentElement.style.setProperty('--footer-height', footerEl.offsetHeight + 'px');
            map.invalidateSize();
        };
        ajusterHauteurFooter();
        window.addEventListener('resize', ajusterHauteurFooter);
    }
}


// ===================== Initialisation =====================

appliquerTraductions();