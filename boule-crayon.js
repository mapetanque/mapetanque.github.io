/* =============================================================================================
   Boule crayonnée qui tourne (page Connexion, en attendant le code ou le lien du mail).

   Même sphère que l'animation du logo mobile (boule-animee.js) : deux bandes blanches qui sont
   deux grands cercles perpendiculaires, ici sans cochonnet, donc une boule complète. Elle tourne
   lentement et sans fin.

   Rendu « dessin animé traditionnel » plutôt qu'une image qui pivote :
   - les hachures gardent leur direction à l'écran, comme si on les redessinait à chaque image ;
   - quelques variantes de hachures (traits, grain, angle) alternent à chaque image ;
   - le contour tremble un peu, différemment d'une variante à l'autre ;
   - la cadence est volontairement basse (10 images/s), comme un dessin animé fait à la main.
   Les hachures reprennent le style de images/mapetanque-boule-crayon.svg (mêmes filtres de grain,
   mêmes angles), calculées une fois au chargement ; seule la silhouette est recalculée.

   Utilisation : <canvas data-boule-crayon></canvas>, taille fixée en CSS, animé au chargement de
   la page ; pour un canvas ajouté ensuite, appeler window.BouleCrayon.demarrer(canvas).
   L'animation s'arrête d'elle-même quand le canvas est retiré de la page.
============================================================================================= */

