// ===================== Application installable (PWA) =====================

// Enregistre le service worker (/sw.js) : il permet d'installer le site comme une application
// sur téléphone et ordinateur, et de revoir hors connexion les pages déjà consultées.
// Placé en tête du fichier pour ne dépendre d'aucune autre partie du script.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
}

// ===================== Icônes SVG réutilisables (popups des terrains) =====================

const ICON_ROUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>';
const ICON_FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
const ICON_MAP_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
// Roue dentée de la même famille Feather, pour le lien discret vers la page admin du pied de page.
// Remplace le caractère ⚙, que l'iPad affichait en emoji en relief, jurant avec le reste.
const ICON_REGLAGES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
const ICON_MAXIMIZE = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
const ICON_MINIMIZE = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
const ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

// Pictos des fiches terrain et club : Lucide (https://lucide.dev, suite de Feather, licence ISC),
// même style que les icônes ci-dessus. Seuls les tracés sont stockés ; iconeLucide() les habille.
// Le banc et les jeux sont dessinés pour le site (pas d'équivalent lisible chez Lucide).
function iconeLucide(traces) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + traces + '</svg>';
}
const PICTOS = {
    banc: iconeLucide('<path d="M4 7h16"/><path d="M6 7v6M18 7v6"/><path d="M3 13h18"/><path d="M5 13v6M19 13v6"/>'),
    jeux: iconeLucide('<path d="M4 21V4"/><path d="M8 21V4"/><path d="M4 9h4M4 14h4"/><path d="M8 4c4 0 6 3 8 9 1.3 4 3 7 5 8"/>'),
    eclaire: iconeLucide('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    nature: iconeLucide('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
    calme: iconeLucide('<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>'),
    eau: iconeLucide('<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>'),
    wc: iconeLucide('<path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/>'),
    eau_potable: iconeLucide('<path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"/><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/>'),
    parking: iconeLucide('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>'),
    arret: iconeLucide('<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>'),
    voie_verte: iconeLucide('<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'),
    ombrage: iconeLucide('<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>'),
    abri_pluie: iconeLucide('<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>'),
    plusieurs_pistes: iconeLucide('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
    bien_entretenu: iconeLucide('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
    // Boutons et fiche club
    etoile: iconeLucide('<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'),
    club: iconeLucide('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    site: iconeLucide('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
    federation: iconeLucide('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
    lien_sortant: iconeLucide('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
};

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

// Icône des marqueurs de club affilié sur la carte (pin bleu, pour se distinguer du pin vert des
// terrains — même silhouette de pin que terrainMarkerIcon, seule la couleur change)
const clubMarkerIcon = L.divIcon({
    className: 'club-marker-icon',
    html: '<svg width="29" height="45" viewBox="0 0 29 45" xmlns="http://www.w3.org/2000/svg">' +
          '<g transform="translate(2,2)">' +
          '<path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#1976d2" stroke="white" stroke-width="2"/>' +
          '<circle cx="12.5" cy="12.5" r="5" fill="white"/>' +
          '</g>' +
          '</svg>',
    iconSize: [29, 45],
    iconAnchor: [14, 43],
    popupAnchor: [0, -36]
});

// Icône des amas (clusters) de clubs affiliés, en bleu (assorti à clubMarkerIcon) pour rester
// visuellement distincte des amas de terrains (orange/jaune, style par défaut de la librairie
// Leaflet.markercluster — voir MarkerCluster.Default.css, non modifié). Même principe de 3
// paliers de taille que le style par défaut (small/medium/large selon le nombre de clubs
// regroupés), mais entièrement stylée via des classes dédiées plutôt que d'hériter du style par
// défaut, pour ne dépendre d'aucun détail interne de la feuille de style chargée depuis le CDN.
function creerIconeClusterClub(cluster) {
    const nombre = cluster.getChildCount();
    let palier = 'small';
    if (nombre >= 20) palier = 'large';
    else if (nombre >= 10) palier = 'medium';

    return L.divIcon({
        html: '<div><span>' + nombre + '</span></div>',
        className: 'club-cluster-icon club-cluster-icon-' + palier,
        iconSize: L.point(40, 40)
    });
}



// ===================== Gestion de la langue =====================

const LANGUES_DISPONIBLES = ['fr', 'nl', 'de', 'en'];

// Langue déduite du chemin de l'URL (/nl/, /de/, /en/), le cas échéant. Cette détection passe
// en priorité sur tout le reste : c'est elle qui permet à Google d'indexer /nl/, /de/ et /en/
// comme des pages distinctes, réellement dans leur langue dès le premier rendu.
function detecterLangueDepuisURL() {
    const chemin = window.location.pathname;
    if (chemin === '/nl' || chemin.startsWith('/nl/')) return 'nl';
    if (chemin === '/de' || chemin.startsWith('/de/')) return 'de';
    if (chemin === '/en' || chemin.startsWith('/en/')) return 'en';
    return null;
}

function detecterLanguePreferee() {
    const depuisURL = detecterLangueDepuisURL();
    if (depuisURL) return depuisURL;

    const sauvegardee = localStorage.getItem('mapetanque_lang');
    if (sauvegardee && LANGUES_DISPONIBLES.includes(sauvegardee)) {
        return sauvegardee;
    }

    // L'anglais n'est jamais choisi d'après le navigateur, seulement via le bouton EN ou
    // l'adresse /en/ : Googlebot se présente avec un navigateur en anglais, et sans cette
    // exception il afficherait les pages françaises en anglais.
    const navigateur = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return LANGUES_DISPONIBLES.includes(navigateur) && navigateur !== 'en' ? navigateur : 'fr';
}

let currentLang = detecterLanguePreferee();

function t(cle) {
    return translations[currentLang][cle];
}

// Nombre à une décimale, avec la virgule en français, néerlandais et allemand, et le point en
// anglais (3,4 → 3.4).
function uneDecimale(nombre) {
    const texte = nombre.toFixed(1);
    return currentLang === 'en' ? texte : texte.replace('.', ',');
}

// Piste du panneau d'info actuellement ouvert, pour le régénérer si la langue change
let panneauOuvertActuel = null;

// Vrai sur l'accueil, dans les 4 langues : /, /index.html, /nl/, /nl/index.html, etc.
function estPageAccueil() {
    return /^\/((nl|de|en)\/?)?(index\.html)?$/.test(window.location.pathname);
}

function appliquerTraductions() {

    const dict = translations[currentLang];

    document.documentElement.lang = dict.html_lang;

    // Titre de l'onglet + balise meta description, pour un extrait Google correct
    // dans la langue affichée (au lieu du texte piqué au hasard dans la page).
    // Accueil uniquement : meta_title/meta_description sont ceux de l'accueil, et les autres pages
    // (provinces, régions, Comment jouer…) ont déjà leur propre titre dans leur HTML — les écraser
    // leur donnait à toutes le titre de l'accueil.
    // Garde-fou : si meta_title/meta_description est absent pour une raison quelconque
    // (ex. translations.js et script.js désynchronisés lors d'un déploiement), on laisse
    // la valeur existante plutôt que d'écrire la chaîne littérale "undefined".
    if (estPageAccueil()) {
        if (dict.meta_title) {
            document.title = dict.meta_title;
        }
        const metaDescription = document.getElementById('meta-description');
        if (metaDescription && dict.meta_description) {
            metaDescription.setAttribute('content', dict.meta_description);
        }
    }

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

    // Bouton actif dans le sélecteur de langue de la nav desktop
    document.querySelectorAll('.lang-link').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });

    // Reconstruire le pied de page et le menu mobile dans la nouvelle langue, puis reposer les chiffres
    construirePied();
    construireMenu();
    mettreAJourStats();

    // Régénérer le bandeau chiffré de la section statistiques
    mettreAJourBandeauStats();

    // Reconstruire l'entonnoir région/province/commune dans la nouvelle langue (sans re-télécharger
    // les données, déjà en cache dans statsGeoData ; ne fait rien si le fetch n'est pas encore arrivé)
    construireStatsGeo();

    // Régénérer le titre par défaut d'un éventuel marqueur de recherche déjà ouvert
    if (typeof searchMarker !== 'undefined' && searchMarker && searchMarker.isPopupOpen()) {
        searchMarker.getPopup().setContent(searchMarker._displayName || '');
    }
}

function changerLangue(langue) {
    if (!LANGUES_DISPONIBLES.includes(langue)) return;
    currentLang = langue;
    localStorage.setItem('mapetanque_lang', langue);

    // Met à jour l'URL sans recharger la page, pour que chaque langue reste indexable et
    // partageable via sa propre adresse (/nl/, /de/, /en/, ou / pour le français)
    const cheminCible = langue === 'fr' ? '/' : '/' + langue + '/';
    if (window.location.pathname !== cheminCible) {
        history.pushState({ lang: langue }, '', cheminCible + window.location.search + window.location.hash);
    }

    appliquerTraductions();
}

// Recalcule la langue depuis l'URL quand l'utilisateur navigue avec les boutons précédent/suivant
window.addEventListener('popstate', function () {
    currentLang = detecterLanguePreferee();
    appliquerTraductions();
});

document.querySelectorAll('.lang-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
        changerLangue(btn.dataset.lang);
    });
});

// Sélecteur de langue de la nav desktop en menu déroulant : seule la langue en cours est
// visible (« FR ▾ »), les quatre boutons s'affichent au clic. Le HTML des pages garde ses
// quatre boutons tels quels (pages générées, une vingtaine de fichiers par langue) : on les
// range ici dans une liste déroulante, et le libellé du bouton suit .active, posé par
// appliquerTraductions(). Le menu mobile a ses propres liens de langue (construireMenu).
(function () {
    const selecteur = document.getElementById('lang-switcher-inline');
    if (!selecteur) return;

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'lang-toggle';
    bouton.setAttribute('aria-haspopup', 'true');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.innerHTML = '<span class="lang-toggle-code"></span>' +
        '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.hidden = true;
    selecteur.querySelectorAll('.lang-link').forEach(function (lien) { menu.appendChild(lien); });

    selecteur.appendChild(bouton);
    selecteur.appendChild(menu);

    function mettreAJourLibelle() {
        bouton.querySelector('.lang-toggle-code').textContent = currentLang.toUpperCase();
        bouton.setAttribute('aria-label', currentLang.toUpperCase());
    }

    function ouvrir(ouvert) {
        menu.hidden = !ouvert;
        bouton.setAttribute('aria-expanded', String(ouvert));
        selecteur.classList.toggle('ouvert', ouvert);
    }

    bouton.addEventListener('click', function (e) {
        e.stopPropagation();
        ouvrir(menu.hidden);
    });
    menu.addEventListener('click', function (e) {
        if (e.target.closest('.lang-link')) {
            ouvrir(false);
            mettreAJourLibelle();
        }
    });
    document.addEventListener('click', function (e) {
        if (!selecteur.contains(e.target)) ouvrir(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !menu.hidden) {
            ouvrir(false);
            bouton.focus();
        }
    });
    window.addEventListener('popstate', mettreAJourLibelle);

    mettreAJourLibelle();
})();


// ===================== Carte =====================

// Création de la carte centrée sur la Belgique
// Molette : voir « Molette sur la carte » juste en dessous (la molette seule fait défiler la page,
// Ctrl + molette zoome).
const map = L.map('map', {
    // Sensibilité de la molette : Leaflet accumule le défilement et change de niveau de zoom
    // tous les wheelPxPerZoomLevel pixels équivalents (défaut Leaflet : 60, ce qui faisait sauter
    // plusieurs niveaux d'un coup pour un seul cran de molette, contrairement aux boutons +/-
    // qui avancent toujours d'exactement un niveau). 320 = valeur testée et validée par l'utilisateur.
    wheelPxPerZoomLevel: 320
});
// `const` ne crée pas de propriété sur window (contrairement à `var` ou aux déclarations de
// fonction). beaux-terrains.js en a besoin (window.map) sur les pages région/Bruxelles pour
// centrer la carte au clic sur une tuile du carrousel.
window.map = map;

// ===================== Molette sur la carte =====================
// La carte occupe presque tout l'écran sous la bannière : avec la molette Leaflet par défaut, le
// visiteur qui fait défiler la page pour descendre vers les sections du bas zoomait la carte à la
// place (jusqu'au planisphère). Comme sur Google Maps : la molette seule fait défiler la page et
// un message l'indique ; Ctrl + molette (⌘ sur Mac, ou le pincement du pavé tactile, qui arrive
// avec ctrlKey) zoome. En plein écran, la page ne défile plus : la molette zoome directement.
// Écouteur en phase de capture sur le parent de la carte : stopPropagation empêche l'événement
// d'atteindre Leaflet, sans preventDefault, donc la page défile normalement.
//
// Même problème sur mobile : la carte occupe presque toute la largeur de l'écran, un glissé à un doigt
// pour descendre dans la page déplaçait la carte. Sur écran tactile, un doigt fait donc défiler
// la page et deux doigts déplacent/zooment la carte (le pincement de Leaflet déplace aussi la
// carte). Désactiver le glissement de Leaflet retire sa classe leaflet-touch-drag : son CSS
// passe alors à « touch-action: pan-x pan-y » et le navigateur fait défiler la page lui-même.
// En plein écran, le glissement à un doigt est rétabli (voir definirModePleinEcran).
const ecranTactile = window.matchMedia('(pointer: coarse)').matches;

function ajusterGlissementCarte() {
    if (!ecranTactile) return;
    if (map.getContainer().closest('.fullscreen-active')) {
        map.dragging.enable();
    } else {
        map.dragging.disable();
    }
}

(function () {
    const conteneur = map.getContainer();
    const estMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const message = document.createElement('div');
    message.className = 'carte-message-molette';
    message.setAttribute('aria-hidden', 'true');
    conteneur.appendChild(message);
    let minuteur = null;

    function afficherMessage(texte) {
        message.textContent = texte;
        message.classList.add('visible');
        clearTimeout(minuteur);
        minuteur = setTimeout(function () { message.classList.remove('visible'); }, 1500);
    }

    function masquerMessage() {
        clearTimeout(minuteur);
        message.classList.remove('visible');
    }

    conteneur.parentNode.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) return;
        if (conteneur.closest('.fullscreen-active')) return;
        // Popups et contrôles (filtres…) : Leaflet y gère déjà la molette (défilement du contenu)
        if (e.target.closest('.leaflet-popup, .leaflet-control')) return;

        e.stopPropagation();
        afficherMessage(t('molette_zoom').replace('{touche}', estMac ? '⌘' : t('molette_touche')));
    }, { capture: true });

    if (!ecranTactile) return;
    ajusterGlissementCarte();

    // Message au glissé à un doigt, seulement au-delà de quelques pixels : un simple toucher
    // (ouvrir un terrain, un bouton) ne doit pas l'afficher.
    let depart = null;
    conteneur.addEventListener('touchstart', function (e) {
        depart = null;
        if (e.touches.length !== 1) { masquerMessage(); return; }
        if (conteneur.closest('.fullscreen-active')) return;
        if (e.target.closest('.leaflet-popup, .leaflet-control')) return;
        depart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    conteneur.addEventListener('touchmove', function (e) {
        if (!depart || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - depart.x;
        const dy = e.touches[0].clientY - depart.y;
        if (dx * dx + dy * dy < 100) return;
        depart = null;
        afficherMessage(t('deux_doigts_carte'));
    }, { passive: true });
})();

// Emprise de la Belgique [sud-ouest, nord-est] (légère marge incluse : Arlon au sud, pointe du
// Limbourg à l'est). Utilisée pour cadrer la carte au premier chargement et au retour à l'accueil
// (clic sur le logo) via fitBounds plutôt qu'un center/zoom fixes : #map fait toute la largeur de
// l'écran pour une hauteur fixe (455px), donc un center/zoom codé en dur donnait un cadrage vertical
// différent selon la largeur de fenêtre (ex. Pays-Bas visibles en haut, sud du pays coupé en bas).
// fitBounds recalcule le zoom optimal à chaque chargement, quelle que soit la taille de la fenêtre.
const BELGIQUE_BOUNDS = [[49.50, 2.54], [51.51, 6.41]];

function cadrerSurBelgique() {
    const emprise = L.latLngBounds(BELGIQUE_BOUNDS);
    // Zoom calculé directement (indépendamment du zoom courant de la carte), plutôt que
    // fitBounds() + setZoom(getZoom()+1) : ce dernier lisait le zoom courant juste après avoir
    // lancé une animation, qui n'est pas toujours terminée à ce moment-là — au clic suivant sur
    // le logo, getZoom() pouvait donc retourner une valeur intermédiaire et le "+1" s'accumulait
    // à chaque clic au lieu de repartir de la même base.
    const zoomCible = map.getBoundsZoom(emprise, false, L.point(20, 20)) + 1;
    map.setView(emprise.getCenter(), zoomCible);
}
cadrerSurBelgique();

// Cadrage sur les terrains d'une province ou d'une région (pages province/région). Leaflet
// arrondit le zoom au niveau entier inférieur : la province n'occupait alors qu'une petite partie
// de la carte (Namur : de Lille à l'Allemagne sur ordinateur, toute la Belgique sur mobile). Les
// quarts de niveau sont permis le temps de ce cadrage seulement ; les zooms suivants (boutons,
// molette) reviennent aux niveaux entiers.
function cadrerSurEmprise(emprise, options) {
    map.options.zoomSnap = 0.25;
    map.fitBounds(emprise, options);
    map.options.zoomSnap = 1;
}

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

// Mémorisation des choix liés à la carte (fond Plan/Satellite, visibilité de la couche clubs)
// d'une page à l'autre, sur le même principe que 'mapetanque_lang' plus haut (localStorage,
// donc persiste aussi d'une visite à l'autre, pas seulement le temps de la session).
const STORAGE_KEY_BASE_LAYER = 'mapetanque_base_layer';
const STORAGE_KEY_CLUBS_VISIBLE = 'mapetanque_clubs_visible';

// Affiche le fond satellite par défaut uniquement si c'est le dernier choisi ; Plan sinon (comme avant)
if (localStorage.getItem(STORAGE_KEY_BASE_LAYER) === 'satellite') {
    satellite.addTo(map);
} else {
    osm.addTo(map);
}

// Sélecteur de couches
const baseMaps = {
    "🗺️ Plan": osm,
    "🛰️ Satellite": satellite
};

// Couche superposée des clubs affiliés (voir section "Chargement des clubs affiliés" plus bas
// pour le peuplement effectif — créée ici, vide, pour être référencée immédiatement par le
// contrôle dédié ci-dessous). Décochée par défaut, sauf si l'utilisateur l'avait laissée cochée
// sur une page précédente (voir STORAGE_KEY_CLUBS_VISIBLE) : la couche elle-même peut être
// ajoutée à la carte dès maintenant même si elle est encore vide, les marqueurs y seront ajoutés
// au fur et à mesure de l'arrivée de data/clubs.json (voir plus bas) sans que rien de spécial ne
// soit nécessaire ici pour ça.
// Regroupement (clustering) comme pour les terrains, mais avec une icône d'amas bleue dédiée
// (voir creerIconeClusterClub plus haut) pour rester visuellement distincte des amas de terrains.
// Nécessaire pour les performances sur mobile : sur la page d'accueil, jusqu'à 197 marqueurs
// individuels sans regroupement pouvaient ralentir sensiblement le pan/zoom sur les appareils
// bas de gamme. Sur les pages province/région, où les clubs sont déjà filtrés à la zone (une
// vingtaine tout au plus), le clustering se désactive de toute façon très vite en zoomant
// (disableClusteringAtZoom: 16, même seuil que pour les terrains) et reste donc peu visible.
const clubsLayer = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    iconCreateFunction: creerIconeClusterClub
});
if (localStorage.getItem(STORAGE_KEY_CLUBS_VISIBLE) === 'true') {
    map.addLayer(clubsLayer);
}

const layersControl = L.control.layers(baseMaps).addTo(map);

// Mémorise le fond de carte choisi via le sélecteur Plan/Satellite pour le restaurer sur la
// prochaine page (voir plus haut). 'baselayerchange' est l'événement Leaflet standard, déclenché
// à chaque changement de fond, qu'il vienne de ce contrôle ou d'un appel programmatique.
map.on('baselayerchange', function (e) {
    localStorage.setItem(STORAGE_KEY_BASE_LAYER, e.layer === satellite ? 'satellite' : 'osm');
});

// Contrôle indépendant "Afficher les clubs" (interrupteur rond + bouton d'aide (i)), directement
// visible à côté du sélecteur Plan/Satellite plutôt que caché dans son menu déroulant. Ajouté
// juste après le sélecteur de couches : les contrôles Leaflet d'un même coin (topright) flottent
// naturellement à droite (règle CSS .leaflet-right .leaflet-control { float:right; clear:right })
// — .clubs-toggle-control retire ce clear:right (voir style.css) pour flotter juste à gauche du
// sélecteur déjà en place plutôt que de passer à la ligne en dessous. Le bouton plein écran, lui,
// garde son clear:right par défaut et continue donc de s'empiler sous cette rangée.
const ClubsToggleControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control clubs-toggle-control');

        const label = L.DomUtil.create('label', 'clubs-toggle-label', container);

        const switchWrapper = L.DomUtil.create('span', 'clubs-toggle-switch', label);
        const checkbox = L.DomUtil.create('input', '', switchWrapper);
        checkbox.type = 'checkbox';
        checkbox.id = 'clubs-toggle-checkbox';
        // Reflète l'état déjà décidé plus haut (clubsLayer ajoutée ou non à la carte selon
        // STORAGE_KEY_CLUBS_VISIBLE), plutôt que de relire localStorage une seconde fois ici :
        // une seule source de vérité (l'état réel de la carte) pour éviter toute désynchronisation.
        checkbox.checked = map.hasLayer(clubsLayer);
        L.DomUtil.create('span', 'clubs-toggle-slider', switchWrapper);

        const texte = L.DomUtil.create('span', 'clubs-toggle-text', label);
        texte.textContent = t('clubs_layer_label');
        texte.dataset.i18n = 'clubs_layer_label';

        const boutonAide = L.DomUtil.create('button', 'clubs-help-trigger control-clubs-help-trigger', container);
        boutonAide.type = 'button';
        boutonAide.setAttribute('aria-label', t('clubs_help_aria'));
        boutonAide.dataset.i18nAria = 'clubs_help_aria';
        boutonAide.innerHTML = ICON_INFO;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(checkbox, 'change', function () {
            if (checkbox.checked) {
                map.addLayer(clubsLayer);
            } else {
                map.removeLayer(clubsLayer);
            }
            localStorage.setItem(STORAGE_KEY_CLUBS_VISIBLE, checkbox.checked ? 'true' : 'false');
            // Consommé par le script inline des pages province, pour compléter/retirer le
            // comptage de clubs dans la liste des communes (voir clubsParCommune plus bas).
            window.dispatchEvent(new CustomEvent('clubsAffichageChange', { detail: { visible: checkbox.checked } }));
        });

        L.DomEvent.on(boutonAide, 'click', function (e) {
            L.DomEvent.stop(e);
            basculerBulleAideClubs(boutonAide);
        });

        return container;
    }
});
map.addControl(new ClubsToggleControl());

// Interrupteur du contrôle ci-dessus : gardé accessible pour être resynchronisé (coché) depuis
// allerVersClub() quand un lien de partage active la couche clubs par programme plutôt que par clic.
const clubsToggleCheckbox = document.getElementById('clubs-toggle-checkbox');

// ===================== Bulle d'aide "Clubs affiliés" =====================
// Composant unique et partagé (pas un par déclencheur) : repositionné et son contenu
// réinjecté à chaque clic, pour fonctionner aussi bien depuis le bouton (i) du sélecteur de
// couches que depuis celui de la popup d'un club — et sur mobile (clic, pas survol).
const clubsHelpPopover = document.createElement('div');
clubsHelpPopover.className = 'clubs-help-popover';
clubsHelpPopover.setAttribute('role', 'note');
document.body.appendChild(clubsHelpPopover);

let clubsHelpPopoverTrigger = null;

function positionnerBulleAideClubs(trigger) {
    const rect = trigger.getBoundingClientRect();
    const largeurBulle = 260;

    let gauche = rect.left + (rect.width / 2) - (largeurBulle / 2);
    gauche = Math.max(8, Math.min(gauche, window.innerWidth - largeurBulle - 8));

    let haut = rect.bottom + 8;
    // Si la bulle déborderait en bas de l'écran (déclencheur proche du bas), on l'affiche
    // au-dessus du déclencheur plutôt qu'en dessous
    if (haut + 160 > window.innerHeight) {
        haut = rect.top - 8;
        clubsHelpPopover.classList.add('clubs-help-popover-above');
        clubsHelpPopover.style.transform = 'translateY(-100%)';
    } else {
        clubsHelpPopover.classList.remove('clubs-help-popover-above');
        clubsHelpPopover.style.transform = 'none';
    }

    clubsHelpPopover.style.left = gauche + 'px';
    clubsHelpPopover.style.top = haut + 'px';
}

function fermerBulleAideClubs() {
    clubsHelpPopover.classList.remove('open');
    clubsHelpPopoverTrigger = null;
}

function basculerBulleAideClubs(trigger) {
    if (clubsHelpPopoverTrigger === trigger && clubsHelpPopover.classList.contains('open')) {
        fermerBulleAideClubs();
        return;
    }

    clubsHelpPopover.innerHTML = t('clubs_help_intro');
    clubsHelpPopoverTrigger = trigger;
    positionnerBulleAideClubs(trigger);
    clubsHelpPopover.classList.add('open');
}

