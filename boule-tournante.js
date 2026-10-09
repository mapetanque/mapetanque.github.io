/* =============================================================================================
   Boule qui tourne (page Connexion, en attendant le code ou le lien du mail).

   Même sphère que l'animation du logo mobile (boule-animee.js) : deux bandes blanches qui sont
   deux grands cercles perpendiculaires, ici sans cochonnet, donc une boule complète. Elle tourne
   lentement et sans fin, en aplat vert Mapetanque (charte : formes pleines, sans texture ni
   effet). Remplace l'ancienne boule crayonnée.

   Utilisation : <canvas data-boule-tournante></canvas>, taille fixée en CSS, animé au chargement
   de la page ; pour un canvas ajouté ensuite, appeler window.BouleTournante.demarrer(canvas).
   L'animation s'arrête d'elle-même quand le canvas est retiré de la page.
============================================================================================= */

(function () {
    'use strict';

    // --- Géométrie (reprise de boule-animee.js) ------------------------------------------
    const VERT = [116, 193, 90];                      // #74C15A
    const NORMALE_1 = [-0.8924, 0.0883, 0.4426];
    const NORMALE_2 = [0.2129, 0.9471, 0.2403];
    const DEMI_BANDE = 0.0914;

    // --- Réglages ------------------------------------------------------------------------
    const REGLAGES = {
        tour: 3000,         // ms pour un tour complet
        camera: 45,         // comme boule-animee.js
        direction: -40
    };

    function produitVectoriel(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }

    // Rotation de v d'un angle a autour de l'axe unitaire k (formule de Rodrigues).
    function tourner(v, k, a) {
        const c = Math.cos(a), s = Math.sin(a);
        const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
        const kxv = produitVectoriel(k, v);
        return [
            v[0] * c + kxv[0] * s + k[0] * kv * (1 - c),
            v[1] * c + kxv[1] * s + k[1] * kv * (1 - c),
            v[2] * c + kxv[2] * s + k[2] * kv * (1 - c)
        ];
    }

    // Axe d'une boule qui roule sur un sol vu sous l'angle `camera` (voir boule-animee.js).
    function axeDeRotation(r) {
        const phi = r.camera * Math.PI / 180;
        const alpha = r.direction * Math.PI / 180;
        const haut = [0, Math.cos(phi), Math.sin(phi)];
        const loin = [0, Math.sin(phi), -Math.cos(phi)];
        const sens = [Math.cos(alpha), Math.sin(alpha) * loin[1], Math.sin(alpha) * loin[2]];
        const axe = produitVectoriel(haut, sens);
        const n = Math.hypot(axe[0], axe[1], axe[2]);
        return [axe[0] / n, axe[1] / n, axe[2] / n];
    }

    // Boule moins les deux bandes, suréchantillonnée pour des bords lisses.
    function dessiner(ctx, image, n1, n2) {
        const cote = image.width;
        const px = image.data;
        const ss = cote <= 160 ? 3 : 2;
        const pas = 2 / (cote * ss);
        const poids = 255 / (ss * ss);

        for (let j = 0; j < cote; j++) {
            for (let i = 0; i < cote; i++) {
                let couverture = 0;
                for (let sj = 0; sj < ss; sj++) {
                    const y = 1 - (j * ss + sj + 0.5) * pas;
                    for (let si = 0; si < ss; si++) {
                        const x = (i * ss + si + 0.5) * pas - 1;
                        const r2 = x * x + y * y;
                        if (r2 >= 1) continue;
                        const z = Math.sqrt(1 - r2);
                        if (Math.abs(x * n1[0] + y * n1[1] + z * n1[2]) < DEMI_BANDE) continue;
                        if (Math.abs(x * n2[0] + y * n2[1] + z * n2[2]) < DEMI_BANDE) continue;
                        couverture++;
                    }
                }
                const k = (j * cote + i) * 4;
                px[k] = VERT[0];
                px[k + 1] = VERT[1];
                px[k + 2] = VERT[2];
                px[k + 3] = Math.round(couverture * poids);
            }
        }
        ctx.putImageData(image, 0, 0);
    }

    // --- Animation ---------------------------------------------------------------------
    function demarrer(canvas, options) {
        const r = Object.assign({}, REGLAGES, options || {});
        const cote = Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1));
        if (!cote) return;
        canvas.width = canvas.height = cote;
        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(cote, cote);
        const axe = axeDeRotation(r);
        const immobile = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const debut = performance.now();

        function suivante(maintenant) {
            if (!canvas.isConnected) return;   // canvas retiré : fin de l'animation
            const angle = immobile ? 0 : (maintenant - debut) / r.tour * 2 * Math.PI;
            dessiner(ctx, image, tourner(NORMALE_1, axe, angle), tourner(NORMALE_2, axe, angle));
            if (!immobile) requestAnimationFrame(suivante);
        }
        requestAnimationFrame(suivante);
    }

    function tout() {
        document.querySelectorAll('canvas[data-boule-tournante]').forEach(function (c) { demarrer(c); });
    }

    window.BouleTournante = { demarrer: demarrer, reglages: REGLAGES };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tout);
    } else {
        tout();
    }
})();
