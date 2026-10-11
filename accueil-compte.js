// ===================== Accueil : zone « compte » =====================
// Section #compte-accueil des quatre index.html (styles : /style-accueil-compte.css). Maquette
// validée le 11/10/2026 : maquettes/accueil-compte/index.html (variante A).
//   - Visiteur sans compte : quatre onglets (parties, statistiques, score en direct,
//     contributions). Le téléphone dessiné montre l'écran de l'onglet choisi ; les écrans
//     défilent seuls toutes les 6 s tant que la section est visible, jusqu'au premier clic.
//   - Connecté : « Bon retour, {pseudo} ! », les chiffres du compte (une requête GET
//     /compte/parties) et les boutons Nouvelle partie / Mes parties. Le téléphone montre alors
//     ses vraies statistiques.
// Les écrans sont écrits ici avec t() pour suivre la langue ; les données d'exemple (Julie, Marc…)
// ne servent qu'à l'illustration.
//
// Chargé après script.js (t, currentLang, sessionCompte, entetesCompte, MAPETANQUE_URL_COMPTES,
// echapperAvis, uneDecimale).
(function () {
    var zone = document.getElementById('compte-accueil');
    if (!zone) return;

    var ecran = zone.querySelector('.compte-accueil-ecran');
    var onglets = Array.prototype.slice.call(zone.querySelectorAll('.compte-accueil-onglet'));
    var blocVisiteur = zone.querySelector('.compte-accueil-bloc.visiteur');
    var blocConnecte = zone.querySelector('.compte-accueil-bloc.connecte');
    var DUREE = 6000;
    var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var minuterie = null;
    var arretDefinitif = false;     // le visiteur a choisi un onglet lui-même
    var enVue = false;
    var parties = null;             // parties du compte, préparées (connecté seulement)

    // --- Outils -----------------------------------------------------------------------------

    function locale() {
        return { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    }

    function libelle(cle, valeurs) {
        var texte = t(cle) || translations.fr[cle] || cle;
        for (var nom in valeurs) texte = texte.split('{' + nom + '}').join(valeurs[nom]);
        return texte;
    }

    function pluriel(cle, n) {
        var un = currentLang === 'fr' ? n < 2 : n === 1;
        return libelle(cle + (un ? '_1' : '_n'), { n: n });
    }

    function echapper(texte) {
        return echapperAvis(texte);
    }

    function pct(v, n) {
        return n ? Math.round(100 * v / n) : 0;
    }

    function listeEt(noms) {
        if (noms.length < 2) return noms.join('');
        return noms.slice(0, -1).join(', ') + ' ' + t('compteur_et') + ' ' + noms[noms.length - 1];
    }

    // « Avec Julie, contre Marc et Paul », comme la page Mes parties
    function texteJoueurs(avec, contre) {
        if (!avec.length) return libelle('compteur_contre_seul', { noms: listeEt(contre) });
        return libelle('compteur_avec', { noms: listeEt(avec) }) + (contre.length ? ', ' + libelle('compteur_contre', { noms: listeEt(contre) }) : '');
    }

    function nomMois(date) {
        var texte = date.toLocaleDateString(locale(), { month: 'long' });
        return texte.charAt(0).toUpperCase() + texte.slice(1);
    }

    function dateCourte(date) {
        return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    }

    function picto(chemins) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
    }

    // QR code d'exemple : la forme d'un vrai (repères, ligne de synchronisation), le reste tiré
    // au hasard (toujours le même). Il ne mène nulle part.
    function qrExemple() {
        var g = 7311;
        function h() { g = (g * 16807) % 2147483647; return g / 2147483647; }
        var N = 25, m = [], x, y, i;
        for (y = 0; y < N; y++) { m.push([]); for (x = 0; x < N; x++) m[y].push(h() < 0.47); }
        function repere(ox, oy) {
            for (var y = -1; y < 8; y++) for (var x = -1; x < 8; x++) {
                var X = ox + x, Y = oy + y;
                if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
                var b = Math.max(Math.abs(x - 3), Math.abs(y - 3));
                m[Y][X] = b === 3 || b <= 1;
            }
        }
        repere(0, 0); repere(N - 7, 0); repere(0, N - 7);
        for (i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; }
        var d = '';
        m.forEach(function (l, y) { l.forEach(function (v, x) { if (v) d += 'M' + x + ' ' + y + 'h1v1h-1z'; }); });
        return '<svg viewBox="0 0 ' + N + ' ' + N + '" shape-rendering="crispEdges" aria-hidden="true"><path d="' + d + '" fill="#1D2619"/></svg>';
    }


    // --- Données d'exemple ------------------------------------------------------------------

    function ilYa(jours) {
        var d = new Date();
        d.setDate(d.getDate() - jours);
        return d;
    }

    var EXEMPLE_PARTIES = [
        { debut: ilYa(1), nous: 13, eux: 9, avec: ['Julie'], contre: ['Marc', 'Paul'], minutes: 42 },
        { debut: ilYa(3), nous: 11, eux: 13, avec: [], contre: ['Thomas'], minutes: 35 },
        { debut: ilYa(9), nous: 13, eux: 4, avec: ['Julie'], contre: ['Marc', 'Paul'], minutes: 51 },
        { debut: ilYa(13), nous: 13, eux: 12, avec: ['Marc'], contre: ['Sophie', 'Léa'], minutes: 47 },
        { debut: ilYa(20), nous: 8, eux: 13, avec: [], contre: ['Thomas'], minutes: 30 },
        { debut: ilYa(27), nous: 13, eux: 6, avec: ['Julie'], contre: ['Sophie', 'Léa'], minutes: 39 }
    ];

    var EXEMPLE_STATS = {
        n: 23, v: 14, serie: 3, typeSerie: true, ecart: 2.4, fannysDonnees: 2, fannysPrises: 0, duree: 41,
        joueurs: [{ nom: 'Julie', n: 12, v: 9 }, { nom: 'Marc', n: 7, v: 4 }]
    };


    // --- Écrans du téléphone ----------------------------------------------------------------

    function barre(titre) {
        return '<div class="ca-barre"><i></i>' + echapper(titre) + '</div>';
    }

    function ecranParties(liste, total) {
        var h = '', moisCourant = '';
        liste.slice(0, 6).forEach(function (p) {
            var cle = p.debut.getFullYear() + '-' + p.debut.getMonth();
            if (cle !== moisCourant) {
                moisCourant = cle;
                var duMois = liste.filter(function (q) { return q.debut.getFullYear() === p.debut.getFullYear() && q.debut.getMonth() === p.debut.getMonth(); });
                var v = duMois.filter(function (q) { return q.nous > q.eux; }).length;
                h += '<li class="ca-mois"><b>' + echapper(nomMois(p.debut)) + '</b><small>'
                    + echapper(pluriel('mesparties_parties', duMois.length) + ' · ' + pluriel('mesparties_victoires', v)) + '</small></li>';
            }
            var gagnee = p.nous > p.eux;
            h += '<li><span class="ca-res ' + (gagnee ? 'v' : 'd') + '">' + echapper(t(gagnee ? 'mesparties_lettre_v' : 'mesparties_lettre_d')) + '</span>'
                + '<div><b>' + echapper(texteJoueurs(p.avec, p.contre)) + '</b><small>'
                + echapper(dateCourte(p.debut) + ' · ' + p.minutes + ' ' + t('mesparties_min')) + '</small></div>'
                + '<span class="ca-sc">' + p.nous + ' – ' + p.eux + '</span></li>';
        });
        return barre(t('moncompte_parties_titre'))
            + '<p class="ca-titre haut">' + echapper(t('mesparties_liste') + ' · ' + libelle('mesparties_en_tout', { n: total })) + '</p>'
            + '<ul class="ca-liste">' + h + '</ul>';
    }

    function anneau(p) {
        var r = 32, c = 2 * Math.PI * r, l = c * p / 100;
        return '<svg class="ca-anneau" viewBox="0 0 76 76" aria-hidden="true">'
            + '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="#C9D0C3" stroke-width="8"/>'
            + (p ? '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="#3D7A2A" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + l.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 38 38)"/>' : '')
            + '<text x="38" y="43" text-anchor="middle">' + p + (currentLang === 'en' ? '%' : ' %') + '</text></svg>';
    }

    function tuile(lib, val, petit, sous) {
        return '<div class="ca-tuile"><span class="lib">' + echapper(lib) + '</span>'
            + '<b>' + echapper(val) + (petit ? '<small>' + echapper(petit) + '</small>' : '') + '</b>'
            + '<span class="sous">' + echapper(sous) + '</span></div>';
    }

    function ecranStats(s) {
        var p = pct(s.v, s.n);
        var ecart = (s.ecart >= 0 ? '+' : '−') + uneDecimale(Math.abs(s.ecart));
        var joueurs = s.joueurs.slice(0, 2).map(function (j) {
            var q = pct(j.v, j.n);
            return '<li><span class="nomj">' + echapper(j.nom) + '</span>'
                + '<span class="ch">' + echapper(libelle('mesparties_v_sur', { v: j.v, n: j.n })) + '<b>' + q + (currentLang === 'en' ? '%' : ' %') + '</b></span>'
                + '<span class="ca-jauge"><span style="width:' + q + '%"></span></span></li>';
        }).join('');
        return barre(t('moncompte_parties_titre'))
            + '<div class="ca-seg"><span class="on">' + echapper(t('mesparties_periode_tout')) + '</span><span>'
            + echapper(t('mesparties_periode_annee')) + '</span><span>' + echapper(t('mesparties_periode_30')) + '</span></div>'
            + '<div class="ca-tuiles">'
            + '<div class="ca-tuile grande">' + anneau(p) + '<div><span class="lib">' + echapper(t('mesparties_victoires')) + '</span>'
            + '<b>' + s.v + '<small>' + echapper(libelle('mesparties_sur', { n: s.n })) + '</small></b>'
            + '<span class="sous">' + echapper(libelle('mesparties_pct_parties', { pct: p })) + '</span></div></div>'
            + tuile(t('mesparties_serie'), String(s.serie), '', pluriel(s.typeSerie ? 'mesparties_victoires' : 'mesparties_defaites', s.serie))
            + tuile(t('mesparties_ecart'), ecart, '', t('mesparties_ecart_aide'))
            + tuile(t('mesparties_fannys'), String(s.fannysDonnees), '/ ' + s.fannysPrises, t('mesparties_fannys_aide'))
            + tuile(t('mesparties_duree'), String(s.duree), t('mesparties_min'), t('mesparties_duree_aide'))
            + '</div>'
            + (joueurs ? '<p class="ca-titre">' + echapper(t('mesparties_avec_qui')) + '</p><ul class="ca-liste ca-joueurs">' + joueurs + '</ul>' : '');
    }

    function ecranCompteur() {
        return '<div class="ca-cpt-haut"><span class="ca-direct">' + echapper(t('compte_accueil_ec_direct')) + '</span>'
            + '<span>' + echapper(libelle('compte_accueil_ec_partie_a', { n: 13 })) + '</span></div>'
            + '<div class="ca-moitie a"><span class="ca-suivi">' + echapper(libelle('compte_accueil_ec_suivent', { noms: listeEt(['Julie', 'Marc']) })) + '</span>'
            + '<span class="ca-nom-eq">' + echapper(t('compteur_vous')) + ' · Julie</span><span class="ca-sc-grand">9</span></div>'
            + '<div class="ca-moitie b"><span class="ca-nom-eq">Marc · Paul</span><span class="ca-sc-grand">7</span></div>'
            + '<div class="ca-cpt-bas"><span>↺ ' + echapper(t('compteur_annuler')) + '</span><span>☰ ' + echapper(t('compteur_menes'))
            + '</span><span>' + echapper(t('compteur_equipes')) + '</span><span class="on">' + echapper(t('compteur_partager')) + '</span></div>';
    }

    function ecranContributions() {
        var bulle = picto('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
        var etoile = picto('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
        var lieu = picto('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
        function ligne(vignette, titre, ou, statut, ok) {
            return '<li>' + vignette + '<div><b>' + echapper(titre) + '</b><small>' + echapper(ou) + '</small></div>'
                + '<span class="ca-statut ' + (ok ? 'ok' : 'att') + '">' + echapper(t(statut)) + '</span></li>';
        }
        return barre(t('moncompte_envois_titre'))
            + '<p class="ca-titre haut">' + echapper([t('moncompte_filtre_photos'), t('moncompte_filtre_notes'), t('moncompte_filtre_avis')].join(' · ')) + '</p>'
            + '<ul class="ca-liste">'
            + ligne('<span class="ca-vign photo"></span>', t('moncompte_type_photo'), 'Parc de Fléron', 'moncompte_statut_publiee', true)
            + ligne('<span class="ca-vign">' + bulle + '</span>', t('compte_accueil_ec_avis'), 'Quai de la Boverie, Liège', 'moncompte_statut_attente', false)
            + ligne('<span class="ca-vign">' + etoile + '</span>', libelle('compte_accueil_ec_note', { n: 4 }), 'Parc Josaphat, Schaerbeek', 'moncompte_statut_publie', true)
            + ligne('<span class="ca-vign">' + lieu + '</span>', t('moncompte_signal_manquant'), 'Soumagne', 'moncompte_statut_ajoute', true)
            + '</ul><p class="ca-aide">' + echapper(t('compte_accueil_ec_aide')) + '</p>';
    }

    // Les quatre écrans, dans l'ordre des onglets. Connecté avec des parties : la liste et les
    // statistiques sont les siennes.
    function dessinerEcrans() {
        var liste = parties && parties.length ? parties : EXEMPLE_PARTIES;
        var total = parties && parties.length ? parties.length : EXEMPLE_STATS.n;
        var s = parties && parties.length ? stats(parties) : EXEMPLE_STATS;
        var contenus = [ecranParties(liste, total), ecranStats(s), ecranCompteur(), ecranContributions()];
        var actif = +(zone.dataset.onglet || 0);
        ecran.innerHTML = contenus.map(function (c, i) {
            return '<div class="ca-ec' + (i === 2 ? ' ca-cpt' : '') + (i === actif ? ' visible' : '') + '" data-ec="' + i + '">' + c + '</div>';
        }).join('');
        var qr = zone.querySelector('.compte-accueil-qr');
        qr.innerHTML = qrExemple() + '<b>K7P2</b><small>' + echapper(t('compte_accueil_ec_scanner')) + '</small>';
    }


    // --- Onglets et défilement --------------------------------------------------------------

    function montrer(i) {
        zone.dataset.onglet = i;
        onglets.forEach(function (o, j) { o.setAttribute('aria-selected', String(j === i)); });
        zone.querySelectorAll('.ca-ec').forEach(function (e) { e.classList.toggle('visible', +e.dataset.ec === i); });
    }

    function arreter() {
        clearInterval(minuterie);
        minuterie = null;
        zone.dataset.auto = 'non';
    }

    function lancer() {
        if (minuterie || arretDefinitif || mouvementReduit || !enVue || zone.dataset.etat === 'connecte') return;
        zone.dataset.auto = 'oui';
        // Relance l'animation du fil sur l'onglet en cours
        montrer(+(zone.dataset.onglet || 0));
        minuterie = setInterval(function () {
            montrer((+zone.dataset.onglet + 1) % onglets.length);
        }, DUREE);
    }

    onglets.forEach(function (o, i) {
        o.addEventListener('click', function () {
            arretDefinitif = true;
            arreter();
            montrer(i);
        });
    });

    // Ne défile que quand la section est à l'écran
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entrees) {
            enVue = entrees[0].isIntersecting;
            if (enVue) lancer(); else arreter();
        }, { threshold: 0.3 }).observe(zone);
    }


    // --- Connecté ---------------------------------------------------------------------------

    function lireDate(texte) {
        var date = new Date(String(texte || '').replace(' ', 'T') + 'Z');
        return isNaN(date) ? null : date;
    }

    // Une partie du Worker, vue du côté du titulaire (comme preparer() dans mes-parties.js)
    function preparer(brut) {
        var moi = brut.mon_equipe === 'b' ? 'b' : 'a';
        var autre = moi === 'a' ? 'b' : 'a';
        var debut = lireDate(brut.debut) || new Date(0);
        var fin = lireDate(brut.fin) || debut;
        var joueurs = brut.joueurs || {};
        return {
            debut: debut,
            minutes: Math.max(1, Math.round((fin - debut) / 60000)),
            nous: moi === 'a' ? brut.score_a : brut.score_b,
            eux: moi === 'a' ? brut.score_b : brut.score_a,
            gagnee: Number(brut.victoire) === 1,
            avec: (joueurs[moi] || []).slice(),
            contre: (joueurs[autre] || []).slice(),
            terrain: brut.terrain || null
        };
    }

    function stats(liste) {
        var n = liste.length;
        var v = liste.filter(function (p) { return p.gagnee; }).length;
        var serie = 0, typeSerie = null;
        for (var i = 0; i < liste.length; i++) {      // liste : de la plus récente à la plus ancienne
            if (typeSerie === null) typeSerie = liste[i].gagnee;
            if (liste[i].gagnee !== typeSerie) break;
            serie++;
        }
        var m = {};
        liste.forEach(function (p) {
            p.avec.forEach(function (j) {
                m[j] = m[j] || { nom: j, n: 0, v: 0 };
                m[j].n++;
                if (p.gagnee) m[j].v++;
            });
        });
        function fanny(p) { return p.nous === 0 || p.eux === 0; }
        return {
            n: n, v: v, serie: serie, typeSerie: typeSerie,
            ecart: n ? liste.reduce(function (s, p) { return s + p.nous - p.eux; }, 0) / n : 0,
            fannysDonnees: liste.filter(function (p) { return fanny(p) && p.gagnee; }).length,
            fannysPrises: liste.filter(function (p) { return fanny(p) && !p.gagnee; }).length,
            duree: n ? Math.round(liste.reduce(function (s, p) { return s + p.minutes; }, 0) / n) : 0,
            joueurs: Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.n - x.n || y.v - x.v; })
        };
    }

    function chiffre(n, cle) {
        return '<div><b>' + n + '</b><span>' + echapper(pluriel(cle, n)) + '</span></div>';
    }

    function dessinerConnecte(session) {
        var pseudo = session.pseudo;
        blocConnecte.querySelector('.compte-accueil-accroche').textContent = pseudo
            ? libelle('compte_accueil_bonjour', { pseudo: pseudo }) : t('compte_accueil_bonjour_seul');
        var titre = blocConnecte.querySelector('.compte-accueil-titre');
        var zoneChiffres = blocConnecte.querySelector('.compte-accueil-chiffres');
        var info = blocConnecte.querySelector('.compte-accueil-info');
        if (!parties) {                               // pas encore lues, ou Worker injoignable
            titre.textContent = t('compte_accueil_titre_connecte');
            zoneChiffres.hidden = true;
            info.textContent = '';
            return;
        }
        if (!parties.length) {
            titre.textContent = t('compte_accueil_titre_zero');
            zoneChiffres.hidden = true;
            info.textContent = t('compte_accueil_texte_zero');
            return;
        }
        var v = parties.filter(function (p) { return p.gagnee; }).length;
        var terrains = {};
        parties.forEach(function (p) { if (p.terrain) terrains[p.terrain] = true; });
        var nbTerrains = Object.keys(terrains).length;
        titre.textContent = t('compte_accueil_titre_connecte');
        zoneChiffres.innerHTML = chiffre(parties.length, 'compte_accueil_lib_parties') + chiffre(v, 'compte_accueil_lib_victoires')
            + (nbTerrains ? chiffre(nbTerrains, 'compte_accueil_lib_terrains') : '');
        zoneChiffres.hidden = false;
        var derniere = parties[0];
        info.textContent = libelle('compte_accueil_derniere', {
            score: derniere.nous + ' – ' + derniere.eux,
            date: derniere.debut.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
        });
    }

    function passerConnecte(session) {
        zone.dataset.etat = 'connecte';
        arreter();
        blocVisiteur.hidden = true;
        blocConnecte.hidden = false;
        dessinerConnecte(session);
        montrer(1);                                   // les statistiques
        fetch(MAPETANQUE_URL_COMPTES + '/compte/parties', { headers: entetesCompte() })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (donnees) {
                if (!donnees) return;                 // session expirée ou Worker injoignable
                parties = (donnees.parties || []).map(preparer).sort(function (x, y) { return y.debut - x.debut; });
                dessinerConnecte(session);
                dessinerEcrans();
                // Sans partie, le compteur illustre mieux la suite que des statistiques vides
                montrer(parties.length ? 1 : 2);
            });
    }


    // --- Démarrage --------------------------------------------------------------------------

    dessinerEcrans();
    montrer(0);
    var session = sessionCompte();
    if (session) passerConnecte(session);

    // Retour en arrière vers une autre langue : les écrans sont réécrits dans la nouvelle langue
    window.addEventListener('popstate', function () {
        dessinerEcrans();
        if (zone.dataset.etat === 'connecte') dessinerConnecte(sessionCompte() || {});
    });
})();
