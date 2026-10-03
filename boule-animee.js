/* =============================================================================================
   Boule animée du logo mobile : au clic, la boule roule quelques tours en soulevant des graviers,
   touche le cochonnet, qui avance un peu, et tout s'arrête exactement dans la pose du logo
   (images/mapetanque-boule-pleine.svg).

   Pourquoi un rendu calculé plutôt qu'une planche d'images comme chargeur-photo.js :
   le chargeur enchaîne deux planches (boucle + sortie) dessinées séparément, et le raccord entre
   les deux n'a jamais été parfait — la vitesse de rotation change au basculement. Ici, une seule
   rotation est calculée image par image, avec une seule courbe de vitesse : la boule part lancée
   et ne fait que ralentir, sans aucun raccord possible.

   Le logo est une vraie sphère vue de face : ses deux bandes blanches sont deux grands cercles
   perpendiculaires, et l'encoche est un disque (le cochonnet, posé devant). Les valeurs
   ci-dessous ont été relevées sur les courbes du SVG (écart < 0,5 % du rayon) : la dernière
   image de l'animation retombe donc exactement sur le logo, qui reprend sa place sans saut.
============================================================================================= */

(function () {
    'use strict';

    // --- Géométrie du logo (unités : rayon de la boule ; x vers la droite, y vers le haut,
    //     z vers le spectateur) ------------------------------------------------------------
    const VERT = [116, 193, 90];                      // #74C15A, couleur du SVG
    const NORMALE_1 = [-0.8924, 0.0883, 0.4426];      // bande « verticale »
    const NORMALE_2 = [0.2129, 0.9471, 0.2403];       // bande « horizontale »
    const DEMI_BANDE = 0.0914;                        // demi-largeur d'une bande
    const COCHONNET = { x: -0.640, y: -0.715, r: 0.375 };  // encoche, marge blanche comprise

    // Place laissée autour de la boule pour les graviers, en rayons de boule. Le canvas fait
    // donc (1 + MARGE) fois la taille de la boule.
    const MARGE = 0.7;

    // --- Réglages par défaut (ajustables depuis demo-boule-animee.html) --------------------
    const REGLAGES = {
        tours: 2,         // nombre ENTIER : la première image retombe alors sur le logo
        duree: 3000,      // ms
        courbe: 4,        // 2 = freinage constant ; plus haut, départ plus vif, fin plus douce
        camera: 45,       // hauteur de la caméra au-dessus du sol, en degrés
        direction: -40,   // 0 = la boule roule vers la droite ; négatif = vers le spectateur
        graviers: 1,      // densité des graviers soulevés (0 = aucun)
        touche: 0.18      // recul du cochonnet quand la boule le touche, en rayons (0 = aucun)
    };

    // Graviers : nombre émis par rayon parcouru (à densité 1), gravité en rayons/s², durée de vie.
    const GRAVIERS_PAR_RAYON = 6;
    const GRAVITE = 40;
    const VITESSE_MIN_GRAVIERS = 1.5;   // rayons/s : en dessous, la boule ne soulève plus rien
    const TEINTES_GRAVIER = ['#c8b48f', '#a8946f', '#ddd0b5', '#8f7d5e'];

    // Touche : la boule rattrape le cochonnet quand il lui reste cet angle à parcourir (radians),
    // et le cochonnet, plus léger, repart un peu plus vite qu'elle (facteur REBOND).
    const ANGLE_TOUCHE = 0.06;
    const REBOND = 1.6;

    // --- Petits outils vectoriels --------------------------------------------------------

    function produitVectoriel(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }

    function scalaire(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    // Rotation de v d'un angle a autour de l'axe unitaire k (formule de Rodrigues).
    function tourner(v, k, a) {
        const c = Math.cos(a), s = Math.sin(a);
        const kv = scalaire(k, v);
        const kxv = produitVectoriel(k, v);
        return [
            v[0] * c + kxv[0] * s + k[0] * kv * (1 - c),
            v[1] * c + kxv[1] * s + k[1] * kv * (1 - c),
            v[2] * c + kxv[2] * s + k[2] * kv * (1 - c)
        ];
    }

    function hasard(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Mouvement de la boule : axe de rotation, direction de roulement, verticale du sol.
     * La boule roule sans glisser sur un sol vu d'en haut sous l'angle `camera` : son axe est
     * perpendiculaire au sol et à la direction de roulement. Comme la caméra suit la boule, c'est
     * le sol (cochonnet, graviers) qui semble venir à sa rencontre, d'autant plus vite qu'elle
     * tourne vite : un radian de rotation = un rayon parcouru. Rotation et défilement du sol sont
     * ainsi liés par construction et ne peuvent pas se désynchroniser.
     */
    function mouvement(reglages) {
        const phi = reglages.camera * Math.PI / 180;
        const alpha = reglages.direction * Math.PI / 180;
        const haut = [0, Math.cos(phi), Math.sin(phi)];        // normale au sol
        const loin = [0, Math.sin(phi), -Math.cos(phi)];       // sur le sol, en s'éloignant
        const sens = [
            Math.cos(alpha) + Math.sin(alpha) * loin[0],
            Math.sin(alpha) * loin[1],
            Math.sin(alpha) * loin[2]
        ];
        return { axe: produitVectoriel(haut, sens), sens: sens, haut: haut };
    }

    /**
     * Dessine la boule dans une ImageData carrée (diamètre de la boule).
     * @param {ImageData} image
     * @param {number[]} n1, n2  normales des bandes dans la pose courante
     * @param {object} coch  {x, y, r} du cochonnet dans le repère de l'écran
     */
    function peindreBoule(image, n1, n2, coch) {
        const taille = image.width;
        const px = image.data;
        // Suréchantillonnage pour des bords lisses ; moins de sous-points en grand format.
        const ss = taille <= 160 ? 4 : 2;
        const pas = 2 / (taille * ss);
        const poids = 255 / (ss * ss);
        const cochR2 = coch.r * coch.r;

        for (let j = 0; j < taille; j++) {
            for (let i = 0; i < taille; i++) {
                let couverture = 0;
                for (let sj = 0; sj < ss; sj++) {
                    const y = 1 - (j * ss + sj + 0.5) * pas;
                    for (let si = 0; si < ss; si++) {
                        const x = (i * ss + si + 0.5) * pas - 1;
                        const r2 = x * x + y * y;
                        if (r2 >= 1) continue;
                        const dx = x - coch.x, dy = y - coch.y;
                        if (dx * dx + dy * dy < cochR2) continue;
                        const z = Math.sqrt(1 - r2);
                        if (Math.abs(x * n1[0] + y * n1[1] + z * n1[2]) < DEMI_BANDE) continue;
                        if (Math.abs(x * n2[0] + y * n2[1] + z * n2[2]) < DEMI_BANDE) continue;
                        couverture++;
                    }
                }
                const k = (j * taille + i) * 4;
                px[k] = VERT[0];
                px[k + 1] = VERT[1];
                px[k + 2] = VERT[2];
                px[k + 3] = Math.round(couverture * poids);
            }
        }
    }

    /**
     * Joue l'animation complète dans un canvas carré, boule au centre, entourée de MARGE.
     * @param {HTMLCanvasElement} canvas
     * @param {object} [options]  remplace tout ou partie de REGLAGES ; `diametre` (px) impose la
     *                            taille de la boule, sinon déduite de celle du canvas
     * @param {function} [fin]    appelée sur la dernière image
     * @returns {function} fonction d'arrêt
     */
    function jouer(canvas, options, fin) {
        const r = Object.assign({}, REGLAGES, options || {});
        const m = mouvement(r);
        const total = Math.max(1, Math.round(r.tours)) * 2 * Math.PI;  // tours entiers : départ = logo
        const duree = r.duree / 1000;                                    // secondes
        const ctx = canvas.getContext('2d');

        // Disposition dans le canvas : boule de `diametre` px, posée à `bord` px du bord.
        const diametre = r.diametre || Math.round(canvas.width / (1 + MARGE));
        const bord = Math.floor((canvas.width - diametre) / 2);
        const rayon = diametre / 2;
        const centre = bord + rayon;
        const imageBoule = ctx.createImageData(diametre, diametre);
        const pixelMin = window.devicePixelRatio || 1;   // un gravier fait au moins 1 px CSS
        const limite = 1 + MARGE;                        // bord du canvas, en rayons

        // Angle restant à parcourir et vitesse (rayons/s) au temps t.
        function reste(t) {
            return t >= duree ? 0 : total * Math.pow(1 - t / duree, r.courbe);
        }
        function vitesse(t) {
            return t >= duree ? 0 : r.courbe * total / duree * Math.pow(1 - t / duree, r.courbe - 1);
        }

        // Touche : moment où la boule rattrape le cochonnet, et durée de sa petite avancée,
        // tirée de la vitesse de la boule à cet instant (il repart REBOND fois plus vite).
        const avecTouche = r.touche > 0 && ANGLE_TOUCHE < total;
        const tTouche = duree * (1 - Math.pow(ANGLE_TOUCHE / total, 1 / r.courbe));
        const dureeTouche = avecTouche
            ? Math.min(Math.max(2 * r.touche / (REBOND * vitesse(tTouche)), 0.25), 1.2)
            : 0;
        const finAnimation = Math.max(duree, tTouche + dureeTouche);

        // Avancée du cochonnet après la touche, de 0 à 1, en ralentissant.
        function avancee(t) {
            if (!avecTouche || t <= tTouche) return 0;
            const w = Math.min((t - tTouche) / dureeTouche, 1);
            return 1 - (1 - w) * (1 - w);
        }

        const graviers = [];
        let aEmettre = 0;
        let debut = null, precedent = 0;
        let requete = null;

        function emettre(v, dt) {
            aEmettre += GRAVIERS_PAR_RAYON * r.graviers * v * dt;
            while (aEmettre >= 1) {
                aEmettre--;
                // Devant la boule, au ras du sol : elle pousse les graviers, qui partent vers
                // l'avant à peu près à sa vitesse, s'écartent sur les côtés et sautent un peu.
                // Ils restent donc un instant près d'elle avant de retomber derrière.
                const cote = hasard(-0.9, 0.9), avant = hasard(0.3, 0.8);
                const kAvant = hasard(0.7, 1.1), kHaut = hasard(0.15, 0.45);
                const kCote = (cote < 0 ? -1 : 1) * hasard(0.2, 0.6);
                const p = [], vit = [];
                for (let a = 0; a < 3; a++) {
                    p[a] = -m.haut[a] + m.axe[a] * cote + m.sens[a] * avant;
                    vit[a] = v * (m.sens[a] * kAvant + m.haut[a] * kHaut + m.axe[a] * kCote);
                }
                graviers.push({
                    p: p, v: vit, age: 0, vie: hasard(0.35, 0.7), pose: false,
                    taille: hasard(0.025, 0.06),
                    teinte: TEINTES_GRAVIER[Math.floor(Math.random() * TEINTES_GRAVIER.length)]
                });
            }
        }

        function animerGraviers(v, dt) {
            for (let i = graviers.length - 1; i >= 0; i--) {
                const g = graviers[i];
                g.age += dt;
                if (g.age >= g.vie) { graviers.splice(i, 1); continue; }
                for (let a = 0; a < 3; a++) {
                    g.v[a] -= m.haut[a] * GRAVITE * dt;
                    // Le sol défile sous la boule : le gravier recule d'autant.
                    g.p[a] += (g.v[a] - v * m.sens[a]) * dt;
                }
                // Retombé au sol : il s'y pose et ne fait plus que défiler.
                const hauteur = scalaire(g.p, m.haut) + 1;
                if (hauteur < 0) {
                    for (let a = 0; a < 3; a++) {
                        g.p[a] -= m.haut[a] * hauteur;
                        g.v[a] = 0;
                    }
                    // Une fois posé, il s'efface vite plutôt que de traîner sur le sol.
                    if (!g.pose) { g.pose = true; g.vie = Math.min(g.vie, g.age + 0.2); }
                }
            }
        }

        function dessinerGraviers() {
            graviers.forEach(function (g) {
                const x = g.p[0], y = g.p[1];
                // Caché derrière la boule ?
                const r2 = x * x + y * y;
                if (r2 < 1 && g.p[2] < Math.sqrt(1 - r2)) return;
                // Fondu en fin de vie et à l'approche du bord du canvas.
                const bordProche = (limite - Math.max(Math.abs(x), Math.abs(y))) / 0.3;
                const opacite = Math.min(1, 1.6 * (1 - g.age / g.vie), bordProche);
                if (opacite <= 0) return;
                const taille = Math.max(g.taille * 2 * rayon, pixelMin);
                ctx.globalAlpha = opacite;
                ctx.fillStyle = g.teinte;
                ctx.beginPath();
                ctx.arc(centre + x * rayon, centre - y * rayon, taille / 2, 0, 2 * Math.PI);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        function image(maintenant) {
            if (debut === null) { debut = maintenant; precedent = maintenant; }
            const t = (maintenant - debut) / 1000;
            const dt = Math.min((maintenant - precedent) / 1000, 0.05);
            precedent = maintenant;

            const v = vitesse(t);
            const angle = reste(t);
            if (v > VITESSE_MIN_GRAVIERS && r.graviers > 0) emettre(v, dt);
            animerGraviers(v, dt);

            // Le cochonnet suit le défilement du sol, en retrait de `touche` ; à la touche, il
            // avance de ce retrait et finit exactement à sa place dans le logo.
            const decalage = angle - r.touche * (avecTouche ? 1 - avancee(t) : 0);
            const n1 = tourner(NORMALE_1, m.axe, -angle);
            const n2 = tourner(NORMALE_2, m.axe, -angle);
            peindreBoule(imageBoule, n1, n2, {
                x: COCHONNET.x + decalage * m.sens[0],
                y: COCHONNET.y + decalage * m.sens[1],
                r: COCHONNET.r
            });

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(imageBoule, bord, bord);
            dessinerGraviers();

            if (t < finAnimation || graviers.length) {
                requete = requestAnimationFrame(image);
            } else if (fin) {
                fin();
            }
        }
        requete = requestAnimationFrame(image);
        return function arreter() { if (requete) cancelAnimationFrame(requete); };
    }

    // --- Branchement sur le logo ---------------------------------------------------------
    // Seulement en mobile (boule seule) et seulement quand le clic ne quitte pas la page
    // (href="#top" sur l'accueil) : sur les autres pages, la navigation couperait l'animation.

    const MOBILE = window.matchMedia('(max-width: 1024px)');
    const MOINS_DANIMATION = window.matchMedia('(prefers-reduced-motion: reduce)');

    function brancherLogo() {
        const lien = document.querySelector('.brand-link');
        if (!lien || (lien.getAttribute('href') || '').charAt(0) !== '#') return;
        const logo = lien.querySelector('img.logo');
        const cadre = lien.querySelector('picture');
        if (!logo || !cadre) return;

        let enCours = false;

        lien.addEventListener('click', function () {
            if (enCours || !MOBILE.matches || MOINS_DANIMATION.matches) return;
            const cote = logo.getBoundingClientRect().width;
            if (!cote) return;
            enCours = true;

            // Le canvas déborde de l'image de MARGE / 2 de chaque côté pour laisser voler les
            // graviers ; la boule tombe exactement sur l'image, masquée le temps de l'animation.
            const ratio = window.devicePixelRatio || 1;
            const diametre = Math.round(cote * ratio);
            const bord = Math.round(diametre * MARGE / 2);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = diametre + 2 * bord;
            canvas.setAttribute('aria-hidden', 'true');
            const decalage = -bord / ratio, taille = canvas.width / ratio;
            canvas.style.cssText = 'position:absolute;left:' + decalage + 'px;top:' + decalage +
                'px;width:' + taille + 'px;height:' + taille + 'px;pointer-events:none;z-index:1;';
            cadre.style.position = 'relative';
            cadre.appendChild(canvas);
            logo.style.visibility = 'hidden';

            jouer(canvas, { diametre: diametre }, function () {
                logo.style.visibility = '';
                canvas.remove();
                enCours = false;
            });
        });
    }

    window.BouleAnimee = { jouer: jouer, reglages: REGLAGES, marge: MARGE };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', brancherLogo);
    } else {
        brancherLogo();
    }
})();