// Fermeture au clic en dehors de la bulle (et en dehors de n'importe quel déclencheur (i))
document.addEventListener('click', function (e) {
    if (!clubsHelpPopover.classList.contains('open')) return;
    if (clubsHelpPopover.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.clubs-help-trigger')) return;
    fermerBulleAideClubs();
});

// Repositionnement si la bulle est ouverte pendant un redimensionnement (rotation mobile, etc.)
window.addEventListener('resize', function () {
    if (clubsHelpPopoverTrigger) positionnerBulleAideClubs(clubsHelpPopoverTrigger);
});


// Bouton plein écran, ajouté juste après pour s'empiler sous le sélecteur Plan/Satellite dans
// le même coin (topright) — voir definirModePleinEcran() plus bas pour la logique de bascule
const FullscreenControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const btn = L.DomUtil.create('a', '', container);
        btn.id = 'fullscreenBtn';
        btn.href = '#';
        btn.setAttribute('role', 'button');
        btn.dataset.i18nAria = 'fullscreen_enter';
        btn.setAttribute('aria-label', t('fullscreen_enter'));
        btn.innerHTML = ICON_MAXIMIZE;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        L.DomEvent.on(btn, 'click', function (e) {
            L.DomEvent.stop(e);
            definirModePleinEcran(!mapView.classList.contains('fullscreen-active'));
        });

        return container;
    }
});
map.addControl(new FullscreenControl());

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
        // Terrains masqués par les filtres de la carte : ignorés (voir « Filtres de la carte »).
        if (filtresActifs.size && t.props && !passeLesFiltres(t.props)) return;
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


// ===================== Filtres de la carte (critères OSM) =====================
// Bouton « Filtres » sur la carte, qui ouvre un panneau de pastilles à cocher : un menu déroulant
// posé sur la carte sur ordinateur, un panneau montant du bas de l'écran sur mobile. Les critères
// cochés se cumulent (Bancs ET WC). Seuls les critères OSM servent de filtres, jamais ceux des
// joueurs. Mêmes règles et mêmes seuils que les pastilles des fiches (voir « Critères des
// terrains » plus bas) : une seule source de vérité.
//
// Les couches filtrées sont les groupes de marqueurs de terrains que chaque page déclare avec
// window.enregistrerTerrainsFiltrables(groupe) : `markers` sur l'accueil, le groupe propre aux
// pages province et région (voir leurs gabarits). Chaque marqueur doit porter sa feature
// (layer.feature, que L.geoJSON pose de lui-même). Tant qu'aucun groupe n'est déclaré, le bouton
// reste masqué : il n'apparaît donc pas sur les pages sans terrains.
//
// Rien n'est mémorisé : les filtres repartent à zéro à chaque page.

const ICON_FILTRES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"></path></svg>';

const filtresActifs = new Set();
const groupesFiltrables = [];            // [{ groupe, couches: [marqueurs portant .feature] }]
function passeLesFiltres(props, filtres) {
    const criteres = criteresFiltrables(props);
    for (const cle of (filtres || filtresActifs)) {
        if (!criteres.has(cle)) return false;
    }
    return true;
}

function toutesLesCouchesFiltrables() {
    return groupesFiltrables.reduce(function (liste, g) { return liste.concat(g.couches); }, []);
}

function formaterNombre(n) {
    const locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    return n.toLocaleString(locale);
}

function texteNombreTerrains(n) {
    return t(n === 1 || (n === 0 && currentLang === 'fr') ? 'filtres_terrains_un' : 'filtres_terrains_n')
        .replace('%n', formaterNombre(n));
}

window.enregistrerTerrainsFiltrables = function (groupe) {
    groupesFiltrables.push({
        groupe: groupe,
        couches: groupe.getLayers().filter(function (couche) { return couche.feature; })
    });
    if (boutonFiltres) boutonFiltres.parentNode.hidden = false;
    if (filtresActifs.size) appliquerFiltres();
};

// Un terrain demandé explicitement (lien de partage, tuile du carrousel) mais masqué par les
// filtres : on retire les filtres plutôt que de ne rien ouvrir.
window.mapetanqueRevelerTerrain = function (lat, lon) {
    if (!filtresActifs.size) return;
    const masque = toutesLesCouchesFiltrables().some(function (couche) {
        const pos = couche.getLatLng();
        return Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001
            && !passeLesFiltres(couche.feature.properties);
    });
    if (masque) effacerFiltres();
};

function appliquerFiltres() {
    groupesFiltrables.forEach(function (g) {
        const visibles = filtresActifs.size
            ? g.couches.filter(function (couche) { return passeLesFiltres(couche.feature.properties); })
            : g.couches;
        g.groupe.clearLayers();
        g.groupe.addLayers(visibles);
    });

    // La flèche « terrain le plus proche » ne vise que les terrains encore affichés.
    if (userPosition) {
        terrainLePlusProche = trouverTerrainLePlusProche(userPosition[0], userPosition[1]);
        mettreAJourFlecheTerrainProche();
    }

    majBoutonFiltres();
    majResumeFiltres();
    majPanneauFiltres();
}

function basculerFiltre(cle) {
    if (filtresActifs.has(cle)) filtresActifs.delete(cle);
    else filtresActifs.add(cle);
    appliquerFiltres();
}

function effacerFiltres() {
    if (!filtresActifs.size) return;
    filtresActifs.clear();
    appliquerFiltres();
}

// --- Bouton sur la carte ---------------------------------------------------------------------
// Ajouté après le bouton plein écran et sans clear (voir .filtres-control dans style.css) : il
// flotte à sa gauche, sur la deuxième rangée, sous « Afficher les clubs ». Sur mobile, la
// première rangée n'a pas la place d'un troisième contrôle.
let boutonFiltres = null;

const FiltresControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control filtres-control');
        container.hidden = !groupesFiltrables.length;

        boutonFiltres = L.DomUtil.create('button', 'filtres-bouton', container);
        boutonFiltres.type = 'button';
        boutonFiltres.setAttribute('aria-expanded', 'false');
        boutonFiltres.setAttribute('aria-controls', 'filtres-panneau');
        boutonFiltres.innerHTML = ICON_FILTRES
            + '<span data-i18n="filtres_bouton">' + t('filtres_bouton') + '</span>'
            + '<span class="filtres-badge" hidden></span>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        L.DomEvent.on(boutonFiltres, 'click', function (e) {
            L.DomEvent.stop(e);
            if (panneauFiltresOuvert()) fermerPanneauFiltres();
            else ouvrirPanneauFiltres();
        });

        return container;
    }
});
map.addControl(new FiltresControl());

function majBoutonFiltres() {
    if (!boutonFiltres) return;
    const badge = boutonFiltres.querySelector('.filtres-badge');
    badge.textContent = filtresActifs.size;
    badge.hidden = !filtresActifs.size;
    boutonFiltres.classList.toggle('actif', filtresActifs.size > 0);
}

// --- Rappel sur la carte quand des filtres sont actifs : « 92 terrains · Bancs, WC  Effacer » ---
const resumeFiltres = document.createElement('div');
resumeFiltres.id = 'filtres-resume';
resumeFiltres.hidden = true;
document.getElementById('map').appendChild(resumeFiltres);
L.DomEvent.disableClickPropagation(resumeFiltres);

function majResumeFiltres() {
    resumeFiltres.hidden = !filtresActifs.size;
    if (!filtresActifs.size) { resumeFiltres.innerHTML = ''; return; }

    const nombre = toutesLesCouchesFiltrables().filter(function (couche) {
        return passeLesFiltres(couche.feature.properties);
    }).length;
    const libelles = FILTRES_SUR_PLACE.concat(FILTRES_PROXIMITE)
        .filter(function (cle) { return filtresActifs.has(cle); })
        .map(function (cle) { return t('critere_' + cle); });

    resumeFiltres.innerHTML = '<span class="filtres-resume-texte"><b>' + texteNombreTerrains(nombre) + '</b> · '
        + libelles.join(', ') + '</span>'
        + '<button type="button" class="filtres-effacer">' + t('filtres_effacer') + '</button>';
    resumeFiltres.querySelector('.filtres-effacer').addEventListener('click', effacerFiltres);
}

// --- Panneau ---------------------------------------------------------------------------------
// Un seul élément, déplacé selon l'écran : dans le conteneur de la carte sur ordinateur (il suit
// la carte au défilement et en plein écran), dans <body> sur mobile, avec un voile derrière.
const panneauFiltres = document.createElement('div');
panneauFiltres.id = 'filtres-panneau';
panneauFiltres.setAttribute('role', 'dialog');
panneauFiltres.hidden = true;
L.DomEvent.disableClickPropagation(panneauFiltres);
L.DomEvent.disableScrollPropagation(panneauFiltres);

const voileFiltres = document.createElement('div');
voileFiltres.id = 'filtres-voile';
voileFiltres.hidden = true;
voileFiltres.addEventListener('click', fermerPanneauFiltres);

function panneauFiltresOuvert() {
    return !panneauFiltres.hidden;
}

function pastilleFiltreHtml(cle) {
    return '<button type="button" class="filtre-pastille" data-cle="' + cle + '" aria-pressed="false">'
        + PICTOS[cle] + '<span>' + t('critere_' + cle) + '</span>'
        + '<span class="filtre-nombre"></span></button>';
}

function ouvrirPanneauFiltres() {
    const mobile = estMobile();
    panneauFiltres.className = mobile ? 'feuille' : 'deroulant';
    panneauFiltres.setAttribute('aria-label', t('filtres_titre'));

    // Construit à chaque ouverture : suit la langue affichée et le format (mobile/ordinateur).
    panneauFiltres.innerHTML =
        '<div class="filtres-tete">'
        + '<h2>' + t('filtres_titre') + '</h2>'
        + '<button type="button" class="filtres-fermer" aria-label="' + t('close_panel') + '">✕</button>'
        + '</div>'
        + '<div class="filtres-corps">'
        + '<div class="filtres-groupe"><div class="criteres-titre">' + t('fiche_sur_place') + '</div>'
        + '<div class="filtres-liste">' + FILTRES_SUR_PLACE.map(pastilleFiltreHtml).join('') + '</div></div>'
        + '<div class="filtres-groupe"><div class="criteres-titre">' + t('fiche_a_proximite') + '</div>'
        + '<div class="filtres-liste">' + FILTRES_PROXIMITE.map(pastilleFiltreHtml).join('') + '</div></div>'
        + '</div>'
        + '<div class="filtres-pied">'
        + (mobile
            ? '<button type="button" class="filtres-effacer"></button><button type="button" class="filtres-voir"></button>'
            : '<span class="filtres-compte"></span><button type="button" class="filtres-effacer"></button>')
        + '</div>';

    panneauFiltres.querySelectorAll('.filtre-pastille').forEach(function (pastille) {
        pastille.addEventListener('click', function () { basculerFiltre(pastille.getAttribute('data-cle')); });
    });
    panneauFiltres.querySelector('.filtres-fermer').addEventListener('click', fermerPanneauFiltres);
    panneauFiltres.querySelector('.filtres-effacer').addEventListener('click', effacerFiltres);
    const voir = panneauFiltres.querySelector('.filtres-voir');
    if (voir) voir.addEventListener('click', fermerPanneauFiltres);

    if (mobile) {
        document.body.appendChild(voileFiltres);
        document.body.appendChild(panneauFiltres);
        voileFiltres.hidden = false;
    } else {
        // Sous le bouton, aligné sur le bord droit de la carte.
        const conteneurCarte = map.getContainer();
        conteneurCarte.appendChild(panneauFiltres);
        const haut = boutonFiltres.getBoundingClientRect().bottom - conteneurCarte.getBoundingClientRect().top + 8;
        panneauFiltres.style.top = haut + 'px';
        panneauFiltres.style.maxHeight = Math.max(200, conteneurCarte.clientHeight - haut - 12) + 'px';
    }

    majPanneauFiltres();
    panneauFiltres.hidden = false;
    boutonFiltres.setAttribute('aria-expanded', 'true');
    // Le rappel sur la carte ferait doublon avec le pied du panneau.
    resumeFiltres.classList.add('masque');
}

function fermerPanneauFiltres() {
    panneauFiltres.hidden = true;
    voileFiltres.hidden = true;
    if (boutonFiltres) boutonFiltres.setAttribute('aria-expanded', 'false');
    resumeFiltres.classList.remove('masque');
}

// Chiffres des pastilles : pour un critère non coché, le nombre de terrains qui resteraient si
// on le cochait en plus. Un critère qui ne laisserait aucun terrain est désactivé.
function majPanneauFiltres() {
    if (panneauFiltres.hidden && !panneauFiltres.firstChild) return;

    const couches = toutesLesCouchesFiltrables();
    const retenues = couches.filter(function (couche) { return passeLesFiltres(couche.feature.properties); });

    panneauFiltres.querySelectorAll('.filtre-pastille').forEach(function (pastille) {
        const cle = pastille.getAttribute('data-cle');
        const coche = filtresActifs.has(cle);
        const nombre = coche ? retenues.length : retenues.filter(function (couche) {
            return criteresFiltrables(couche.feature.properties).has(cle);
        }).length;
        pastille.setAttribute('aria-pressed', String(coche));
        pastille.disabled = !coche && nombre === 0;
        pastille.querySelector('.filtre-nombre').textContent = coche ? '' : formaterNombre(nombre);
    });

    const effacer = panneauFiltres.querySelector('.filtres-effacer');
    if (effacer) {
        effacer.textContent = t('filtres_effacer');
        effacer.disabled = !filtresActifs.size;
    }
    const compte = panneauFiltres.querySelector('.filtres-compte');
    if (compte) {
        compte.innerHTML = '<b>' + texteNombreTerrains(retenues.length) + '</b> '
            + t('filtres_sur_total').replace('%t', formaterNombre(couches.length));
    }
    const voir = panneauFiltres.querySelector('.filtres-voir');
    if (voir) {
        voir.textContent = retenues.length === 0 ? t('filtres_voir_aucun')
            : retenues.length === 1 ? t('filtres_voir_un')
            : t('filtres_voir_n').replace('%n', formaterNombre(retenues.length));
    }
}

// Fermeture du menu déroulant (ordinateur) au clic en dehors, et avec Échap partout.
document.addEventListener('click', function (e) {
    if (!panneauFiltresOuvert() || panneauFiltres.classList.contains('feuille')) return;
    if (panneauFiltres.contains(e.target) || (boutonFiltres && boutonFiltres.contains(e.target))) return;
    fermerPanneauFiltres();
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panneauFiltresOuvert()) fermerPanneauFiltres();
});

// Icône réutilisée pour marquer une position (localisation ou résultat de recherche)
const positionIcon = L.divIcon({
    className: 'user-location',
    html: '<div></div>',
    iconSize: [20, 20]
});


// ===================== Géolocalisation =====================

let locateMarker = null; // marqueur de la position géolocalisée (distinct de searchMarker)

// Gardé optionnel (comme add-terrain-link plus bas) : les pages sans carte de recherche
// (ex. "Comment jouer", "Compteur de points") n'ont pas ce bouton, et ne doivent pas faire
// planter le reste du script pour autant.
const locateBtn = document.getElementById("locateBtn");
if (locateBtn) {
    locateBtn.addEventListener("click", function () {

        effacerMessageRecherche();

        if (navigator.geolocation) {

            navigator.geolocation.getCurrentPosition(function(position) {

                let lat = position.coords.latitude;
                let lon = position.coords.longitude;

                definirPositionUtilisateur(lat, lon);

                // Signale la position GPS, plus fiable que la détection par IP, au carrousel des
                // beaux terrains — n'a d'effet que sur l'accueil (voir beaux-terrains.js).
                if (typeof window.mapetanqueMajRegionBeauxTerrains === "function") {
                    window.mapetanqueMajRegionBeauxTerrains(lat, lon);
                }

                map.setView([lat, lon], 15);

                if (locateMarker) {
                    map.removeLayer(locateMarker);
                }

                locateMarker = L.marker([lat, lon], {
                    icon: positionIcon
                })
                .addTo(map)
                .bindPopup(function () { return t('popup_here'); })
                .openPopup();

                signalerSiHorsZone(lat, lon, '?localiser=1');

            }, function() {
                alert(t('geoloc_error'));
            });

        } else {
            alert(t('geoloc_unsupported'));
        }

    });
}


// ===================== Recherche d'adresse =====================

let searchMarker = null;

// Pages province et région : la carte ne montre que les terrains de la zone de la page
// (window.MAPETANQUE_STATS_GEO_KEY, clé de province ou de région, absente sur l'accueil). Même
// condition que pour les clubs (voir « Chargement des clubs » plus bas).
function estDansLaZone(props) {
    const cle = window.MAPETANQUE_STATS_GEO_KEY;
    return !cle || props.province === cle || props.region === cle;
}

// Recherche biaisée vers la zone de la page, sans l'exclure strictement (utile pour les communes
// frontalières) : la Belgique sur l'accueil, l'emprise des terrains de la province ou de la région
// ailleurs, pour que le Saint-Gérard de la province passe avant ses homonymes.
function viewboxRecherche() {
    if (!window.MAPETANQUE_STATS_GEO_KEY) return Promise.resolve('2.5,51.6,6.5,49.4');
    return terrainsGeojson.then(function (data) {
        let ouest = 180, est = -180, sud = 90, nord = -90;
        data.features.forEach(function (f) {
            if (!estDansLaZone(f.properties)) return;
            const c = f.geometry.coordinates; // [lon, lat]
            ouest = Math.min(ouest, c[0]);
            est = Math.max(est, c[0]);
            sud = Math.min(sud, c[1]);
            nord = Math.max(nord, c[1]);
        });
        return [ouest, nord, est, sud].join(',');
    });
}

function effacerMessageRecherche() {
    const errorEl = document.getElementById('searchError');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('search-info');
}

// Pages province et région : un lieu (recherche ou géolocalisation) hors de la zone de la page
// tombe sur une carte vide. Il est jugé hors zone quand le terrain le plus proche, tous terrains
// de Belgique confondus, n'en fait pas partie ; on propose alors la carte de Belgique, qui
// reprend la recherche ou la géolocalisation (suiteUrl, voir la fin de « Chargement des
// terrains » plus bas).
function signalerSiHorsZone(lat, lon, suiteUrl) {
    if (!window.MAPETANQUE_STATS_GEO_KEY) return;
    terrainsGeojson.then(function (data) {
        let plusProche = null;
        let distanceMin = Infinity;
        data.features.forEach(function (f) {
            const c = f.geometry.coordinates;
            const d = calculDistance(lat, lon, c[1], c[0]);
            if (d < distanceMin) {
                distanceMin = d;
                plusProche = f;
            }
        });
        if (!plusProche || estDansLaZone(plusProche.properties)) return;

        const errorEl = document.getElementById('searchError');
        const lien = document.createElement('a');
        lien.href = (currentLang === 'fr' ? '/' : '/' + currentLang + '/') + suiteUrl;
        lien.textContent = t('hors_zone_lien');
        errorEl.textContent = t('hors_zone') + ' ';
        errorEl.appendChild(lien);
        errorEl.classList.add('search-info');
    });
}

// Même principe que locateBtn ci-dessus : optionnel, absent sur les pages sans recherche.
const searchForm = document.getElementById('searchForm');
if (searchForm) {
    searchForm.addEventListener('submit', function (e) {

    e.preventDefault();

    const input = document.getElementById('searchInput');
    const errorEl = document.getElementById('searchError');
    const query = input.value.trim();

    effacerMessageRecherche();

    if (!query) return;

    // Referme le clavier virtuel : sans ceci, il masque la moitié de la carte au moment même
    // où l'utilisateur veut voir le résultat de sa recherche.
    // Fait ici, de façon synchrone, et non dans le .then() : iOS n'honore le blur() de manière
    // fiable que dans le contexte du geste utilisateur, pas depuis une callback asynchrone.
    input.blur();

    viewboxRecherche()
        .then(function (viewbox) {
            return fetch('https://nominatim.openstreetmap.org/search'
                + '?format=jsonv2'
                + '&q=' + encodeURIComponent(query)
                + '&limit=1'
                + '&viewbox=' + viewbox
                + '&bounded=0');
        })
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
                // className : cette bulle ne contient qu'une ligne d'adresse, alors que le
                // style par défaut des popups (.leaflet-popup-content) réserve 40px en haut
                // pour la croix de fermeture des fiches terrain. Sans classe distincte, elle
                // hériterait de cette marge et paraîtrait inutilement haute.
                .bindPopup(resultat.display_name, { className: 'popup-adresse' })
                .openPopup();

            searchMarker._displayName = resultat.display_name;

            signalerSiHorsZone(lat, lon, '?recherche=' + encodeURIComponent(query));

        })
        .catch(function () {
            errorEl.textContent = t('search_failed');
        });

    });
}


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


// ===================== Modale "Ajouter une photo" =====================
// Même schéma que le panneau de partage ci-dessus (#share-panel/#share-overlay). Ouverte depuis
// le bouton "Ajouter une photo" d'une popup de terrain sans photo — voir brancherPhotosPopup.
const addPhotoOverlay = document.getElementById('add-photo-overlay');
const addPhotoModal = document.getElementById('add-photo-modal');
const addPhotoTerrainName = document.getElementById('add-photo-terrain-name');

// Les photos partent maintenant vers le Worker Cloudflare, qui les range dans R2 et les met en
// file d'attente de modération (Forminit n'est plus utilisé). Le honeypot _gotcha du HTML est
// conservé : c'est désormais le Worker qui le vérifie, avec la taille, le format réel du fichier
// et un plafond d'envois par jour.
const URL_ENVOI_PHOTO = "https://mapetanque-admin.mapetanque.workers.dev/photos/envoi";

// Taille maximale acceptée AVANT redimensionnement, vérifiée ici pour un retour immédiat, et
// revérifiée par le Worker (le contrôle côté navigateur se contourne).
const TAILLE_MAX_PHOTO = 20 * 1024 * 1024;

// Nombre de photos par envoi. Au-delà, l'attente devient longue et la file de modération se
// remplit sans bénéfice : une poignée de bonnes photos vaut mieux qu'une rafale.
const MAX_PHOTOS_PAR_ENVOI = 5;

// Côté le plus long après redimensionnement. Largement suffisant pour Mapillary, et divise par
// dix ou vingt le poids d'une photo de téléphone moderne.
const COTE_MAX_PHOTO = 2048;
const QUALITE_JPEG = 0.85;

const addPhotoForm = document.getElementById('add-photo-form');
const addPhotoStatus = document.getElementById('add-photo-status');
const addPhotoSubmitBtn = addPhotoForm ? addPhotoForm.querySelector('.add-photo-submit-btn') : null;

window.ouvrirModaleAjoutPhoto = function (osmId, terrainTitre) {
    addPhotoTerrainName.textContent = terrainTitre || '';
    addPhotoModal.dataset.osmId = osmId || '';
    addPhotoModal.classList.add('open');
    addPhotoOverlay.classList.add('visible');

    // Réinitialise le formulaire à chaque ouverture (sinon une soumission précédente, pour un
    // autre terrain, pourrait laisser la modale dans un état "envoyé" ou "erreur").
    if (addPhotoForm) {
        addPhotoForm.reset();
        addPhotoForm.style.display = '';
        addPhotoForm.querySelector('[name="fi-text-terrain-osm-id"]').value = osmId || '';
        addPhotoForm.querySelector('[name="fi-text-terrain-nom"]').value = terrainTitre || '';
        addPhotoForm.querySelector('[name="fi-text-terrain-lien-osm"]').value = osmId
            ? `https://www.openstreetmap.org/${osmId}`
            : '';
        if (addPhotoStatus) {
            addPhotoStatus.textContent = '';
            addPhotoStatus.className = 'add-photo-status';
        }
        if (addPhotoSubmitBtn) addPhotoSubmitBtn.disabled = false;
    }
};

// --- Préparation du formulaire ------------------------------------------------------------
// Le bloc #add-photo-modal est présent à l'identique dans 15 pages statiques et 2 gabarits :
// ces quelques ajustements sont faits ici pour n'avoir qu'une seule source à maintenir.
if (addPhotoForm) {
    const champPhoto = addPhotoForm.querySelector('[name="fi-file-photo"]');
    if (champPhoto) champPhoto.multiple = true;

    // L'ancien champ e-mail devient le prénom ou pseudo à créditer : c'est ce que la case de
    // licence promet déjà, et un pseudo est bien moins sensible qu'une adresse.
    const champCredit = addPhotoForm.querySelector('[name="fi-sender-email"]');
    if (champCredit) {
        champCredit.type = 'text';
        champCredit.name = 'credit_nom';
        champCredit.maxLength = 60;
        champCredit.autocomplete = 'nickname';

        const etiquette = champCredit.previousElementSibling;
        if (etiquette && etiquette.classList.contains('add-photo-field-label')) {
            etiquette.dataset.i18n = 'add_photo_field_credit_label';
            etiquette.textContent = t('add_photo_field_credit_label');
        }
    }
}

