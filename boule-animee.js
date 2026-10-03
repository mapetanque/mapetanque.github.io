/* =============================================================================================
   Boule animée du logo mobile : au clic, la boule roule quelques tours puis s'arrête derrière
   le cochonnet, exactement dans la pose du logo (images/mapetanque-boule-pleine.svg).

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

    // --- Réglages (choisis par essais sur téléphone) --------------------------------------
    const REGLAGES = {
        tours: 2,        // nombre ENTIER : la première image retombe alors sur le logo
        duree: 3000,     // ms
        courbe: 4,       // 2 = freinage constant ; plus haut, départ plus vif, fin plus douce
        camera: 45,      // hauteur de la caméra au-dessus du sol, en degrés
        direction: -40   // 0 = la boule roule vers la droite ; négatif = vers le spectateur
    };

    // --- Petits outils vectoriels --------------------------------------------------------

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

    /**
     * Mouvement de la boule : axe de rotation et trajet apparent du cochonnet.
     * La boule roule sans glisser sur un sol vu d'en haut sous l'angle `camera` : son axe est
     * perpendiculaire au sol et à la direction de roulement. Comme la caméra suit la boule, c'est
     * le cochonnet qui semble venir à sa rencontre, d'autant plus vite qu'elle tourne vite :
     * un radian de rotation = un rayon parcouru. Les deux mouvements sont ainsi liés par
     * construction et ne peuvent pas se désynchroniser.
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
        return { axe: produitVectoriel(haut, sens), sens: sens };
    }

    /**
     * Dessine la boule dans le canvas.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} taille  côté du canvas en pixels réels
     * @param {number[]} n1, n2  normales des bandes dans la pose courante
     * @param {object} coch  {x, y, r} du cochonnet dans le repère de l'écran
     */
    function dessiner(ctx, taille, n1, n2, coch) {
        const image = ctx.createImageData(taille, taille);
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
                if (couverture) {
                    const k = (j * taille + i) * 4;
                    px[k] = VERT[0];
                    px[k + 1] = VERT[1];
                    px[k + 2] = VERT[2];
                    px[k + 3] = Math.round(couverture * poids);
                }
            }
        }
        ctx.putImageData(image, 0, 0);
    }

    /**
     * Joue l'animation complète dans un canvas carré.
     * @param {HTMLCanvasElement} canvas
     * @param {object} [options]  remplace tout ou partie de REGLAGES
     * @param {function} [fin]    appelée sur la dernière image
     * @returns {function} fonction d'arrêt
     */
    function jouer(canvas, options, fin) {
        const r = Object.assign({}, REGLAGES, options || {});
        const m = mouvement(r);
        const total = Math.round(r.tours) * 2 * Math.PI;   // tours entiers : départ = logo
        const ctx = canvas.getContext('2d');
        const debut = performance.now();
        let requete = null;

        function image(maintenant) {
            const u = Math.min((maintenant - debut) / r.duree, 1);
            // Angle parcouru : 1 - (1 - u)^courbe. La vitesse, maximale au départ, ne fait que
            // décroître jusqu'à zéro : jamais d'accélération apparente.
            const reste = total * Math.pow(1 - u, r.courbe);
            const n1 = tourner(NORMALE_1, m.axe, -reste);
            const n2 = tourner(NORMALE_2, m.axe, -reste);
            const coch = {
                x: COCHONNET.x + reste * m.sens[0],
                y: COCHONNET.y + reste * m.sens[1],
                r: COCHONNET.r
            };
            dessiner(ctx, canvas.width, n1, n2, coch);
            if (u < 1) {
                requete = requestAnimationFrame(image);
            } else if (fin) {
                fin();
            }
        }
        requete = requestAnimationFrame(image);
        return function arreter() { if (requete) cancelAnimationFrame(requete); };
    }

    // --- Branchement sur le logo ---------------------------------------------------------
    // Seulement en mobile (boule seule). À l'arrivée sur l'accueil, la boule entre déjà lancée,
    // en fondu, à la place du logo fixe que style.css cache dès le premier affichage : on ne voit
    // donc jamais le logo avant l'animation. Au clic, quand celui-ci ne quitte pas la page
    // (href="#top" sur l'accueil), elle repart depuis le logo. Sur les autres pages, la navigation
    // couperait l'animation : le script n'est chargé que sur les accueils.

    const MOBILE = window.matchMedia('(max-width: 1024px)');
    const MOINS_DANIMATION = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Fondu d'entrée de la boule à l'arrivée sur la page, en ms.
    const FONDU_ARRIVEE = 200;

    function brancherLogo() {
        const lien = document.querySelector('.brand-link');
        if (!lien) return;
        const logo = lien.querySelector('img.logo');
        const cadre = lien.querySelector('picture');
        if (!logo || !cadre) return;

        let enCours = false;

        function afficherLogo() {
            logo.style.visibility = '';
        }

        /** @param {boolean} arrivee  vrai à l'arrivée sur la page (entrée en fondu) */
        function lancer(arrivee) {
            if (enCours) return;
            // Le script prend le relais du filet de sécurité CSS (voir style.css) : sans ceci,
            // l'animation CSS réafficherait le logo au bout de 2 s, en pleine animation.
            logo.style.animation = 'none';
            // La boule est carrée et sa hauteur fixée par le CSS : connue avant même que
            // l'image soit chargée, ce qui permet de démarrer sans l'attendre.
            const cote = logo.getBoundingClientRect().height;
            if (!MOBILE.matches || MOINS_DANIMATION.matches || !cote) { afficherLogo(); return; }
            enCours = true;

            // Le canvas se pose exactement sur l'image, qui est masquée le temps de l'animation.
            // Sa classe lui donne la même ombre portée que le logo (style-ombres.css).
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = Math.round(cote * (window.devicePixelRatio || 1));
            canvas.className = 'logo-anime';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:absolute;left:0;top:0;width:' + cote + 'px;height:' +
                cote + 'px;pointer-events:none;';
            cadre.style.position = 'relative';
            cadre.appendChild(canvas);
            logo.style.visibility = 'hidden';
            if (arrivee && canvas.animate) {
                canvas.animate([{ opacity: 0 }, { opacity: 1 }],
                               { duration: FONDU_ARRIVEE, easing: 'ease-out' });
            }

            jouer(canvas, null, function () {
                afficherLogo();
                canvas.remove();
                enCours = false;
            });
        }

        if ((lien.getAttribute('href') || '').charAt(0) === '#') {
            lien.addEventListener('click', function () { lancer(false); });
        }

        // Arrivée sur la page : tout de suite, le logo fixe n'a pas encore été montré.
        lancer(true);

        // Retour par le bouton « précédent » : le navigateur ressort la page de sa mémoire sans
        // la recharger, le script ne repasse donc pas par ici. On cache le logo en quittant la
        // page pour qu'il ne réapparaisse pas fixe au retour, puis la boule rentre comme à
        // l'arrivée.
        window.addEventListener('pagehide', function () {
            if (MOBILE.matches && !MOINS_DANIMATION.matches && !enCours) {
                logo.style.visibility = 'hidden';
            }
        });
        window.addEventListener('pageshow', function (e) {
            if (e.persisted) lancer(true);
        });
    }

    window.BouleAnimee = { jouer: jouer, reglages: REGLAGES };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', brancherLogo);
    } else {
        brancherLogo();
    }
})();
