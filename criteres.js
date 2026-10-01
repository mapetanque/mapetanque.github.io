// ===================== Règles des critères d'environnement =====================
// Partagées par le site (pastilles des fiches et filtres de la carte, voir script.js) et par la
// page admin (filtres de l'onglet Terrains) : les seuils ne sont écrits qu'ici. Ce fichier doit
// donc être chargé AVANT script.js sur les pages à carte (index.html dans les quatre langues,
// gabarits province et région) et dans admin.html.
//
// Les critères OSM sont calculés chaque semaine par scripts/enrichir_environnement.py et rangés
// dans la propriété `env` de chaque terrain (distances en mètres ; clé absente = rien trouvé dans
// le rayon interrogé), plus deux tags du terrain lui-même (éclairage, toit). Les seuils sont
// appliqués ici, pas dans la collecte : on peut les ajuster sans rien recalculer.

// Routes trop proches pour « Au calme » : distance minimale par type, en mètres. Une route absente
// de env.routes est assez loin (rien trouvé dans le rayon interrogé).
const SEUILS_ROUTES_CALME = {
    motorway: 200, trunk: 200, primary: 100, secondary: 75,
    tertiary: 50, residential: 20, unclassified: 20
};

// Plans d'eau retenus pour « Au bord de l'eau » (à 100 m au plus). Les ruisseaux et les petits
// plans d'eau (suffixe _petit, moins de 0,5 ha) sont exclus : trop nombreux et souvent trompeurs.
const TYPES_EAU_BORD = ['riviere', 'canal', 'lac', 'etang', 'plan_eau', 'reservoir', 'douves', 'mer', 'plage'];

// « À proximité » : clé de env, seuil en mètres, dans l'ordre d'affichage des fiches.
const CRITERES_PROXIMITE = [
    { cle: 'jeux', seuil: 100 },
    { cle: 'wc', seuil: 200 },
    { cle: 'eau_potable', seuil: 200 },
    { cle: 'parking', seuil: 300 },
    { cle: 'arret', seuil: 300 },
    { cle: 'voie_verte', seuil: 200 }
];

// Critères des joueurs (liste fermée, voir le Worker mapetanque-notes), dans l'ordre d'affichage.
// Sur le site, une pastille n'apparaît qu'à partir de CONFIRMATIONS_MIN appareils distincts.
const CRITERES_JOUEURS = ['ombrage', 'abri_pluie', 'plusieurs_pistes', 'bien_entretenu'];
const CONFIRMATIONS_MIN = 2;

// Critères OSM proposés comme filtres, dans l'ordre des panneaux de filtres.
const FILTRES_SUR_PLACE = ['banc', 'eclaire', 'nature', 'calme', 'eau', 'abri_pluie'];
const FILTRES_PROXIMITE = ['jeux', 'wc', 'eau_potable', 'voie_verte', 'parking', 'arret'];

// Toit d'après les tags OSM du terrain lui-même.
function estAbriteOsm(tags) {
    return tags.covered === 'yes' || tags.covered === 'partial' || tags.indoor === 'yes'
        || ['yes', 'roof', 'public', 'sports_hall', 'sports_centre'].indexOf(tags.building) !== -1;
}

// Liste des critères OSM « Sur place » présents, dans l'ordre d'affichage.
function criteresOsmSurPlace(tags) {
    const env = tags.env || null;
    const presents = [];

    if (env && typeof env.banc === 'number' && env.banc <= 10) presents.push('banc');
    if (tags.lit === 'yes') presents.push('eclaire');

    // Nature : dans un bois, une réserve, ou un parc d'au moins 1 ha (les zones de loisirs, en
    // pratique des terrains de sport, ne comptent pas).
    const nature = (env && env.nature) || {};
    if ('bois' in nature || 'reserve' in nature || (nature.parc || 0) >= 1) presents.push('nature');

    // Au calme : seulement si la collecte a tourné pour ce terrain (sinon on ne sait rien).
    if (env) {
        const routes = env.routes || {};
        const bruyant = Object.keys(SEUILS_ROUTES_CALME).some(function (type) {
            return typeof routes[type] === 'number' && routes[type] < SEUILS_ROUTES_CALME[type];
        });
        if (!bruyant) presents.push('calme');
    }

    const eau = (env && env.eau) || {};
    if (TYPES_EAU_BORD.some(function (type) { return typeof eau[type] === 'number' && eau[type] <= 100; })) {
        presents.push('eau');
    }
    return presents;
}

// Liste des critères OSM « À proximité » présents : [{ cle, distance }].
function criteresOsmProximite(tags) {
    const env = tags.env || {};
    return CRITERES_PROXIMITE
        .filter(function (c) { return typeof env[c.cle] === 'number' && env[c.cle] <= c.seuil; })
        .map(function (c) { return { cle: c.cle, distance: env[c.cle] }; });
}

// Tous les critères OSM présents pour un terrain (clés de FILTRES_SUR_PLACE et
// FILTRES_PROXIMITE), calculés une fois par terrain.
const cacheCriteresFiltres = new WeakMap();
function criteresFiltrables(props) {
    let criteres = cacheCriteresFiltres.get(props);
    if (!criteres) {
        criteres = new Set(criteresOsmSurPlace(props));
        if (estAbriteOsm(props)) criteres.add('abri_pluie');
        criteresOsmProximite(props).forEach(function (c) { criteres.add(c.cle); });
        cacheCriteresFiltres.set(props, criteres);
    }
    return criteres;
}