// --- Astuce "format paysage" animée -------------------------------------------------------
// Même logique que ci-dessus : l'astuce est en dur dans toutes les pages, on la reconstruit ici
// pour n'avoir qu'une source. Elle gagne un petit téléphone qui pivote vers le format paysage
// (animation en boucle, 3,6 s) et le lien porte désormais sur le mot "Mapillary" lui-même.
//
// Le texte est découpé en trois morceaux (avant le lien / le lien / après le lien), chacun avec
// son data-i18n : appliquerTraductions() les met à jour tout seul au changement de langue, et
// l'allemand peut accrocher "-Fotos passt." directement derrière le lien.
//
// Le style est injecté ici plutôt que dans une feuille CSS : la modale est présente dans des
// pages qui ne chargent pas toutes les mêmes feuilles additives, et style.css n'est pas modifié.
const CSS_ASTUCE_PAYSAGE = `
#add-photo-modal .add-photo-tip { display: flex; align-items: center; gap: 10px; }
.astuce-paysage-anim { flex: none; width: 44px; height: 44px; overflow: visible; }
.astuce-paysage-tout { animation: astuce-paysage-tout 3.6s infinite; }
.astuce-paysage-fleche { fill: none; stroke: #74C15A; stroke-width: 2.4; stroke-linecap: round;
    stroke-dasharray: 100; animation: astuce-paysage-fleche 3.6s infinite; }
.astuce-paysage-pointe { fill: none; stroke: #74C15A; stroke-width: 2.4; stroke-linecap: round;
    stroke-linejoin: round; animation: astuce-paysage-pointe 3.6s infinite; }
.astuce-paysage-tel { transform-box: view-box; transform-origin: 24px 24px;
    animation: astuce-paysage-tel 3.6s infinite; }
.astuce-paysage-coque { fill: #fff; stroke: #555; stroke-width: 2.4; }
.astuce-paysage-hp { stroke: #555; stroke-width: 2; stroke-linecap: round; }
.astuce-paysage-ecran { opacity: 0; animation: astuce-paysage-ecran 3.6s infinite; }
@keyframes astuce-paysage-tout { 0% { opacity: 0; } 6% { opacity: 1; } 88% { opacity: 1; } 97%, 100% { opacity: 0; } }
@keyframes astuce-paysage-fleche {
    0%, 8% { stroke-dashoffset: 100; opacity: 1; }
    30%, 48% { stroke-dashoffset: 0; opacity: 1; }
    58%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes astuce-paysage-pointe { 0%, 26% { opacity: 0; } 32%, 48% { opacity: 1; } 58%, 100% { opacity: 0; } }
@keyframes astuce-paysage-tel {
    0%, 32% { transform: rotate(0deg); animation-timing-function: cubic-bezier(.65, 0, .35, 1); }
    56%, 100% { transform: rotate(-90deg); } }
@keyframes astuce-paysage-ecran { 0%, 56% { opacity: 0; } 66%, 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
    .astuce-paysage-tout, .astuce-paysage-fleche, .astuce-paysage-pointe,
    .astuce-paysage-tel, .astuce-paysage-ecran { animation: none; }
    .astuce-paysage-tel { transform: rotate(-90deg); }
    .astuce-paysage-ecran { opacity: 1; }
    .astuce-paysage-fleche, .astuce-paysage-pointe { opacity: 0; }
}`;

// Repère 48 x 48 centré sur le téléphone (24, 24), avec 4 unités de marge pour la pointe de la
// flèche. Le téléphone pivote autour de ce centre ; le petit paysage (colline + soleil) est
// dessiné hors du groupe qui tourne, déjà à l'horizontale, et n'apparaît qu'une fois couché.
const SVG_ASTUCE_PAYSAGE = `
<svg class="astuce-paysage-anim" viewBox="-4 -4 56 56" aria-hidden="true" focusable="false">
    <defs><clipPath id="astuce-paysage-clip"><rect x="12.5" y="16.5" width="26" height="15" rx="1.5"/></clipPath></defs>
    <g class="astuce-paysage-tout">
        <path class="astuce-paysage-fleche" pathLength="100" d="M35 4.95 A22 22 0 0 0 2.33 20.18"/>
        <polyline class="astuce-paysage-pointe" points="6.48,16.85 2.33,20.18 -0.42,15.63"/>
        <g class="astuce-paysage-tel">
            <rect class="astuce-paysage-coque" x="14" y="7" width="20" height="34" rx="3.5"/>
            <line class="astuce-paysage-hp" x1="21.5" y1="10.8" x2="26.5" y2="10.8"/>
        </g>
        <g class="astuce-paysage-ecran" clip-path="url(#astuce-paysage-clip)">
            <path d="M12 32 L19 23.5 L23.5 27.5 L29 21.5 L39 32 Z" fill="#74C15A"/>
            <circle cx="33" cy="20.3" r="1.9" fill="#74C15A"/>
        </g>
    </g>
</svg>`;

(function preparerAstucePaysage() {
    const astuce = addPhotoModal ? addPhotoModal.querySelector('.add-photo-tip') : null;
    if (!astuce || astuce.querySelector('.astuce-paysage-anim')) return;

    if (!document.getElementById('style-astuce-paysage')) {
        const style = document.createElement('style');
        style.id = 'style-astuce-paysage';
        style.textContent = CSS_ASTUCE_PAYSAGE;
        document.head.appendChild(style);
    }

    // On garde l'adresse du lien existant, pour ne pas la dupliquer ici.
    const ancienLien = astuce.querySelector('a');
    const adresse = ancienLien ? ancienLien.href : 'https://www.mapillary.com';

    function morceau(balise, cle) {
        const el = document.createElement(balise);
        el.dataset.i18n = cle;
        el.textContent = t(cle);
        return el;
    }

    const texte = document.createElement('span');
    const lien = morceau('a', 'add_photo_tip_link');
    lien.href = adresse;
    lien.target = '_blank';
    lien.rel = 'noopener';

    texte.append(
        morceau('strong', 'add_photo_tip_label'), ' ',
        morceau('span', 'add_photo_tip'), ' ',
        lien,
        morceau('span', 'add_photo_tip_after')
    );

    astuce.innerHTML = SVG_ASTUCE_PAYSAGE;
    astuce.appendChild(texte);
})();


// --- Lecture de la date de prise de vue ---------------------------------------------------
// Le redimensionnement ci-dessous réécrit l'image et efface donc les EXIF : c'est voulu, ils
// peuvent contenir les coordonnées du domicile de quelqu'un qui envoie une photo prise ailleurs,
// ainsi que le modèle et le numéro de série de l'appareil. Mais mapillary_tools exige une date
// de prise de vue, d'où cette lecture préalable du seul champ utile (DateTimeOriginal, 0x9003).
//
// Analyse volontairement minimale du conteneur JPEG : on cherche le segment APP1/Exif, on lit
// l'en-tête TIFF pour connaître l'ordre des octets, puis on parcourt les deux répertoires qui
// peuvent porter la date. Aucune bibliothèque, une centaine de lignes évitées.
function lireDateExif(fichier) {
    return new Promise(function (resoudre) {
        // Les EXIF sont en tête de fichier : inutile de lire 8 Mo pour trouver une date.
        const debut = fichier.slice(0, 131072);
        const lecteur = new FileReader();

        lecteur.onerror = function () { resoudre(null); };
        lecteur.onload = function () {
            try {
                const vue = new DataView(lecteur.result);
                if (vue.getUint16(0) !== 0xFFD8) { resoudre(null); return; }   // pas un JPEG

                let position = 2;
                while (position < vue.byteLength - 4) {
                    if (vue.getUint8(position) !== 0xFF) break;

                    const marqueur = vue.getUint8(position + 1);
                    const longueur = vue.getUint16(position + 2);

                    if (marqueur === 0xE1) {   // APP1
                        const tiff = position + 10;   // 4 octets d'en-tête + "Exif\0\0"
                        const petitBoutiste = vue.getUint16(tiff) === 0x4949;
                        const premierIfd = tiff + vue.getUint32(tiff + 4, petitBoutiste);

                        const date = chercherDateDansIfd(vue, tiff, premierIfd, petitBoutiste, 0);
                        resoudre(date);
                        return;
                    }

                    if (marqueur === 0xDA) break;   // début de l'image : plus d'EXIF au-delà
                    position += 2 + longueur;
                }
                resoudre(null);
            } catch (e) {
                resoudre(null);   // EXIF illisibles : la date de réception fera l'affaire
            }
        };

        lecteur.readAsArrayBuffer(debut);
    });
}

// Parcourt un répertoire IFD à la recherche de DateTimeOriginal (0x9003) ou, à défaut, de
// DateTime (0x0132). Descend d'un niveau dans le sous-répertoire Exif (0x8769), où la première
// se trouve presque toujours.
function chercherDateDansIfd(vue, tiff, ifd, petitBoutiste, profondeur) {
    if (profondeur > 2 || ifd <= tiff || ifd + 2 > vue.byteLength) return null;

    const nombreEntrees = vue.getUint16(ifd, petitBoutiste);
    let sousRepertoire = null;
    let dateSecours = null;

    for (let i = 0; i < nombreEntrees; i++) {
        const entree = ifd + 2 + i * 12;
        if (entree + 12 > vue.byteLength) break;

        const etiquette = vue.getUint16(entree, petitBoutiste);

        if (etiquette === 0x8769) {
            sousRepertoire = tiff + vue.getUint32(entree + 8, petitBoutiste);
        }

        if (etiquette === 0x9003 || etiquette === 0x0132) {
            const decalage = tiff + vue.getUint32(entree + 8, petitBoutiste);
            let texte = '';
            for (let o = 0; o < 19 && decalage + o < vue.byteLength; o++) {
                texte += String.fromCharCode(vue.getUint8(decalage + o));
            }
            // Format EXIF : "AAAA:MM:JJ hh:mm:ss"
            if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(texte)) {
                const normalisee = texte.slice(0, 10).replace(/:/g, '-') + texte.slice(10);
                if (etiquette === 0x9003) return normalisee;
                dateSecours = normalisee;
            }
        }
    }

    if (sousRepertoire) {
        const trouvee = chercherDateDansIfd(vue, tiff, sousRepertoire, petitBoutiste, profondeur + 1);
        if (trouvee) return trouvee;
    }

    return dateSecours;
}


// --- Redimensionnement --------------------------------------------------------------------
// Ramène la photo à COTE_MAX_PHOTO sur son plus grand côté. createImageBitmap applique
// l'orientation EXIF, ce qui évite les photos couchées ; en cas d'échec (navigateur ancien), on
// repasse par un <img>, que les navigateurs actuels orientent également.
function redimensionnerPhoto(fichier) {
    return new Promise(function (resoudre) {
        function dessiner(source, largeur, hauteur) {
            const facteur = Math.min(1, COTE_MAX_PHOTO / Math.max(largeur, hauteur));

            // Photo déjà petite : inutile de la réencoder, ce qui dégraderait l'image pour rien.
            // Les EXIF sont alors conservés — acceptable, ces photos-là sont rares.
            if (facteur === 1) { resoudre(fichier); return; }

            const toile = document.createElement('canvas');
            toile.width = Math.round(largeur * facteur);
            toile.height = Math.round(hauteur * facteur);
            toile.getContext('2d').drawImage(source, 0, 0, toile.width, toile.height);

            toile.toBlob(function (blob) {
                resoudre(blob || fichier);
            }, 'image/jpeg', QUALITE_JPEG);
        }

        if (typeof createImageBitmap === 'function') {
            createImageBitmap(fichier, { imageOrientation: 'from-image' })
                .then(function (bitmap) { dessiner(bitmap, bitmap.width, bitmap.height); })
                .catch(function () { resoudre(fichier); });
            return;
        }

        const image = new Image();
        const url = URL.createObjectURL(fichier);
        image.onload = function () {
            dessiner(image, image.naturalWidth, image.naturalHeight);
            URL.revokeObjectURL(url);
        };
        image.onerror = function () { URL.revokeObjectURL(url); resoudre(fichier); };
        image.src = url;
    });
}


// --- Envoi --------------------------------------------------------------------------------
if (addPhotoForm) {
    addPhotoForm.addEventListener('submit', function (evt) {
        evt.preventDefault();

        const champPhoto = addPhotoForm.querySelector('[name="fi-file-photo"]');
        const fichiers = champPhoto ? Array.from(champPhoto.files) : [];

        function afficherStatut(cle, classe, texteDirect) {
            if (!addPhotoStatus) return;
            addPhotoStatus.textContent = texteDirect || t(cle);
            addPhotoStatus.className = 'add-photo-status' + (classe ? ' ' + classe : '');
        }

        if (!fichiers.length) return;

        if (fichiers.length > MAX_PHOTOS_PAR_ENVOI) {
            afficherStatut('add_photo_error_too_many', 'error');
            return;
        }
        if (fichiers.some(function (f) { return f.size > TAILLE_MAX_PHOTO; })) {
            afficherStatut('add_photo_error_too_large', 'error');
            return;
        }

        if (addPhotoSubmitBtn) addPhotoSubmitBtn.disabled = true;
        afficherStatut('add_photo_sending', 'sending');

        const osmId = addPhotoForm.querySelector('[name="fi-text-terrain-osm-id"]').value || '';
        const champCredit = addPhotoForm.querySelector('[name="credit_nom"]');
        const honeypot = addPhotoForm.querySelector('[name="_gotcha"]');

        // Envois l'un après l'autre plutôt qu'en parallèle : la progression est lisible, et une
        // photo refusée par le serveur n'emporte pas les autres.
        let envoyees = 0;

        function envoyerSuivante(index) {
            if (index >= fichiers.length) {
                if (envoyees === 0) {
                    afficherStatut('add_photo_error', 'error');
                    if (addPhotoSubmitBtn) addPhotoSubmitBtn.disabled = false;
                    return;
                }
                afficherStatut('add_photo_success', 'success');
                addPhotoForm.style.display = 'none';
                return;
            }

            if (fichiers.length > 1) {
                afficherStatut(null, 'sending',
                    t('add_photo_sending_progress')
                        .replace('{n}', index + 1)
                        .replace('{total}', fichiers.length));
            }

            const fichier = fichiers[index];

            lireDateExif(fichier).then(function (datePrise) {
                return redimensionnerPhoto(fichier).then(function (image) {
                    const donnees = new FormData();
                    donnees.set('osm_id', osmId);
                    donnees.set('licence', '1');
                    donnees.set('photo', image, fichier.name);
                    donnees.set('nom_fichier', fichier.name);
                    if (datePrise) donnees.set('date_prise', datePrise);
                    if (champCredit && champCredit.value) donnees.set('credit_nom', champCredit.value);
                    if (honeypot) donnees.set('_gotcha', honeypot.value || '');

                    return fetch(URL_ENVOI_PHOTO, { method: 'POST', body: donnees });
                });
            }).then(function (reponse) {
                return reponse.text().then(function (texte) {
                    if (!reponse.ok) throw new Error('Réponse HTTP ' + reponse.status + ' : ' + texte);
                    envoyees++;
                });
            }).catch(function (erreur) {
                console.error('Échec envoi photo :', erreur);
            }).then(function () {
                envoyerSuivante(index + 1);
            });
        }

        envoyerSuivante(0);
    });
}

function fermerModaleAjoutPhoto() {
    addPhotoModal.classList.remove('open');
    addPhotoOverlay.classList.remove('visible');
}

document.getElementById('add-photo-close').addEventListener('click', fermerModaleAjoutPhoto);
addPhotoOverlay.addEventListener('click', fermerModaleAjoutPhoto);


// ===================== Signalements (terrain manquant, erreur sur une fiche) =====================
// Deux portes d'entrée, une seule modale :
//   - « Signaler un terrain manquant », lien de la bannière d'accueil (#signaler-terrain-link) :
//     le visiteur place une épingle sur une petite carte et peut ajouter un commentaire ;
//   - « Signaler une erreur », en bas de chaque fiche de terrain (voir construireContenuPopupTerrain) :
//     un simple commentaire libre, le terrain étant déjà connu ;
//   - le même lien en bas de chaque fiche club (type « club » : nom et position du club, sans
//     osm_id, puisque les clubs ne viennent pas d'OSM).
// Les signalements partent vers le Worker mapetanque-admin, qui les range dans D1 et prévient
// par une issue GitHub (même circuit que les photos). Rien n'est modifié sur le site : la
// correction se fait dans OSM, et la carte suit à la mise à jour hebdomadaire suivante.
//
// La modale est construite ici en JS, à la première ouverture, plutôt qu'écrite en dur dans
// les pages : le lien d'erreur existe dans toutes les pages à carte (accueils et pages province
// ou région générées), et une seule source évite de maintenir le même bloc dans une vingtaine de
// fichiers. Même raison pour son style, injecté ici (style.css n'est pas modifié) ; les classes
// .add-photo-* du formulaire photo sont réutilisées pour que les deux formulaires se ressemblent.
const URL_ENVOI_SIGNALEMENT = "https://mapetanque-admin.mapetanque.workers.dev/signalements/envoi";

// Zoom minimum auquel l'épingle doit avoir été posée. En dessous, un clic sur la carte tombe
// facilement à plusieurs centaines de mètres du terrain réel ; à 16, l'écart reste de l'ordre de
// quelques mètres, ce qui suffit pour le retrouver sur la photo aérienne.
const ZOOM_MIN_SIGNALEMENT = 16;

const CSS_SIGNALEMENT = `
#signalement-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1500; }
#signalement-overlay.visible { display: block; }
#signalement-modal {
    display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 1550; box-sizing: border-box; width: 420px; max-width: calc(100vw - 24px);
    max-height: 88vh; overflow-y: auto; padding: 25px; background: white;
    border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
#signalement-modal.open { display: block; }
#signalement-close { float: right; border: none; background: none; font-size: 22px; cursor: pointer; line-height: 1; }
#signalement-modal .signalement-zone { border-top: 1px solid #eee; padding-top: 16px; }
#signalement-modal .signalement-bloc { display: flex; flex-direction: column; gap: 10px; }
#signalement-modal .signalement-bloc[hidden] { display: none; }
#signalement-modal .signalement-intro { font-size: 12.5px; line-height: 1.45; color: #555; margin: 0; }
#signalement-modal .signalement-recherche { display: flex; gap: 6px; }
#signalement-modal .signalement-recherche input { flex: 1; min-width: 0; }
#signalement-modal .signalement-recherche button {
    flex: none; width: 38px; display: flex; align-items: center; justify-content: center;
    border: 1px solid #ddd; border-radius: 6px; background: white; color: #555; cursor: pointer;
}
#signalement-modal .signalement-recherche button:hover { color: #56A03D; border-color: #74C15A; }
#signalement-modal .signalement-recherche button svg { width: 17px; height: 17px; }
#signalement-modal .signalement-carte {
    position: relative; z-index: 0; height: 220px; border: 1px solid #ddd; border-radius: 8px;
}
#signalement-modal .signalement-legende { font-size: 11px; color: #888; margin: -4px 0 0; }
#signalement-modal textarea.add-photo-text-input { min-height: 84px; resize: vertical; font-family: inherit; }
#signalement-modal .signalement-osm { font-size: 12px; color: #777; text-align: center; margin: 2px 0 0; }
#signalement-modal .signalement-osm a { color: #56A03D; font-weight: bold; text-decoration: none; white-space: nowrap; }
#signalement-modal .signalement-osm a:hover { text-decoration: underline; }
.signalement-epingle { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)); }
`;

// Épingle du terrain signalé : même silhouette que les terrains de la carte, mais une croix
// blanche à la place du rond, et un vert plus soutenu (#56A03D) — la forme suffit à la distinguer
// des terrains déjà recensés, affichés sur la petite carte sous forme de simples points.
const iconeEpingleSignalement = L.divIcon({
    className: 'signalement-epingle',
    html: '<svg width="29" height="45" viewBox="0 0 29 45" xmlns="http://www.w3.org/2000/svg">' +
          '<g transform="translate(2,2)">' +
          '<path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#56A03D" stroke="white" stroke-width="2"/>' +
          '<path d="M12.5 7.5v10M7.5 12.5h10" stroke="white" stroke-width="2.6" stroke-linecap="round"/>' +
          '</g>' +
          '</svg>',
    iconSize: [29, 45],
    iconAnchor: [14, 43]
});

let modaleSignalement = null;          // construite à la première ouverture
let overlaySignalement = null;
let miniCarteSignalement = null;
let epingleSignalement = null;
let pointsTerrainsSignalement = null;  // terrains déjà recensés, en points sur la petite carte
let zoomPlacementSignalement = 0;      // zoom au moment où l'épingle a été posée pour la dernière fois
let contexteSignalement = null;        // { type: 'manquant' | 'erreur', osmId, titre, lat, lon }

function elementSignalement(selecteur) {
    return modaleSignalement.querySelector(selecteur);
}

// Pose le texte ET la clé de traduction : appliquerTraductions() tient ensuite l'élément à jour
// tout seul si la langue change.
function texteSignalement(el, cle) {
    el.dataset.i18n = cle;
    el.textContent = t(cle);
}

function construireModaleSignalement() {
    if (modaleSignalement) return;

    if (!document.getElementById('style-signalement')) {
        const style = document.createElement('style');
        style.id = 'style-signalement';
        style.textContent = CSS_SIGNALEMENT;
        document.head.appendChild(style);
    }

    overlaySignalement = document.createElement('div');
    overlaySignalement.id = 'signalement-overlay';

    modaleSignalement = document.createElement('div');
    modaleSignalement.id = 'signalement-modal';
    modaleSignalement.setAttribute('role', 'dialog');
    modaleSignalement.setAttribute('aria-modal', 'true');
    modaleSignalement.setAttribute('aria-labelledby', 'signalement-titre');
    modaleSignalement.innerHTML = `
        <button type="button" id="signalement-close" data-i18n-aria="close_panel">✕</button>
        <p class="add-photo-title" id="signalement-titre"></p>
        <p class="add-photo-terrain-name" id="signalement-terrain-nom"></p>
        <div class="signalement-zone">
            <form id="signalement-form" class="add-photo-form">
                <div class="signalement-bloc" data-bloc="manquant">
                    <p class="signalement-intro" data-cle="signalement_intro"></p>
                    <div class="signalement-recherche">
                        <input type="text" class="add-photo-text-input" autocomplete="off" enterkeyhint="search">
                        <button type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </button>
                    </div>
                    <div class="signalement-carte"></div>
                    <p class="signalement-legende" data-cle="signalement_map_legend"></p>
                    <label class="add-photo-checkbox-row">
                        <input type="checkbox" name="acces_libre" value="1">
                        <span data-cle="signalement_checkbox_access"></span>
                    </label>
                </div>

                <label class="add-photo-field-label" for="signalement-commentaire" id="signalement-commentaire-label"></label>
                <textarea id="signalement-commentaire" name="commentaire" rows="4" maxlength="1000" class="add-photo-text-input"></textarea>

                <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none !important">

                <button type="submit" class="add-photo-submit-btn" data-cle="signalement_submit"></button>

                <p class="signalement-osm">
                    <span data-cle="signalement_osm_prefix"></span>
                    <a id="signalement-lien-osm" href="https://www.openstreetmap.org" target="_blank" rel="noopener"></a>
                </p>
            </form>
            <p id="signalement-status" class="add-photo-status" role="status"></p>
        </div>
    `;

    document.body.appendChild(overlaySignalement);
    document.body.appendChild(modaleSignalement);

    modaleSignalement.querySelectorAll('[data-cle]').forEach(function (el) {
        texteSignalement(el, el.dataset.cle);
    });
    const champRecherche = elementSignalement('.signalement-recherche input');
    champRecherche.dataset.i18nPlaceholder = 'signalement_search_placeholder';
    champRecherche.placeholder = t('signalement_search_placeholder');
    const boutonRecherche = elementSignalement('.signalement-recherche button');
    boutonRecherche.dataset.i18nAria = 'signalement_search_btn';
    boutonRecherche.setAttribute('aria-label', t('signalement_search_btn'));
    elementSignalement('#signalement-close').setAttribute('aria-label', t('close_panel'));

    // Fermeture : croix, clic à côté, touche Échap.
    elementSignalement('#signalement-close').addEventListener('click', fermerModaleSignalement);
    overlaySignalement.addEventListener('click', fermerModaleSignalement);
    document.addEventListener('keydown', function (evt) {
        if (evt.key === 'Escape' && modaleSignalement.classList.contains('open')) fermerModaleSignalement();
    });

    // Recherche d'adresse : pas de <form> ici (il n'en faut pas un dans l'autre), d'où la
    // touche Entrée interceptée à la main — sans quoi elle enverrait le signalement.
    boutonRecherche.addEventListener('click', rechercherAdresseSignalement);
    champRecherche.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter') {
            evt.preventDefault();
            rechercherAdresseSignalement();
        }
    });

    elementSignalement('#signalement-form').addEventListener('submit', envoyerSignalement);
}

// --- Petite carte (terrain manquant) ---------------------------------------------------------
function preparerMiniCarteSignalement() {
    const conteneur = elementSignalement('.signalement-carte');

    if (!miniCarteSignalement) {
        miniCarteSignalement = L.map(conteneur, { preferCanvas: true });

        // Couches propres à la petite carte : une couche Leaflet ne peut pas vivre sur deux
        // cartes à la fois. Même fond que la carte principale au moment de l'ouverture — la vue
        // satellite aide beaucoup à repérer un terrain.
        const plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        });
        const vueSatellite = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
        );
        ((typeof satellite !== 'undefined' && map.hasLayer(satellite)) ? vueSatellite : plan)
            .addTo(miniCarteSignalement);
        L.control.layers({ "🗺️ Plan": plan, "🛰️ Satellite": vueSatellite }).addTo(miniCarteSignalement);

        epingleSignalement = L.marker([50.5, 4.5], {
            icon: iconeEpingleSignalement,
            draggable: true,
            autoPan: true,
            zIndexOffset: 1000
        }).addTo(miniCarteSignalement);

        epingleSignalement.on('dragend', function () {
            noterPlacementSignalement();
        });
        miniCarteSignalement.on('click', function (evt) {
            epingleSignalement.setLatLng(evt.latlng);
            noterPlacementSignalement();
        });
    }

    // Terrains déjà recensés, pour éviter de signaler un terrain qui figure déjà sur la carte.
    // Construits une seule fois, dès que la liste est chargée (voir le fetch de terrains.geojson).
    if (!pointsTerrainsSignalement && listeTousLesTerrains.length) {
        pointsTerrainsSignalement = L.layerGroup(listeTousLesTerrains.map(function (terrain) {
            return L.circleMarker([terrain.lat, terrain.lon], {
                radius: 5,
                color: '#ffffff',
                weight: 1.5,
                fillColor: '#74C15A',
                fillOpacity: 1,
                interactive: false
            });
        })).addTo(miniCarteSignalement);
    }

    // Démarre sur la vue de la carte principale : si le visiteur a déjà cherché une commune ou
    // s'est localisé, il tombe directement au bon endroit. Sur les pages sans carte visible
    // (À propos, Comment jouer… : formulaire ouvert depuis le pied de page), la carte principale
    // cachée n'a pas de taille et son zoom ne veut rien dire : on montre alors toute la Belgique.
    miniCarteSignalement.invalidateSize();
    if (map.getContainer().offsetWidth > 0) {
        miniCarteSignalement.setView(map.getCenter(), map.getZoom(), { animate: false });
    } else {
        miniCarteSignalement.fitBounds(BELGIQUE_BOUNDS, { animate: false });
    }
    const centre = miniCarteSignalement.getCenter();
    const zoom = miniCarteSignalement.getZoom();
    epingleSignalement.setLatLng(centre);
    zoomPlacementSignalement = zoom;
    mettreAJourLienOsmSignalement();
}

