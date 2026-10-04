// Page carte (carte.html) : la liste des terrains de la zone affichée, et l'arrivée sur la page.
//
// Liste : à gauche de la carte sur ordinateur ; sur téléphone, une feuille qui monte du bas de
// l'écran, comme sur Komoot (voir « Feuille du téléphone » plus bas). Elle suit la carte : à chaque
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
    // Pastilles des tuiles : sur une seule ligne, les plus utiles pour choisir un terrain d'abord ;
    // celles qui ne tiennent pas sont remplacées par « +N » (compacterPastilles). La fiche les
    // montre toutes.
    var ORDRE_PASTILLES = ['wc', 'parking', 'arret', 'banc', 'abri_pluie', 'eau_potable', 'jeux',
                           'calme', 'nature', 'eau', 'eclaire', 'voie_verte'];

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

        var criteres = (l.sp || []).map(function (cle) { return [cle, '']; })
            .concat((l.px || []).map(function (p) { return [p[0], distanceCritere(p[1])]; }));
        var rang = function (c) { var i = ORDRE_PASTILLES.indexOf(c[0]); return i < 0 ? 99 : i; };
        var pastilles = criteres.sort(function (a, b) { return rang(a) - rang(b); })
            .map(function (c) { return pastille(c[0], c[1]); });

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
        var centre = zone.getCenter();
        return { point: [centre.lat, centre.lng], distances: false };
    }

    // Partie de la carte que l'on voit : sur téléphone, la feuille en cache le bas.
    function zoneVisible() {
        var marge = margeBas();
        if (!marge) return map.getBounds();
        var taille = map.getSize();
        return L.latLngBounds(map.containerPointToLatLng([0, 0]),
            map.containerPointToLatLng([taille.x, Math.max(40, taille.y - marge)]));
    }

    function calculer() {
        var zone = zoneVisible();
        var ref = repere(zone);
        visibles = index.lieux
            .filter(function (l) { return zone.contains([l.lat, l.lon]) && passe(l); })
            .map(function (l) {
                return { lieu: l, km: calculDistance(ref.point[0], ref.point[1], l.lat, l.lon) };
            })
            .sort(function (a, b) { return a.km - b.km; });
        visibles.distances = ref.distances;
    }

    // Une ligne de pastilles par tuile : on cache celles qui dépassent, en partant de la fin, et
    // une pastille « +N » dit combien il en reste (au moins une pastille reste visible).
    // La tuile fictive de hauteurApercu peut se mesurer plus courte qu'une vraie (mise en page pas
    // encore stable, fichiers d'une version précédente dans le cache de l'application) : si la
    // première vraie tuile, sans sa ligne de note, dépasse, l'aperçu prend sa hauteur, une fois.
    function verifierHauteurApercu() {
        var tuile = tuiles.querySelector('.carte-tuile');
        if (!tuile || !ECRAN_ETROIT || !ECRAN_ETROIT.matches || hauteurApercuMesuree === null) return;
        var note = tuile.querySelector('.commune-terrain-note');
        var bas = tuile.offsetTop + tuile.offsetHeight - (note ? note.offsetHeight + 6 : 0) + 14;
        if (bas > hauteurApercuMesuree) {
            hauteurApercuMesuree = bas;
            if (etat === 'apercu' && !glisse) poser(decalagePour(etat), true);
        }
    }

    function compacterPastilles() {
        tuiles.querySelectorAll('.commune-pastilles').forEach(function (ligne) {
            var ancien = ligne.querySelector('.pastille-plus');
            if (ancien) ancien.remove();
            var items = Array.prototype.slice.call(ligne.children);
            items.forEach(function (item) { item.hidden = false; });
            var largeur = ligne.clientWidth;
            if (!largeur || ligne.scrollWidth <= largeur) return;
            var plus = document.createElement('span');
            plus.className = 'commune-pastille pastille-plus';
            ligne.appendChild(plus);
            for (var n = items.length - 1; n >= 1; n--) {
                items[n].hidden = true;
                plus.textContent = '+' + (items.length - n);
                if (ligne.scrollWidth <= largeur) break;
            }
        });
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
        compacterPastilles();
        verifierHauteurApercu();
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

    // ----- Feuille du téléphone -----
    // Sous 900 px, la liste est une feuille posée sur le bas de la carte, en trois positions :
    //   aperçu  : le compteur et une tuile entière (au chargement), 60 % de la carte au plus ;
    //   repliée : le compteur seul, pour voir toute la carte ;
    //   dépliée : la liste sur toute la hauteur ; la poignée, le compteur ou le bouton retour du
    //             téléphone la redescendent.
    // On la fait glisser du doigt (poignée, ou n'importe où tant qu'elle n'est pas dépliée), ou on
    // touche la poignée et le compteur. La liste ne compte que la partie de la carte qu'on voit.

    var ECRAN_ETROIT = window.matchMedia('(max-width: 900px)');
    var corps = document.querySelector('.carte-corps');
    var etat = 'apercu';

    function hauteurCorps() { return corps.clientHeight; }

    // Feuille repliée : la poignée et le compteur, jusqu'au-dessus de la première tuile (le compteur
    // garde la même hauteur, ses deux lignes ayant leur place réservée, voir style-carte.css).
    function hauteurRepliee() { return tuiles.offsetTop; }

    // Hauteur de l'aperçu : le compteur et une tuile type (photo, titre, une ligne de détails, une
    // ligne de pastilles), mesurée une fois sur une tuile fictive glissée dans la liste puis
    // retirée. Toujours la même, qu'il y ait des terrains ou non : la feuille ne fait pas le
    // yo-yo quand on déplace la carte. Remesurée si l'écran change de taille ; 60 % de la carte
    // au plus.
    var hauteurApercuMesuree = null;

    function hauteurApercu() {
        if (hauteurApercuMesuree === null) {
            var essai = document.createElement('div');
            essai.style.visibility = 'hidden';
            essai.innerHTML = tuileHtml({ o: '', l: 'Mapetanque', p: 1, sp: ['banc'], lat: 0, lon: 0 }, null);
            tuiles.insertBefore(essai, tuiles.firstChild);
            hauteurApercuMesuree = tuiles.offsetTop + essai.offsetHeight + 14;
            essai.remove();
        }
        return Math.max(hauteurRepliee() + 120, Math.min(hauteurApercuMesuree, Math.round(hauteurCorps() * 0.6)));
    }

    function decalagePour(e) {
        if (e === 'deplie') return 0;
        if (e === 'replie') return hauteurCorps() - hauteurRepliee();
        return hauteurCorps() - hauteurApercu();
    }


    // Hauteur de carte cachée par la feuille, pour la liste et pour les cadrages (script.js)
    function margeBas() {
        return ECRAN_ETROIT.matches && etat !== 'deplie' ? hauteurCorps() - decalagePour(etat) : 0;
    }
    window.margeBasCarte = margeBas;

    function poser(decalage, anime) {
        liste.classList.toggle('glisse', !anime);
        liste.style.transform = 'translateY(' + decalage + 'px)';
        corps.style.setProperty('--feuille-visible', Math.max(0, hauteurCorps() - decalage) + 'px');
    }

    function changerEtat(nouvel, depuisHistorique) {
        var ancien = etat;
        etat = nouvel;
        liste.classList.toggle('deplie', etat === 'deplie');
        poser(decalagePour(etat), true);
        if (etat === 'deplie' && ancien !== 'deplie' && !depuisHistorique) {
            history.pushState({ carteListe: true }, '');
        }
        if (ancien === 'deplie' && etat !== 'deplie') {
            liste.scrollTop = 0;
            if (!depuisHistorique && history.state && history.state.carteListe) history.back();
        }
        // La partie visible de la carte a changé : la liste suit
        if (etat !== 'deplie' && ancien !== etat) rafraichir();
    }

    function mettreEnPlace() {
        if (ECRAN_ETROIT.matches) {
            poser(decalagePour(etat), false);
        } else {
            liste.style.transform = '';
            liste.classList.remove('deplie', 'glisse');
            corps.style.removeProperty('--feuille-visible');
            etat = 'apercu';
        }
    }
    mettreEnPlace();
    window.addEventListener('resize', function () {
        hauteurApercuMesuree = null;
        compacterPastilles();
        mettreEnPlace();
    });

    // Glisser du doigt
    var glisse = null;
    liste.addEventListener('touchstart', function (e) {
        glisse = null;
        if (!ECRAN_ETROIT.matches || e.touches.length !== 1) return;
        var surEntete = !!e.target.closest('.carte-liste-poignee, .carte-liste-entete');
        // Dépliée et déjà défilée : le doigt fait défiler la liste
        if (etat === 'deplie' && !surEntete && liste.scrollTop > 0) return;
        glisse = { y: e.touches[0].clientY, depart: decalagePour(etat), actuel: decalagePour(etat),
                   bouge: false, contenuDeplie: etat === 'deplie' && !surEntete };
    }, { passive: true });

    liste.addEventListener('touchmove', function (e) {
        if (!glisse) return;
        var dy = e.touches[0].clientY - glisse.y;
        if (!glisse.bouge) {
            if (Math.abs(dy) < 8) return;
            // Dépliée, vers le haut : c'est un défilement de la liste, pas un glissement
            if (glisse.contenuDeplie && dy < 0) { glisse = null; return; }
            glisse.bouge = true;
        }
        e.preventDefault();
        glisse.actuel = Math.min(Math.max(glisse.depart + dy, 0), hauteurCorps() - hauteurRepliee());
        poser(glisse.actuel, false);
    }, { passive: false });

    liste.addEventListener('touchend', function () {
        if (!glisse || !glisse.bouge) { glisse = null; return; }
        var ordre = ['deplie', 'apercu', 'replie'];
        var rang = ordre.indexOf(etat);
        var ecart = glisse.actuel - glisse.depart;
        if (ecart < -50) rang = Math.max(0, rang - 1);
        else if (ecart > 50) rang = Math.min(2, rang + 1);
        glisse = null;
        if (ordre[rang] === etat) poser(decalagePour(etat), true);
        else changerEtat(ordre[rang]);
    });

    // Toucher la poignée ou le compteur : aperçu ↔ dépliée (repliée → aperçu)
    liste.addEventListener('click', function (e) {
        if (!ECRAN_ETROIT.matches || !e.target.closest('.carte-liste-poignee, .carte-liste-compte')) return;
        changerEtat(etat === 'apercu' ? 'deplie' : 'apercu');
    });

    window.addEventListener('popstate', function () {
        if (etat === 'deplie' && !(history.state && history.state.carteListe)) changerEtat('apercu', true);
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
        if (!window.location.search && ECRAN_ETROIT.matches) {
            cadrerSurBelgique();   // le premier cadrage (script.js) ignorait la feuille
        }
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
