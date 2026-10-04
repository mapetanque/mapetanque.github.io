// Page carte (carte.html) : la liste des terrains de la zone affichée, et l'arrivée sur la page.
//
// Liste : à gauche de la carte sur ordinateur ; sur téléphone, elle s'ouvre par-dessus la carte
// avec « Voir la liste » (le bouton retour du téléphone la referme). Elle suit la carte : à chaque
// déplacement, les lieux visibles, du plus proche au plus lointain (de la position cherchée ou
// localisée si elle est à l'écran, sinon du centre de la carte), par paquets de PAR_PAQUET. Un
// lieu, ce sont les pistes voisines réunies, comme sur les pages commune : mêmes tuiles, mêmes
// données (data/recherche.json, écrit par scripts/generer_communes.py). Les filtres de la carte
// s'appliquent aussi à la liste.
//
// Un clic sur une tuile ouvre la fiche sans bouger la carte (la liste resterait sinon sous la
// fiche, réordonnée) : voir ouvrirFicheSurPlace dans script.js.
//
// Arrivée sur la page, selon l'adresse :
//   ?commune=<slug>[&localite=<nom>] : carte cadrée sur les terrains de la commune (du village),
//                                      avec la fiche ouverte quand il n'y a qu'un lieu ;
//   ?province=<clé>, ?region=<clé>     : carte cadrée sur les terrains de la province, de la
//                                      région (bouton « Voir sur la carte » de leurs pages) ;
//   ?q=<texte>                       : recherche d'adresse, comme Entrée dans la barre ;
//   ?moi=1                           : « Me localiser » ;
//   ?lat=…&lon=… (terrain), ?club=1&lat=…&lon=… (club) : déjà traités par script.js.
// Chargé après script.js, dont il utilise les fonctions et variables (map, markers, t…).