function noterPlacementSignalement() {
    zoomPlacementSignalement = miniCarteSignalement.getZoom();
    mettreAJourLienOsmSignalement();
    afficherStatutSignalement(null, '', '');
}

// Même recherche que la barre de la bannière (Nominatim, orientée vers la Belgique).
function rechercherAdresseSignalement() {
    const champ = elementSignalement('.signalement-recherche input');
    const requete = champ.value.trim();
    if (!requete) return;

    champ.blur();   // referme le clavier virtuel, comme dans la recherche principale

    const url = 'https://nominatim.openstreetmap.org/search'
        + '?format=jsonv2'
        + '&q=' + encodeURIComponent(requete)
        + '&limit=1'
        + '&viewbox=2.5,51.6,6.5,49.4'
        + '&bounded=0';

    fetch(url)
        .then(function (reponse) {
            if (!reponse.ok) throw new Error('Réponse Nominatim invalide');
            return reponse.json();
        })
        .then(function (resultats) {
            if (!resultats || !resultats.length) {
                afficherStatutSignalement('search_no_result', 'error');
                return;
            }
            const resultat = resultats[0];
            const point = L.latLng(parseFloat(resultat.lat), parseFloat(resultat.lon));

            if (resultat.boundingbox) {
                const bbox = resultat.boundingbox.map(parseFloat);
                miniCarteSignalement.fitBounds([[bbox[0], bbox[2]], [bbox[1], bbox[3]]],
                    { maxZoom: 18, animate: false });
            } else {
                miniCarteSignalement.setView(point, 17, { animate: false });
            }
            epingleSignalement.setLatLng(point);
            noterPlacementSignalement();
        })
        .catch(function () {
            afficherStatutSignalement('search_failed', 'error');
        });
}

// Lien « … directement » vers l'éditeur d'OSM : sur l'élément lui-même pour une erreur
// (edit?node=123), sur l'emplacement de l'épingle pour un terrain manquant.
function mettreAJourLienOsmSignalement() {
    const lien = elementSignalement('#signalement-lien-osm');
    const c = contexteSignalement;
    let adresse = 'https://www.openstreetmap.org/edit';

    if (c.type === 'erreur' && /^(node|way|relation)\/\d+$/.test(c.osmId)) {
        const morceaux = c.osmId.split('/');
        adresse += '?' + morceaux[0] + '=' + morceaux[1];
    } else {
        const position = c.type === 'manquant' && epingleSignalement
            ? epingleSignalement.getLatLng()
            : L.latLng(c.lat, c.lon);
        if (position && isFinite(position.lat)) {
            adresse += '#map=19/' + position.lat.toFixed(6) + '/' + position.lng.toFixed(6);
        }
    }
    lien.href = adresse;
}

function afficherStatutSignalement(cle, classe, texteDirect) {
    const statut = elementSignalement('#signalement-status');
    statut.textContent = texteDirect !== undefined ? texteDirect : t(cle);
    statut.className = 'add-photo-status' + (classe ? ' ' + classe : '');
}

// --- Ouverture / fermeture -------------------------------------------------------------------
function ouvrirModaleSignalement(options) {
    construireModaleSignalement();

    // Trois types : 'manquant' (bannière d'accueil), 'erreur' (fiche terrain), 'club' (fiche
    // club : comme une erreur, mais sans osm_id ni lien vers OpenStreetMap).
    contexteSignalement = {
        type: (options.type === 'erreur' || options.type === 'club') ? options.type : 'manquant',
        osmId: options.osmId || '',
        titre: options.titre || '',
        lat: parseFloat(options.lat),
        lon: parseFloat(options.lon)
    };
    const estManquant = contexteSignalement.type === 'manquant';

    const formulaire = elementSignalement('#signalement-form');
    formulaire.reset();
    formulaire.style.display = '';
    formulaire.querySelector('.add-photo-submit-btn').disabled = false;
    afficherStatutSignalement(null, '', '');

    texteSignalement(elementSignalement('#signalement-titre'),
        estManquant ? 'signalement_missing_title' : 'signalement_error_title');

    const nomTerrain = elementSignalement('#signalement-terrain-nom');
    nomTerrain.textContent = estManquant ? '' : contexteSignalement.titre;
    nomTerrain.hidden = estManquant;

    // Le bloc carte + accès n'existe que pour un terrain manquant. Ses champs sont
    // désactivés quand il est masqué : sinon la case obligatoire bloquerait l'envoi d'une erreur.
    const bloc = elementSignalement('[data-bloc="manquant"]');
    bloc.hidden = !estManquant;
    bloc.querySelectorAll('input, button').forEach(function (champ) { champ.disabled = !estManquant; });
    bloc.querySelector('[name="acces_libre"]').required = estManquant;

    // Commentaire : facultatif pour un terrain manquant (l'épingle dit l'essentiel),
    // obligatoire pour une erreur (c'est tout le contenu du signalement).
    const commentaire = elementSignalement('#signalement-commentaire');
    commentaire.required = !estManquant;
    const libelleCommentaire = elementSignalement('#signalement-commentaire-label');
    libelleCommentaire.hidden = !estManquant;
    if (estManquant) {
        texteSignalement(libelleCommentaire, 'signalement_field_comment_missing');
        commentaire.removeAttribute('aria-labelledby');
    } else {
        commentaire.setAttribute('aria-labelledby', 'signalement-titre');
    }
    commentaire.dataset.i18nPlaceholder = estManquant
        ? 'signalement_comment_placeholder_missing'
        : contexteSignalement.type === 'club'
            ? 'signalement_comment_placeholder_club'
            : 'signalement_comment_placeholder_error';
    commentaire.placeholder = t(commentaire.dataset.i18nPlaceholder);

    // Un club ne se corrige pas dans OpenStreetMap : pas d'invitation à le faire.
    elementSignalement('.signalement-osm').hidden = contexteSignalement.type === 'club';
    texteSignalement(elementSignalement('#signalement-lien-osm'),
        estManquant ? 'signalement_osm_link_missing' : 'signalement_osm_link_error');

    modaleSignalement.classList.add('open');
    overlaySignalement.classList.add('visible');
    modaleSignalement.scrollTop = 0;

    // La carte ne se construit qu'une fois la modale affichée : Leaflet a besoin de connaître la
    // taille réelle de son conteneur.
    if (estManquant) {
        preparerMiniCarteSignalement();
    } else {
        mettreAJourLienOsmSignalement();
    }
}
window.ouvrirModaleSignalement = ouvrirModaleSignalement;

function fermerModaleSignalement() {
    if (!modaleSignalement) return;
    modaleSignalement.classList.remove('open');
    overlaySignalement.classList.remove('visible');
}

// --- Envoi -----------------------------------------------------------------------------------
// FormData plutôt que JSON : c'est un envoi « simple » aux yeux du navigateur, sans requête
// préalable OPTIONS, exactement comme l'envoi de photos vers le même Worker.
function envoyerSignalement(evt) {
    evt.preventDefault();

    const c = contexteSignalement;
    const formulaire = evt.currentTarget;
    const bouton = formulaire.querySelector('.add-photo-submit-btn');
    const donnees = new FormData();

    donnees.set('type', c.type);
    donnees.set('langue', currentLang);

    if (c.type === 'manquant') {
        if (zoomPlacementSignalement < ZOOM_MIN_SIGNALEMENT) {
            afficherStatutSignalement('signalement_error_zoom', 'error');
            return;
        }
        const position = epingleSignalement.getLatLng();
        donnees.set('lat', position.lat.toFixed(6));
        donnees.set('lon', position.lng.toFixed(6));
        donnees.set('acces_libre', '1');
    } else {
        if (c.type === 'erreur') donnees.set('osm_id', c.osmId);
        donnees.set('titre', c.titre);
        if (isFinite(c.lat)) donnees.set('lat', c.lat.toFixed(6));
        if (isFinite(c.lon)) donnees.set('lon', c.lon.toFixed(6));
    }

    donnees.set('commentaire', formulaire.querySelector('[name="commentaire"]').value.trim());
    donnees.set('_gotcha', formulaire.querySelector('[name="_gotcha"]').value || '');

    bouton.disabled = true;
    afficherStatutSignalement('add_photo_sending', 'sending');

    fetch(URL_ENVOI_SIGNALEMENT, { method: 'POST', body: donnees })
        .then(function (reponse) {
            if (reponse.status === 429) {
                afficherStatutSignalement('signalement_error_limit', 'error');
                bouton.disabled = false;
                return;
            }
            if (!reponse.ok) throw new Error('Réponse HTTP ' + reponse.status);
            formulaire.style.display = 'none';
            afficherStatutSignalement(
                c.type === 'manquant' ? 'signalement_success_missing' : 'signalement_success_error',
                'success');
        })
        .catch(function (erreur) {
            console.error('Échec envoi signalement :', erreur);
            afficherStatutSignalement('add_photo_error', 'error');
            bouton.disabled = false;
        });
}

// --- Portes d'entrée -------------------------------------------------------------------------
// Un seul écouteur pour tous les liens « Signaler une erreur » des fiches (terrains et clubs),
// présents ou à venir.
document.addEventListener('click', function (evt) {
    const lien = evt.target.closest('.popup-report-btn');
    if (!lien) return;
    evt.preventDefault();
    ouvrirModaleSignalement({
        type: lien.dataset.type === 'club' ? 'club' : 'erreur',
        osmId: lien.dataset.osmId,
        titre: lien.dataset.terrainTitre,
        lat: lien.dataset.lat,
        lon: lien.dataset.lon
    });
});

// Lien de la bannière d'accueil. Son href mène au contact de l'À propos : c'est le repli si le script ne tourne
// pas. Il ne vit que dans l'espace libre sous les boutons, sans jamais agrandir la bannière :
// quand cet espace manque (boutons repliés sur deux lignes sur les plus petits écrans, titre plus
// long dans certaines langues), le lien déborderait sur la mention de licence de la photo ou
// serait coupé. Il est alors masqué plutôt que de chevaucher quoi que ce soit.
const lienSignalerTerrain = document.getElementById('signaler-terrain-link');
if (lienSignalerTerrain) {
    lienSignalerTerrain.addEventListener('click', function (evt) {
        evt.preventDefault();
        ouvrirModaleSignalement({ type: 'manquant' });
    });

    const blocLien = lienSignalerTerrain.parentElement;
    const banniere = blocLien.closest('.hero-banner');
    const credit = banniere ? banniere.querySelector('.hero-banner-credit') : null;

    const verifierPlaceLienSignalement = function () {
        if (!banniere) return;
        blocLien.classList.remove('hors-cadre');

        const lien = lienSignalerTerrain.getBoundingClientRect();
        const cadre = banniere.getBoundingClientRect();
        let deborde = lien.bottom > cadre.bottom;

        if (credit && !deborde) {
            const c = credit.getBoundingClientRect();
            const marge = 4;
            deborde = lien.bottom + marge > c.top && lien.top < c.bottom + marge
                && lien.right + marge > c.left && lien.left < c.right + marge;
        }
        blocLien.classList.toggle('hors-cadre', deborde);
    };

    verifierPlaceLienSignalement();
    window.addEventListener('load', verifierPlaceLienSignalement);
    // La place change avec la largeur de l'écran, mais aussi avec la langue (libellés plus ou
    // moins longs) : on surveille donc directement la taille des éléments concernés.
    if (typeof ResizeObserver === 'function') {
        const observateur = new ResizeObserver(verifierPlaceLienSignalement);
        observateur.observe(banniere);
        observateur.observe(lienSignalerTerrain);
        const controles = banniere.querySelector('.controls');
        if (controles) observateur.observe(controles);
    } else {
        window.addEventListener('resize', verifierPlaceLienSignalement);
    }
}

// ===================== Crédit photo des bannières, replié en « i » =====================
// Sur toutes les pages à bannière photo (accueils, provinces, régions, pages de contenu), en
// mobile comme en desktop : le crédit tient dans un petit « i » en bas à droite. Un clic ou un
// toucher affiche le texte complet (auteur, licence et son lien) dans une bulle, un clic ailleurs
// la referme ; sur ordinateur, le survol suffit aussi. Le crédit reste ainsi accessible, comme
// l'exige la licence CC BY-SA, sans occuper la bannière. Sans JavaScript, le crédit reste
// affiché en toutes lettres, comme avant.
//
// Le texte d'origine est simplement déplacé dans une enveloppe, sans être réécrit : chaque page
// garde son propre crédit. Le style est injecté ici, comme celui de la modale de signalement :
// toutes ces pages chargent script.js, mais pas les mêmes feuilles additives.
const CSS_CREDIT_PHOTO = `
.hero-banner-credit.credit-repliable {
    bottom: 4px; right: 6px; z-index: 2;
    display: flex; align-items: center; gap: 4px;
}
.hero-banner-credit.credit-repliable .credit-texte { display: none; }
.hero-banner-credit.credit-repliable.ouvert .credit-texte {
    display: inline; padding: 4px 8px; border-radius: 6px;
    background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 11px; text-shadow: none;
    max-width: calc(100vw - 56px); line-height: 1.35;
}
@media (hover: hover) {
    .hero-banner-credit.credit-repliable:hover .credit-texte {
        display: inline; padding: 4px 8px; border-radius: 6px;
        background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 11px; text-shadow: none;
        max-width: calc(100vw - 56px); line-height: 1.35;
    }
}
.hero-banner-credit.credit-repliable .credit-info-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; padding: 0; border: none; background: none;
    color: rgba(255, 255, 255, 0.85); cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}
.hero-banner-credit.credit-repliable .credit-info-btn:hover { color: #fff; }
.credit-info-btn svg { width: 18px; height: 18px; }
`;

document.querySelectorAll('.hero-banner .hero-banner-credit').forEach(function (credit, index) {
    if (credit.querySelector('.credit-info-btn')) return;

    if (!document.getElementById('style-credit-photo')) {
        const style = document.createElement('style');
        style.id = 'style-credit-photo';
        style.textContent = CSS_CREDIT_PHOTO;
        document.head.appendChild(style);
    }

    const texte = document.createElement('span');
    texte.className = 'credit-texte';
    texte.id = 'credit-banniere-texte-' + index;
    while (credit.firstChild) texte.appendChild(credit.firstChild);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'credit-info-btn';
    bouton.dataset.i18nAria = 'photo_credit_btn';
    bouton.setAttribute('aria-label', t('photo_credit_btn'));
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-controls', texte.id);
    bouton.innerHTML = ICON_INFO;

    credit.append(texte, bouton);
    credit.classList.add('credit-repliable');

    const basculer = function (ouvrir) {
        credit.classList.toggle('ouvert', ouvrir);
        bouton.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
    };
    bouton.addEventListener('click', function (evt) {
        evt.stopPropagation();
        basculer(!credit.classList.contains('ouvert'));
    });
    // Un clic ou un toucher n'importe où ailleurs referme la bulle.
    document.addEventListener('click', function (evt) {
        if (credit.classList.contains('ouvert') && !credit.contains(evt.target)) basculer(false);
    });
});


// Fonction globale appelée depuis le lien "Partager" de chaque popup de terrain
window.partagerTerrain = function (lat, lon, titre) {
    const url = window.location.origin + window.location.pathname
        + `?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&z=18`;
    ouvrirPartage(url, titre);
};


// ===================== Pied de page =====================

// Le pied de page est construit ici, à partir des traductions, plutôt que recopié dans chacune
// des quelque 80 pages (4 langues, gabarits province et région compris) : les pages ne contiennent
// qu'un <footer class="pied"></footer> vide. appliquerTraductions() le reconstruit à chaque
// changement de langue ; mettreAJourStats() y pose ensuite les chiffres et la date.

const piedEl = document.querySelector('footer.pied');

const ICONES_PIED = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>',
    // Le vrai logo X : l'ancienne icône était une simple croix, qu'on prenait pour « fermer »
    x: '<svg class="pied-icone-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    lien: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    ajouter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>'
};

// Adresse de la page courante dans une autre langue, d'après ses balises hreflang. On ne garde que
// le chemin, pour que le lien reste sur le même site (utile aussi en local avec Live Server). Sans
// balise pour cette langue (page pas encore traduite) : accueil de la langue.
function urlPageDansLangue(langue) {
    const alternative = document.querySelector(`link[rel="alternate"][hreflang="${langue}"]`);
    if (alternative) return new URL(alternative.href).pathname;
    return langue === 'fr' ? '/' : '/' + langue + '/';
}

function construirePied() {
    if (!piedEl) return;

    const prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
    const urlEncodee = encodeURIComponent(window.location.origin + window.location.pathname);
    const texteEncode = encodeURIComponent(t('share_site_title'));

    const langues = LANGUES_DISPONIBLES.map(function (langue) {
        const actif = langue === currentLang ? ' aria-current="true"' : '';
        return `<a href="${urlPageDansLangue(langue)}" data-lang="${langue}" hreflang="${langue}"${actif}>${langue.toUpperCase()}</a>`;
    }).join('');

    piedEl.innerHTML = `
        <img class="pied-filigrane" src="/images/mapetanque-boule-pleine.svg" alt="">
        <div class="pied-haut">
            <div class="pied-marque">
                <a href="${prefixe}" class="pied-logo-lien"><img class="pied-logo" src="/images/mapetanque-logo.svg" width="173" height="30" alt="Mapetanque"></a>
                <p class="pied-accroche">${t('pied_accroche')}</p>
                <ul class="pied-chiffres">
                    <li><strong id="pied-nb-terrains">…</strong><span>${t('pied_terrains')}</span></li>
                    <li><strong id="pied-nb-photos">…</strong><span>${t('pied_photos')}</span></li>
                </ul>
                <p class="pied-maj" id="pied-maj" hidden></p>
            </div>

            <nav class="pied-col">
                <h2 class="pied-titre">${t('pied_explorer')}</h2>
                <ul class="pied-liens">
                    <li><a href="${prefixe}region-wallonie.html">${t('geo_region_wallonie')}</a></li>
                    <li><a href="${prefixe}region-flandre.html">${t('geo_region_flandre')}</a></li>
                    <li><a href="${prefixe}province-bruxelles.html">${t('geo_region_bruxelles')}</a></li>
                    <li><a href="${prefixe}#provinces-section">${t('pied_toutes_provinces')}</a></li>
                    <li><a href="${prefixe}a-propos.html#contact" class="pied-lien-accent pied-signaler">${ICONES_PIED.ajouter}${t('pied_signaler')}</a></li>
                </ul>
            </nav>

            <nav class="pied-col">
                <h2 class="pied-titre">${t('pied_le_site')}</h2>
                <ul class="pied-liens">
                    <li><a href="${prefixe}comment-jouer.html">${t('menu_comment_jouer')}</a></li>
                    <li><a href="${prefixe}compteur.html">${t('menu_compteur')}</a></li>
                    <li><a href="${prefixe}la-petanque.html">${t('menu_la_petanque')}</a></li>
                    <li><a href="${prefixe}a-propos.html">${t('menu_about')}</a></li>
                    <li><a href="${prefixe}a-propos.html#contact">${t('pied_contact')}</a></li>
                </ul>
            </nav>

            <div class="pied-col-partage">
                <h2 class="pied-titre">${t('pied_partager')}</h2>
                <p class="pied-partage-texte">${t('pied_partage_texte')}</p>
                <div class="pied-partage">
                    <a class="pied-bouton" href="https://wa.me/?text=${texteEncode}%20${urlEncodee}" target="_blank" rel="noopener" title="${t('share_whatsapp')}" aria-label="${t('share_whatsapp')}">${ICONES_PIED.whatsapp}</a>
                    <a class="pied-bouton" href="https://www.facebook.com/sharer/sharer.php?u=${urlEncodee}" target="_blank" rel="noopener" title="${t('share_facebook')}" aria-label="${t('share_facebook')}">${ICONES_PIED.facebook}</a>
                    <a class="pied-bouton" href="https://twitter.com/intent/tweet?url=${urlEncodee}&amp;text=${texteEncode}" target="_blank" rel="noopener" title="${t('share_twitter')}" aria-label="${t('share_twitter')}">${ICONES_PIED.x}</a>
                    <a class="pied-bouton" href="mailto:?subject=${texteEncode}&amp;body=${urlEncodee}" title="${t('share_email')}" aria-label="${t('share_email')}">${ICONES_PIED.email}</a>
                    <button type="button" class="pied-bouton pied-copier">${ICONES_PIED.lien}<span>${t('share_copy')}</span></button>
                </div>
            </div>
        </div>

        <div class="pied-bas">
            <nav class="pied-langues" aria-label="${t('pied_langue')}">${langues}</nav>
            <div class="pied-credits">
                ${t('pied_donnees')}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"><img src="/images/logo-openstreetmap.webp" alt="">OpenStreetMap</a>
                · ${t('pied_credits_photos')}
                <a href="https://www.mapillary.com" target="_blank" rel="noopener"><img src="/images/logo-mapillary.webp" alt="">Mapillary</a>
            </div>
            <div class="pied-droite">
                <span>© ${new Date().getFullYear()} mapetanque.be</span>
                <!-- Raccourci vers l'admin : la page ne donne accès à rien sans mot de passe, et
                     robots.txt l'exclut de l'indexation. -->
                <a class="pied-admin" href="/admin.html" rel="nofollow" title="Administration" aria-label="Administration">${ICON_REGLAGES}</a>
            </div>
        </div>`;
}

if (piedEl) {
    // Écouteurs posés une seule fois sur le <footer> lui-même : son contenu est remplacé à
    // chaque changement de langue, mais lui reste en place.
    let minuterieCopie = null;

    piedEl.addEventListener('click', function (e) {

        // Copier le lien de la page : le libellé du bouton devient « Lien copié ! » 2 secondes
        const boutonCopier = e.target.closest('.pied-copier');
        if (boutonCopier) {
            const url = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(url).then(function () {
                const libelle = boutonCopier.querySelector('span');
                boutonCopier.classList.add('pied-copie-faite');
                libelle.textContent = t('share_copied');
                clearTimeout(minuterieCopie);
                minuterieCopie = setTimeout(function () {
                    boutonCopier.classList.remove('pied-copie-faite');
                    libelle.textContent = t('share_copy');
                }, 2000);
            }).catch(function () {
                // Navigateur trop ancien ou contexte non sécurisé : on propose le texte à copier
                window.prompt('Ctrl+C / Cmd+C :', url);
            });
            return;
        }

        // « Signaler un terrain » : même formulaire que le lien de la bannière d'accueil. Le href
        // vers le contact de l'À propos ne sert que si le script ne tourne pas.
        if (e.target.closest('.pied-signaler')) {
            e.preventDefault();
            ouvrirModaleSignalement({ type: 'manquant' });
            return;
        }

        // Choix de la langue : on la mémorise avant de suivre le lien, sinon l'accueil français
        // (« / ») rouvrirait dans la langue gardée en mémoire (voir detecterLanguePreferee).
        const lienLangue = e.target.closest('.pied-langues a[data-lang]');
        if (lienLangue) {
            try { localStorage.setItem('mapetanque_lang', lienLangue.dataset.lang); } catch (erreur) {}
        }
    });
}


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

// « 850 m » sous le kilomètre, « 1,2 km » au-delà (virgule sauf en anglais, voir uneDecimale).
function formaterDistanceKm(km) {
    return km < 1 ? Math.round(km * 1000) + ' m' : uneDecimale(km) + ' km';
}


// ===================== Critères des terrains =====================
// Deux sources, affichées dans la fiche en deux groupes de pastilles :
//   - les critères OSM, calculés chaque semaine par scripts/enrichir_environnement.py et rangés
//     dans la propriété `env` de chaque terrain (distances en mètres ; clé absente = rien trouvé
//     dans le rayon interrogé), plus deux tags du terrain lui-même (éclairage, toit) ;
//   - les critères confirmés par les joueurs, lus sur le Worker mapetanque-notes (GET /criteres).
// On n'affiche que la présence, jamais l'absence (l'absence dans OSM ne prouve rien), et un
// groupe vide disparaît.

// Les règles et seuils (SEUILS_ROUTES_CALME, CRITERES_PROXIMITE, CRITERES_JOUEURS,
// criteresOsmSurPlace, estAbriteOsm…) sont dans /criteres.js, chargé avant ce fichier : la page
// admin s'en sert aussi.

// "way/123" -> { ombrage: [nombre, "AAAA-MM"], ... }, cumulé par groupe de pistes voisines (voir
// « Terrains voisins ») — un seul GET pour tout le site, comme les notes. Vide tant que la réponse n'est pas arrivée ; l'événement mapetanque:criteres redessine
// alors les fiches ouvertes.
window.mapetanqueCriteres = {};

