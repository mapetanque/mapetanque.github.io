// ===================== Accueil : zone « carte » à deux onglets =====================
// #zone-carte des quatre index.html (styles : /style-accueil-onglets.css). Maquette validée le
// 19/10/2026 : maquettes/zone-carte-onglets/.
//   - La bande affichée en arrivant est choisie par le petit script de index.html, juste après la
//     zone : l'autre que la fois précédente (?bande=contribuer ou ?bande=respiration pour tester).
//   - Ensuite, comme les onglets de la zone compte (accueil-compte.js) : les bandes changent seules
//     toutes les DUREE ms tant que la zone est à l'écran, le fil sous l'onglet montre le temps qui
//     reste. Un clic sur un onglet ou dans une bande fige la bande affichée jusqu'au prochain
//     chargement de la page (rien n'est retenu).
//   - Pas de changement automatique si le visiteur a demandé moins d'animations.
(function () {
    var zone = document.getElementById('zone-carte');
    if (!zone) return;

    var DUREE = 10000;
    var onglets = Array.prototype.slice.call(zone.querySelectorAll('.zone-carte-onglet'));
    var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var minuterie = null;
    var arretDefinitif = false;     // le visiteur a cliqué dans la zone
    var enVue = false;
    zone.style.setProperty('--duree', DUREE + 'ms');

    function bande(onglet) { return document.getElementById(onglet.getAttribute('aria-controls')); }
    function ongletAffiche() {
        return onglets.filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0] || onglets[0];
    }

    function afficher(onglet, anime) {
        onglets.forEach(function (o) {
            var actif = o === onglet;
            o.setAttribute('aria-selected', actif ? 'true' : 'false');
            o.tabIndex = actif ? 0 : -1;
            var b = bande(o);
            b.hidden = !actif;
            b.classList.remove('apparait');
            if (actif && anime) { void b.offsetWidth; b.classList.add('apparait'); }
        });
    }

    // Relance le fil de l'onglet affiché depuis le début.
    function relancerFil() {
        onglets.forEach(function (o) { o.querySelector('.zone-carte-fil').classList.remove('court'); });
        var fil = ongletAffiche().querySelector('.zone-carte-fil');
        void fil.offsetWidth;
        fil.classList.add('court');
    }

    function arreter() {
        clearInterval(minuterie);
        minuterie = null;
        zone.dataset.auto = 'non';
    }

    function lancer() {
        if (minuterie || arretDefinitif || mouvementReduit || !enVue) return;
        zone.dataset.auto = 'oui';
        relancerFil();
        minuterie = setInterval(function () {
            afficher(onglets[(onglets.indexOf(ongletAffiche()) + 1) % onglets.length], true);
            relancerFil();
        }, DUREE);
    }

    function figer() {
        arretDefinitif = true;
        arreter();
    }

    onglets.forEach(function (o, i) {
        o.addEventListener('click', function () {
            figer();
            if (o !== ongletAffiche()) afficher(o, true);
        });
        // Flèches gauche / droite entre les onglets.
        o.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            var autre = onglets[(i + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length];
            autre.focus();
            autre.click();
        });
        // Un clic dans une bande (« Terrains sans photo près de moi »…) : elle reste à l'écran.
        bande(o).addEventListener('click', figer);
    });

    // Ne défile que quand la zone est à l'écran
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entrees) {
            enVue = entrees[0].isIntersecting;
            if (enVue) lancer(); else arreter();
        }, { threshold: 0.3 }).observe(zone);
    }

    afficher(ongletAffiche(), false);
})();
