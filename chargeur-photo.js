/* =============================================================================================
   Chargeur animé des photos de terrain (boule qui roule, puis fermeture sur le logo).

   Pourquoi un MutationObserver plutôt qu'un appel direct depuis script.js :
   le HTML des photos est produit par construireContenuPopupTerrain et branché par
   brancherPhotosPopup, mais cette dernière est appelée par sa référence LOCALE (script.js
   ligne ~1495), pas via window.brancherPhotosPopup — impossible de l'envelopper depuis
   l'extérieur. On observe donc l'apparition des .popup-photo-wrap dans le document, ce qui
   couvre indifféremment le popup Leaflet, la fenêtre flottante desktop et la fiche mobile,
   sans toucher une seule ligne de script.js.

   Trois comportements, décidés après essais chronométrés :
     - iframe Mapillary : cycle complet (boucle + outro). L'attente réelle tourne autour de
       3,5 s, l'animation est donc justifiée.
     - <img> (miniature 360° locale, photo_url) : chargeur différé, sans outro. Ces images
       arrivent en général en moins de 250 ms ; on n'affiche donc rien du tout, et surtout on
       n'ajoute pas 1,7 s à une image déjà prête.
     - .popup-photo-placeholder (pas-de-photo.webp) : rien. Fichier statique du site, il n'y a
       aucune attente à meubler.
============================================================================================= */

