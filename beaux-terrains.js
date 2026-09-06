/* =====================================================================================
   Les plus beaux terrains — logique commune à la page d'accueil et aux pages région
   Fichier ADDITIF : script.js n'est pas modifié.

   Fonctionnement :
     - la page fournit un conteneur <section id="beaux-terrains"> (voir extraits HTML fournis) ;
     - ce script charge /data/beaux_terrains.json, remplit la rangée de tuiles, et branche le
       clic sur la carte déjà présente sur la page ;
     - sur la page d'accueil (liste non filtrée), la région est devinée par IP pour restreindre
       l'affichage ; sur une page région, la région est imposée par la page elle-même.

   Dépend de : window.allerVersTerrain (script.js) sur la page d'accueil,
               window.beauxTerrainsGroupe (exposé par le template région) sur les pages région.
   ===================================================================================== */
(function () {
    "use strict";

    var CHEMIN_DONNEES = "/data/beaux_terrains.json";
    var URL_GEO_IP = "https://ipapi.co/json/";
    var NB_MOTS_EXTRAIT = 8;

    var section = document.getElementById("beaux-terrains");
    if (!section) return;   // page sans cette section : rien à faire

    var carrousel = section.querySelector(".beaux-terrains-carrousel");
    var scroller = section.querySelector(".beaux-terrains-scroller");
    var titre = section.querySelector("h2");

    // Le template région fournit {{STATS_GEO_KEY}}, qui vaut la clé canonique du projet
    // ("flandre", "wallonie", "bruxelles"), alors que le JSON des terrains utilise les libellés
    // ("Flandre", "Wallonie", "Bruxelles"). On compare donc toujours sur la clé canonique, en
    // normalisant les deux côtés — comme ça, peu importe la forme reçue.
    // "Flandre", "flandre", "Vlaanderen"... -> "flandre". Retourne "" si non reconnu.
    var CLES_REGION = {
        "flandre": "flandre", "vlaanderen": "flandre", "flanders": "flandre",
        "wallonie": "wallonie", "wallonia": "wallonie",
        "bruxelles": "bruxelles", "brussel": "bruxelles", "brussels": "bruxelles"
    };

    function cleRegion(valeur) {
        return CLES_REGION[(valeur || "").toString().trim().toLowerCase()] || "";
    }

    // Une page région impose sa région via data-region ; la page d'accueil ne met rien et
    // laisse la géolocalisation décider.
    var regionImposee = cleRegion(section.getAttribute("data-region"));
    var regionCourante = regionImposee || "";
    var terrains = [];
    var modeAuto = !regionImposee;

    // ---------------------------------------------------------------------------------
    // Libellés
    // ---------------------------------------------------------------------------------
    // Les clés existent dans translations.js (source de vérité unique) ; on retombe sur le
    // français si la clé manque, pour ne jamais afficher une chaîne vide.
    function traduire(cle, repli) {
        try {
            if (window.translations && window.currentLang) {
                var dict = window.translations[window.currentLang];
                if (dict && dict[cle]) return dict[cle];
            }
        } catch (e) { /* translations non chargé : on prend le repli */ }
        return repli;
    }

    function titreSelonRegion(region) {
        if (region === "flandre")   return traduire("beaux_terrains_titre_flandre",   "Les plus beaux terrains en Flandre");
        if (region === "wallonie")  return traduire("beaux_terrains_titre_wallonie",  "Les plus beaux terrains en Wallonie");
        if (region === "bruxelles") return traduire("beaux_terrains_titre_bruxelles", "Les plus beaux terrains \u00e0 Bruxelles");
        return traduire("beaux_terrains_titre_belgique", "Les plus beaux terrains en Belgique");
    }

    // ---------------------------------------------------------------------------------
    // Détection de région par IP (page d'accueil uniquement)
    // ---------------------------------------------------------------------------------
    // Les API IP renvoient des libellés variables ("Flanders", "Vlaanderen", "Brussels
    // Capital"...) et parfois une province plutôt qu'une région : on normalise les deux.
    var REGION_PAR_LIBELLE = {
        "flanders": "flandre", "vlaanderen": "flandre", "flandre": "flandre",
        "flemish region": "flandre", "vlaams gewest": "flandre",
        "wallonia": "wallonie", "wallonie": "wallonie", "walloon region": "wallonie",
        "region wallonne": "wallonie", "waals gewest": "wallonie",
        "brussels": "bruxelles", "brussels capital": "bruxelles", "bruxelles": "bruxelles",
        "brussels capital region": "bruxelles", "brussels-capital region": "bruxelles",
        "brussels hoofdstedelijk gewest": "bruxelles",
        "antwerp": "flandre", "antwerpen": "flandre", "anvers": "flandre",
        "east flanders": "flandre", "oost-vlaanderen": "flandre",
        "west flanders": "flandre", "west-vlaanderen": "flandre",
        "flemish brabant": "flandre", "vlaams-brabant": "flandre",
        "limburg": "flandre", "limbourg": "flandre",
        "hainaut": "wallonie", "henegouwen": "wallonie",
        "liege": "wallonie", "li\u00e8ge": "wallonie", "luik": "wallonie",
        "namur": "wallonie", "namen": "wallonie", "luxembourg": "wallonie",
        "walloon brabant": "wallonie", "brabant wallon": "wallonie", "waals-brabant": "wallonie"
    };

    function normaliser(texte) {
        return (texte || "").toString().trim().toLowerCase();
    }

    function regionDepuisReponse(d) {
        // Hors Belgique : on ne restreint pas (le visiteur prépare peut-être un voyage).
        if (normaliser(d.country_code) !== "be") return "";
        var candidats = [d.region, d.region_code, d.city];
        for (var i = 0; i < candidats.length; i++) {
            var trouve = REGION_PAR_LIBELLE[normaliser(candidats[i])];
            if (trouve) return trouve;
        }
        return "";
    }

    function detecterRegion() {
        if (!window.fetch) return Promise.resolve("");
        return fetch(URL_GEO_IP, { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return d ? regionDepuisReponse(d) : ""; })
            .catch(function () { return ""; });   // échec/quota : on reste sur la Belgique
    }

    // ---------------------------------------------------------------------------------
    // Rendu
    // ---------------------------------------------------------------------------------
    function terrainsAffiches() {
        if (!regionCourante) return terrains;
        return terrains.filter(function (t) { return cleRegion(t.region) === regionCourante; });
    }

    function echapper(texte) {
        return (texte || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function premiersMots(texte, nbMots) {
        var mots = texte.trim().split(/\s+/);
        if (mots.length <= nbMots) return texte;
        return mots.slice(0, nbMots).join(" ") + "\u2026";
    }

    // Bruxelles est à la fois région et "province" dans les données : on n'affiche pas deux
    // fois le même niveau ("Bruxelles > Bruxelles > Anderlecht" -> "Bruxelles > Anderlecht").
    function filAriane(t) {
        var niveaux = [t.region];
        if (t.province && t.province !== t.region) niveaux.push(t.province);
        niveaux.push(t.commune);
        return niveaux.map(echapper).join(" &rsaquo; ");
    }

    // ---------------------------------------------------------------------------------
    // Largeur des tuiles et flèches de défilement (écrans larges avec survol)
    // ---------------------------------------------------------------------------------
    // Sur écran large : 4 tuiles pleines qui remplissent exactement la largeur disponible
    // (rien de coupé). Ailleurs : largeur fixe du CSS, avec une tuile partiellement visible
    // qui indique qu'on peut faire défiler au doigt.
    var MQ_DESKTOP = window.matchMedia ? window.matchMedia("(min-width: 1025px) and (hover: hover)") : null;
    var TUILES_PAR_VUE = 4;
    var GAP = 16;
    var flechePrev = null;
    var flecheNext = null;

    function ajusterLargeurTuiles() {
        var tuiles = scroller.querySelectorAll(".tuile-terrain");
        var desktop = MQ_DESKTOP && MQ_DESKTOP.matches;
        var largeur = desktop
            ? Math.floor((scroller.clientWidth - GAP * (TUILES_PAR_VUE - 1)) / TUILES_PAR_VUE)
            : null;
        for (var i = 0; i < tuiles.length; i++) {
            if (largeur) {
                tuiles[i].style.flex = "0 0 " + largeur + "px";
                tuiles[i].style.width = largeur + "px";
            } else {
                tuiles[i].style.flex = "";
                tuiles[i].style.width = "";
            }
        }
    }

    // Un clic fait défiler d'une "page" = la largeur visible, soit exactement 4 tuiles.
    function defiler(sens) {
        scroller.scrollLeft += sens * scroller.clientWidth;
    }

    function majFleches() {
        if (!flechePrev) return;
        var max = scroller.scrollWidth - scroller.clientWidth;
        // Marge de 4px : les navigateurs arrondissent parfois scrollLeft, la flèche resterait
        // sinon visible alors qu'on est déjà tout au bout.
        flechePrev.hidden = scroller.scrollLeft <= 4;
        flecheNext.hidden = scroller.scrollLeft >= max - 4;
    }

    function creerFleches() {
        if (!carrousel) return;

        flechePrev = document.createElement("button");
        flechePrev.type = "button";
        flechePrev.className = "carrousel-fleche prev";
        flechePrev.setAttribute("aria-label", traduire("beaux_terrains_precedents", "Voir les terrains pr\u00e9c\u00e9dents"));
        flechePrev.innerHTML = "<span>&lsaquo;</span>";
        flechePrev.addEventListener("click", function () { defiler(-1); });

        flecheNext = document.createElement("button");
        flecheNext.type = "button";
        flecheNext.className = "carrousel-fleche next";
        flecheNext.setAttribute("aria-label", traduire("beaux_terrains_suivants", "Voir les terrains suivants"));
        flecheNext.innerHTML = "<span>&rsaquo;</span>";
        flecheNext.addEventListener("click", function () { defiler(1); });

        carrousel.appendChild(flechePrev);
        carrousel.appendChild(flecheNext);

        scroller.addEventListener("scroll", majFleches);
        window.addEventListener("resize", function () { ajusterLargeurTuiles(); majFleches(); });
    }

    function construire() {
        var items = terrainsAffiches();

        // Région sans terrain sélectionné : on masque toute la section plutôt que d'afficher
        // une rangée vide.
        section.style.display = items.length ? "" : "none";
        if (!items.length) return;

        if (titre) titre.textContent = titreSelonRegion(regionCourante);

        var html = "";
        for (var i = 0; i < items.length; i++) {
            var t = items[i];
            var photo = t.miniature
                ? '<img src="' + echapper(t.miniature) + '" alt="" loading="lazy" width="500" height="500">'
                : '<div class="tuile-photo-placeholder">' + echapper(traduire("beaux_terrains_photo_a_venir", "photo \u00e0 venir")) + '</div>';
            var extrait = t.description
                ? '<p class="tuile-extrait">' + echapper(premiersMots(t.description, NB_MOTS_EXTRAIT)) + '</p>'
                : "";
            html +=
                '<div class="tuile-terrain" data-index="' + i + '" role="button" tabindex="0">' +
                '  <div class="tuile-photo">' + photo + '</div>' +
                '  <div class="tuile-info">' +
                '    <p class="tuile-nom">' + echapper(t.nom) + '</p>' +
                '    <div class="popup-breadcrumb">' + filAriane(t) + '</div>' +
                '    ' + extrait +
                '  </div>' +
                '</div>';
        }
        scroller.innerHTML = html;
        scroller.scrollLeft = 0;
        ajusterLargeurTuiles();
        majFleches();

        var tuiles = scroller.querySelectorAll(".tuile-terrain");
        for (var j = 0; j < tuiles.length; j++) {
            (function (tuile) {
                function ouvrir() {
                    ouvrirTerrain(items[parseInt(tuile.getAttribute("data-index"), 10)]);
                }
                tuile.addEventListener("click", ouvrir);
                tuile.addEventListener("keydown", function (e) {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
                });
            })(tuiles[j]);
        }
    }

    // ---------------------------------------------------------------------------------
    // Clic sur une tuile : ouvrir la fiche du terrain depuis la carte
    // ---------------------------------------------------------------------------------
    // On ne reconstruit AUCUN contenu de fiche ici : on ouvre la vraie popup Leaflet du
    // marqueur, qui passe par brancherPopupTerrain (donc bascule automatiquement en fiche
    // plein écran sur mobile / fenêtre flottante sur desktop, avec photos et partage câblés).
    function ouvrirTerrain(t) {
        if (t.lat == null || t.lon == null) return;

        // Pages région et Bruxelles : le template expose sa propre couche sur
        // window.beauxTerrainsGroupe — signal fiable, posé exprès pour ce cas. On le teste en
        // premier plutôt que allerVersTerrain : cette dernière EXISTE toujours (fonction déclarée
        // sans condition dans script.js), y compris sur ces pages, mais y plante silencieusement
        // (elle s'appuie sur `markers`, jamais créé quand MAPETANQUE_SKIP_DEFAULT_MARKERS est
        // actif) — d'où le clic qui ne faisait rien.
        var groupe = window.beauxTerrainsGroupe;
        var carte = window.map;
        if (groupe && carte) {
            var cible = null;
            groupe.eachLayer(function (layer) {
                if (cible) return;
                var pos = layer.getLatLng();
                if (Math.abs(pos.lat - t.lat) < 0.0001 && Math.abs(pos.lng - t.lon) < 0.0001) {
                    cible = layer;
                }
            });

            if (cible) {
                groupe.zoomToShowLayer(cible, function () { cible.openPopup(); });
            } else {
                // Terrain introuvable sur la carte (retiré depuis ?) : on centre quand même dessus.
                carte.setView([t.lat, t.lon], 18);
            }

            // Le carrousel est au-dessus de la carte sur les pages région : on redescend vers la
            // carte pour que le recentrage soit visible.
            var conteneurCarte = document.getElementById("map");
            if (conteneurCarte && conteneurCarte.scrollIntoView) {
                conteneurCarte.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        // Page d'accueil : allerVersTerrain fait déjà tout le travail (recherche du marqueur,
        // dépliage de l'amas via zoomToShowLayer, ouverture du popup, puis remontée douce vers
        // la carte). Exactement le même chemin que les liens de partage ?lat=&lon=.
        if (typeof window.allerVersTerrain === "function") {
            window.allerVersTerrain(t.lat, t.lon);
        }
    }

    // ---------------------------------------------------------------------------------
    // Démarrage
    // ---------------------------------------------------------------------------------
    fetch(CHEMIN_DONNEES)
        .then(function (r) { return r.json(); })
        .then(function (data) {
            terrains = data || [];

            // 1) Affichage immédiat : rien n'attend le réseau de géolocalisation.
            creerFleches();
            construire();

            // 2) Puis restriction à la région détectée, uniquement si la page ne l'impose pas.
            if (modeAuto) {
                detecterRegion().then(function (region) {
                    if (region) { regionCourante = region; construire(); }
                });
            }
        })
        .catch(function () {
            // Données absentes ou invalides : la section disparaît, le reste de la page est
            // intact (aucune erreur visible pour le visiteur).
            section.style.display = "none";
        });
})();