// Critères des joueurs assez confirmés : [{ cle, nombre, mois }].
function criteresJoueursConfirmes(osmId) {
    const brut = (window.mapetanqueCriteres || {})[osmId] || {};
    return CRITERES_JOUEURS
        .filter(function (cle) { return brut[cle] && brut[cle][0] >= CONFIRMATIONS_MIN; })
        .map(function (cle) { return { cle: cle, nombre: brut[cle][0], mois: brut[cle][1] }; });
}

// Distance arrondie à la dizaine (« 40 m ») ; rien sous 10 m, le libellé seul suffit alors.
function distanceCritere(metres) {
    return metres < 10 ? '' : (Math.round(metres / 10) * 10) + ' m';
}

function pastilleHtml(cle, complement) {
    return '<span class="critere">' + PICTOS[cle] + '<span>' + t('critere_' + cle) + '</span>'
        + (complement ? '<span class="critere-distance">' + complement + '</span>' : '') + '</span>';
}

// Les deux groupes de pastilles de la fiche. Chaîne vide si aucun critère n'est présent.
function criteresHtml(tags) {
    const joueurs = criteresJoueursConfirmes(tags.osm_id);
    const osm = criteresOsmSurPlace(tags);
    // Abrité de la pluie vient des joueurs OU du toit tagué dans OSM : la pastille OSM (sans
    // compteur) ne s'affiche que si les joueurs ne l'ont pas déjà confirmée.
    if (estAbriteOsm(tags) && !joueurs.some(function (j) { return j.cle === 'abri_pluie'; })) {
        osm.push('abri_pluie');
    }

    // Pastille d'un critère des joueurs : un bouton, dont l'appui affiche sous le groupe
    // « Confirmé par N joueurs, la dernière fois en <mois> » (pas de survol sur mobile).
    const surPlace = joueurs.map(function (j) {
        return '<button type="button" class="critere critere-joueurs" aria-expanded="false" data-detail="'
            + echapperAvis(t('critere_confirme_par').replace('%n', j.nombre).replace('%m', moisAvis(j.mois))) + '">'
            + PICTOS[j.cle] + '<span>' + t('critere_' + j.cle) + '</span>'
            + '<span class="critere-compteur">' + j.nombre + '</span></button>';
    }).concat(osm.map(function (cle) { return pastilleHtml(cle); }));

    const proximite = criteresOsmProximite(tags).map(function (c) {
        return pastilleHtml(c.cle, distanceCritere(c.distance));
    });

    function groupe(cleTitre, pastilles, avecDetail) {
        if (!pastilles.length) return '';
        return '<div class="criteres-groupe">'
            + '<div class="criteres-titre">' + t(cleTitre) + '</div>'
            + '<div class="criteres-liste">' + pastilles.join('') + '</div>'
            + (avecDetail ? '<p class="criteres-detail" hidden></p>' : '')
            + '</div>';
    }

    return groupe('fiche_sur_place', surPlace, joueurs.length > 0)
        + groupe('fiche_a_proximite', proximite, false);
}
// (Le chargement de GET /criteres est plus bas, avec celui des notes : il a besoin de
// MAPETANQUE_URL_NOTES, qui n'est défini qu'à cet endroit.)


// Certaines communes bruxelloises n'ont pas de nom belge unique mais un nom officiel bilingue
// FR/NL (ex. "Woluwe-Saint-Lambert - Sint-Lambrechts-Woluwe", tel que renvoyé par Nominatim et
// stocké tel quel dans terrains.geojson — voir commentaire plus bas sur le fil d'Ariane). N'affiche
// que la partie correspondant à la langue courante. Pas de nom officiel distinct en allemand pour
// ces communes : on retombe sur le néerlandais (choix assumé, cohérent avec le reste du site DE
// qui n'a pas toujours de traduction propre à ce niveau de détail). L'anglais reprend au contraire
// la forme française, la plus courante dans l'usage anglophone à Bruxelles (Ixelles,
// Woluwe-Saint-Lambert…). Exposée sur window car
// réutilisée par le script inline des pages province/région (voir templates/province_template.html).
// Sans effet sur les communes à nom unique (pas de séparateur " - " trouvé) : renvoyées telles quelles.
window.nomCommuneAffiche = function (nomBrut, langue) {
    if (!nomBrut) return nomBrut;
    const parties = nomBrut.split(' - ');
    if (parties.length !== 2) return nomBrut;
    return (langue === 'fr' || langue === 'en') ? parties[0] : parties[1];
};

// Fil d'Ariane région › province › commune des fiches terrain et club.
//
// Défini au niveau racine, hors de tout bloc conditionnel : c'est la même précaution que pour
// brancherPopupTerrain, sans quoi les pages province/région ne le verraient pas.
//
// La région est cliquable au même titre que la province — les pages region-flandre.html et
// region-wallonie.html existent, il n'y avait pas de raison de les laisser en texte mort.
// Bruxelles fait exception : c'est une région sans page dédiée, on pointe donc sa page
// « province », qui joue ce rôle.
//
// Les liens tiennent compte de la langue affichée : toutes les pages province et région
// existent désormais dans les trois langues, alors qu'auparavant le lien renvoyait toujours
// vers la version française.
window.construireFilAriane = function (source) {
    const prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
    const commune = source.commune
        ? ' › ' + window.nomCommuneAffiche(source.commune, currentLang)
        : '';

    if (source.province) {
        const provinceSlug = source.province.replace(/_/g, '-');
        const province = `<a href="${prefixe}province-${provinceSlug}.html">`
            + t('geo_province_' + source.province) + '</a>';

        let region = '';
        if (source.region) {
            const nom = t('geo_region_' + source.region);
            region = (source.region === 'wallonie' || source.region === 'flandre')
                ? `<a href="${prefixe}region-${source.region}.html">${nom}</a> › `
                : nom + ' › ';
        }
        return `<div class="popup-breadcrumb">${region}${province}${commune}</div>`;
    }

    if (source.region === 'bruxelles') {
        return `<div class="popup-breadcrumb">`
            + `<a href="${prefixe}province-bruxelles.html">${t('geo_region_bruxelles')}</a>`
            + `${commune}</div>`;
    }

    return "";
};