(function () {
    var liste = document.getElementById('carte-liste');
    var tuiles = document.getElementById('carte-liste-tuiles');
    var compte = document.getElementById('carte-liste-compte');
    var compteLieux = document.getElementById('carte-liste-lieux');
    var boutonPlus = document.getElementById('carte-liste-plus');
    if (!liste || !tuiles) return;

    var PAR_PAQUET = 24;
    var NB_PASTILLES = 4;   // au-delà, la tuile s'allonge trop dans une colonne étroite

    var index = null;          // data/recherche.json, voir chargerIndexRecherche dans script.js
    var proprietes = {};       // osm_id -> propriétés du terrain, pour les filtres
    var visibles = [];         // lieux de la zone, triés
    var montres = 0;           // combien sont affichés

    // ----- Tuiles -----

    function echapper(texte) {
        return echapperAvis(String(texte));
    }

    function nomLieu(l) {
        if (l.l) return nomLocaliteRecherche(l.l);
        var c = index.communes[l.c];
        return c ? nomCommuneRecherche(c) : '';
    }

    function pastille(cle, distance) {
        return '<span class="commune-pastille">' + (PICTOS[cle] || '') + echapper(t('critere_' + cle))
            + (distance ? ' · ' + distance : '') + '</span>';
    }

    function tuileHtml(l, distanceKm) {
        var photo;
        if (l.ph) {
            var credit = l.ph[1] ? echapper(l.ph[1]) + ' · ' + l.ph[2] : l.ph[2];
            photo = '<img src="' + echapper(l.ph[0]) + '" alt="" loading="lazy" width="320" height="180">'
                + '<span class="commune-terrain-credit">' + credit + '</span>';
        } else {
            photo = '<img src="/images/pas-de-photo.webp" alt="" loading="lazy" width="320" height="180" class="sans-photo">';
        }

        var details = [nomLieu(l)];
        if (l.p > 1) details.push(t('commune_pistes').replace('{n}', l.p));
        if (l.s && translations[currentLang]['commune_surface_' + l.s]) details.push(t('commune_surface_' + l.s));
        if (distanceKm !== null) details.push(t('carte_a_distance').replace('{d}', formaterDistanceKm(distanceKm)));

        var pastilles = (l.sp || []).map(function (cle) { return pastille(cle, ''); })
            .concat((l.px || []).map(function (p) { return pastille(p[0], distanceCritere(p[1])); }))
            .slice(0, NB_PASTILLES);

        var resume = window.mapetanqueResumeNote(l.o);
        var note = resume
            ? '<span class="commune-terrain-note">' + window.mapetanqueEtoileHtml(resume.moyenne) + ' ' + resume.texte + '</span>'
            : '';

        return '<a class="commune-terrain carte-tuile" href="' + window.location.pathname + '?lat=' + l.lat + '&amp;lon=' + l.lon
            + '" data-osm="' + l.o + '">'
            + '<span class="commune-terrain-photo">' + photo + '</span>'
            + '<span class="commune-terrain-texte">'
            + '<h2 class="commune-terrain-nom">' + echapper(titreLieuRecherche(l)) + '</h2>'
            + note
            + '<span class="commune-terrain-details">' + details.map(echapper).join(' · ') + '</span>'
            + (pastilles.length ? '<span class="commune-pastilles">' + pastilles.join('') + '</span>' : '')
            + '</span></a>';
    }

    // ----- Lieux de la zone affichée -----

    function passe(l) {
        if (!filtresActifs.size) return true;
        var props = proprietes[l.o];
        return !!props && passeLesFiltres(props);
    }

    function texteCompte(nbTerrains) {
        if (!nbTerrains) return t('carte_liste_compte_0');
        if (nbTerrains === 1) return t('carte_liste_compte_1');
        return t('carte_liste_compte_n').replace('{n}', formaterNombre(nbTerrains));
    }

    // Une tuile par lieu, alors que le compteur compte les terrains (pistes), comme partout sur
    // le site : « Répartis sur 12 lieux » dit combien de tuiles suivent, comme l'intro des pages
    // commune. Rien quand chaque lieu n'a qu'une piste (les deux nombres sont alors égaux).
    function texteLieux(nbLieux, nbTerrains) {
        if (nbLieux === nbTerrains) return '';
        var unite = nbLieux === 1 ? t('commune_lieu_singulier') : t('commune_lieux_pluriel');
        return t('carte_liste_repartis').replace('{lieux}', formaterNombre(nbLieux) + ' ' + unite);
    }

    // Repère du tri et des distances : la position cherchée ou localisée quand elle est à
    // l'écran (distances affichées), sinon le centre de la carte (pas de distance affichée).
    function repere(zone) {
        if (userPosition && zone.contains(userPosition)) return { point: userPosition, distances: true };
        var centre = map.getCenter();
        return { point: [centre.lat, centre.lng], distances: false };
    }

    function calculer() {
        var zone = map.getBounds();
        var ref = repere(zone);
        visibles = index.lieux
            .filter(function (l) { return zone.contains([l.lat, l.lon]) && passe(l); })
            .map(function (l) {
                return { lieu: l, km: calculDistance(ref.point[0], ref.point[1], l.lat, l.lon) };
            })
            .sort(function (a, b) { return a.km - b.km; });
        visibles.distances = ref.distances;
    }

    function afficher(nombre) {
        montres = Math.min(nombre, visibles.length);
        var nbTerrains = visibles.reduce(function (n, v) { return n + v.lieu.p; }, 0);
        compte.textContent = texteCompte(nbTerrains);
        compteLieux.textContent = texteLieux(visibles.length, nbTerrains);

        if (!visibles.length) {
            tuiles.innerHTML = '<p class="carte-liste-vide">' + echapper(t('carte_liste_vide_aide')) + '</p>';
        } else {
            tuiles.innerHTML = visibles.slice(0, montres).map(function (v) {
                return tuileHtml(v.lieu, visibles.distances ? v.km : null);
            }).join('');
        }
        boutonPlus.hidden = montres >= visibles.length;
    }

    function rafraichir() {
        if (!index) return;
        calculer();
        tuiles.scrollTop = 0;
        liste.scrollTop = 0;
        afficher(PAR_PAQUET);
    }

    boutonPlus.addEventListener('click', function () {
        afficher(montres + PAR_PAQUET);
    });

    map.on('moveend', rafraichir);
    window.addEventListener('mapetanque:filtres', rafraichir);
    // Notes arrivées du Worker : mêmes tuiles, avec leurs étoiles
    window.addEventListener('mapetanque:notes', function () {
        if (index) afficher(montres || PAR_PAQUET);
    });

    // ----- Fiche d'un terrain, sans bouger la carte (ouvrirFicheSurPlace, script.js) -----

    tuiles.addEventListener('click', function (e) {
        var lien = e.target.closest('.carte-tuile');
        if (!lien || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var adresse = new URL(lien.href).searchParams;
        ouvrirFicheSurPlace(lien.dataset.osm, parseFloat(adresse.get('lat')), parseFloat(adresse.get('lon')));
    });

    // Survol d'une tuile : son marqueur (ou l'amas qui le contient) ressort sur la carte.
    var survole = null;

    function marqueurDuTerrain(osmId) {
        var trouve = null;
        if (markers) {
            markers.eachLayer(function (couche) {
                if (!trouve && couche.feature && couche.feature.properties.osm_id === osmId) trouve = couche;
            });
        }
        return trouve;
    }

    function finSurvol() {
        if (survole) survole.classList.remove('carte-marqueur-survol');
        survole = null;
    }

    tuiles.addEventListener('mouseover', function (e) {
        var lien = e.target.closest('.carte-tuile');
        if (!lien) return;
        var couche = marqueurDuTerrain(lien.dataset.osm);
        var parent = couche ? markers.getVisibleParent(couche) : null;
        var element = parent && parent.getElement ? parent.getElement() : null;
        if (element === survole) return;
        finSurvol();
        if (element) {
            element.classList.add('carte-marqueur-survol');
            survole = element;
        }
    });
    tuiles.addEventListener('mouseleave', finSurvol);
    map.on('movestart', finSurvol);

    // ----- Liste par-dessus la carte (téléphone) -----

    var voirListe = document.getElementById('carte-voir-liste');
    var fermerListe = document.getElementById('carte-liste-fermer');

    function listeOuverte() {
        return document.body.classList.contains('carte-liste-ouverte');
    }

    if (voirListe) {
        voirListe.addEventListener('click', function () {
            document.body.classList.add('carte-liste-ouverte');
            history.pushState({ carteListe: true }, '');
            liste.scrollTop = 0;
        });
    }
    if (fermerListe) {
        fermerListe.addEventListener('click', function () {
            if (history.state && history.state.carteListe) history.back();
            else document.body.classList.remove('carte-liste-ouverte');
        });
    }
    window.addEventListener('popstate', function () {
        if (listeOuverte() && !(history.state && history.state.carteListe)) {
            document.body.classList.remove('carte-liste-ouverte');
        }
    });

    // ----- Arrivée sur la page -----

    var parametres = new URLSearchParams(window.location.search);
    var champ = document.getElementById('searchInput');

    function arriveeCommune(slug, localite) {
        var c = index.communes[slug];
        if (!c) return;
        var lieux = (index.lieuxParCommune[slug] || []).filter(function (l) {
            return !localite || l.l === localite;
        });
        var nom = localite ? nomLocaliteRecherche(localite) : nomCommuneRecherche(c);
        if (champ) champ.value = nom;
        if (lieux.length) {
            cadrerSurLieux(lieux);
            // Un seul lieu (commune sans page) : sa fiche, comme l'ouvrait la page province
            if (lieux.length === 1) ouvrirFicheSurPlace(lieux[0].o, lieux[0].lat, lieux[0].lon);
        } else {
            // Commune sans terrain : la carte autour d'elle, avec la flèche vers le plus proche
            montrerLieuRecherche(c.lat, c.lon, nom, [[c.lat - 0.04, c.lon - 0.06], [c.lat + 0.04, c.lon + 0.06]]);
        }
    }

    // Province (Bruxelles compte comme telle, clé « bruxelles ») ou région : ses communes, puis
    // leurs lieux. Le champ de recherche reste vide : ce n'est pas une recherche.
    function arriveeZone(cle, champCommune) {
        var lieux = [];
        Object.keys(index.communes).forEach(function (slug) {
            if (index.communes[slug][champCommune] === cle) lieux = lieux.concat(index.lieuxParCommune[slug] || []);
        });
        if (lieux.length) cadrerSurLieux(lieux);
    }

    var chargement = Promise.all([
        chargerIndexRecherche(),
        terrainsGeojson.then(function (data) {
            data.features.forEach(function (f) { proprietes[f.properties.osm_id] = f.properties; });
        })
    ]);

    chargement.then(function (resultats) {
        index = resultats[0];
        if (parametres.get('commune')) {
            arriveeCommune(parametres.get('commune'), parametres.get('localite'));
        } else if (parametres.get('province')) {
            arriveeZone(parametres.get('province'), 'p');
        } else if (parametres.get('region')) {
            arriveeZone(parametres.get('region'), 'r');
        }
        rafraichir();
    }).catch(function () {
        compte.textContent = t('carte_erreur_chargement');
    });

    if (parametres.get('q') && champ) {
        champ.value = parametres.get('q');
        document.getElementById('searchForm').requestSubmit();
    }
    if (parametres.get('moi') === '1') {
        var localiser = document.getElementById('locateBtn');
        if (localiser) localiser.click();
    }
})();