(function () {
    'use strict';

    // --- Géométrie (reprise de boule-animee.js) ------------------------------------------
    const NORMALE_1 = [-0.8924, 0.0883, 0.4426];
    const NORMALE_2 = [0.2129, 0.9471, 0.2403];
    const DEMI_BANDE = 0.0914;

    // --- Réglages ------------------------------------------------------------------------
    const REGLAGES = {
        tour: 3000,         // ms pour un tour complet
        images: 10,         // images par seconde
        variantes: 4,       // nombre de dessins de hachures qui alternent
        rayon: 0.92,        // rayon de la boule dans le canvas (marge pour le tremblement)
        tremblement: 0.022, // amplitude du tremblement du contour, en rayons
        camera: 45,         // comme boule-animee.js
        direction: -40
    };

    function produitVectoriel(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }

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

    // Petit générateur aléatoire à graine : mêmes dessins à chaque chargement.
    function hasard(graine) {
        let a = graine >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // --- Hachures : un SVG par variante, dans le style de mapetanque-boule-crayon.svg ---------
    // Repère 0..1000, centre 500. Les valeurs du SVG d'origine sont divisées par 3 (rayon 1380
    // là-bas, environ 460 ici).

    function filtreGrain(id, graine1, graine2) {
        return '<filter id="' + id + '" filterUnits="userSpaceOnUse" x="-500" y="-500" width="2000" height="2000">' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.018 0.27" numOctaves="3" seed="' + graine1 + '" result="t"/>' +
            '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  7 0 0 0 -2.25" result="s"/>' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.36" numOctaves="2" seed="' + graine2 + '" result="f"/>' +
            '<feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  9 0 0 0 -2.9" result="fs"/>' +
            '<feComposite in="s" in2="fs" operator="arithmetic" k1="1" result="m"/>' +
            '<feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
    }

    function couche(alea, angle, filtre, pas, largeurMin, largeurMax, opaciteMin) {
        let traits = '';
        for (let y = -250 + alea() * pas; y < 1250; y += pas * (0.8 + alea() * 0.4)) {
            const y1 = y + (alea() - 0.5) * 40, y2 = y + (alea() - 0.5) * 40, yc = y + (alea() - 0.5) * 40;
            traits += '<path d="M-250,' + y1.toFixed(1) + 'Q500,' + yc.toFixed(1) + ' 1250,' + y2.toFixed(1) +
                '" stroke-width="' + (largeurMin + alea() * (largeurMax - largeurMin)).toFixed(1) +
                '" opacity="' + (opaciteMin + alea() * (1 - opaciteMin)).toFixed(2) + '"/>';
        }
        return '<g transform="rotate(' + angle.toFixed(1) + ' 500 500)" filter="url(#' + filtre + ')">' + traits + '</g>';
    }

    function svgHachures(v) {
        const alea = hasard(1234 + v * 977);
        const decalage = (alea() - 0.5) * 6;   // la main ne hachure jamais deux fois au même angle
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><defs>' +
            filtreGrain('g1', 3 + v * 11, 8 + v * 13) + filtreGrain('g2', 17 + v * 7, 29 + v * 5) +
            '</defs><g fill="none" stroke="#74C15A" stroke-linecap="round">' +
            couche(alea, -57 + decalage, 'g1', 22, 21, 29, 1) +
            couche(alea, -50 + decalage, 'g2', 37, 16, 25, 0.9) +
            '</g></svg>';
    }

    function chargerHachures(v, cote) {
        return new Promise(function (ok, erreur) {
            const img = new Image();
            img.onload = function () {
                const c = document.createElement('canvas');
                c.width = c.height = cote;
                c.getContext('2d').drawImage(img, 0, 0, cote, cote);
                ok(c);
            };
            img.onerror = erreur;
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgHachures(v));
        });
    }

    // --- Tremblement du contour : deux grilles de décalages aléatoires, lissées -----------
    // Une grille large pour l'ondulation du trait, une fine pour le grain du crayon sur les bords
    // (le filtre « rough » du SVG d'origine).

    function grille(alea, taille, amplitude) {
        const dx = new Float32Array(taille * taille), dy = new Float32Array(taille * taille);
        for (let i = 0; i < dx.length; i++) {
            dx[i] = (alea() * 2 - 1) * amplitude;
            dy[i] = (alea() * 2 - 1) * amplitude;
        }
        return function (x, y, sortie) {
            // x, y dans [-1, 1] -> indices de grille
            const gx = (x + 1) / 2 * (taille - 1), gy = (y + 1) / 2 * (taille - 1);
            const i = Math.max(0, Math.min(taille - 2, Math.floor(gx)));
            const j = Math.max(0, Math.min(taille - 2, Math.floor(gy)));
            let fx = gx - i, fy = gy - j;
            fx = fx * fx * (3 - 2 * fx);
            fy = fy * fy * (3 - 2 * fy);
            const k = j * taille + i;
            sortie[0] += (dx[k] * (1 - fx) + dx[k + 1] * fx) * (1 - fy) +
                (dx[k + taille] * (1 - fx) + dx[k + taille + 1] * fx) * fy;
            sortie[1] += (dy[k] * (1 - fx) + dy[k + 1] * fx) * (1 - fy) +
                (dy[k + taille] * (1 - fx) + dy[k + taille + 1] * fx) * fy;
        };
    }

    function tremblement(v, amplitude) {
        const alea = hasard(4321 + v * 131);
        const large = grille(alea, 7, amplitude);
        const fine = grille(alea, 45, amplitude * 0.5);
        const d = [0, 0];
        return function (x, y) {
            d[0] = d[1] = 0;
            large(x, y, d);
            fine(x, y, d);
            return d;
        };
    }

    // --- Silhouette : boule moins les deux bandes, dans un canvas de masque ----------------
    function silhouette(masque, n1, n2, decale, rayon) {
        const cote = masque.width;
        const ctx = masque.getContext('2d');
        const image = ctx.createImageData(cote, cote);
        const px = image.data;
        const ss = cote <= 160 ? 3 : 2;
        const pas = 2 / (cote * ss);
        const poids = 255 / (ss * ss);

        for (let j = 0; j < cote; j++) {
            for (let i = 0; i < cote; i++) {
                let couverture = 0;
                for (let sj = 0; sj < ss; sj++) {
                    const ey = 1 - (j * ss + sj + 0.5) * pas;
                    for (let si = 0; si < ss; si++) {
                        const ex = (i * ss + si + 0.5) * pas - 1;
                        const d = decale(ex, ey);
                        const x = (ex + d[0]) / rayon, y = (ey + d[1]) / rayon;
                        const r2 = x * x + y * y;
                        if (r2 >= 1) continue;
                        const z = Math.sqrt(1 - r2);
                        if (Math.abs(x * n1[0] + y * n1[1] + z * n1[2]) < DEMI_BANDE) continue;
                        if (Math.abs(x * n2[0] + y * n2[1] + z * n2[2]) < DEMI_BANDE) continue;
                        couverture++;
                    }
                }
                if (couverture) px[(j * cote + i) * 4 + 3] = Math.round(couverture * poids);
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
        const masque = document.createElement('canvas');
        masque.width = masque.height = cote;
        const axe = axeDeRotation(r);
        const decalages = [];
        const promesses = [];
        for (let v = 0; v < r.variantes; v++) {
            decalages.push(tremblement(v, r.tremblement));
            promesses.push(chargerHachures(v, cote));
        }
        const immobile = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        Promise.all(promesses).then(function (hachures) {
            let derniere = -1, variante = 0;

            function image(maintenant) {
                if (!canvas.isConnected) return;   // canvas retiré : fin de l'animation
                const numero = Math.floor(maintenant * r.images / 1000);
                if (numero !== derniere) {
                    derniere = numero;
                    // Jamais deux fois de suite le même dessin.
                    variante = (variante + 1 + Math.floor(Math.random() * (r.variantes - 1))) % r.variantes;
                    const angle = immobile ? 0 : (numero * 1000 / r.images) / r.tour * 2 * Math.PI;
                    silhouette(masque, tourner(NORMALE_1, axe, angle), tourner(NORMALE_2, axe, angle),
                        decalages[variante], r.rayon);
                    ctx.globalCompositeOperation = 'copy';
                    ctx.drawImage(hachures[variante], 0, 0);
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(masque, 0, 0);
                }
                if (!immobile) requestAnimationFrame(image);
            }
            requestAnimationFrame(image);
        });
    }

    function tout() {
        document.querySelectorAll('canvas[data-boule-crayon]').forEach(function (c) { demarrer(c); });
    }

    window.BouleCrayon = { demarrer: demarrer, reglages: REGLAGES };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tout);
    } else {
        tout();
    }
})();