// ===================== Contenu des popups de terrain =====================
// Extrait en fonction autonome (au lieu d'être imbriquée dans onEachFeature) pour pouvoir être
// réutilisée telle quelle par les pages provinces, qui affichent leur propre sous-ensemble de
// terrains sans passer par le clustering de la page d'accueil.
function construireContenuPopupTerrain(feature, layer) {

    let tags = feature.properties;

    let acces = (tags.access === "public" || tags.access === "yes")
        ? t('fiche_acces_public')
        : t('fiche_acces_probable');

    let titre = tags.nearest_street
        ? t('popup_terrain_prefix') + " " + tags.nearest_street
        : t('popup_terrain_default');

    // Fil d'Ariane région › province › commune — voir construireFilAriane plus haut.
    const filAriane = window.construireFilAriane(tags);

    // Photo(s) du terrain — deux sources possibles, combinées :
    // 1) Un tag OSM image=/wikimedia_commons=/mapillary= renseigné par un mappeur (résolu par
    //    resoudre_photo() dans update_terrains.py) — affichée en <img> classique.
    // 2) Une entrée dans data/photos_mapillary.json (validée manuellement via l'outil de revue,
    //    voir generer_revue_photos.py) — affichée via l'embed officiel Mapillary
    //    (mapillary.com/embed?image_key=...), plutôt qu'une URL d'image directe : les URLs de
    //    vignettes Mapillary expirent au bout d'un moment, l'embed évite ce problème et ne
    //    nécessite aucun token côté client.
    // Remarque : pas de détection de doublon entre les deux sources pour l'instant (cas rare vu
    // qu'aucun terrain n'a aujourd'hui de tag mapillary= OSM ET une entrée validée à la fois) —
    // à revoir si ça devient un cas fréquent.
    const diapositives = [];
    const terrainLat = layer.getLatLng().lat;
    const terrainLon = layer.getLatLng().lng;

    if (tags.photo_url) {
        let credit = "";
        if (tags.photo_source === 'wikimedia_commons') {
            credit = t('popup_photo_credit_wikimedia');
        } else if (tags.photo_source === 'mapillary') {
            credit = t('popup_photo_credit_mapillary');
        }
        diapositives.push({
            type: 'img',
            html: `<img src="${tags.photo_url}" alt="" class="popup-photo" loading="lazy">`,
            creditUrl: tags.photo_credit_url,
            creditLabel: credit,
        });
    }

    // Photos validées manuellement (une ou plusieurs — voir data/photos_mapillary.json, qui
    // stocke désormais une LISTE par terrain plutôt qu'une entrée unique, pour accueillir aussi
    // bien les photos retenues via l'outil de revue que celles ajoutées au coup par coup plus
    // tard via club/ajouter_photo_manuelle.py, sans limite de nombre).
    const photosValidees = tags.osm_id && window.photosMapillaryParOsmId
        ? (window.photosMapillaryParOsmId[tags.osm_id] || [])
        : [];
    photosValidees.forEach(function (entree) {
        if (entree.miniature_locale) {
            // Photo 360° reprojetée en image plate statique par generer_miniature_360.py /
            // generer_miniatures_360_batch.py (voir data/photos_mapillary.json) — contrairement
            // à l'embed Mapillary classique ci-dessous (qui ignore le cadrage x/y/zoom qu'on
            // avait repéré à la main), cette image est déjà pré-recadrée dans le bon angle une
            // fois pour toutes, donc une <img> classique suffit, pas besoin d'iframe.
            diapositives.push({
                type: 'img',
                panoStatique: true,
                html: `<img src="${entree.miniature_locale}" alt="" class="popup-photo" loading="lazy">`,
                // entree.credit_url (généré avec x/y/zoom par generer_miniatures_360_batch.py)
                // amène directement au bon cadrage repéré dans l'outil de revue. Repli sur un
                // lien générique (sans orientation) uniquement pour d'anciennes entrées produites
                // avant l'ajout de x/y/zoom au batch — mieux qu'un lien cassé, mais atterrit alors
                // sur le cadrage par défaut de Mapillary, pas le bon angle.
                creditUrl: entree.credit_url
                    || `https://www.mapillary.com/app/?pKey=${entree.mapillary_id}&lat=${terrainLat}&lng=${terrainLon}&z=17&focus=photo`,
                creditLabel: t('popup_photo_credit_mapillary'),
            });
            return;
        }
        diapositives.push({
            type: 'iframe',
            html: `<iframe src="https://www.mapillary.com/embed?image_key=${entree.mapillary_id}&style=photo" class="popup-photo popup-photo-iframe" loading="lazy" frameborder="0" scrolling="no"></iframe>`,
            // Construit ici plutôt que réutiliser entree.credit_url tel quel : ce dernier
            // (mapillary.com/map/im/ID) ouvre la vue carte avec la photo en vignette, pas la
            // photo en plein cadre — focus=photo donne directement la bonne vue.
            creditUrl: `https://www.mapillary.com/app/?pKey=${entree.mapillary_id}&lat=${terrainLat}&lng=${terrainLon}&z=17&focus=photo`,
            creditLabel: t('popup_photo_credit_mapillary'),
            // Prénom ou pseudo d'un visiteur qui a envoyé la photo (voir creditVisiteur plus bas).
            creditVisiteur: entree.credit_nom || null,
        });
    });

    // Zone "agrandir" couvrant toute la photo (pas juste un petit bouton dans un coin), ouvrant
    // la source d'origine dans un nouvel onglet — sert aussi pour l'embed Mapillary, où on ne
    // peut pas rendre l'iframe elle-même cliquable (contenu d'un autre domaine, le navigateur
    // bloque toute interaction depuis notre page — voir la discussion sur le same-origin plus
    // haut dans nos échanges). La petite icône ⤢ dans le coin reste comme indice visuel, mais
    // toute la zone .popup-photo-expand-zone est cliquable, pas seulement l'icône elle-même.
    function avecBoutonAgrandir(d) {
        return `<div class="popup-photo-wrap">${d.html}<a href="${d.creditUrl}" target="_blank" rel="noopener" class="popup-photo-expand-zone" aria-label="${t('popup_photo_expand')}"></a></div>`;
    }

    // Sous chaque photo : crédit classique pour une <img> (Wikimedia, ou Mapillary résolu via
    // tag OSM — aucun des deux n'affiche d'habillage propre, contrairement à l'iframe ci-dessous,
    // donc le crédit y reste nécessaire). Pour l'embed Mapillary (type 'iframe') ET pour une
    // miniature 360° statique (panoStatique) : l'habillage Mapillary (pour l'iframe) ou le fait
    // que la photo soit déjà de notre propre pipeline (pour la 360°) rendent ce crédit redondant
    // — rien n'est affiché ici pour ces deux cas, le bouton "Ajouter une photo ?" prend le relais
    // séparément (voir boutonAjouterPhoto() plus bas, rendu une seule fois sous le carrousel, pas
    // par diapositive — sinon il apparaissait autant de fois qu'il y a de photos de ce type, en
    // plus de gonfler la hauteur du carrousel et de désaligner les points de pagination posés
    // par-dessus).
    function proposeAjouterPhoto(d) {
        return d.type === 'iframe' || d.panoStatique;
    }

    // Photo envoyée par un visiteur : son prénom ou pseudo, s'il en a donné un, s'affiche sous la
    // photo — c'est la promesse de la section « Vos données » de la page À propos. Le nom a été
    // tapé par un inconnu dans le formulaire : il est neutralisé avant d'entrer dans le HTML,
    // pour qu'aucun code glissé dedans ne puisse s'exécuter dans la page.
    function echapperHtml(texte) {
        return String(texte)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function creditVisiteur(d) {
        if (!d.creditVisiteur) return "";
        return `<span class="popup-photo-credit" style="display:block;margin-top:2px;">${t('popup_photo_envoyee_par')(echapperHtml(d.creditVisiteur))}</span>`;
    }

    function sousLaPhoto(d) {
        if (proposeAjouterPhoto(d)) return creditVisiteur(d);
        return d.creditLabel
            ? `<a href="${d.creditUrl}" target="_blank" rel="noopener" class="popup-photo-credit">${d.creditLabel}</a>`
            : "";
    }

    function boutonAjouterPhoto() {
        return `<button type="button" class="popup-photo-add-btn" data-osm-id="${tags.osm_id || ''}" data-terrain-titre="${titre.replace(/"/g, '&quot;')}">${t('popup_photo_add')}</button>`;
    }

    let photo = "";
    if (diapositives.length === 0) {
        // Aucune photo : un bandeau bas (le dessin recadré et atténué) plutôt que le grand dessin,
        // qui occupait près de la moitié de la fiche. L'invitation à proposer une photo est posée
        // dessus ; elle ouvre la modale #add-photo-modal (voir brancherPhotosPopup).
        photo = `
        <div class="fiche-sans-photo">
            <img src="/images/pas-de-photo.webp" alt="" loading="lazy">
            <button type="button" class="popup-photo-add-btn fiche-ajout-photo" data-osm-id="${tags.osm_id || ''}" data-terrain-titre="${titre.replace(/"/g, '&quot;')}">${t('fiche_ajouter_photo')}</button>
        </div>`;
    } else if (diapositives.length === 1) {
        const d = diapositives[0];
        photo = `<div class="fiche-photos">${avecBoutonAgrandir(d)}${proposeAjouterPhoto(d) ? creditVisiteur(d) + boutonAjouterPhoto() : sousLaPhoto(d)}</div>`;
    } else {
        // Plusieurs photos : petit carrousel (flèches précédent/suivant), en JS natif — voir
        // brancherCarrouselPhotos(), appelée juste après l'ouverture de la popup plus bas.
        const diapositivesHtml = diapositives.map((d, i) => `
            <div class="popup-photo-slide" data-index="${i}" style="${i === 0 ? '' : 'display:none;'}">
                ${avecBoutonAgrandir(d)}
                ${sousLaPhoto(d)}
            </div>`).join('');
        const auMoinsUneAvecBouton = diapositives.some(proposeAjouterPhoto);
        photo = `
        <div class="fiche-photos">
        <div class="popup-photo-carousel" data-total="${diapositives.length}">
            ${diapositivesHtml}
            <button type="button" class="popup-photo-nav prev" aria-label="${t('popup_photo_prev')}">‹</button>
            <button type="button" class="popup-photo-nav next" aria-label="${t('popup_photo_next')}">›</button>
            <div class="popup-photo-dots">${diapositives.map((_, i) => `<span class="popup-photo-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>
        </div>
        ${auMoinsUneAvecBouton ? boutonAjouterPhoto() : ""}
        </div>`;
    }

    // Distance : seulement si la position du visiteur est connue. Sinon rien, plutôt que l'ancienne
    // invitation « Cliquez sur Me localiser » qui prenait deux lignes pour ne rien apprendre.
    const distance = userPosition
        ? formaterDistanceKm(calculDistance(userPosition[0], userPosition[1], terrainLat, terrainLon))
        : "";

    // Trois boutons côte à côte. « Partager » garde la classe popup-share-btn, sur laquelle
    // brancherPartagePopup s'accroche ; « Noter » ouvre le panneau du même nom (brancherFicheTerrain).
    const boutons = `
    <div class="fiche-boutons">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${terrainLat},${terrainLon}" target="_blank" rel="noopener" class="fiche-btn fiche-btn-plein">${ICON_ROUTE}<span>${t('fiche_itineraire')}</span></a>
        <button type="button" class="fiche-btn popup-share-btn">${ICON_SHARE}<span>${t('fiche_partager')}</span></button>
        ${tags.osm_id ? `<button type="button" class="fiche-btn fiche-btn-noter" aria-expanded="false">${PICTOS.etoile}<span>${t('fiche_noter')}</span></button>` : ''}
    </div>`;

    // « Signaler une erreur », en pied de fiche et en gris : ce n'est pas une action courante, il
    // ne doit pas se confondre avec les boutons. Il ouvre la modale de signalement (voir
    // « Signalements » plus haut dans ce fichier), branchée par un seul écouteur sur le document :
    // rien à rebrancher à chaque ouverture de fiche. Le titre vient d'OSM (nom de rue) : il est
    // neutralisé avant d'entrer dans l'attribut.
    const signaler = `
    <div class="fiche-pied">
        <a href="#" class="popup-report-btn" data-osm-id="${echapperHtml(tags.osm_id || '')}" data-terrain-titre="${echapperHtml(titre)}" data-lat="${terrainLat}" data-lon="${terrainLon}">${ICON_FLAG}<span>${t('popup_report')}</span></a>
    </div>`;


    // Description rédigée à la main pour les terrains de la sélection "Les plus beaux terrains"
    // (voir le chargement de /data/beaux_terrains.json plus bas dans ce fichier). Le carrousel
    // n'en affiche que les premiers mots, la fiche affiche le texte entier, juste sous la photo.
    // Le paragraphe n'est créé que si le terrain a effectivement un texte : aucun bloc vide pour
    // les 1700 autres.
    // description_nl / description_de / description_en sont lus s'ils existent dans le JSON, sinon repli sur le
    // texte français — la structure est donc déjà prête si ces champs sont ajoutés un jour.
    const beauTerrain = (MAPETANQUE_AFFICHER_DESCRIPTIONS && tags.osm_id)
        ? (window.beauxTerrainsParOsmId || {})[tags.osm_id]
        : null;
    const texteDescription = beauTerrain
        ? (beauTerrain['description_' + currentLang] || beauTerrain.description || "")
        : "";
    const description = texteDescription
        ? `<p class="popup-description">${texteDescription}</p>`
        : "";

    // Ligne de résumé sous le titre : « ★ 4,2 (9) · 2 avis · 1,2 km · Accès public probable ».
    // Un <span> par morceau, sans aucun blanc à l'intérieur : un morceau vide (pas de note, pas
    // d'avis, position inconnue) disparaît avec son séparateur, posé en CSS (voir .fiche-resume).
    // La note et le lien « N avis » sont remplis ici avec les données déjà chargées, puis tenus à
    // jour par brancherFicheTerrain (données arrivées après l'ouverture, vote du visiteur).
    const resume = `<div class="fiche-resume">`
        + `<span class="fiche-resume-note">${resumeNoteHtml(tags.osm_id)}</span>`
        + `<span class="fiche-resume-avis">${lienAvisHtml(tags.osm_id)}</span>`
        + `<span>${distance}</span>`
        + `<span>${acces}</span>`
        + `</div>`;

    // Panneaux « Noter » et « N avis » : vides et masqués, juste sous les boutons ; leur contenu
    // est construit par brancherFicheTerrain à l'ouverture.
    const panneaux = tags.osm_id
        ? `<div class="fiche-panneau fiche-panneau-noter" hidden></div><div class="fiche-panneau fiche-panneau-avis" hidden></div>`
        : "";

    return `
    <div class="fiche fiche-terrain" data-osm-id="${echapperHtml(tags.osm_id || '')}">
    ${filAriane}
    <div class="fiche-titre">${titre}</div>
    ${resume}
    ${photo}
    ${description}
    ${boutons}
    ${panneaux}
    <div class="fiche-criteres">${criteresHtml(tags)}</div>
    ${signaler}
    </div>
    `;

}

// Exposée globalement : les pages provinces (script chargé après celui-ci) l'appellent aussi,
// pour afficher des popups strictement identiques sans dupliquer cette logique.
window.construireContenuPopupTerrain = construireContenuPopupTerrain;

// Bouton "Partager" du popup : branché à chaque ouverture (réutilisé par la page d'accueil et
// les pages provinces), pour éviter tout souci d'échappement de caractères spéciaux dans le nom
// de rue.
function brancherPartagePopup(e, feature, layer) {
    const boutonPartage = e.popup.getElement().querySelector('.popup-share-btn');
    if (!boutonPartage) return;

    boutonPartage.onclick = function (evt) {
        evt.preventDefault();

        const tags = feature.properties;
        const titreActuel = tags.nearest_street
            ? t('popup_terrain_prefix') + " " + tags.nearest_street
            : t('popup_terrain_default');

        window.partagerTerrain(layer.getLatLng().lat, layer.getLatLng().lng, titreActuel);
    };
}
window.brancherPartagePopup = brancherPartagePopup;


// Branche le carrousel (si plusieurs photos) et le bouton "Ajouter une photo" (si aucune) d'une
// popup de terrain — voir la construction du HTML correspondant dans construireContenuPopupTerrain.
function brancherPhotosPopup(e) {
    const conteneur = e.popup.getElement();

    // Carrousel (2 photos ou plus)
    const carrousel = conteneur.querySelector('.popup-photo-carousel');
    if (carrousel) {
        const diapositives = carrousel.querySelectorAll('.popup-photo-slide');
        const points = carrousel.querySelectorAll('.popup-photo-dot');
        let indexActuel = 0;

        function afficherDiapositive(index) {
            diapositives.forEach((d, i) => { d.style.display = i === index ? '' : 'none'; });
            points.forEach((p, i) => p.classList.toggle('active', i === index));
            indexActuel = index;
        }

        const total = diapositives.length;
        carrousel.querySelector('.popup-photo-nav.prev').addEventListener('click', function (evt) {
            evt.preventDefault();
            afficherDiapositive((indexActuel - 1 + total) % total);
        });
        carrousel.querySelector('.popup-photo-nav.next').addEventListener('click', function (evt) {
            evt.preventDefault();
            afficherDiapositive((indexActuel + 1) % total);
        });
    }

    // Bouton(s) "Ajouter une photo" — soit celui de l'illustration de substitution (aucune photo),
    // soit un par diapositive Mapillary dans un carrousel (voir sousLaPhoto dans
    // construireContenuPopupTerrain) : peut donc y en avoir plusieurs à la fois, tous branchés.
    conteneur.querySelectorAll('.popup-photo-add-btn').forEach(function (boutonAjouter) {
        boutonAjouter.addEventListener('click', function (evt) {
            evt.preventDefault();
            window.ouvrirModaleAjoutPhoto(boutonAjouter.dataset.osmId, boutonAjouter.dataset.terrainTitre);
        });
    });
}
window.brancherPhotosPopup = brancherPhotosPopup;


// ===================== Fiche terrain plein écran (mobile) =====================
// Sur mobile, .leaflet-map-pane porte son propre transform (translate3d) — ça piège
// position:fixed sur tout élément qui en descend, impossible à contourner en CSS pur (vérifié).
// Solution, désormais appliquée aussi bien sur desktop que mobile (voir ouvrirFicheMobileTerrain
// ci-dessous) : le contenu du popup Leaflet est DÉPLACÉ (pas copié — mêmes nœuds DOM, donc les
// écouteurs d'événements déjà branchés par brancherPartagePopup/brancherPhotosPopup restent
// valides) dans un panneau séparé, en dehors de toute la hiérarchie de calques de Leaflet — le
// panneau plein écran (#mobile-sheet) sur petit écran, une fenêtre flottante centrée
// (#desktop-modal) sur grand écran. Les noms de fonctions/variables ont gardé leur préfixe
// "mobile" historique pour limiter l'ampleur du changement, mais servent maintenant aux deux.
const mobileSheet = document.getElementById('mobile-sheet');
const mobileSheetOverlay = document.getElementById('mobile-sheet-overlay');
const mobileSheetContent = document.getElementById('mobile-sheet-content');
const mobileSheetClose = document.getElementById('mobile-sheet-close');

const desktopModal = document.getElementById('desktop-modal');
const desktopModalOverlay = document.getElementById('desktop-modal-overlay');
const desktopModalContent = document.getElementById('desktop-modal-content');
const desktopModalClose = document.getElementById('desktop-modal-close');

const SEUIL_MOBILE = 1024; // même point de bascule que le menu burger — voir @media (max-width: 1024px) dans style.css

function estMobile() {
    return window.innerWidth <= SEUIL_MOBILE;
}

function ouvrirFicheMobileTerrain(noeudContenuPopup) {
    const panneau = estMobile() ? mobileSheet : desktopModal;
    const conteneur = estMobile() ? mobileSheetContent : desktopModalContent;
    const overlay = estMobile() ? mobileSheetOverlay : desktopModalOverlay;
    if (!panneau || !conteneur) return;

    // Efface TOUS les styles inline que Leaflet a posés sur ce nœud pour le petit popup ancré
    // (largeur figée, plafond de hauteur, overflow...) — plutôt que d'en neutraliser un par un au
    // fil des bugs trouvés, on repart d'une page blanche : ce nœud n'a plus besoin d'aucun de ces
    // réglages une fois accueilli dans son nouveau panneau, qui gère lui-même sa propre
    // largeur/hauteur/défilement.
    noeudContenuPopup.removeAttribute('style');
    conteneur.innerHTML = '';
    conteneur.appendChild(noeudContenuPopup);
    panneau.classList.add('open');
    if (overlay) overlay.classList.add('visible');
}

function fermerFicheMobileTerrain() {
    if (mobileSheet) mobileSheet.classList.remove('open');
    if (mobileSheetOverlay) mobileSheetOverlay.classList.remove('visible');
    if (mobileSheetContent) mobileSheetContent.innerHTML = '';

    if (desktopModal) desktopModal.classList.remove('open');
    if (desktopModalOverlay) desktopModalOverlay.classList.remove('visible');
    if (desktopModalContent) desktopModalContent.innerHTML = '';
}

if (mobileSheetClose) {
    mobileSheetClose.addEventListener('click', function () {
        fermerFicheMobileTerrain();
        map.closePopup();
    });
}
if (mobileSheetOverlay) {
    mobileSheetOverlay.addEventListener('click', function () {
        fermerFicheMobileTerrain();
        map.closePopup();
    });
}
if (desktopModalClose) {
    desktopModalClose.addEventListener('click', function () {
        fermerFicheMobileTerrain();
        map.closePopup();
    });
}
if (desktopModalOverlay) {
    desktopModalOverlay.addEventListener('click', function () {
        fermerFicheMobileTerrain();
        map.closePopup();
    });
}

window.estMobile = estMobile;
window.ouvrirFicheMobileTerrain = ouvrirFicheMobileTerrain;
window.fermerFicheMobileTerrain = fermerFicheMobileTerrain;


// ===================== Fiche club affilié =====================
// Même fenêtre que la fiche terrain (plein écran sur mobile, fenêtre flottante sur ordinateur) :
// l'ancienne petite bulle Leaflet était recouverte, sur téléphone, par les boutons de la carte.
// Club = objet simple de data/clubs.json : {name, lat, lon, region, province, commune,
// federation, adresse, site} — adresse et site recopiés du CSV par club/enrichir_clubs.py.
// Rien d'autre que la fiche terrain n'est repris : ni note, ni avis, ni critères, ni photo.

// Fédérations : nom officiel (identique dans toutes les langues) et site.
const FEDERATIONS = {
    FBFP: { nom: 'Fédération Belge Francophone de Pétanque', site: 'https://www.fbfp.be/', detail: 'federation_fbfp_detail' },
    PFV: { nom: 'Petanque Federatie Vlaanderen', site: 'https://www.pfv.be/', detail: 'federation_pfv_detail' }
};

function construireContenuPopupClub(club) {

    const filAriane = window.construireFilAriane(club);
    const sigle = club.federation === 'PFV' ? 'PFV' : 'FBFP';
    const federation = FEDERATIONS[sigle];
    const nom = echapperAvis(club.name);

    // Distance seulement si la position du visiteur est connue (même règle que les terrains).
    const distance = userPosition
        ? formaterDistanceKm(calculDistance(userPosition[0], userPosition[1], club.lat, club.lon))
        : "";

    const adresse = club.adresse
        ? `<div class="fiche-club-adresse">${ICON_MAP_PIN}<span>${echapperAvis(club.adresse)}</span></div>`
        : "";

    // Le site web n'existe que pour les clubs dont on l'a collecté : sinon deux boutons.
    const siteWeb = /^https?:\/\//.test(club.site || '')
        ? `<a href="${echapperAvis(club.site)}" target="_blank" rel="noopener" class="fiche-btn">${PICTOS.site}<span>${t('fiche_site_web')}</span></a>`
        : "";

    // « Signaler une erreur » : même modale que pour les terrains, en type « club » (un club n'a
    // pas d'osm_id ; le Worker le reconnaît à son nom et à sa position).
    return `
    <div class="fiche fiche-club">
    <div class="fiche-club-pastille">${PICTOS.club}<span>${t('fiche_club')}</span></div>
    ${filAriane}
    <div class="fiche-titre">${nom}</div>
    <div class="fiche-resume"><span>${t('club_affilie_a').replace('%f', sigle)}</span><span>${distance}</span></div>
    ${adresse}
    <div class="fiche-boutons">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${club.lat},${club.lon}" target="_blank" rel="noopener" class="fiche-btn fiche-btn-plein">${ICON_ROUTE}<span>${t('fiche_itineraire')}</span></a>
        <button type="button" class="fiche-btn popup-share-btn-club">${ICON_SHARE}<span>${t('fiche_partager')}</span></button>
        ${siteWeb}
    </div>
    <div class="criteres-groupe">
        <div class="criteres-titre">${t('federation_titre')}</div>
        <a href="${federation.site}" target="_blank" rel="noopener" class="fiche-federation">
            ${PICTOS.federation}
            <span class="fiche-federation-texte"><b>${federation.nom}</b><span>${t(federation.detail)}</span></span>
            <span class="fiche-federation-lien">${t('federation_site')} ${PICTOS.lien_sortant}</span>
        </a>
    </div>
    <div class="fiche-pied">
        <a href="#" class="popup-report-btn" data-type="club" data-terrain-titre="${nom}" data-lat="${club.lat}" data-lon="${club.lon}">${ICON_FLAG}<span>${t('popup_report')}</span></a>
    </div>
    </div>
    `;

}
window.construireContenuPopupClub = construireContenuPopupClub;

// Bouton « Partager » de la fiche club : même schéma que brancherPartagePopup, avec un paramètre
// distinctif (club=1) dans l'URL de partage pour que la résolution du deep-link sache qu'il
// s'agit d'un club et pas d'un terrain (voir plus bas, section deep-link).
function brancherPartagePopupClub(e, club, layer) {
    const boutonPartage = e.popup.getElement().querySelector('.popup-share-btn-club');
    if (!boutonPartage) return;

    boutonPartage.onclick = function (evt) {
        evt.preventDefault();
        window.partagerClub(layer.getLatLng().lat, layer.getLatLng().lng, club.name);
    };
}
window.brancherPartagePopupClub = brancherPartagePopupClub;

// Branche la popup d'un club et bascule son contenu dans la fiche (plein écran ou fenêtre
// flottante). Même mécanique, et même piège, que brancherPopupTerrain : Leaflet réutilise sa popup
// d'une ouverture à l'autre, alors que son contenu a été déplacé ; on repart donc d'une popup
// neuve à chaque fermeture (voir le commentaire de brancherPopupTerrain).
function brancherPopupClub(marker, club) {
    marker.bindPopup(function () {
        return construireContenuPopupClub(club);
    }, {
        maxHeight: 320,
        autoPan: false,
    });

    marker.once('popupopen', function (e) {
        brancherPartagePopupClub(e, club, marker);
        const noeudContenu = e.popup.getElement().querySelector('.leaflet-popup-content');
        if (noeudContenu) {
            ouvrirFicheMobileTerrain(noeudContenu);
        }
    });

    marker.once('popupclose', function () {
        fermerFicheMobileTerrain();
        setTimeout(function () {
            marker.unbindPopup();
            brancherPopupClub(marker, club);
        }, 0);
    });
}

// Fonction globale appelée depuis le lien "Partager ce club" de chaque popup de club
window.partagerClub = function (lat, lon, titre) {
    const url = window.location.origin + window.location.pathname
        + `?club=1&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&z=18`;
    ouvrirPartage(url, titre);
};


// ===================== Chargement des terrains =====================
// Les pages provinces définissent window.MAPETANQUE_SKIP_DEFAULT_MARKERS = true (avant de
// charger ce script) pour afficher leur propre sous-ensemble de terrains, sans clustering,
// plutôt que la totalité des terrains de Belgique groupés en amas. Elles réutilisent malgré
// tout construireContenuPopupTerrain()/brancherPartagePopup() ci-dessus pour des popups
// identiques, et appellent elles-mêmes afficherNombreTerrains() pour le compteur du footer.

// Déclarée ici (pas avec const/let à l'intérieur du bloc if ci-dessous) pour rester accessible
// depuis allerVersTerrain() plus loin dans ce fichier, y compris quand ce bloc ne s'exécute pas.
let markers;

// Stats du footer (nombre total de terrains, terrains avec photo) — toujours calculées sur
// l'ensemble de la Belgique et TOUJOURS exécutées, même sur les pages qui définissent
// MAPETANQUE_SKIP_DEFAULT_MARKERS (province/région/comment-jouer/compteur) : le footer doit
// afficher le même total partout, pas un sous-ensemble propre à la page courante.
// Un seul téléchargement du fichier (1,3 Mo), partagé par les chiffres du pied de page et par les
// marqueurs de la carte plus bas (conditionnés, eux, par MAPETANQUE_SKIP_DEFAULT_MARKERS).
const terrainsGeojson = fetch('/data/terrains.geojson').then(response => response.json());

terrainsGeojson
    .then(data => {
        // Date écrite dans le fichier par scripts/update_terrains.py (« AAAA-MM-JJ ») ; midi pour
        // qu'aucun décalage horaire ne la fasse glisser au jour précédent. Sans date, la ligne
        // « Données mises à jour le … » reste masquée.
        if (data.mis_a_jour) {
            lastUpdateRaw = new Date(data.mis_a_jour + 'T12:00:00');
        }
        afficherNombreTerrains(data.features.length);
        terrainsFeaturesPourPhotos = data.features;
        calculerTerrainsAvecPhoto();
    });

// Branche (ou rebranche) la popup Leaflet d'un terrain : construit son contenu, câble le partage
// et les photos, et sur mobile bascule ce contenu dans la fiche plein écran.
//
// Piège corrigé ici : Leaflet réutilise en interne la MÊME instance de popup d'une ouverture à
// l'autre (il ne reconstruit sa structure interne — .leaflet-popup-content, etc. — que si aucun
// conteneur n'existe déjà pour cette popup). Sur mobile, ouvrirFicheMobileTerrain() déplace le
// contenu (pas une copie) vers la fiche plein écran, ce qui vide l'enveloppe interne de Leaflet.
// Sans le unbindPopup()/rebind ci-dessous, une deuxième ouverture du même terrain réaffichait donc
// cette enveloppe désormais vide (juste la pointe et la croix, sans contenu). On repart ici d'une
// popup neuve à chaque fermeture, pour repartir d'un contenu frais à chaque ouverture — d'où
// layer.once() plutôt que layer.on() : chaque rebind ré-arme des écouteurs à usage unique, sans
// jamais les empiler.
//
// IMPORTANT : définie ici, tout en haut, en dehors du bloc "if (!MAPETANQUE_SKIP_DEFAULT_MARKERS)"
// juste en dessous — cette fonction est aussi appelée par les pages province/région (voir leurs
// templates), qui définissent justement ce flag à true pour éviter le double-affichage des
// marqueurs par défaut de la page d'accueil. Si elle était définie À L'INTÉRIEUR de ce bloc
// conditionnel (bug corrigé ici), elle n'existerait tout simplement jamais sur ces pages-là,
// pourtant celles qui en ont le plus besoin.
function brancherPopupTerrain(layer, feature) {
    layer.bindPopup(function () {
        return construireContenuPopupTerrain(feature, layer);
    }, {
        // Le popup Leaflet original reste minuscule et invisible dans tous les cas (son contenu
        // est toujours déplacé ailleurs, voir ouvrirFicheMobileTerrain plus haut) — inutile donc
        // que Leaflet déplace la carte pour le faire apparaître à l'écran.
        maxHeight: 320,
        autoPan: false,
    });

    layer.once('popupopen', function (e) {
        brancherPartagePopup(e, feature, layer);
        brancherPhotosPopup(e);
        brancherFicheTerrain(e, feature);

        // Doit venir APRÈS le câblage ci-dessus : on déplace les mêmes nœuds DOM (pas une
        // copie), donc les écouteurs déjà attachés restent valides une fois le contenu basculé
        // dans son panneau (plein écran mobile, ou fenêtre flottante desktop).
        const noeudContenu = e.popup.getElement().querySelector('.leaflet-popup-content');
        if (noeudContenu) {
            ouvrirFicheMobileTerrain(noeudContenu);
        }
    });

    layer.once('popupclose', function () {
        fermerFicheMobileTerrain();
        // setTimeout(…, 0) plutôt qu'un appel immédiat : rebinder à chaud, pendant que Leaflet
        // est encore en train de finaliser la fermeture de l'ancienne popup, provoquait une
        // popup fantôme (juste la croix, coincée en haut à gauche de la carte, jamais
        // positionnée sur son terrain). On laisse Leaflet terminer son propre cycle de fermeture
        // avant de reconstruire.
        setTimeout(function () {
            layer.unbindPopup();
            brancherPopupTerrain(layer, feature);
        }, 0);
    });
}
window.brancherPopupTerrain = brancherPopupTerrain;

if (!window.MAPETANQUE_SKIP_DEFAULT_MARKERS) {

markers = L.markerClusterGroup({
    disableClusteringAtZoom: 16
});

terrainsGeojson
    .then(data => {

        // Liste plate de tous les terrains, pour le calcul du plus proche (flèche hors écran)
        listeTousLesTerrains = data.features.map(function (feature) {
            return {
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                props: feature.properties
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
                brancherPopupTerrain(layer, feature);
            }


        }).addTo(markers);

        map.addLayer(markers);
        window.enregistrerTerrainsFiltrables(markers);

        // Lien de partage d'un terrain précis (?lat=...&lon=...) : centrer et ouvrir son popup.
        // Exclut le cas ?club=1&lat=...&lon=... (lien de partage d'un club, pas d'un terrain —
        // voir la résolution dédiée dans le chargement des clubs plus bas).
        const urlParams = new URLSearchParams(window.location.search);
        const paramLat = parseFloat(urlParams.get('lat'));
        const paramLon = parseFloat(urlParams.get('lon'));

        if (urlParams.get('club') !== '1' && !isNaN(paramLat) && !isNaN(paramLon)) {
            allerVersTerrain(paramLat, paramLon);
        }

    });

} // fin du if (!window.MAPETANQUE_SKIP_DEFAULT_MARKERS)

// Pages province et région : la flèche « terrain le plus proche » (après une recherche ou une
// géolocalisation) ne vise que les terrains de la page.
if (window.MAPETANQUE_STATS_GEO_KEY) {
    terrainsGeojson.then(function (data) {
        listeTousLesTerrains = data.features
            .filter(function (f) { return estDansLaZone(f.properties); })
            .map(function (f) {
                return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], props: f.properties };
            });
    });
}

// Lien « Le voir sur la carte de Belgique » des pages province et région (voir
// signalerSiHorsZone) : ?recherche=… relance la recherche, ?localiser=1 la géolocalisation. Une
// fois les terrains chargés, pour que la flèche du terrain le plus proche puisse s'afficher.
if (searchForm || locateBtn) {
    const paramsArrivee = new URLSearchParams(window.location.search);
    const rechercheArrivee = paramsArrivee.get('recherche');
    terrainsGeojson.then(function () {
        if (rechercheArrivee && searchForm) {
            document.getElementById('searchInput').value = rechercheArrivee;
            searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
        } else if (paramsArrivee.get('localiser') === '1' && locateBtn) {
            locateBtn.click();
        }
    });
}


// ===================== Chargement des photos Mapillary validées manuellement =====================
// Association simple osm_id -> {mapillary_id, credit_url}, produite par l'outil de revue
// (voir club/generer_revue_photos.py côté scripts). Fichier optionnel : son absence (site tout
// juste mis à jour, avant le premier dépôt de ce fichier) ne doit rien casser.
window.photosMapillaryParOsmId = {};
fetch('/data/photos_mapillary.json')
    .then(response => response.json())
    .then(data => {
        window.photosMapillaryParOsmId = data;
        photosMapillaryChargees = true;
        calculerTerrainsAvecPhoto();
    })
    .catch(() => {
        // Fichier absent ou invalide : les popups fonctionnent normalement, juste sans photo
        // supplémentaire en plus de celle éventuellement déjà présente via un tag OSM. Le
        // compteur "terrains avec photo" du footer se base alors uniquement sur les tags OSM.
        photosMapillaryChargees = true;
        calculerTerrainsAvecPhoto();
    });


// ===================== Chargement des descriptions "Les plus beaux terrains" =====================
// Même schéma que les photos Mapillary ci-dessus : une association osm_id -> entrée, tirée du
// même /data/beaux_terrains.json que le carrousel (voir beaux-terrains.js). Chargé ici plutôt
// que dans beaux-terrains.js pour que la description apparaisse aussi dans les fiches ouvertes
// depuis une page province ou depuis un lien de partage, où le carrousel n'existe pas.
// Fichier optionnel : son absence ne casse rien, les fiches restent celles d'aujourd'hui.
// Le contenu des popups étant construit à l'ouverture (bindPopup reçoit une fonction), ce
// chargement asynchrone n'a pas besoin d'être terminé avant l'affichage de la carte.
// Depuis l'arrivée de la note publique, plus rien n'affiche ces descriptions : la fiche montre
// les étoiles à leur emplacement, et la tuile du carrousel la note au lieu de l'extrait. Le
// mécanisme entier reste en place, éteint par cette constante. La repasser à true ICI ET dans
// beaux-terrains.js (AFFICHER_EXTRAIT) fait tout revenir : les textes n'ont jamais quitté
// data/beaux_terrains.json.
var MAPETANQUE_AFFICHER_DESCRIPTIONS = false;

window.beauxTerrainsParOsmId = {};
if (MAPETANQUE_AFFICHER_DESCRIPTIONS) {
    fetch('/data/beaux_terrains.json')
        .then(response => response.json())
        .then(data => {
            (data || []).forEach(function (terrain) {
                if (terrain.osm_id) window.beauxTerrainsParOsmId[terrain.osm_id] = terrain;
            });
        })
        .catch(() => { /* absent ou invalide : les fiches s'affichent simplement sans description */ });
}


// ===================== Notes publiques des terrains =====================
// Un seul GET au chargement rapatrie toutes les moyennes ; chaque fiche y puise ensuite sans
// requête réseau. Le Worker (Cloudflare + D1) vit sur *.workers.dev parce que le DNS du domaine
// est chez OVH et qu'un domaine personnalisé pour un Worker exige que Cloudflare gère le domaine
// — d'où la requête cross-origin et les en-têtes CORS côté Worker.
// Échec silencieux assumé : Worker injoignable = fiches sans note, tout le reste intact.
//
// UNE SEULE LIGNE À ADAPTER DANS CE FICHIER : l'adresse ci-dessous, donnée par Cloudflare au
// moment du déploiement du Worker.
var MAPETANQUE_URL_NOTES = "https://mapetanque-notes.mapetanque.workers.dev";

// ===================== Terrains voisins =====================
// Plusieurs pistes côte à côte sont souvent autant de terrains dans OSM, alors que c'est un seul
// endroit pour un joueur : une note, un critère des joueurs ou un avis déposé sur une piste vaut
// pour ses voisines. Les groupes (centres à 25 m au plus, de proche en proche) sont calculés par
// scripts/grouper_terrains.py dans data/groupes_terrains.json.
// Le cumul se fait ici, à la lecture : le Worker garde chaque piste séparée, les données déjà
// déposées en profitent, et changer le seuil ne demande rien côté base. Les données brutes
// restent dans mapetanqueBrut ; window.mapetanqueNotes, mapetanqueCriteres et mapetanqueAvis
// portent le cumul du groupe sous l'osm_id de CHAQUE piste, si bien que les fiches, les filtres
// et le carrousel n'ont rien à savoir des groupes.
var mapetanqueGroupes = {};   // osm_id -> osm_id de toutes les pistes de son groupe (absent = isolé)
var mapetanqueBrut = { notes: {}, criteres: {}, avis: null };

function membresGroupe(osmId) {
    return mapetanqueGroupes[osmId] || [osmId];
}

// Piste du groupe où ce navigateur a déjà voté (ou, à défaut, envoyé un avis) : ses envois
// suivants y vont aussi, pour qu'un même visiteur ne compte pas deux fois dans le cumul en passant
// d'une piste à l'autre (le jeton de vote ne vaut que pour sa piste). Sinon, la piste ouverte.
function terrainCible(osmId) {
    var membres = membresGroupe(osmId);
    if (mapetanqueVoteLocal(osmId)) return osmId;
    for (var i = 0; i < membres.length; i++) {
        if (mapetanqueVoteLocal(membres[i])) return membres[i];
    }
    for (var j = 0; j < membres.length; j++) {
        if (mapetanqueAvisDejaEnvoye(membres[j])) return membres[j];
    }
    return osmId;
}

// Recopie les données brutes de chaque piste sur toutes les pistes de son groupe, puis prévient
// les fiches ouvertes et le carrousel.
//   notes    : [somme, nombre] additionnés ;
//   critères : nombres de confirmations additionnés, mois le plus récent ;
//   avis     : listes mises bout à bout, du plus récent au plus ancien.
function cumulerNotes() {
    var cumul = {};
    Object.keys(mapetanqueBrut.notes).forEach(function (id) {
        var brut = mapetanqueBrut.notes[id];
        membresGroupe(id).forEach(function (m) {
            var c = cumul[m] || (cumul[m] = [0, 0]);
            c[0] += brut[0];
            c[1] += brut[1];
        });
    });
    window.mapetanqueNotes = cumul;
    window.dispatchEvent(new CustomEvent('mapetanque:notes'));
}

function cumulerCriteres() {
    var cumul = {};
    Object.keys(mapetanqueBrut.criteres).forEach(function (id) {
        var brut = mapetanqueBrut.criteres[id] || {};
        membresGroupe(id).forEach(function (m) {
            var c = cumul[m] || (cumul[m] = {});
            Object.keys(brut).forEach(function (cle) {
                var actuel = c[cle] || [0, ''];
                c[cle] = [actuel[0] + brut[cle][0], actuel[1] > brut[cle][1] ? actuel[1] : brut[cle][1]];
            });
        });
    });
    window.mapetanqueCriteres = cumul;
    window.dispatchEvent(new CustomEvent('mapetanque:criteres'));
}

function cumulerAvis() {
    if (!mapetanqueBrut.avis) return;   // pas encore chargés : mapetanqueAvis reste null
    var cumul = {};
    Object.keys(mapetanqueBrut.avis).forEach(function (id) {
        membresGroupe(id).forEach(function (m) {
            cumul[m] = (cumul[m] || []).concat(mapetanqueBrut.avis[id]);
        });
    });
    // Tri stable par mois : l'ordre d'arrivée est gardé à l'intérieur d'un même mois.
    Object.keys(cumul).forEach(function (m) {
        cumul[m].sort(function (a, b) { return a[3] < b[3] ? 1 : a[3] > b[3] ? -1 : 0; });
    });
    window.mapetanqueAvis = cumul;
    window.dispatchEvent(new CustomEvent('mapetanque:avis'));
}

// Groupes arrivés après les données : on refait les trois cumuls. Échec : chaque piste garde
// simplement ses propres données, comme avant les groupes.
fetch('/data/groupes_terrains.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (groupes) {
        if (!Array.isArray(groupes)) return;
        groupes.forEach(function (groupe) {
            groupe.forEach(function (id) { mapetanqueGroupes[id] = groupe; });
        });
        cumulerNotes();
        cumulerCriteres();
        cumulerAvis();
    })
    .catch(function () { });


// window.x = explicite plutôt que const/let : ces fonctions sont lues depuis beaux-terrains.js,
// et const/let ne créent PAS de propriété sur window (même piège que brancherPopupTerrain).
window.mapetanqueNotes = {};   // "node/123456789" -> [somme, nombre], cumulé par groupe de pistes

fetch(MAPETANQUE_URL_NOTES + '/notes')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
        if (!data) return;
        mapetanqueBrut.notes = data;
        // Les tuiles du carrousel sont déjà dessinées à ce moment : elles se redessinent sur
        // l'événement mapetanque:notes, plutôt que de faire attendre le réseau avant le premier
        // affichage.
        cumulerNotes();
    })
    .catch(function () { /* pas de note affichée ; le vote reste possible */ });


// Moyenne → une seule étoile, suivie du chiffre écrit à côté par l'appelant (« ★ 4,7 »). Les cinq
// étoiles restent réservées au vote, dans la fiche : deux rangées de cinq l'une sous l'autre se
// confondaient. Étoile grise tant que personne n'a voté.
window.mapetanqueEtoileHtml = function (moyenne) {
    var notee = typeof moyenne === 'number' && isFinite(moyenne) && moyenne > 0;
    return '<span class="note-etoile' + (notee ? '' : ' vide') + '" aria-hidden="true">★</span>';
};

// "4,5 (12 notes)" — virgule décimale dans les trois langues. Retourne null tant qu'aucun vote
// n'est enregistré, pour que l'appelant choisisse quoi afficher à la place.
window.mapetanqueResumeNote = function (osmId) {
    var brut = (window.mapetanqueNotes || {})[osmId];
    if (!brut || !brut[1]) return null;
    var nombre = brut[1];
    var moyenne = brut[0] / nombre;
    return {
        moyenne: moyenne,
        nombre: nombre,
        texte: uneDecimale(moyenne)
            + ' (' + nombre + '\u00a0' + t(nombre > 1 ? 'notation_note_n' : 'notation_note_un') + ')'
    };
};

// Vote enregistré sur cet appareil : { note, jeton }. Le jeton est un identifiant aléatoire créé
// par le Worker au premier vote ; le renvoyer permet de MODIFIER ce vote plutôt que d'en ajouter
// un second. Il ne sert qu'à ça, n'identifie personne et n'existe que parce que le visiteur a
// voté — un stockage « strictement nécessaire » à la fonction qu'il a lui-même demandée.
// Clé distincte de l'ancienne (mapetanque_note_…), qui ne portait pas de jeton : les votes de test
// antérieurs sont simplement ignorés.
function mapetanqueVoteLocal(osmId) {
    try {
        var brut = localStorage.getItem('mapetanque_vote_' + osmId);
        if (!brut) return null;
        var vote = JSON.parse(brut);
        return (vote && vote.note >= 1 && vote.note <= 5) ? vote : null;
    } catch (e) {
        return null;   // navigation privée stricte ou valeur corrompue : comme si rien n'était stocké
    }
}

function mapetanqueMemoriserVote(osmId, note, jeton) {
    try {
        localStorage.setItem('mapetanque_vote_' + osmId, JSON.stringify({ note: note, jeton: jeton }));
    } catch (e) { }
}

// Note dans la ligne de résumé de la fiche : « ★ 4,2 (9) ». Chaîne vide tant que personne n'a
// voté : le morceau disparaît alors de la ligne, avec son séparateur.
function resumeNoteHtml(osmId) {
    var resume = osmId ? window.mapetanqueResumeNote(osmId) : null;
    if (!resume) return '';
    return '<span title="' + resume.texte + '">' + window.mapetanqueEtoileHtml(resume.moyenne)
        + ' ' + uneDecimale(resume.moyenne) + ' (' + resume.nombre + ')</span>';
}

// Critères confirmés par les joueurs (voir « Critères des terrains » plus haut) : même Worker et
// même principe que les notes, un seul GET pour tout le site.
fetch(MAPETANQUE_URL_NOTES + '/criteres')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
        if (!data) return;
        mapetanqueBrut.criteres = data;
        cumulerCriteres();
    })
    .catch(function () { /* fiches sans les critères des joueurs ; les critères OSM restent */ });

// Critères cochés depuis ce navigateur, pour pré-cocher les cases du panneau « Noter ». Le
// Worker ne sait les retrouver que par le jeton du vote, qu'il ne faut pas exposer dans un GET :
// on garde donc ici la liste renvoyée par chaque POST /confirmation.
function mapetanqueConfirmationsLocales(osmId) {
    try {
        var liste = JSON.parse(localStorage.getItem('mapetanque_confirmations_' + osmId) || '[]');
        return Array.isArray(liste) ? liste : [];
    } catch (e) {
        return [];
    }
}

function mapetanqueMemoriserConfirmations(osmId, liste) {
    try {
        localStorage.setItem('mapetanque_confirmations_' + osmId, JSON.stringify(liste || []));
    } catch (e) { }
}


// ===================== Avis des visiteurs =====================
// Texte libre de 280 caractères au plus, écrit dans le panneau « Noter » de la fiche. Circuit :
//   - envoi : Worker mapetanque-admin (POST /avis/envoi), qui range l'avis « en attente » et
//     prévient par une issue GitHub, comme pour les signalements ;
//   - publication : un clic dans l'onglet Notes/Avis de la page admin ;
//   - lecture : Worker mapetanque-notes (GET /avis), un seul paquet pour tout le site, chargé
//     une fois comme les notes et mis en cache 5 minutes.
// La fiche montre « N avis » dans sa ligne de résumé ; ce lien ouvre le panneau de la liste.
var MAPETANQUE_URL_AVIS_ENVOI = "https://mapetanque-admin.mapetanque.workers.dev/avis/envoi";
var AVIS_TAILLE_MAX = 280;

// "node/123" -> [[texte, pseudo, note, "AAAA-MM"], ...], du plus récent au plus ancien, avis des
// pistes voisines compris (voir « Terrains voisins »).
// null tant que la réponse n'est pas arrivée : la fiche n'affiche alors pas de lien « N avis »,
// ajouté à l'arrivée (événement mapetanque:avis).
window.mapetanqueAvis = null;

fetch(MAPETANQUE_URL_NOTES + '/avis')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
        mapetanqueBrut.avis = data || {};
        cumulerAvis();
    })
    .catch(function () {
        // Worker injoignable : les fiches restent sans avis, l'écriture reste possible.
        mapetanqueBrut.avis = {};
        cumulerAvis();
    });

function echapperAvis(texte) {
    return String(texte == null ? '' : texte)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Identifiant aléatoire de ce navigateur pour les avis : il permet seulement qu'un nouvel avis
// remplace le précédent sur le même terrain. Il n'identifie personne et n'est jamais publié.
function mapetanqueAuteurAvis() {
    try {
        var existant = localStorage.getItem('mapetanque_auteur_avis');
        if (existant) return existant;
        var nouveau = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        localStorage.setItem('mapetanque_auteur_avis', nouveau);
        return nouveau;
    } catch (e) {
        return null;   // stockage bloqué : l'envoi reste possible, sans remplacement
    }
}

// Terrains sur lesquels ce navigateur a déjà envoyé un avis : sert au message « votre nouvel
// avis remplacera le précédent ».
function mapetanqueAvisDejaEnvoye(osmId) {
    try { return localStorage.getItem('mapetanque_avis_' + osmId) === '1'; } catch (e) { return false; }
}

function mapetanqueMemoriserAvisEnvoye(osmId) {
    try { localStorage.setItem('mapetanque_avis_' + osmId, '1'); } catch (e) { }
}

// « 2026-09 » -> « septembre 2026 » dans la langue du site.
function moisAvis(mois) {
    var morceaux = String(mois || '').split('-');
    if (morceaux.length !== 2) return '';
    var date = new Date(Date.UTC(+morceaux[0], +morceaux[1] - 1, 15));
    var locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Une seule étoile et le chiffre, comme pour la moyenne : « ★ 4 ».
function noteAvisHtml(note) {
    return (note >= 1 && note <= 5)
        ? '<span class="avis-note">' + window.mapetanqueEtoileHtml(note) + ' ' + note + '</span>'
        : '';
}

function avisHtml(avis) {
    var meta = [noteAvisHtml(avis[2]), echapperAvis(avis[1] || t('avis_anonyme')), echapperAvis(moisAvis(avis[3]))]
        .filter(Boolean).join(' · ');
    return '<div class="avis">'
        + '<p class="avis-texte">' + echapperAvis(avis[0]) + '</p>'
        + '<div class="avis-meta">' + meta + '</div>'
        + '</div>';
}

// Lien « N avis » de la ligne de résumé : absent tant qu'aucun avis n'est publié (ou pas encore
// chargé), plutôt qu'un « Pas encore d'avis ».
function lienAvisHtml(osmId) {
    var nombre = osmId ? ((window.mapetanqueAvis || {})[osmId] || []).length : 0;
    if (!nombre) return '';
    return '<button type="button" class="fiche-lien-avis" aria-expanded="false">'
        + t(nombre > 1 ? 'fiche_n_avis' : 'fiche_un_avis').replace('%n', nombre) + '</button>';
}


// ===================== Fiche terrain : panneaux « Noter » et « N avis » =====================
// Appelée à chaque ouverture de fiche, comme brancherPartagePopup et brancherPhotosPopup.
// IMPORTANT : définie au niveau racine du fichier, hors de tout bloc conditionnel — les pages
// province et région l'atteignent via brancherPopupTerrain, et la placer dans un bloc la rendrait
// indéfinie sur ces pages sans la moindre erreur visible (piège déjà payé une fois).
//
// Les deux panneaux s'ouvrent juste sous les boutons, un seul à la fois :
//   - « Noter » (bouton) : la note, puis les cases des joueurs (après un vote), puis l'avis. C'est
//     le seul endroit où l'on note et où l'on écrit un avis ;
//   - « N avis » (lien de la ligne de résumé) : la liste complète, terminée par « Donner votre
//     avis › », qui ouvre « Noter ».
// La fiche se tient aussi à jour quand les notes, les avis ou les critères arrivent après son
// ouverture, ou changent après un vote.
function brancherFicheTerrain(e, feature) {
    var contenu = e.popup.getElement();
    var fiche = contenu ? contenu.querySelector('.fiche-terrain') : null;
    if (!fiche) return;

    var tags = feature.properties;
    var osmId = tags.osm_id;
    var zoneCriteres = fiche.querySelector('.fiche-criteres');

    // Appui sur une pastille des joueurs : « Confirmé par N joueurs… » sous le groupe ; un second
    // appui le referme. Écouteur sur la zone entière : les pastilles sont redessinées à l'arrivée
    // des données sans qu'il faille le rebrancher.
    zoneCriteres.addEventListener('click', function (evt) {
        var pastille = evt.target.closest('.critere-joueurs');
        if (!pastille) return;
        var groupe = pastille.closest('.criteres-groupe');
        var detail = groupe.querySelector('.criteres-detail');
        var etaitOuverte = pastille.getAttribute('aria-expanded') === 'true';
        groupe.querySelectorAll('.critere-joueurs').forEach(function (p) { p.setAttribute('aria-expanded', 'false'); });
        detail.hidden = etaitOuverte;
        if (!etaitOuverte) {
            pastille.setAttribute('aria-expanded', 'true');
            detail.textContent = pastille.getAttribute('data-detail');
        }
    });

    var panneauNoter = fiche.querySelector('.fiche-panneau-noter');
    var panneauAvis = fiche.querySelector('.fiche-panneau-avis');
    var boutonNoter = fiche.querySelector('.fiche-btn-noter');
    if (!osmId || !panneauNoter || !panneauAvis || !boutonNoter) return;

    // --- Ouverture des panneaux --------------------------------------------------------------
    var panneauxTouches = false;   // le visiteur a déjà ouvert ou fermé un panneau lui-même

    function basculer(panneau) {
        panneauxTouches = true;
        var ouvrir = panneau.hidden;
        panneauNoter.hidden = true;
        panneauAvis.hidden = true;
        if (ouvrir) {
            if (panneau === panneauAvis) afficherAvis();
            else if (!panneauNoter.firstChild) construireNoter();   // construit une fois : un avis en cours de frappe survit à la fermeture
            panneau.hidden = false;
        }
        boutonNoter.setAttribute('aria-expanded', String(!panneauNoter.hidden));
        var lien = fiche.querySelector('.fiche-lien-avis');
        if (lien) lien.setAttribute('aria-expanded', String(!panneauAvis.hidden));
    }
    boutonNoter.addEventListener('click', function () { basculer(panneauNoter); });

    // Les avis sont dépliés d'office quand le terrain en a : à l'ouverture de la fiche, ou à leur
    // arrivée si elle est plus tardive — sauf si le visiteur a entre-temps ouvert ou fermé un
    // panneau lui-même. Le lien « N avis » les replie.
    function deplierAvisParDefaut() {
        if (panneauxTouches || !panneauAvis.hidden || !panneauNoter.hidden) return;
        if (!((window.mapetanqueAvis || {})[osmId] || []).length) return;
        afficherAvis();
        panneauAvis.hidden = false;
        var lien = fiche.querySelector('.fiche-lien-avis');
        if (lien) lien.setAttribute('aria-expanded', 'true');
    }

    // --- Ligne de résumé ---------------------------------------------------------------------
    function majResume() {
        fiche.querySelector('.fiche-resume-note').innerHTML = resumeNoteHtml(osmId);
        var zoneLien = fiche.querySelector('.fiche-resume-avis');
        zoneLien.innerHTML = lienAvisHtml(osmId);
        var lien = zoneLien.querySelector('.fiche-lien-avis');
        if (lien) {
            lien.setAttribute('aria-expanded', String(!panneauAvis.hidden));
            lien.addEventListener('click', function () { basculer(panneauAvis); });
        }
    }

    // --- Panneau « N avis » ------------------------------------------------------------------
    function afficherAvis() {
        var liste = (window.mapetanqueAvis || {})[osmId] || [];
        panneauAvis.innerHTML = liste.map(avisHtml).join('')
            + '<button type="button" class="fiche-lien-texte avis-donner">' + t('fiche_donner_avis') + ' ›</button>';
        panneauAvis.querySelector('.avis-donner').addEventListener('click', function () { basculer(panneauNoter); });
    }

    // --- Panneau « Noter » -------------------------------------------------------------------
    var noteActuelle = 0;        // note de ce navigateur, état de repos des étoiles
    var envoiEnCours = false;

    function construireNoter() {
        var suffixe = osmId.replace('/', '-');
        var etoiles = '';
        for (var i = 1; i <= 5; i++) {
            etoiles += '<button type="button" class="note-vote-etoile" data-note="' + i
                + '" aria-label="' + t('notation_etoile_aria').replace('%n', i) + '">★</button>';
        }
        var cases = CRITERES_JOUEURS.map(function (cle) {
            return '<button type="button" class="critere-case" data-critere="' + cle + '" aria-pressed="false">'
                + PICTOS[cle] + '<span>' + t('critere_' + cle) + '</span></button>';
        }).join('');

        panneauNoter.innerHTML =
            '<div class="noter-note">'
            + '<span class="noter-libelle"></span>'
            + '<span class="note-vote-etoiles">' + etoiles + '</span>'
            + '</div>'
            // Cases des joueurs : seulement après un vote (le Worker exige le jeton de ce vote).
            + '<div class="noter-criteres" hidden>'
            + '<div class="noter-sous-titre">' + t('fiche_vous_confirmez') + ' <span class="avis-facultatif">' + t('avis_facultatif') + '</span></div>'
            + '<div class="noter-cases">' + cases + '</div>'
            + '<p class="noter-erreur" hidden></p>'
            + '</div>'
            // Avis : le champ est là dès l'ouverture (un avis sans note reste permis) ; le reste du
            // formulaire n'apparaît qu'au premier caractère.
            + '<form class="avis-form" novalidate>'
            + (mapetanqueAvisDejaEnvoye(terrainCible(osmId)) ? '<p class="avis-info">' + t('avis_remplacera') + '</p>' : '')
            + '<label for="avis-texte-' + suffixe + '">' + t('fiche_votre_avis') + ' <span class="avis-facultatif">' + t('avis_facultatif') + '</span></label>'
            + '<textarea id="avis-texte-' + suffixe + '" name="texte" maxlength="' + AVIS_TAILLE_MAX + '" placeholder="' + t('fiche_avis_exemple') + '"></textarea>'
            + '<div class="avis-suite" hidden>'
            + '<div class="avis-compteur" aria-live="polite">0 / ' + AVIS_TAILLE_MAX + '</div>'
            + '<label for="avis-pseudo-' + suffixe + '">' + t('avis_champ_pseudo') + ' <span class="avis-facultatif">' + t('avis_facultatif') + '</span></label>'
            + '<input type="text" id="avis-pseudo-' + suffixe + '" name="pseudo" maxlength="40" autocomplete="nickname" placeholder="' + t('avis_anonyme') + '">'
            // Champ piège : invisible pour un visiteur, rempli par les robots.
            + '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="avis-piege" aria-hidden="true">'
            + '<p class="avis-mention"></p>'
            + '<p class="avis-erreur" hidden></p>'
            + '<div class="avis-boutons"><button type="submit" class="avis-btn avis-btn-envoyer" disabled>' + t('fiche_publier_avis') + '</button></div>'
            + '</div>'
            + '</form>';

        brancherEtoiles();
        panneauNoter.querySelectorAll('.critere-case').forEach(function (bouton) {
            bouton.addEventListener('click', function () { basculerCase(bouton); });
        });
        brancherFormulaire();
        etatNote();
    }

    // État du panneau d'après le vote mémorisé sur cet appareil : étoiles, libellé, cases, mention.
    function etatNote() {
        var vote = mapetanqueVoteLocal(terrainCible(osmId));
        noteActuelle = vote ? vote.note : 0;
        peindre(noteActuelle);
        afficherLibelle(vote ? '✓ ' + t('fiche_note_enregistree') : t('notation_votre_note'), vote ? 'ok' : '');
        var criteres = panneauNoter.querySelector('.noter-criteres');
        if (criteres) criteres.hidden = !(vote && vote.jeton);
        majCases();
        majMention();
    }

    function afficherLibelle(texte, etat) {
        var libelle = panneauNoter.querySelector('.noter-libelle');
        if (!libelle) return;
        libelle.textContent = texte;
        libelle.classList.toggle('ok', etat === 'ok');
        libelle.classList.toggle('note-erreur', etat === 'erreur');
    }

    // Remplissage fait en JS plutôt qu'en CSS : la technique du sélecteur ~ imposerait un ordre
    // DOM inversé, alors qu'ici le même code sert au survol, au clavier, au retour à l'état de
    // repos et à l'état après vote.
    function peindre(niveau) {
        panneauNoter.querySelectorAll('.note-vote-etoile').forEach(function (bouton) {
            bouton.classList.toggle('active', parseInt(bouton.getAttribute('data-note'), 10) <= niveau);
        });
    }

    function brancherEtoiles() {
        panneauNoter.querySelectorAll('.note-vote-etoile').forEach(function (bouton) {
            var valeur = parseInt(bouton.getAttribute('data-note'), 10);
            bouton.addEventListener('mouseenter', function () { peindre(valeur); });
            bouton.addEventListener('focus', function () { peindre(valeur); });
            bouton.addEventListener('click', function () { voter(valeur); });
        });
        // Retour à l'état de repos : la note donnée si le visiteur a voté, rien sinon.
        panneauNoter.querySelector('.note-vote-etoiles').addEventListener('mouseleave', function () {
            peindre(noteActuelle);
        });
    }

    // Le vote part dès l'appui et reste modifiable : le jeton mémorisé permet de MODIFIER ce vote
    // plutôt que d'en ajouter un second (voir mapetanqueVoteLocal).
    function voter(note) {
        // Même note que celle déjà donnée : rien à envoyer. Clics répétés pendant un envoi :
        // ignorés, sinon deux requêtes se croiseraient et la seconde pourrait écraser la première.
        if (envoiEnCours || note === noteActuelle) return;
        envoiEnCours = true;

        var precedente = noteActuelle;
        noteActuelle = note;
        peindre(note);

        // Piste voisine déjà notée depuis ce navigateur : on modifie ce vote-là (voir terrainCible).
        var cible = terrainCible(osmId);
        var voteExistant = mapetanqueVoteLocal(cible);

        fetch(MAPETANQUE_URL_NOTES + '/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                osm_id: cible,
                note: note,
                jeton: voteExistant ? voteExistant.jeton : undefined
            })
        })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data || typeof data.nombre !== 'number') throw new Error('réponse inattendue');

                // Refus du Worker : cette connexion a déjà voté pour ce terrain ce mois-ci, mais
                // depuis un autre navigateur (pas de jeton ici pour le modifier). On le dit, et
                // on retire les étoiles de vote.
                if (data.deja_vote) {
                    panneauNoter.querySelector('.noter-note').innerHTML =
                        '<span class="note-vote-message">' + t('notation_deja') + '</span>';
                    return;
                }

                mapetanqueMemoriserVote(cible, note, data.jeton);

                // Le Worker renvoie l'agrégat à jour de la piste : on le recopie dans le cache local
                // plutôt que de relancer un GET /notes, mis en cache 5 min et qui renverrait
                // l'ancienne valeur. Le cumul prévient la ligne de résumé et le carrousel.
                mapetanqueBrut.notes[cible] = [data.somme, data.nombre];
                cumulerNotes();
                etatNote();
            })
            .catch(function () {
                noteActuelle = precedente;
                peindre(precedente);
                afficherLibelle(t('notation_erreur'), 'erreur');
            })
            .then(function () { envoiEnCours = false; });
    }

    // --- Cases des joueurs -------------------------------------------------------------------
    function majCases() {
        var confirmes = mapetanqueConfirmationsLocales(terrainCible(osmId));
        panneauNoter.querySelectorAll('.critere-case').forEach(function (bouton) {
            bouton.setAttribute('aria-pressed', String(confirmes.indexOf(bouton.getAttribute('data-critere')) !== -1));
        });
    }

    // Cocher confirme (ou rafraîchit la date), décocher retire. La case change tout de suite et
    // revient en arrière si l'envoi échoue.
    function basculerCase(bouton) {
        var cible = terrainCible(osmId);
        var vote = mapetanqueVoteLocal(cible);
        if (!vote || !vote.jeton || bouton.disabled) return;

        var erreur = panneauNoter.querySelector('.noter-erreur');
        var coche = bouton.getAttribute('aria-pressed') !== 'true';
        var criteres = {};
        criteres[bouton.getAttribute('data-critere')] = coche;

        bouton.setAttribute('aria-pressed', String(coche));
        bouton.disabled = true;
        erreur.hidden = true;

        fetch(MAPETANQUE_URL_NOTES + '/confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ osm_id: cible, jeton: vote.jeton, criteres: criteres })
        })
            .then(function (r) {
                if (!r.ok) throw new Error('Réponse HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                mapetanqueMemoriserConfirmations(cible, data.confirmes);
                majCases();
                // Compteurs à jour de la piste, sans attendre le cache de GET /criteres.
                mapetanqueBrut.criteres[cible] = data.criteres || {};
                cumulerCriteres();
            })
            .catch(function () {
                bouton.setAttribute('aria-pressed', String(!coche));
                erreur.textContent = t('fiche_confirmation_erreur');
                erreur.hidden = false;
            })
            .then(function () { bouton.disabled = false; });
    }

    // --- Formulaire d'avis -------------------------------------------------------------------
    function majMention() {
        var mention = panneauNoter.querySelector('.avis-mention');
        if (!mention) return;
        var vote = mapetanqueVoteLocal(terrainCible(osmId));
        mention.textContent = t('avis_mention')
            + (vote ? ' ' + t('fiche_note_jointe').replace('%n', vote.note + ' ★') : '');
    }

    function brancherFormulaire() {
        var formulaire = panneauNoter.querySelector('.avis-form');
        var zoneTexte = formulaire.querySelector('textarea');
        var suite = formulaire.querySelector('.avis-suite');
        var compteur = formulaire.querySelector('.avis-compteur');
        var bouton = formulaire.querySelector('.avis-btn-envoyer');

        zoneTexte.addEventListener('input', function () {
            var longueur = zoneTexte.value.length;
            if (longueur > 0) suite.hidden = false;   // une fois affichée, la suite reste
            compteur.textContent = longueur + ' / ' + AVIS_TAILLE_MAX;
            compteur.classList.toggle('presque', longueur >= AVIS_TAILLE_MAX - 20);
            bouton.disabled = zoneTexte.value.trim().length < 3;
        });
        formulaire.addEventListener('submit', envoyerAvis);
    }

    function envoyerAvis(evt) {
        evt.preventDefault();
        var formulaire = evt.currentTarget;
        var bouton = formulaire.querySelector('.avis-btn-envoyer');
        var erreur = formulaire.querySelector('.avis-erreur');
        // Même piste que le vote : la note jointe à l'avis est retrouvée par ce jeton, et un
        // nouvel avis remplace le précédent du même auteur sur la même piste.
        var cible = terrainCible(osmId);
        var vote = mapetanqueVoteLocal(cible);
        var auteur = mapetanqueAuteurAvis();

        // FormData plutôt que JSON : envoi « simple », sans requête OPTIONS préalable, comme
        // les photos et les signalements vers le même Worker.
        var donnees = new FormData();
        donnees.set('osm_id', cible);
        donnees.set('texte', formulaire.querySelector('[name="texte"]').value);
        donnees.set('pseudo', formulaire.querySelector('[name="pseudo"]').value);
        donnees.set('_gotcha', formulaire.querySelector('[name="_gotcha"]').value);
        donnees.set('langue', currentLang);
        if (auteur) donnees.set('auteur', auteur);
        if (vote && vote.jeton) donnees.set('jeton', vote.jeton);

        bouton.disabled = true;
        erreur.hidden = true;

        fetch(MAPETANQUE_URL_AVIS_ENVOI, { method: 'POST', body: donnees })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (corps) {
                    if (r.ok) return;
                    throw new Error(r.status === 429 ? 'avis_erreur_trop'
                        : corps.erreur === 'lien interdit' ? 'avis_erreur_lien' : 'avis_erreur');
                });
            })
            .then(function () {
                mapetanqueMemoriserAvisEnvoye(cible);
                var merci = document.createElement('div');
                merci.className = 'avis-merci';
                merci.textContent = '✓ ' + t('avis_merci');
                formulaire.replaceWith(merci);
            })
            .catch(function (err) {
                var cle = /^avis_/.test(err.message) ? err.message : 'avis_erreur';
                erreur.textContent = t(cle);
                erreur.hidden = false;
                bouton.disabled = false;
            });
    }

    // --- Données arrivées après l'ouverture, ou modifiées par un vote ------------------------
    // L'écouteur se retire de lui-même une fois la fiche fermée et son contenu détaché du document.
    var EVENEMENTS = ['mapetanque:notes', 'mapetanque:avis', 'mapetanque:criteres'];
    function surDonnees(evt) {
        if (!fiche.isConnected) {
            EVENEMENTS.forEach(function (nom) { window.removeEventListener(nom, surDonnees); });
            return;
        }
        if (evt.type === 'mapetanque:criteres') {
            zoneCriteres.innerHTML = criteresHtml(tags);
        } else {
            majResume();
            if (evt.type === 'mapetanque:avis') {
                if (!panneauAvis.hidden) afficherAvis();
                else deplierAvisParDefaut();
            }
        }
    }
    EVENEMENTS.forEach(function (nom) { window.addEventListener(nom, surDonnees); });

    majResume();
    deplierAvisParDefaut();
}


// ===================== Chargement des clubs affiliés =====================
// Contrairement aux terrains, ce bloc est inconditionnel : il tourne sur la page d'accueil ET
// sur les pages province/région, pour que la couche "Afficher les clubs" y soit disponible aussi
// (voir clubsLayer/ClubsToggleControl plus haut, avec regroupement par clusters bleus). Pas de
// fetch séparé par province : les 197 clubs sont chargés en une fois, puis filtrés ici même à la
// province/région de la page courante le cas échéant (voir window.MAPETANQUE_STATS_GEO_KEY,
// défini par templates/province_template.html et templates/region_template.html juste avant le
// chargement de ce fichier — absent sur la page d'accueil, qui affiche donc bien les 197 clubs
// de Belgique sans filtrage, mais regroupés en amas aux faibles niveaux de zoom).
fetch('/data/clubs.json')
    .then(response => response.json())
    .then(data => {

        const cleGeo = window.MAPETANQUE_STATS_GEO_KEY;
        // club.province vaut la clé de province (ex. "anvers"), sauf pour les clubs de
        // Bruxelles-Capitale qui n'ont pas de province propre et n'ont que club.region ===
        // "bruxelles" (voir data/clubs.json) : la condition ci-dessous couvre les trois cas -
        // page province normale, page province Bruxelles, et page région (cleGeo vaut alors une
        // clé de région comme "flandre"/"wallonie", qui ne correspond à aucune clé de province).
        const clubsAffiches = cleGeo
            ? data.filter(function (club) { return club.province === cleGeo || club.region === cleGeo; })
            : data;

        clubsAffiches.forEach(function (club) {

            const marker = L.marker([club.lat, club.lon], { icon: clubMarkerIcon });

            brancherPopupClub(marker, club);

            marker.addTo(clubsLayer);

        });

        // Nombre de clubs par commune (clé = même nom de commune que terrainsParCommune, voir
        // data/clubs.json — champ "commune" ajouté via club/geocoder_communes_clubs.py). Construit
        // à partir de clubsAffiches (déjà filtré ci-dessus), pas de data brut : sur une page
        // province/région, seules les communes de cette zone doivent compter, cohérent avec ce
        // qui est effectivement affiché sur la carte. Exposé globalement : consommé par le script
        // inline des pages province pour compléter "Nom de la commune (x terrains)" en
        // "(x terrains, x clubs)" quand la couche clubs est affichée — voir
        // templates/province_template.html. Absent (undefined) tant que ce fetch n'a pas résolu ;
        // l'événement 'clubsChargees' ci-dessous permet de réagir à son arrivée.
        window.clubsParCommune = {};
        clubsAffiches.forEach(function (club) {
            if (!club.commune) return;
            window.clubsParCommune[club.commune] = (window.clubsParCommune[club.commune] || 0) + 1;
        });
        window.dispatchEvent(new CustomEvent('clubsChargees'));

        // Lien de partage d'un club précis (?club=1&lat=...&lon=...) : active la couche clubs
        // (si elle ne l'est pas déjà), centre la carte et ouvre son popup. Fonctionne dès le
        // départ sur toutes les pages (accueil, province, région) puisque ce bloc de chargement
        // est inconditionnel — contrairement au deep-link terrain, limité à la page d'accueil
        // (voir commentaire plus haut) : ce n'est pas un correctif d'un comportement existant,
        // juste une nouvelle fonctionnalité un peu plus large que celle des terrains.
        const urlParamsClub = new URLSearchParams(window.location.search);
        const paramClubLat = parseFloat(urlParamsClub.get('lat'));
        const paramClubLon = parseFloat(urlParamsClub.get('lon'));

        if (urlParamsClub.get('club') === '1' && !isNaN(paramClubLat) && !isNaN(paramClubLon)) {
            allerVersClub(paramClubLat, paramClubLon);
        }

    });


// ===================== Menu mobile =====================
// Comme le pied de page, le contenu du menu est construit ici : les pages n'ont qu'un
// <nav id="side-menu"> à remplir, que appliquerTraductions() reconstruit à chaque changement de
// langue. Mise en forme et animation d'ouverture : « Menu mobile » dans style.css.

const menuButton = document.getElementById("menu-button");
const sideMenu = document.getElementById("side-menu");

const ICONES_MENU = {
    fermer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path></svg>',
    fleche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'
};

function construireMenu() {
    if (!sideMenu) return;

    const prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';

    // Lien vers la page en cours : mis en évidence. Pas les ancres (« Toutes les provinces »
    // mène à une section de l'accueil, pas à une page).
    function courant(href) {
        if (href.includes('#')) return '';
        return new URL(href, window.location.href).pathname === window.location.pathname ? ' aria-current="page"' : '';
    }
    function pastille(href, texte) {
        return `<li><a href="${href}"${courant(href)}>${texte}</a></li>`;
    }
    function lienPage(href, texte) {
        return `<li><a href="${href}"${courant(href)}>${texte}${ICONES_MENU.fleche}</a></li>`;
    }

    const langues = LANGUES_DISPONIBLES.map(function (langue) {
        const actif = langue === currentLang ? ' aria-current="true"' : '';
        return `<a href="${urlPageDansLangue(langue)}" data-lang="${langue}" hreflang="${langue}"${actif}>${langue.toUpperCase()}</a>`;
    }).join('');

    sideMenu.innerHTML = `
        <img class="menu-filigrane" src="/images/mapetanque-boule-pleine.svg" alt="">
        <div class="menu-defilement">
            <div class="menu-entete">
                <a href="${prefixe}"><img class="menu-logo" src="/images/mapetanque-logo-fonce.svg" width="226" height="39" alt="Mapetanque"></a>
                <button type="button" class="menu-fermer" aria-label="${t('close_menu')}">${ICONES_MENU.fermer}</button>
            </div>

            <div class="menu-section menu-apparait" style="--delai: 0.22s">
                <h2 class="menu-titre">${t('pied_explorer')}</h2>
                <ul class="menu-pastilles">
                    ${pastille(prefixe + 'region-wallonie.html', t('geo_region_wallonie'))}
                    ${pastille(prefixe + 'region-flandre.html', t('geo_region_flandre'))}
                    ${pastille(prefixe + 'province-bruxelles.html', t('geo_region_bruxelles'))}
                    ${pastille(prefixe + '#provinces-section', t('pied_toutes_provinces'))}
                </ul>
            </div>

            <div class="menu-section menu-section-liens menu-apparait" style="--delai: 0.3s">
                <h2 class="menu-titre">${t('pied_le_site')}</h2>
                <ul class="menu-liens">
                    ${lienPage(prefixe + 'comment-jouer.html', t('menu_comment_jouer'))}
                    ${lienPage(prefixe + 'compteur.html', t('menu_compteur'))}
                    ${lienPage(prefixe + 'la-petanque.html', t('menu_la_petanque'))}
                    ${lienPage(prefixe + 'a-propos.html', t('menu_about'))}
                </ul>
            </div>

            <div class="menu-langues menu-apparait" style="--delai: 0.4s">
                <span class="menu-titre">${t('pied_langue')}</span>
                <div class="menu-langues-liste">${langues}</div>
            </div>
        </div>`;
}

function ouvrirMenu() {
    // Le cercle d'ouverture part du centre du bouton burger
    const bouton = menuButton.getBoundingClientRect();
    sideMenu.style.setProperty('--menu-x', (bouton.left + bouton.width / 2) + 'px');
    sideMenu.style.setProperty('--menu-y', Math.max(0, bouton.top + bouton.height / 2) + 'px');

    sideMenu.classList.add('open');
    document.documentElement.classList.add('menu-ouvert');
    menuButton.setAttribute('aria-expanded', 'true');
    sideMenu.querySelector('.menu-fermer').focus({ preventScroll: true });
}

function fermerMenu() {
    if (!sideMenu.classList.contains('open')) return;
    sideMenu.classList.remove('open');
    document.documentElement.classList.remove('menu-ouvert');
    menuButton.setAttribute('aria-expanded', 'false');
}

if (menuButton && sideMenu) {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.addEventListener('click', ouvrirMenu);

    sideMenu.addEventListener('click', function (e) {
        if (e.target.closest('.menu-fermer')) {
            fermerMenu();
            menuButton.focus();
            return;
        }

        const lien = e.target.closest('a');
        if (!lien) return;

        // Choix de la langue : mémorisé avant de suivre le lien, comme dans le pied de page
        if (lien.dataset.lang) {
            try { localStorage.setItem('mapetanque_lang', lien.dataset.lang); } catch (erreur) {}
        }

        // Le menu se referme aussi pour les liens vers une section de la page en cours
        // (« Toutes les provinces » depuis l'accueil), sinon il cacherait le défilement.
        fermerMenu();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sideMenu.classList.contains('open')) {
            fermerMenu();
            menuButton.focus();
        }
    });
}


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
    return uneDecimale(nombreTerrains / superficie * 100) + '/100km²';
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
        '<svg viewBox="202 32 553 580" class="stats-region-tile-watermark" aria-hidden="true"><path fill-rule="evenodd" fill="currentColor" d="M679,135 630,207 619,243 619,261 627,283 664,328 677,349 669,331 642,300 625,275 620,260 620,245 624,228 635,204 674,147ZM369,114 363,125 368,142 375,148 399,156 414,165 408,149 393,135 396,128 394,115 384,109ZM380,111 385,111 384,114 389,117 375,119 371,125 372,132 379,141 396,149 391,152 390,149 382,149 366,134 368,132 365,130 365,124ZM677,70 657,60 634,58 617,61 597,72 584,86 574,104 562,167 558,177 547,190 554,192 575,184 573,217 584,237 582,214 585,200 606,159 609,161 609,196 622,170 624,137 640,134 653,125 642,115 643,104 651,97 666,96 676,104 681,114 677,102 668,93 681,101 686,113 686,129 682,142 639,206 631,222 625,246 626,265 632,278 674,330 683,347 682,365 680,367 678,363 670,371 652,367 634,351 588,280 552,241 505,214 523,206 538,208 540,205 532,197 532,190 536,187 530,186 526,178 534,183 540,183 541,186 550,177 549,175 538,179 533,175 545,166 539,165 535,160 534,134 546,125 550,117 550,111 543,118 537,118 533,114 544,94 544,78 540,68 524,76 466,76 443,92 428,94 425,104 422,99 425,95 421,96 422,109 418,115 417,136 425,134 435,140 437,155 433,165 420,176 405,178 395,165 378,164 369,171 366,188 360,187 347,172 336,147 336,129 351,110 345,101 346,85 343,78 331,93 321,94 318,105 313,101 313,86 306,85 300,75 289,67 285,67 289,84 282,90 287,103 284,108 281,108 273,98 247,94 258,110 257,121 260,127 274,128 278,135 271,140 259,140 257,148 242,142 245,155 254,162 267,165 284,157 288,162 287,171 281,177 269,181 277,185 293,185 293,193 288,201 273,201 275,205 288,212 283,216 270,213 274,226 285,232 306,227 307,233 302,241 328,237 322,262 314,272 300,272 295,265 295,256 286,274 290,287 302,296 323,296 333,292 345,280 367,267 374,281 368,290 346,307 315,322 303,322 298,317 298,304 286,305 277,295 265,293 272,307 267,315 271,330 266,333 253,328 246,337 233,342 227,349 246,350 254,358 267,350 273,353 268,362 255,367 250,383 251,397 264,383 272,389 280,388 284,369 288,364 291,365 292,379 296,384 289,399 306,393 320,378 321,359 329,360 330,374 334,379 335,370 345,352 349,350 354,354 351,344 356,346 358,352 354,363 352,358 351,371 353,372 361,359 368,340 372,345 372,365 383,344 387,327 393,326 395,344 401,331 401,321 407,321 404,316 406,314 411,318 410,327 405,330 407,338 414,313 417,312 419,315 417,306 423,311 422,320 418,320 422,331 432,294 436,295 433,290 436,289 440,293 440,301 437,301 439,309 448,291 450,273 506,292 522,307 519,310 508,311 523,312 526,315 519,316 522,322 520,332 514,318 510,317 514,326 511,335 508,322 502,319 507,326 504,337 501,324 494,322 500,329 499,337 494,328 483,327 456,349 451,350 479,323 500,312 490,315 476,323 442,355 407,357 391,362 347,404 331,406 321,402 320,415 326,422 335,425 348,424 373,412 388,426 391,435 397,441 394,453 382,464 366,468 356,466 354,452 345,451 329,441 319,441 332,458 327,467 339,478 334,483 313,480 309,489 298,496 290,508 311,505 314,510 319,511 329,504 334,506 334,510 322,520 325,529 323,542 330,554 335,537 343,536 347,532 350,520 354,517 359,521 359,532 363,536 357,552 368,548 385,524 381,512 385,504 395,523 394,514 399,493 402,498 402,515 408,504 410,488 414,494 415,507 418,509 417,502 427,476 429,492 434,499 434,491 446,458 452,458 457,462 450,480 451,486 468,469 475,458 474,448 450,420 446,405 452,395 471,388 515,389 526,425 528,443 524,448 517,449 506,437 504,448 507,456 518,466 539,468 546,465 555,455 565,459 576,459 609,449 612,456 609,480 604,489 590,501 583,500 573,484 561,487 549,481 538,481 549,498 547,509 557,512 560,519 556,522 538,522 520,549 521,555 530,548 541,545 544,551 549,553 567,537 568,542 563,550 567,558 567,568 572,578 583,586 580,564 587,564 593,560 592,547 596,541 601,544 603,558 608,562 605,577 620,569 630,549 627,538 635,531 637,508 642,509 649,528 649,516 656,503 663,519 668,522 668,481 673,484 677,500 682,504 682,479 674,460 678,450 682,449 689,455 691,475 697,484 696,469 702,443 695,433 687,430 667,432 657,422 642,418 627,407 603,401 610,379 610,355 650,396 703,411 708,420 710,440 716,445 716,402 701,386 715,366 717,343 711,326 694,300 694,292 702,280 713,278 721,285 720,278 712,267 694,265 682,274 675,291 669,279 671,256 681,244 695,238 716,242 711,236 697,229 678,230 654,242 693,208 714,184 726,157 730,128 713,161 724,145 724,151 705,180 678,204 660,211 677,199 661,205 689,153 699,121 695,92ZM572,559 575,564 575,576 571,574 571,568 568,566ZM602,538 606,539 609,551 625,552 607,557ZM572,533 575,536 572,549 576,555 567,552ZM540,534 540,537 528,542 533,533ZM541,529 546,533 549,543 554,546 550,550 544,544ZM325,523 334,524 344,532 339,534ZM359,518 363,519 365,526 382,526 363,531ZM550,504 562,507 566,511 565,517ZM641,500 648,506 647,515 643,505 638,503ZM657,491 664,495 663,513ZM315,482 319,496 317,510 314,507 312,487ZM412,481 418,487 416,497ZM668,474 676,476 678,490ZM428,468 435,474 432,487ZM453,453 461,455 464,461 456,475 459,462ZM613,449 618,458 617,479 608,495 596,503 613,477ZM507,447 509,446 522,460 540,463 533,467 522,466 512,458ZM326,446 331,446 338,456 335,458ZM402,443 403,449 398,459 387,469 378,471 378,468 385,466 394,458ZM677,444 683,442 693,448 693,465 689,451 684,447 677,447ZM645,441 654,462 638,490 638,482 648,464 647,455 642,447 642,442ZM546,410 552,422 562,430 575,430 588,422 588,439 580,452 566,455 561,451 576,448 584,433 576,436 559,435 548,424ZM434,409 442,433 424,457 425,449 437,432 432,415ZM323,404 329,421 322,415ZM699,403 706,405 713,414 712,437 708,415ZM376,409 394,421 408,422 418,415 405,416 397,412 389,401 390,397 397,407 412,412 426,407 422,419 408,427 388,423ZM258,368 265,370 275,381 281,383 273,386ZM294,367 297,368 299,376 317,378 297,381ZM421,359 390,370 354,406 351,405 390,365 407,359ZM614,354 616,353 640,378 656,390 689,402 675,403 652,393 629,373ZM370,335 377,340 377,351 374,356ZM255,331 257,348 254,354 252,333ZM528,312 532,318 532,333 523,360 523,387 535,430 535,442 532,447 530,427 520,396 517,376 519,357 529,325ZM519,297 542,305 531,307ZM504,288 534,291 517,295ZM378,289 372,297 348,315 328,323 320,323 347,310 376,287ZM484,280 487,278 500,282 513,279 525,281 506,286 493,286ZM492,272 482,278 463,275 465,272ZM451,270 453,267 468,269 456,273ZM704,266 704,269 690,277 681,293 680,288 685,276 693,268ZM291,264 294,280 300,292 292,286 289,279ZM494,254 485,250 462,252 456,247 486,245ZM696,232 676,237 653,252 661,242 678,231ZM436,225 437,235 431,260 445,244 450,229 452,237 432,274 426,258ZM458,225 488,227 493,234 485,231 464,232ZM373,211 361,232 354,266 347,276 355,233 362,221ZM297,206 297,212 286,220 285,217ZM477,205 479,203 488,214 497,216 494,219 486,219ZM405,202 407,214 402,227ZM392,199 392,221 372,254 372,245 388,218ZM367,196 343,219 330,257 319,273 337,219 350,204ZM492,196 513,209 500,207ZM412,194 429,227 424,258 421,263 411,250 395,250 390,256 390,267 405,283 396,288 388,288 377,280 370,264 374,263 384,281 396,283 385,266 389,249 398,243 407,243 420,252 424,239 424,225 411,202ZM522,194 524,193 535,206 527,205ZM428,189 435,206 434,214 426,197ZM355,185 356,192 346,203ZM297,184 298,197 292,205 286,206 285,204 292,200ZM436,181 439,183 443,201 442,210 435,190ZM349,179 349,188 340,197ZM445,170 448,173 451,191 449,203 444,180ZM343,170 345,178 339,187ZM380,165 371,186 371,173ZM338,163 339,172 331,181ZM453,154 461,177 460,191 452,164ZM246,154 262,158 261,161 255,161ZM463,145 471,168 470,181 462,156ZM441,143 441,163 425,177 438,159ZM262,140 270,163 266,162 261,149ZM475,135 483,163 480,171 473,140ZM593,119 594,129 585,170 591,169 580,189 577,222 574,213 575,189ZM427,107 422,123 424,131 420,133 419,118ZM627,89 632,90 620,104 620,120 631,135 623,133 615,120 616,102ZM535,83 526,104 526,92ZM462,82 465,93 493,114 493,124 486,115 480,117 484,119 480,122 468,122 463,119 456,121 460,116 462,102 465,103 464,112 468,117 477,109 462,97 459,89ZM618,78 608,96 605,108 606,124 615,158 615,175 612,179 600,113 607,88ZM612,66 593,85 582,103 571,156 560,179 579,99 587,86 601,72Z"/></svg>',
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
    window.mapetanqueRevelerTerrain(lat, lon);
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

// Centre la carte sur un club précis et ouvre son popup (si le marqueur correspondant est trouvé
// dans les données chargées), puis remonte en haut de page pour voir la carte. Réutilisée par le
// lien de partage (?club=1&lat=&lon=). Même schéma que allerVersTerrain (zoomToShowLayer, pas un
// simple setView) depuis que clubsLayer est un L.markerClusterGroup : le marqueur ciblé peut être
// replié dans un amas selon le zoom courant, zoomToShowLayer s'en charge (dé-zoome/zoome jusqu'à
// ce que le marqueur soit visible individuellement) avant d'ouvrir son popup.
function allerVersClub(lat, lon) {
    let layerCorrespondant = null;

    if (clubsLayer) {
        clubsLayer.eachLayer(function (layer) {
            if (layerCorrespondant) return;
            const pos = layer.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001) {
                layerCorrespondant = layer;
            }
        });
    }

    // S'assure que la couche clubs est active, sinon le marqueur ciblé n'existe pas encore sur la carte
    if (clubsLayer && !map.hasLayer(clubsLayer)) {
        map.addLayer(clubsLayer);
        if (clubsToggleCheckbox) clubsToggleCheckbox.checked = true;
        localStorage.setItem(STORAGE_KEY_CLUBS_VISIBLE, 'true');
        window.dispatchEvent(new CustomEvent('clubsAffichageChange', { detail: { visible: true } }));
    }

    if (layerCorrespondant) {
        clubsLayer.zoomToShowLayer(layerCorrespondant, function () {
            layerCorrespondant.openPopup();
        });
    } else {
        // Club introuvable (peut-être retiré depuis) : on centre quand même sur les coordonnées
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
        nomSpan.textContent = window.nomCommuneAffiche(nom, currentLang);

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
// Téléchargé seulement si la page affiche cette liste (#stats-geo-tree) : l'accueil et les pages
// province/région ne l'ont plus.
const arbreInitial = document.getElementById('stats-geo-tree');
if (arbreInitial) {
    arbreInitial.innerHTML = '<p class="stats-geo-loading">' + translations[currentLang].stats_geo_loading + '</p>';

fetch('/data/stats_geo.json')
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
}

// ===================== Chiffres du pied de page =====================

let terrainsCount = null;
let lastUpdateRaw = null; // objet Date brut, reformaté selon la langue active

// Nombre de terrains avec au moins une photo (pied de page) — dépend de deux chargements distincts
// (terrains.geojson ET data/photos_mapillary.json, voir plus bas dans ce fichier), qui peuvent
// se terminer dans n'importe quel ordre : on ne calcule qu'une fois les deux disponibles.
let terrainsAvecPhotoCount = null;
let terrainsFeaturesPourPhotos = null;
let photosMapillaryChargees = false;

function calculerTerrainsAvecPhoto() {
    if (!terrainsFeaturesPourPhotos || !photosMapillaryChargees) return;

    // Même critère "a une photo" que dans construireContenuPopupTerrain (deux sources
    // combinées) : tag OSM déjà résolu en photo_url, ou entrée dans photos_mapillary.json.
    terrainsAvecPhotoCount = terrainsFeaturesPourPhotos.filter(function (feature) {
        const tags = feature.properties;
        const photosValidees = tags.osm_id ? (window.photosMapillaryParOsmId[tags.osm_id] || []) : [];
        return !!tags.photo_url || photosValidees.length > 0;
    }).length;

    mettreAJourStats();
}

// Pose les chiffres dans le pied de page construit par construirePied(). Les « … » d'attente y
// restent tant qu'un chargement n'a pas abouti ; la ligne de date reste masquée sans date.
function mettreAJourStats() {
    const nbTerrains = document.getElementById('pied-nb-terrains');
    if (!nbTerrains) return;

    if (terrainsCount !== null) {
        nbTerrains.textContent = formaterNombre(terrainsCount);
    }
    if (terrainsAvecPhotoCount !== null) {
        document.getElementById('pied-nb-photos').textContent = formaterNombre(terrainsAvecPhotoCount);
    }

    if (lastUpdateRaw !== null) {
        const locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
        let date = lastUpdateRaw.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
        // « 1er octobre » plutôt que « 1 octobre » en français
        if (currentLang === 'fr' && lastUpdateRaw.getDate() === 1) date = date.replace(/^1 /, '1er ');
        const maj = document.getElementById('pied-maj');
        maj.textContent = t('pied_maj')(date);
        maj.hidden = false;
    }
}

function afficherNombreTerrains(count) {
    terrainsCount = count;
    mettreAJourStats();
    mettreAJourBandeauStats();
}


// ===================== Retour à l'accueil (clic sur le logo) =====================

// Remet la page dans l'état où elle se trouve au tout premier chargement : vue initiale de la
// carte, plus aucune recherche/géolocalisation active, panneaux ouverts refermés, et section
// statistiques réinitialisée (accordéons refermés, filtre commune vidé — construireStatsGeo()
// reconstruit ce bloc de zéro, donc ce reset est automatique).
function revenirAccueil() {

    cadrerSurBelgique();

    if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
    }

    if (locateMarker) {
        map.removeLayer(locateMarker);
        locateMarker = null;
    }

    userPosition = null;
    terrainLePlusProche = null;
    mettreAJourFlecheTerrainProche();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    effacerMessageRecherche();

    fermerPartage();
    if (sideMenu) fermerMenu();

    if (typeof definirModePleinEcran === 'function') {
        definirModePleinEcran(false);
    }

    construireStatsGeo();
}

const brandLink = document.querySelector('.brand-link');
if (brandLink) {
    brandLink.addEventListener('click', revenirAccueil);
}


// ===================== Plein écran de la carte =====================

const mapView = document.querySelector('.map-view');

// Bascule CSS plutôt que l'API plein écran native du navigateur : cette dernière n'est pas
// fiable sur Safari iOS, alors qu'une part importante des visiteurs consulte le site sur mobile.
function definirModePleinEcran(actif) {
    mapView.classList.toggle('fullscreen-active', actif);
    document.body.classList.toggle('fullscreen-lock', actif);
    ajusterGlissementCarte();

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.innerHTML = actif ? ICON_MINIMIZE : ICON_MAXIMIZE;
        fullscreenBtn.dataset.i18nAria = actif ? 'fullscreen_exit' : 'fullscreen_enter';
        fullscreenBtn.setAttribute('aria-label', t(fullscreenBtn.dataset.i18nAria));
    }

    // Laisse le CSS recalculer la taille du conteneur avant que Leaflet ne s'y adapte
    setTimeout(function () { map.invalidateSize(); }, 50);
}

// Touche Échap pour quitter, comme le ferait une vraie API plein écran de navigateur
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mapView.classList.contains('fullscreen-active')) {
        definirModePleinEcran(false);
    }
});


// ===================== Initialisation =====================

appliquerTraductions();
