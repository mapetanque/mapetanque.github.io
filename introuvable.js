/* =============================================================================================
   Page introuvable (404.html) : liens dans la langue de l'adresse et recherche d'une commune.

   Chargé après script.js, dont il utilise t(), currentLang, urlPageCarte() et communesLiens
   (data/communes_liens.json, déjà téléchargé par script.js pour les fiches).
============================================================================================= */

(function () {
    'use strict';

    const prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';

    // Le titre de l'onglet n'est pas traduit par script.js hors de l'accueil
    document.title = t('introuvable_onglet');

    // Liens de la page vers la même langue que l'adresse (/nl/… → /nl/carte.html)
    document.querySelectorAll('.introuvable [data-lien]').forEach(function (lien) {
        lien.href = prefixe + lien.dataset.lien;
    });

    // --- Recherche d'une commune --------------------------------------------------------------

    const formulaire = document.getElementById('introuvable-recherche');
    const champ = document.getElementById('introuvable-champ');
    const liste = document.getElementById('introuvable-resultats');
    if (!formulaire || !champ || !liste) return;

    // « Liège » → « liege », « Sint-Niklaas » → « sint-niklaas » : comme les noms de fichier
    function normaliser(texte) {
        return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    // Nombre de fautes de frappe entre deux mots (distance de Levenshtein)
    function distance(a, b) {
        const ligne = [];
        for (let j = 0; j <= b.length; j++) ligne.push(j);
        for (let i = 1; i <= a.length; i++) {
            let diagonale = ligne[0];
            ligne[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const dessus = ligne[j];
                ligne[j] = Math.min(ligne[j] + 1, ligne[j - 1] + 1,
                    diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
                diagonale = dessus;
            }
        }
        return ligne[b.length];
    }

    function nomCommune(commune) {
        return commune.noms ? commune.noms[currentLang] : commune.nom;
    }

    // Communes dont un nom (dans n'importe quelle langue) commence par le texte tapé, ou s'en
    // écarte d'une ou deux fautes de frappe. Les plus proches d'abord, puis les plus fournies.
    function communesProches(texte) {
        const cherche = normaliser(texte);
        if (cherche.length < 2 || !communesLiens) return [];
        const trouvees = [];
        Object.keys(communesLiens.communes).forEach(function (slug) {
            const commune = communesLiens.communes[slug];
            const noms = [slug].concat(commune.noms ? Object.values(commune.noms) : [commune.nom])
                .map(normaliser);
            let ecart = Infinity;
            noms.forEach(function (nom) {
                if (nom.startsWith(cherche)) ecart = 0;
                const d = distance(cherche, nom);
                if (d <= Math.max(1, Math.floor(nom.length / 4))) ecart = Math.min(ecart, d);
            });
            if (ecart < Infinity) trouvees.push({ slug: slug, commune: commune, ecart: ecart });
        });
        trouvees.sort(function (a, b) {
            return a.ecart - b.ecart || b.commune.terrains - a.commune.terrains;
        });
        return trouvees.slice(0, 5);
    }

    // Page de la commune si elle en a une, sinon la carte cadrée sur ses terrains
    function adresseCommune(r) {
        return r.commune.page
            ? prefixe + 'commune/' + r.slug + '.html'
            : urlPageCarte('?commune=' + encodeURIComponent(r.slug));
    }

    function echapper(texte) {
        return String(texte).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    let resultats = [];

    function afficher() {
        const texte = champ.value.trim();
        resultats = communesProches(texte);
        const etaitCachee = liste.hidden;
        if (resultats.length) {
            liste.innerHTML = resultats.map(function (r) {
                const n = r.commune.terrains;
                const nombre = n > 1
                    ? t('introuvable_terrains').replace('{n}', n)
                    : t('introuvable_un_terrain');
                return '<li><a href="' + adresseCommune(r) + '"><span class="nom">'
                    + echapper(nomCommune(r.commune)) + '</span><span class="nombre">'
                    + nombre + '</span></a></li>';
            }).join('');
        } else if (normaliser(texte).length >= 2 && communesLiens) {
            liste.innerHTML = '<li class="aucune">' + echapper(t('introuvable_aucune')) + '</li>';
        } else {
            liste.innerHTML = '';
        }
        liste.hidden = !liste.innerHTML;
        // Fondu seulement quand la liste apparaît, pas à chaque lettre
        if (etaitCachee && !liste.hidden) {
            liste.classList.remove('vient');
            void liste.offsetWidth;
            liste.classList.add('vient');
        }
    }

    champ.addEventListener('input', afficher);

    // Entrée : la première commune trouvée, sinon la recherche d'adresse de la carte
    formulaire.addEventListener('submit', function (e) {
        e.preventDefault();
        const texte = champ.value.trim();
        if (!texte) return;
        const premiere = communesProches(texte)[0];
        window.location.href = premiere
            ? adresseCommune(premiere)
            : urlPageCarte('?q=' + encodeURIComponent(texte));
    });
})();