(function () {
    'use strict';

    // --- Planches de sprites -------------------------------------------------------------
    // Lecture image par image en JS : un WebP animé ne permet ni de connaître l'image
    // courante, ni d'en changer la cadence. Or le raccord n'est propre qu'à un endroit précis
    // (voir IMAGE_RACCORD), et les deux animations doivent tourner à des vitesses différentes.
    const CELLULE = 132;   // taille d'une case dans les planches, en pixels

    // Cadences retenues après essais chronométrés. Le rapport entre les deux (1,44) est ce qui
    // rend le raccord fluide : la boule aborde l'outro à 0,88 x la vitesse du spinner, soit une
    // décélération à peine amorcée. Toute modification doit conserver ce rapport, sinon on
    // retrouve la rupture de vitesse au basculement.
    const SPINNER = { src: '/images/chargeur-spinner.webp', colonnes: 8, images: 40, ms: 27 };
    const OUTRO   = { src: '/images/chargeur-outro.webp',   colonnes: 6, images: 30, ms: 39 };

    // L'image 0 de l'outro prolonge presque exactement l'image 16 du spinner (écart mesuré :
    // 0,26 cran de rotation, contre 2,3 en moyenne ailleurs). On attend donc d'y être avant de
    // lancer l'outro, sinon la boule saute visiblement d'une position à une autre.
    const IMAGE_RACCORD = 16;

    // En dessous de ce délai, l'image est arrivée trop vite pour qu'un chargeur ait du sens :
    // un spinner qui clignote un dixième de seconde est plus désagréable que pas de spinner.
    const DELAI_AVANT_AFFICHAGE = 250;

    // L'iframe Mapillary signale son chargement avant que la photo soit peinte : sa visionneuse
    // démarre ensuite et va chercher l'image. Contenu d'un autre domaine, donc aucun moyen de
    // savoir quand elle est réellement affichée — cette marge compense l'écart.
    const MARGE_APRES_LOAD_IFRAME = 700;

    // Instrumentation. Taper dans la console : localStorage.chargeurDebug = 1  puis recharger.
    // Chaque photo affiche alors le détail de son temps de chargement, ce qui permet de voir
    // ce qui domine réellement : l'attente réseau, la marge, ou l'animation elle-même.
    const DEBUG = (function () {
        try { return !!localStorage.getItem('chargeurDebug'); } catch (e) { return false; }
    })();

    function tracer() {
        if (!DEBUG) return;
        console.log.apply(console, ['[chargeur]'].concat(Array.prototype.slice.call(arguments)));
    }

    const planches = {};
    let chargementLance = false;

    function chargerPlanches() {
        if (chargementLance) return;
        chargementLance = true;
        [SPINNER, OUTRO].forEach(function (def) {
            const im = new Image();
            im.onload = function () { planches[def.src] = im; };
            im.src = def.src;
        });
    }

    function dessiner(ctx, def, index) {
        const im = planches[def.src];
        if (!im) return;
        const sx = (index % def.colonnes) * CELLULE;
        const sy = Math.floor(index / def.colonnes) * CELLULE;
        ctx.clearRect(0, 0, CELLULE, CELLULE);
        ctx.drawImage(im, sx, sy, CELLULE, CELLULE, 0, 0, CELLULE, CELLULE);
    }

    // --- Construction du voile -----------------------------------------------------------

    /**
     * @param {boolean} estIframe  vrai pour un embed Mapillary, faux pour une <img> locale
     */
    function construireChargeur(estIframe) {
        const voile = document.createElement('div');
        voile.className = 'chargeur-photo';

        const canvas = document.createElement('canvas');
        canvas.width = CELLULE;
        canvas.height = CELLULE;
        canvas.className = 'chargeur-photo-boule';
        // Purement décoratif : le texte juste en dessous porte déjà l'information.
        canvas.setAttribute('aria-hidden', 'true');

        // Deux textes distincts : l'embed vient de Mapillary et l'attente lui est imputable, ce
        // qu'il est utile de dire au visiteur. Une miniature 360° est au contraire servie par
        // notre propre serveur — la mentionner comme venant de Mapillary serait faux.
        const cle = estIframe ? 'popup_photo_loading_mapillary' : 'popup_photo_loading';
        const texte = document.createElement('div');
        texte.className = 'chargeur-photo-texte';
        texte.textContent = (typeof t === 'function' ? t(cle) : 'Chargement…');

        voile.appendChild(canvas);
        voile.appendChild(texte);
        return { voile: voile, canvas: canvas, texte: texte };
    }

    /**
     * Anime une plage d'images puis appelle fin().
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} def      SPINNER ou OUTRO
     * @param {number} depuis   index de départ
     * @param {number} jusqua   index d'arrivée (peut nécessiter de repasser par 0)
     * @param {function} fin
     * @returns {function} fonction d'arrêt
     */
    function jouer(ctx, def, depuis, jusqua, fin) {
        let i = depuis;
        let minuteur = null;
        function pas() {
            dessiner(ctx, def, i);
            if (i === jusqua) { if (fin) fin(); return; }
            i = (i + 1) % def.images;
            minuteur = setTimeout(pas, def.ms);
        }
        pas();
        return function arreter() { if (minuteur) clearTimeout(minuteur); };
    }

    /** Boucle infinie du spinner. Renvoie de quoi l'arrêter et connaître l'image courante. */
    function boucler(ctx) {
        let i = 0;
        let minuteur = null;
        function pas() {
            dessiner(ctx, SPINNER, i);
            i = (i + 1) % SPINNER.images;
            minuteur = setTimeout(pas, SPINNER.ms);
        }
        pas();
        return {
            arreter: function () { if (minuteur) clearTimeout(minuteur); },
            imageCourante: function () { return (i - 1 + SPINNER.images) % SPINNER.images; }
        };
    }

    // --- Traitement d'un média -----------------------------------------------------------

    const DEJA_TRAITE = 'chargeurPhotoTraite';

    function equiper(media) {
        if (media.dataset[DEJA_TRAITE]) return;
        media.dataset[DEJA_TRAITE] = '1';

        // Illustration de substitution : aucune attente à meubler.
        if (media.classList.contains('popup-photo-placeholder')) return;

        const enveloppe = media.closest('.popup-photo-wrap');
        if (!enveloppe) return;

        const estIframe = media.tagName === 'IFRAME';

        // Une <img> déjà en cache est prête avant même qu'on l'observe : rien à faire.
        if (!estIframe && media.complete && media.naturalWidth > 0) return;

        chargerPlanches();

        const tDebut = performance.now();
        let tSignal = 0;   // moment où le média signale son chargement
        let tPret = 0;     // moment où on le considère prêt (signal + marge éventuelle)

        const parties = construireChargeur(estIframe);
        enveloppe.appendChild(parties.voile);
        const ctx = parties.canvas.getContext('2d');

        media.classList.add('chargeur-photo-media');

        let boucle = null;
        let arretCourant = null;
        let termine = false;

        // Le voile n'est révélé qu'après le délai : si le média est prêt avant, il n'aura
        // jamais été visible, donc aucun clignotement.
        const minuteurAffichage = setTimeout(function () {
            parties.voile.classList.add('visible');
            boucle = boucler(ctx);
        }, DELAI_AVANT_AFFICHAGE);

        function reveler() {
            tracer(estIframe ? 'iframe' : 'img',
                   '| signal du média :', Math.round(tSignal - tDebut), 'ms',
                   '| marge :', Math.round(tPret - tSignal), 'ms',
                   '| animation de fin :', Math.round(performance.now() - tPret), 'ms',
                   '| TOTAL :', Math.round(performance.now() - tDebut), 'ms');
            media.classList.add('chargeur-photo-media-visible');
            parties.voile.classList.add('parti');
            // Retiré du DOM une fois le fondu terminé, pour ne pas laisser un canvas inerte
            // dans chaque popup déjà consultée.
            setTimeout(function () {
                if (parties.voile.parentNode) parties.voile.parentNode.removeChild(parties.voile);
            }, 450);
        }

        function terminer() {
            if (termine) return;
            termine = true;
            tPret = performance.now();
            clearTimeout(minuteurAffichage);

            // Voile jamais affiché (média plus rapide que le délai) : fondu direct.
            if (!boucle) {
                if (parties.voile.parentNode) parties.voile.parentNode.removeChild(parties.voile);
                media.classList.add('chargeur-photo-media-visible');
                return;
            }

            const depart = boucle.imageCourante();
            boucle.arreter();

            // Les <img> n'ont pas droit à l'outro : elles sont déjà prêtes, lui laisser 1,7 s
            // de plus reviendrait à ralentir l'affichage au nom de l'animation.
            if (!estIframe) { reveler(); return; }

            parties.voile.classList.add('sortie');

            function lancerOutro() {
                arretCourant = jouer(ctx, OUTRO, 0, OUTRO.images - 1, reveler);
            }

            if (depart !== IMAGE_RACCORD) {
                arretCourant = jouer(ctx, SPINNER, depart, IMAGE_RACCORD, lancerOutro);
            } else {
                lancerOutro();
            }
        }

        if (estIframe) {
            media.addEventListener('load', function () {
                tSignal = performance.now();
                setTimeout(terminer, MARGE_APRES_LOAD_IFRAME);
            });
        } else {
            const noter = function () { tSignal = performance.now(); terminer(); };
            media.addEventListener('load', noter);
            media.addEventListener('error', noter);
            // L'image a pu finir de charger entre la vérification du début et l'écoute.
            if (media.complete && media.naturalWidth > 0) noter();
        }

        // Filet de sécurité : si le média ne signale jamais rien (réseau coupé, embed en
        // erreur), on ne laisse pas la boule tourner indéfiniment.
        setTimeout(terminer, 20000);
    }

    function balayer(racine) {
        if (!racine || racine.nodeType !== 1) return;
        if (racine.matches && racine.matches('.popup-photo')) equiper(racine);
        if (racine.querySelectorAll) {
            racine.querySelectorAll('.popup-photo').forEach(equiper);
        }
    }

    // --- Observation ---------------------------------------------------------------------
    // Couvre le popup Leaflet, la fenêtre flottante desktop et la fiche mobile d'un seul
    // tenant : tous insèrent leur contenu quelque part sous <body>.

    function demarrer() {
        balayer(document.body);
        new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(balayer);
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', demarrer);
    } else {
        demarrer();
    }
})();