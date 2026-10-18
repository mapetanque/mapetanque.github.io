// ===================== Page Mes parties =====================
// mes-parties.html (et ses versions nl/, de/, en/), générée par scripts/generer_mes_parties.py.
// Mise en page validée sur maquettes/mes-parties/index.html (décisions du 10 octobre 2026 dans
// NOTES_comptes_utilisateurs.md, « Étape 2, phase 2 »). Dessinée dans #mes-parties :
//   - filtres en haut, appliqués à toute la page : période, format, et « Avec ou contre {nom} »
//     quand on touche un partenaire ou un adversaire ;
//   - chiffres clés, « Avec qui », parties groupées par mois (5, puis « Afficher 10 de plus »,
//     activité par mois à dérouler), records, terrains les plus joués ;
//   - fiche commune d'une partie (panneau, maquettes/parties-communes/, onglet « Fiche
//     commune ») : victoire ou défaite de son côté, les équipes (« Vous », puis les comptes, puis
//     « Joueur invité »), format, durée, terrain, mène par mène, dernière modification, et
//     « Modifier » (format, noms des équipes, terrain), « Retirer de mes parties ».
// Parties communes (NOTES_parties_communes.md du dépôt privé des Workers) : une seule partie pour
// tous ses joueurs, une correction profite à tous ; plus de carnet de joueurs, « Avec qui » se
// compte sur les comptes inscrits (les invités n'ont pas de nom). Toutes les parties arrivent en
// une requête (GET /parties/mes-parties : parties finies et assez longues où l'on a une place de
// joueur) ; les statistiques sont calculées ici. Modifier : POST /parties/modifier ; retirer :
// POST /parties/quitter (sa place redevient un invité, la partie reste aux autres).
// Sans session (ou session refusée par le Worker) : renvoi vers la page Connexion, qui ramène
// ici une fois connecté (?retour=).
//
// Chargé après script.js (t, currentLang, echapperAvis, chargerIndexRecherche, cleRecherche,
// titreLieuRecherche…) et compte.js (window.mapetanqueCompte).
(function () {
    var zone = document.getElementById('mes-parties');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;

    var prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
    var locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    var PAR_PAGE = 5;         // parties montrées d'abord
    var PAS = 10;             // parties ajoutées par « Afficher 10 de plus »
    var MAX_RESULTATS = 8;    // terrains proposés par la recherche de la fiche

    var parties = null;       // toutes les parties, de la plus récente à la plus ancienne
    var erreur = false;
    var F = { periode: 'tout', format: 0, joueur: null };
    var nbMontrees = PAR_PAGE;
    var onglet = 'avec';      // « Avec qui » : partenaires ou adversaires
    var activiteOuverte = false;
    var statutPage = '';      // « Partie retirée de vos parties… », en haut de la page
    var lieux = {};           // osm_id -> lieu de data/recherche.json
    var listeLieux = [];
    var communes = {};

    // Fiche ouverte : identifiant de la partie et ce qu'elle montre
    var fiche = { id: null, mode: 'vue', edition: null, refus: '', statut: '' };

    function picto(chemins) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
    }
    var PICTOS = {
        croix: picto('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
        lieu: picto('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
        crayon: picto('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
        historique: picto('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
        ok: picto('<circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9.5"/>'),
        chercher: picto('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')
    };


    // --- Outils -----------------------------------------------------------------------------

    function echapper(texte) {
        return echapperAvis(texte);
    }

    function libelle(cle, valeurs) {
        var texte = t(cle) || translations.fr[cle] || cle;
        for (var nom in valeurs) texte = texte.split('{' + nom + '}').join(valeurs[nom]);
        return texte;
    }

    // « 1 partie », « 3 parties » (et « 0 partie » en français)
    function pluriel(cle, n) {
        var un = currentLang === 'fr' ? n < 2 : n === 1;
        return libelle(cle + (un ? '_1' : '_n'), { n: n });
    }

    function pct(v, n) {
        return n ? Math.round(100 * v / n) : 0;
    }

    function listeEt(noms) {
        if (noms.length < 2) return noms.join('');
        return noms.slice(0, -1).join(', ') + ' ' + t('compteur_et') + ' ' + noms[noms.length - 1];
    }

    function nomFormat(format) {
        return t('compteur_format_' + format + '_nom');
    }

    function score(p) {
        return p.nous + ' – ' + p.eux;
    }

    function fanny(p) {
        return p.nous === 0 || p.eux === 0;
    }

    function versConnexion() {
        window.location.replace(prefixe + 'connexion.html?retour=' + encodeURIComponent(window.location.pathname));
    }

    // Dates de la base : « AAAA-MM-JJ HH:MM:SS », en UTC
    function lireDate(texte) {
        var date = new Date(String(texte || '').replace(' ', 'T') + 'Z');
        return isNaN(date) ? null : date;
    }

    function dateCourte(date) {
        var options = { weekday: 'short', day: 'numeric', month: 'short' };
        if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
        return date.toLocaleDateString(locale, options);
    }

    function dateSimple(date) {
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function dateLongue(date) {
        return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            + ', ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }

    function nomMois(date) {
        var texte = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        return texte.charAt(0).toUpperCase() + texte.slice(1);
    }


    // --- Données ----------------------------------------------------------------------------
    // Une partie commune du Worker (score_a, score_b, joueurs par équipe, moi…) est vue ici du
    // côté du compte : « nous » et « eux », ses partenaires et ses adversaires (comptes, par leur
    // pseudo), et les joueurs invités de chaque équipe (un nombre : ils n'ont pas de nom).

    function preparer(brut) {
        var moi = brut.moi && brut.moi.equipe === 'b' ? 'b' : 'a';
        var autre = moi === 'a' ? 'b' : 'a';
        var debut = lireDate(brut.debut) || new Date(0);
        var fin = lireDate(brut.fin) || debut;
        var nous = 0, eux = 0;
        var menes = (brut.menes || []).map(function (m) {
            var aNous = m.e === moi;
            if (aNous) nous = Math.min(brut.objectif, nous + m.p); else eux = Math.min(brut.objectif, eux + m.p);
            return { nous: aNous, pts: m.p, a: nous, b: eux };
        });
        var joueurs = brut.joueurs || { a: [], b: [] };
        var pseudos = function (liste) {
            return liste.filter(function (x) { return !x.moi && x.pseudo; }).map(function (x) { return x.pseudo; });
        };
        var scoreNous = moi === 'a' ? brut.score_a : brut.score_b;
        return {
            id: brut.id,
            debut: debut,
            minutes: Math.max(1, Math.round((fin - debut) / 60000)),
            format: brut.format,
            objectif: brut.objectif,
            moi: moi,
            nous: scoreNous,
            eux: moi === 'a' ? brut.score_b : brut.score_a,
            gagnee: scoreNous >= brut.objectif,
            avec: pseudos(joueurs[moi] || []),
            contre: pseudos(joueurs[autre] || []),
            invitesNous: (brut.invites || {})[moi] || 0,
            invitesEux: (brut.invites || {})[autre] || 0,
            comptesNous: (joueurs[moi] || []).length,
            comptesEux: (joueurs[autre] || []).length,
            nomNous: brut['nom_' + moi] || '',
            nomEux: brut['nom_' + autre] || '',
            menes: menes,
            terrain: brut.terrain || null,
            modif: brut.derniere_modification || null
        };
    }

    // « un invité », « 2 invités » (clés de la partie en ligne, partie.js)
    function invites(n) {
        return n === 1 ? t('pc_un_invite') : libelle('pc_n_invites', { n: n });
    }

    function trouver(id) {
        return (parties || []).filter(function (p) { return p.id === id; })[0] || null;
    }

    function filtrees(sansFormat) {
        var maintenant = new Date();
        var limite = F.periode === '30' ? new Date(maintenant.getTime() - 30 * 86400000)
            : F.periode === 'annee' ? new Date(maintenant.getFullYear(), 0, 1) : null;
        return parties.filter(function (p) {
            return (!limite || p.debut >= limite)
                && (sansFormat || !F.format || p.format === F.format)
                && (!F.joueur || p.avec.indexOf(F.joueur) >= 0 || p.contre.indexOf(F.joueur) >= 0);
        });
    }

    // Tous les comptes partenaires ou adversaires des parties, avec leur nombre de parties
    function carnet() {
        var m = {};
        parties.forEach(function (p) {
            p.avec.concat(p.contre).forEach(function (j) { m[j] = (m[j] || 0) + 1; });
        });
        return m;
    }


    // --- Statistiques -----------------------------------------------------------------------

    function stats(liste) {
        var n = liste.length;
        var v = liste.filter(function (p) { return p.gagnee; }).length;
        var chrono = liste.slice().sort(function (x, y) { return x.debut - y.debut; });

        var serie = 0, typeSerie = null;
        for (var i = chrono.length - 1; i >= 0; i--) {
            if (typeSerie === null) typeSerie = chrono[i].gagnee;
            if (chrono[i].gagnee !== typeSerie) break;
            serie++;
        }
        var meilleure = 0, cours = 0, finMeilleure = null;
        chrono.forEach(function (p) {
            cours = p.gagnee ? cours + 1 : 0;
            if (cours > meilleure) { meilleure = cours; finMeilleure = p.debut; }
        });
        // Plus belle remontée : la victoire où l'on a été le plus mené
        var remontee = null;
        liste.forEach(function (p) {
            if (!p.gagnee) return;
            var pire = 0, a = 0, b = 0;
            p.menes.forEach(function (m) { if (m.b - m.a > pire) { pire = m.b - m.a; a = m.a; b = m.b; } });
            if (pire > 0 && (!remontee || pire > remontee.ecart)) remontee = { ecart: pire, a: a, b: b, p: p };
        });
        var longue = null;
        liste.forEach(function (p) { if (!longue || p.minutes > longue.minutes) longue = p; });

        return {
            n: n, v: v,
            serie: serie, typeSerie: typeSerie,
            meilleure: meilleure, finMeilleure: finMeilleure,
            remontee: remontee, longue: longue,
            ecart: n ? liste.reduce(function (s, p) { return s + p.nous - p.eux; }, 0) / n : 0,
            fannysDonnees: liste.filter(function (p) { return fanny(p) && p.gagnee; }).length,
            fannysPrises: liste.filter(function (p) { return fanny(p) && !p.gagnee; }).length,
            duree: n ? Math.round(liste.reduce(function (s, p) { return s + p.minutes; }, 0) / n) : 0
        };
    }

    // Partenaires ou adversaires, comptés par joueur (pas par équipe)
    function parJoueur(liste, cote) {
        var m = {};
        liste.forEach(function (p) {
            p[cote].forEach(function (j) {
                m[j] = m[j] || { nom: j, n: 0, v: 0 };
                m[j].n++;
                if (p.gagnee) m[j].v++;
            });
        });
        return Object.keys(m).map(function (k) { return m[k]; })
            .sort(function (x, y) { return y.n - x.n || y.v - x.v; });
    }


    // --- Terrains ---------------------------------------------------------------------------
    // Nom et position des terrains : l'index de la recherche (data/recherche.json), comme Mon
    // compte. Un terrain regroupé avec un voisin (data/groupes_terrains.json) n'y figure que sous
    // l'identifiant du groupe : ses autres identifiants y renvoient.

    function chargerTerrains() {
        var groupes = fetch('/data/groupes_terrains.json')
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; });
        return Promise.all([chargerIndexRecherche(), groupes])
            .then(function (resultats) {
                var index = resultats[0];
                communes = index.communes;
                listeLieux = index.lieux;
                index.lieux.forEach(function (l) { lieux[l.o] = l; });
                (resultats[1] || []).forEach(function (groupe) {
                    var lieu = null;
                    groupe.forEach(function (id) { lieu = lieu || lieux[id]; });
                    if (lieu) groupe.forEach(function (id) { if (!lieux[id]) lieux[id] = lieu; });
                });
            })
            .catch(function () { /* noms des terrains indisponibles : « Terrain » seul */ });
    }

    // « Vottem · Herstal », ou seulement la commune quand la localité porte son nom
    function lieuTerrain(l) {
        var commune = communes[l.c] ? nomCommuneRecherche(communes[l.c]) : '';
        var localite = l.l ? nomLocaliteRecherche(l.l) : '';
        if (localite && commune && localite !== commune) return localite + ' · ' + commune;
        return localite || commune;
    }

    function nomTerrain(osm) {
        var l = lieux[osm];
        if (!l) return t('popup_terrain_default');
        var lieu = lieuTerrain(l);
        return titreLieuRecherche(l) + (lieu ? ', ' + lieu : '');
    }

    function lienTerrain(osm) {
        var l = lieux[osm];
        return l ? prefixe + 'carte.html?lat=' + Number(l.lat).toFixed(6) + '&lon=' + Number(l.lon).toFixed(6) : null;
    }

    // Terrains du site dont la rue, la localité ou la commune commence par ce qui est tapé
    function chercherTerrains(texte) {
        var requete = cleRecherche(texte.trim());
        if (requete.length < 2) return [];
        var trouves = [];
        listeLieux.forEach(function (l) {
            var noms = [l.r || '', l.l ? nomLocaliteRecherche(l.l) : '', communes[l.c] ? nomCommuneRecherche(communes[l.c]) : ''];
            var meilleure = null;
            noms.forEach(function (nom, i) {
                var c = nom && correspondanceRecherche(nom, requete);
                if (c && (meilleure === null || c.qualite * 3 + i < meilleure)) meilleure = c.qualite * 3 + i;
            });
            if (meilleure !== null) trouves.push({ l: l, q: meilleure });
        });
        return trouves.sort(function (x, y) { return x.q - y.q; }).slice(0, MAX_RESULTATS).map(function (x) { return x.l; });
    }


    // --- Rendu de la page -------------------------------------------------------------------

    function dessiner() {
        if (erreur) {
            zone.innerHTML = '<p class="mp-statut erreur">' + echapper(t('mesparties_err')) + '</p>';
            return;
        }
        if (!parties) {
            zone.innerHTML = '<p class="mp-mention">' + echapper(t('mesparties_chargement')) + '</p>';
            return;
        }
        var session = compte.session() || {};
        var nom = session.pseudo || session.email || '';
        if (!parties.length) {
            zone.innerHTML = '<p class="mp-sous-titre">' + echapper(nom) + '</p>' + blocStatutPage() + vide();
            return;
        }

        var premiere = parties[parties.length - 1].debut;
        var h = '<p class="mp-sous-titre">' + echapper(nom) + ' · '
            + echapper(libelle('mesparties_depuis', { parties: pluriel('mesparties_parties', parties.length), date: dateSimple(premiere) })) + '</p>'
            + blocStatutPage();
        // Filtre d'un joueur renommé ou fusionné entre-temps : il n'a plus de partie
        if (F.joueur && !(F.joueur in carnet())) F.joueur = null;
        var liste = filtrees(false);
        h += filtres();
        if (!liste.length) {
            h += '<div class="mp-carte"><p class="mp-vide-petit">' + echapper(t('mesparties_aucune_filtre')) + '</p></div>';
        } else {
            var s = stats(liste);
            h += chiffres(s) + avecQui(liste) + listeParties(liste) + records(s) + terrains(liste);
        }
        zone.innerHTML = h;
        if (liste.length && activiteOuverte) dessinerMois(liste);
    }

    function blocStatutPage() {
        return statutPage ? '<p class="mp-statut-page" role="status">' + PICTOS.ok + '<span>' + echapper(statutPage) + '</span></p>' : '';
    }

    function vide() {
        return '<div class="mp-carte mp-vide"><span class="mp-main">' + echapper(t('mesparties_vide_titre')) + '</span>'
            + '<p>' + echapper(t('mesparties_vide')) + '</p>'
            + '<a class="mp-btn vert" href="' + prefixe + 'partie.html?nouvelle=1">' + echapper(t('pc_nouvelle')) + '</a></div>';
    }

    function filtres() {
        var base = filtrees(true);
        var periodes = [['30', 'mesparties_periode_30'], ['annee', 'mesparties_periode_annee'], ['tout', 'mesparties_periode_tout']]
            .map(function (x) {
                var actif = F.periode === x[0];
                return '<button type="button" data-periode="' + x[0] + '" class="' + (actif ? 'actif' : '') + '" aria-pressed="' + actif + '">' + echapper(t(x[1])) + '</button>';
            }).join('');
        var formats = [0, 1, 2, 3].map(function (f) {
            var nombre = base.filter(function (p) { return !f || p.format === f; }).length;
            if (f && !nombre && F.format !== f) return '';
            var actif = F.format === f;
            return '<button type="button" class="mp-filtre' + (actif ? ' actif' : '') + '" data-format="' + f + '" aria-pressed="' + actif + '">'
                + echapper(f ? nomFormat(f) : t('mesparties_format_tous')) + '<b>' + nombre + '</b></button>';
        }).join('');
        var joueur = F.joueur
            ? '<button type="button" class="mp-filtre mp-filtre-joueur" data-action="sansJoueur" aria-label="' + echapper(t('mesparties_retirer_filtre')) + ' : ' + echapper(F.joueur) + '">'
                + echapper(libelle('mesparties_filtre_joueur', { nom: F.joueur })) + PICTOS.croix + '</button>'
            : '';
        return '<div class="mp-filtres"><div class="mp-segment" role="group" aria-label="' + echapper(t('mesparties_periode')) + '">' + periodes + '</div>'
            + '<div class="mp-pastilles">' + formats + joueur + '</div></div>';
    }

    function anneau(p) {
        var r = 32, c = 2 * Math.PI * r, l = c * p / 100;
        return '<svg class="mp-anneau" viewBox="0 0 76 76" role="img" aria-label="' + echapper(libelle('mesparties_pct_victoires', { pct: p })) + '">'
            + '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="#C9D0C3" stroke-width="8"/>'
            + (p ? '<circle cx="38" cy="38" r="' + r + '" fill="none" stroke="#3D7A2A" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + l.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 38 38)"/>' : '')
            + '<text x="38" y="43" text-anchor="middle" class="mp-valeur" style="font-size:16px">' + p + ' %</text></svg>';
    }

    function tuile(lib, val, petit, sous) {
        return '<div class="mp-carte mp-tuile"><span class="mp-lib">' + echapper(lib) + '</span>'
            + '<div class="mp-val">' + val + (petit ? '<small>' + echapper(petit) + '</small>' : '') + '</div>'
            + '<span class="mp-sous">' + echapper(sous) + '</span></div>';
    }

    function chiffres(s) {
        var serie = pluriel(s.typeSerie ? 'mesparties_victoires' : 'mesparties_defaites', s.serie);
        var ecart = (s.ecart >= 0 ? '+' : '−') + uneDecimale(Math.abs(s.ecart));
        return '<div class="mp-tuiles">'
            + '<div class="mp-carte mp-tuile grande">' + anneau(pct(s.v, s.n))
            + '<div><span class="mp-lib">' + echapper(t('mesparties_victoires')) + '</span>'
            + '<div class="mp-val">' + s.v + '<small>' + echapper(libelle('mesparties_sur', { n: s.n })) + '</small></div>'
            + '<span class="mp-sous">' + echapper(libelle('mesparties_pct_parties', { pct: pct(s.v, s.n) })) + '</span></div></div>'
            + tuile(t('mesparties_serie'), s.serie, '', serie)
            + tuile(t('mesparties_ecart'), ecart, '', t('mesparties_ecart_aide'))
            + tuile(t('mesparties_fannys'), s.fannysDonnees, '/ ' + s.fannysPrises, t('mesparties_fannys_aide'))
            + tuile(t('mesparties_duree'), s.duree, t('mesparties_min'), t('mesparties_duree_aide'))
            + '</div>';
    }

    function avecQui(liste) {
        var lignes = parJoueur(liste, onglet);
        var segment = '<div class="mp-segment" role="group" aria-label="' + echapper(t('mesparties_avec_qui')) + '">'
            + ['avec', 'contre'].map(function (o) {
                var actif = onglet === o;
                return '<button type="button" data-onglet="' + o + '" class="' + (actif ? 'actif' : '') + '" aria-pressed="' + actif + '">'
                    + echapper(t(o === 'avec' ? 'mesparties_partenaires' : 'mesparties_adversaires')) + '</button>';
            }).join('') + '</div>';
        var corps = lignes.length
            ? '<ul>' + lignes.slice(0, 6).map(function (j) {
                var p = pct(j.v, j.n);
                return '<li><button type="button" class="mp-ligne-joueur" data-joueur="' + echapper(j.nom) + '">'
                    + '<span class="mp-nomj">' + echapper(j.nom) + '</span>'
                    + '<span class="mp-chiffres">' + echapper(libelle('mesparties_v_sur', { v: j.v, n: j.n })) + '<b>' + p + ' %</b></span>'
                    + '<span class="mp-jauge" aria-hidden="true"><span style="width:' + p + '%"></span></span></button></li>';
            }).join('') + '</ul>'
            : '<p class="mp-vide-petit">' + echapper(t(onglet === 'avec' ? 'mesparties_aucun_partenaire' : 'mesparties_aucun_adversaire')) + '</p>';
        return '<section class="mp-bloc"><h2 class="mp-titre">' + echapper(t('mesparties_avec_qui'))
            + ' <small>' + echapper(t(onglet === 'avec' ? 'mesparties_aide_avec' : 'mesparties_aide_contre')) + '</small></h2>'
            + segment + '<div class="mp-carte mp-joueurs">' + corps + '</div></section>';
    }

    // « Avec Julie et un invité, contre Marc et 2 invités », ou « Contre un invité »
    function texteJoueurs(p) {
        var avec = p.avec.concat(p.invitesNous ? [invites(p.invitesNous)] : []);
        var contre = p.contre.concat(p.invitesEux ? [invites(p.invitesEux)] : []);
        if (!avec.length) return libelle('compteur_contre_seul', { noms: listeEt(contre) });
        return libelle('compteur_avec', { noms: listeEt(avec) }) + (contre.length ? ', ' + libelle('compteur_contre', { noms: listeEt(contre) }) : '');
    }

    function listeParties(liste) {
        var h = '', moisCourant = '';
        liste.slice(0, nbMontrees).forEach(function (p) {
            var cle = p.debut.getFullYear() + '-' + p.debut.getMonth();
            if (cle !== moisCourant) {
                moisCourant = cle;
                var duMois = liste.filter(function (q) { return q.debut.getFullYear() === p.debut.getFullYear() && q.debut.getMonth() === p.debut.getMonth(); });
                var v = duMois.filter(function (q) { return q.gagnee; }).length;
                h += '<div class="mp-mois"><b>' + echapper(nomMois(p.debut)) + '</b><span>'
                    + echapper(pluriel('mesparties_parties', duMois.length) + ' · ' + pluriel('mesparties_victoires', v)) + '</span></div>';
            }
            var lettre = t(p.gagnee ? 'mesparties_lettre_v' : 'mesparties_lettre_d');
            var meta = dateCourte(p.debut) + (p.terrain ? ' · ' + nomTerrain(p.terrain) : '') + ' · ' + p.minutes + ' ' + t('mesparties_min');
            h += '<button type="button" class="mp-partie" data-partie="' + echapper(p.id) + '">'
                + '<span class="mp-res ' + (p.gagnee ? 'v' : 'd') + '" aria-label="' + echapper(t(p.gagnee ? 'compteur_victoire' : 'compteur_defaite')) + '">' + echapper(lettre) + '</span>'
                + '<span class="mp-milieu"><span class="mp-qui">' + echapper(texteJoueurs(p)) + '</span><span class="mp-meta">' + echapper(meta) + '</span></span>'
                + '<span class="mp-sc">' + score(p) + (fanny(p) ? '<span class="mp-fanny">' + echapper(t('compteur_fanny')) + '</span>' : '')
                + '<small>' + echapper(nomFormat(p.format)) + '</small></span></button>';
        });
        var reste = liste.length - nbMontrees;
        var plus = (reste > 0 || nbMontrees > PAR_PAGE)
            ? '<div class="mp-plus">' + (reste > 0 ? '<button type="button" data-action="plus">' + echapper(libelle('recherche_plus', { n: Math.min(PAS, reste) })) + '</button>' : '')
                + (nbMontrees > PAR_PAGE ? '<button type="button" data-action="reduire">' + echapper(t('recherche_moins')) + '</button>' : '') + '</div>'
            : '';
        var activite = '<div class="mp-plus"><button type="button" data-action="activite" aria-expanded="' + activiteOuverte + '">'
            + echapper(t(activiteOuverte ? 'mesparties_activite_masquer' : 'mesparties_activite_voir')) + '</button></div>'
            + (activiteOuverte ? '<div class="mp-graph mp-graph-mois" id="mp-graph-mois"></div>' : '');
        return '<section class="mp-bloc"><h2 class="mp-titre">' + echapper(t('mesparties_liste'))
            + ' <small>' + echapper(libelle('mesparties_en_tout', { n: liste.length })) + '</small></h2>'
            + '<div class="mp-carte mp-liste">' + h + plus + activite + '</div></section>';
    }

    function records(s) {
        var lignes = [];
        if (s.remontee) lignes.push([t('mesparties_remontee'),
            libelle('mesparties_remontee_val', { avant: s.remontee.a + ' – ' + s.remontee.b, apres: score(s.remontee.p) }),
            dateCourte(s.remontee.p.debut), s.remontee.p.id]);
        if (s.meilleure > 1) lignes.push([t('mesparties_serie_record'), pluriel('mesparties_victoires', s.meilleure),
            libelle('mesparties_jusquau', { date: dateCourte(s.finMeilleure) }), null]);
        if (s.longue) lignes.push([t('mesparties_plus_longue'), s.longue.minutes + ' ' + t('mesparties_min'),
            dateCourte(s.longue.debut) + ', ' + score(s.longue), s.longue.id]);
        if (!lignes.length) return '';
        return '<section class="mp-bloc"><h2 class="mp-titre">' + echapper(t('mesparties_records')) + '</h2><div class="mp-carte mp-records">'
            + lignes.map(function (l) {
                var contenu = '<span class="mp-rec-lib">' + echapper(l[0]) + '</span><span class="mp-rec-val">' + echapper(l[1]) + '<small>' + echapper(l[2]) + '</small></span>';
                return l[3] ? '<button type="button" class="mp-record" data-partie="' + echapper(l[3]) + '">' + contenu + '</button>'
                    : '<div class="mp-record">' + contenu + '</div>';
            }).join('') + '</div></section>';
    }

    function terrains(liste) {
        var m = {};
        var sans = 0;
        liste.forEach(function (p) {
            if (!p.terrain) { sans++; return; }
            // Deux identifiants du même groupe de terrains comptent pour un seul terrain
            var cle = lieux[p.terrain] ? lieux[p.terrain].o : p.terrain;
            m[cle] = m[cle] || { osm: cle, n: 0, v: 0 };
            m[cle].n++;
            if (p.gagnee) m[cle].v++;
        });
        var tri = Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 3);
        var corps = tri.map(function (x) {
            var lien = lienTerrain(x.osm);
            var contenu = PICTOS.lieu + '<span>' + echapper(nomTerrain(x.osm)) + '</span><span class="mp-nb">'
                + echapper(pluriel('mesparties_parties', x.n)) + ' · ' + pct(x.v, x.n) + ' %</span>';
            return lien ? '<a class="mp-terrain" href="' + echapper(lien) + '">' + contenu + '</a>' : '<div class="mp-terrain">' + contenu + '</div>';
        }).join('');
        var note = sans ? '<p class="mp-note">' + echapper(pluriel('mesparties_sans_terrain', sans) + ' ' + t('mesparties_sans_terrain_aide')) + '</p>' : '';
        return '<section class="mp-bloc"><h2 class="mp-titre">' + echapper(t('mesparties_terrains'))
            + ' <small>' + echapper(t('mesparties_terrains_aide')) + '</small></h2><div class="mp-carte mp-terrains">' + corps + note + '</div></section>';
    }


    // --- Graphiques -------------------------------------------------------------------------

    // Barre au bout arrondi (4 px) côté donnée, carrée côté base
    function barreHaut(x, y, l, h, arrondi, couleur) {
        if (h <= 0) return '';
        var r = arrondi ? Math.min(4, h, l / 2) : 0;
        return '<path d="M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + l - r)
            + 'Q' + (x + l) + ',' + y + ' ' + (x + l) + ',' + (y + r) + 'V' + (y + h) + 'Z" fill="' + couleur + '"/>';
    }
    function barreBas(x, y, l, h, couleur) {
        if (h <= 0) return '';
        var r = Math.min(4, h, l / 2);
        return '<path d="M' + x + ',' + y + 'V' + (y + h - r) + 'Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h) + 'H' + (x + l - r)
            + 'Q' + (x + l) + ',' + (y + h) + ' ' + (x + l) + ',' + (y + h - r) + 'V' + y + 'Z" fill="' + couleur + '"/>';
    }

    // Bulle au survol ou au toucher d'une colonne (.mp-cible, data-i)
    function brancherBulle(cadre, texte) {
        var bulle = cadre.querySelector('.mp-bulle');
        function montrer(ev) {
            var c = ev.target.closest && ev.target.closest('.mp-cible');
            if (!c) { bulle.classList.remove('vu'); return; }
            var rz = cadre.getBoundingClientRect(), rc = c.getBoundingClientRect();
            bulle.innerHTML = texte(Number(c.getAttribute('data-i')));
            bulle.style.left = Math.max(70, Math.min(rz.width - 70, rc.left - rz.left + rc.width / 2)) + 'px';
            bulle.style.top = (rc.top - rz.top + 6) + 'px';
            bulle.classList.add('vu');
        }
        cadre.addEventListener('pointermove', montrer);
        cadre.addEventListener('click', montrer);
        cadre.addEventListener('pointerleave', function () { bulle.classList.remove('vu'); });
    }

    // Activité par mois : victoires en bas, défaites empilées au-dessus
    function dessinerMois(liste) {
        var cadre = document.getElementById('mp-graph-mois');
        if (!cadre) return;
        var maintenant = new Date();
        var premier = liste.reduce(function (x, p) { return p.debut < x ? p.debut : x; }, maintenant);
        var mois = [];
        for (var d = new Date(premier.getFullYear(), premier.getMonth(), 1); d <= maintenant; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
            var du = liste.filter(function (p) { return p.debut.getFullYear() === d.getFullYear() && p.debut.getMonth() === d.getMonth(); });
            mois.push({ d: d, n: du.length, v: du.filter(function (p) { return p.gagnee; }).length });
        }
        mois = mois.slice(-12);   // une année au plus : les barres restent lisibles sur téléphone
        var L = 400, H = 170, bas = 140, haut = 18;
        var max = Math.max.apply(null, [4].concat(mois.map(function (m) { return m.n; })));
        var pas = max <= 8 ? 2 : max <= 20 ? 5 : 10;
        var plafond = Math.ceil(max / pas) * pas;
        function y(v) { return bas - (bas - haut) * v / plafond; }
        var bande = (L - 30) / mois.length, larg = Math.min(24, bande * 0.5);
        var svg = '';
        for (var g = 0; g <= plafond; g += pas) {
            svg += '<line x1="30" x2="' + L + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#E2E6DE" stroke-width="1"/>'
                + '<text class="mp-axe" x="22" y="' + (y(g) + 4) + '" text-anchor="end">' + g + '</text>';
        }
        mois.forEach(function (m, i) {
            var cx = 30 + bande * (i + 0.5), x = cx - larg / 2;
            if (m.n) {
                var yv = y(m.v), yt = y(m.n);
                if (m.v) svg += barreHaut(x, yv, larg, bas - yv, m.v === m.n, '#3D7A2A');
                if (m.n > m.v) svg += barreHaut(x, yt, larg, (m.v ? yv - 2 : bas) - yt, true, '#C9D0C3');
                svg += '<text class="mp-valeur" x="' + cx + '" y="' + (yt - 6) + '" text-anchor="middle">' + m.n + '</text>';
            }
            svg += '<text class="mp-axe" x="' + cx + '" y="' + (bas + 18) + '" text-anchor="middle">' + echapper(m.d.toLocaleDateString(locale, { month: 'short' })) + '</text>'
                + '<rect class="mp-cible" data-i="' + i + '" x="' + (cx - bande / 2) + '" y="' + haut + '" width="' + bande + '" height="' + (bas - haut + 22) + '" fill="transparent"/>';
        });
        cadre.innerHTML = '<div class="mp-legende"><span><i class="v"></i>' + echapper(t('mesparties_victoires')) + '</span><span><i class="d"></i>' + echapper(t('mesparties_defaites')) + '</span></div>'
            + '<svg viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="' + echapper(t('mesparties_activite_aria')) + '">' + svg + '</svg><div class="mp-bulle"></div>';
        brancherBulle(cadre, function (i) {
            var m = mois[i];
            return '<b>' + echapper(nomMois(m.d)) + '</b><br>' + echapper(pluriel('mesparties_parties', m.n) + ' · ' + pluriel('mesparties_victoires', m.v));
        });
    }

    // Mène par mène : nos mènes vers le haut, les leurs vers le bas
    function dessinerMenes(p) {
        var cadre = document.getElementById('mp-graph-menes');
        if (!cadre || !p.menes.length) return;
        var L = 400, H = 180, milieu = 88, max = Math.max(p.format === 1 ? 3 : 6, Math.max.apply(null, p.menes.map(function (m) { return m.pts; })));
        var ech = 72 / max;
        var n = p.menes.length, bande = (L - 30) / n, larg = Math.min(18, bande * 0.6);
        var svg = '';
        [max, 0, -max].forEach(function (v) {
            svg += '<line x1="30" x2="' + L + '" y1="' + (milieu - v * ech) + '" y2="' + (milieu - v * ech) + '" stroke="' + (v ? '#EEF0EC' : '#E2E6DE') + '" stroke-width="1"/>'
                + '<text class="mp-axe" x="22" y="' + (milieu - v * ech + 4) + '" text-anchor="end">' + (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '</text>';
        });
        p.menes.forEach(function (m, i) {
            var cx = 30 + bande * (i + 0.5), x = cx - larg / 2, h = m.pts * ech;
            svg += m.nous ? barreHaut(x, milieu - h, larg, h, true, '#3D7A2A') : barreBas(x, milieu, larg, h, '#B5502E');
            if (n <= 20 || (i + 1) % 2 === 0) svg += '<text class="mp-axe" x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" style="font-size:11px">' + (i + 1) + '</text>';
            svg += '<rect class="mp-cible" data-i="' + i + '" x="' + (cx - bande / 2) + '" y="0" width="' + bande + '" height="' + (H - 14) + '" fill="transparent"/>';
        });
        cadre.innerHTML = '<div class="mp-legende"><span><i class="v"></i>' + echapper(t('mesparties_legende_nous')) + '</span><span><i class="eux"></i>' + echapper(t('mesparties_legende_eux')) + '</span></div>'
            + '<svg viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="' + echapper(t('mesparties_menes_aria')) + '">' + svg + '</svg><div class="mp-bulle"></div>';
        brancherBulle(cadre, function (i) {
            var m = p.menes[i];
            return '<b>' + echapper(libelle('mesparties_bulle_mene', { n: i + 1 })) + '</b> : '
                + echapper(libelle(m.nous ? 'mesparties_pour_vous' : 'mesparties_pour_eux', { p: m.pts })) + '<br>'
                + echapper(libelle('mesparties_score', { score: m.a + ' – ' + m.b }));
        });
    }


    // --- Fiche d'une partie -----------------------------------------------------------------

    var voile = document.createElement('div');
    voile.className = 'mp-voile';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'mp-fiche-titre');
    voile.innerHTML = '<div class="mp-fiche" id="mp-fiche"></div>';
    document.body.appendChild(voile);
    var cadreFiche = voile.firstChild;
    var focusAvant = null;

    function ouvrirFiche(id) {
        if (!trouver(id)) return;
        if (!voile.classList.contains('ouvert')) focusAvant = document.activeElement;
        fiche = { id: id, mode: 'vue', edition: null, refus: '', statut: '' };
        statutPage = '';
        dessinerFiche();
        voile.classList.add('ouvert');
        document.body.classList.add('mp-fiche-ouverte');
        setTimeout(function () {
            var fermer = cadreFiche.querySelector('.mp-fermer');
            if (fermer) fermer.focus({ preventScroll: true });
        }, 50);
    }

    function fermerFiche() {
        if (!voile.classList.contains('ouvert')) return;
        voile.classList.remove('ouvert');
        document.body.classList.remove('mp-fiche-ouverte');
        fiche = { id: null, mode: 'vue', edition: null, refus: '', statut: '' };
        if (focusAvant && document.contains(focusAvant)) focusAvant.focus({ preventScroll: true });
    }

    function enteteFiche(p) {
        return '<div class="mp-fiche-tete"><div><div class="mp-r ' + (p.gagnee ? 'v' : '') + '" id="mp-fiche-titre">'
            + echapper(t(p.gagnee ? 'compteur_victoire' : 'compteur_defaite')) + ' ' + score(p)
            + (fanny(p) ? ' <span class="mp-fanny">' + echapper(t('compteur_fanny')) + '</span>' : '') + '</div>'
            + '<div class="mp-d">' + echapper(dateLongue(p.debut)) + '</div></div>'
            + '<button type="button" class="mp-fermer" data-action="fermer" aria-label="' + echapper(t('mesparties_fermer')) + '">' + PICTOS.croix + '</button></div>';
    }

    // « Dernière modification : terrain changé par Julie, aujourd'hui à 10:12. » (mêmes clés que
    // la partie en ligne, partie.js)
    function quandRelatif(texte) {
        var date = lireDate(texte);
        if (!date) return '';
        var ecart = Date.now() - date.getTime();
        if (ecart < 60000) return t('pc_instant');
        if (ecart < 3600000) return libelle('pc_il_y_a', { n: Math.round(ecart / 60000) });
        var heure = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        var jour = new Date(); jour.setHours(0, 0, 0, 0);
        if (date >= jour) return libelle('pc_aujourdhui', { heure: heure });
        if (date.getTime() >= jour.getTime() - 86400000) return libelle('pc_hier', { heure: heure });
        return libelle('pc_le', { date: date.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) });
    }

    function phraseModification(m) {
        if (!m) return '';
        var quoi;
        switch (m.champ) {
            case 'format': quoi = libelle('pc_j_format', { format: nomFormat(Number(m.apres)).toLowerCase() }); break;
            case 'objectif': quoi = libelle('pc_j_objectif', { n: m.apres }); break;
            case 'nom_a':
            case 'nom_b': quoi = libelle(m.apres ? 'pc_j_nom' : 'pc_j_nom_efface', { x: m.champ.slice(-1).toUpperCase() }); break;
            case 'terrain': quoi = t(m.apres ? 'pc_j_terrain' : 'pc_j_terrain_retire'); break;
            case 'equipe': quoi = t('pc_j_equipe'); break;
            case 'role': quoi = t(m.apres === 'spectateur' ? 'pc_j_spectateur' : 'pc_j_place'); break;
            case 'depart': quoi = t('pc_j_depart'); break;
            case 'rejoint_apres_fin': quoi = t('pc_j_apres_fin'); break;
            case 'annulation_fin': quoi = t('pc_j_annulation'); break;
            default: return '';
        }
        return libelle('pc_derniere_modif', { quoi: quoi, qui: m.moi ? t('pc_par_vous') : (m.pseudo || '?'), quand: quandRelatif(m.quand) });
    }

    // Les autres joueurs avec un compte (la partie reste chez eux, ils voient les modifications)
    function autresComptes(p) {
        return p.avec.concat(p.contre);
    }

    function dessinerFiche() {
        var p = trouver(fiche.id);
        if (!p) { fermerFiche(); return; }
        if (fiche.mode === 'modifier') { dessinerModifier(p); return; }
        if (fiche.mode === 'terrain') { dessinerTerrain(p); return; }

        // « Vous » en premier, puis les comptes, puis les joueurs invités
        var invitesHtml = function (n) {
            var l = [];
            for (var i = 0; i < n; i++) l.push('<em>' + echapper(t('pc_joueur_invite')) + '</em>');
            return l;
        };
        var nous = [echapper(t('compteur_vous'))].concat(p.avec.map(echapper), invitesHtml(p.invitesNous)).join(', ');
        var eux = p.contre.map(echapper).concat(invitesHtml(p.invitesEux)).join(', ');
        var terrain = p.terrain
            ? (lienTerrain(p.terrain) ? '<a href="' + echapper(lienTerrain(p.terrain)) + '">' + echapper(nomTerrain(p.terrain)) + '</a>' : echapper(nomTerrain(p.terrain)))
            : '<button type="button" class="mp-lien" data-action="terrain">' + echapper(t('compteur_ajouter_terrain')) + '</button>';
        var modif = phraseModification(p.modif);
        var autres = autresComptes(p);
        var bas;
        if (fiche.mode === 'retirer') {
            bas = '<div class="mp-confirmer"><span>' + echapper(autres.length ? libelle('mesparties_retirer_reste', { noms: listeEt(autres) }) : t('mesparties_retirer_efface')) + '</span>'
                + '<div class="mp-actions"><button type="button" class="mp-btn danger" data-action="retirerOk">' + echapper(t('mesparties_retirer_de')) + '</button>'
                + '<button type="button" class="mp-btn ligne" data-action="retirerNon">' + echapper(t('moncompte_annuler')) + '</button></div>'
                + '<p class="mp-statut" role="status"></p></div>';
        } else {
            bas = '<div class="mp-actions">'
                + '<button type="button" class="mp-btn ligne" data-action="modifier">' + PICTOS.crayon + echapper(t('mesparties_modifier')) + '</button>'
                + '<button type="button" class="mp-btn ligne" data-action="retirer">' + echapper(t('mesparties_retirer_de')) + '</button></div>';
        }
        cadreFiche.innerHTML = enteteFiche(p)
            + '<div class="mp-equipes-fiche">'
            + '<div class="mp-eqf"><span class="mp-t"><i></i>' + echapper(t('compteur_vous') + (p.nomNous ? ' · ' + p.nomNous : '')) + '</span>'
            + '<span class="mp-n">' + nous + '</span><span class="mp-s">' + p.nous + '</span></div>'
            + '<span class="mp-contre">' + echapper(t('mesparties_contre')) + '</span>'
            + '<div class="mp-eqf eux"><span class="mp-t"><i></i>' + echapper(t('mesparties_eux') + (p.nomEux ? ' · ' + p.nomEux : '')) + '</span>'
            + '<span class="mp-n">' + eux + '</span><span class="mp-s">' + p.eux + '</span></div></div>'
            + '<dl class="mp-infos">'
            + '<div><dt>' + echapper(t('mesparties_format')) + '</dt><dd>' + echapper(libelle('mesparties_format_val', { format: nomFormat(p.format), objectif: p.objectif })) + '</dd></div>'
            + '<div><dt>' + echapper(t('mesparties_duree_fiche')) + '</dt><dd>' + echapper(libelle('mesparties_duree_val', { minutes: p.minutes, menes: p.menes.length })) + '</dd></div>'
            + '<div class="large"><dt>' + echapper(t('mesparties_terrain')) + '</dt><dd>' + terrain + '</dd></div></dl>'
            + '<section class="mp-bloc"><h3 class="mp-titre">' + echapper(t('mesparties_menes')) + ' <small>' + echapper(t('mesparties_menes_aide')) + '</small></h3>'
            + '<div class="mp-carte mp-graph" id="mp-graph-menes"></div></section>'
            + (modif ? '<p class="mp-modif">' + PICTOS.historique + '<span>' + echapper(modif) + '</span></p>' : '')
            + (fiche.statut ? '<p class="mp-statut-page" role="status">' + PICTOS.ok + '<span>' + echapper(fiche.statut) + '</span></p>' : '')
            + bas;
        dessinerMenes(p);
    }

    // « Modifier » : format, noms des équipes, terrain. Le score et les mènes ne changent plus ;
    // la modification vaut pour tous les joueurs. Pas de changement d'équipe après la partie.
    function dessinerModifier(p) {
        var e = fiche.edition;
        var formats = [1, 2, 3].map(function (f) {
            var actif = e.format === f;
            return '<button type="button" data-format-fiche="' + f + '" class="' + (actif ? 'actif' : '') + '" aria-pressed="' + actif + '">' + echapper(nomFormat(f)) + '</button>';
        }).join('');
        var autre = p.moi === 'a' ? 'b' : 'a';
        var champ = function (cle, etiquette, x) {
            var noms = (x === p.moi ? [t('compteur_vous')].concat(p.avec) : p.contre)
                .concat((x === p.moi ? p.invitesNous : p.invitesEux) ? [invites(x === p.moi ? p.invitesNous : p.invitesEux)] : []);
            return '<div class="mp-champ-groupe"><label class="mp-etiquette" for="mp-' + cle + '">' + echapper(t(etiquette)) + '</label>'
                + '<input type="text" class="mp-champ" id="mp-' + cle + '" data-champ="' + cle + '" value="' + echapper(e[cle]) + '" maxlength="20" autocomplete="off" placeholder="' + echapper(noms.join(' · ')) + '"></div>';
        };
        var terrain = '<div class="mp-terrain-ligne">' + PICTOS.lieu + '<span>' + echapper(p.terrain ? nomTerrain(p.terrain) : t('pc_sans_terrain')) + '</span>'
            + '<button type="button" class="mp-lien" data-action="terrain">' + echapper(t(p.terrain ? 'pc_changer' : 'compteur_ajouter_terrain')) + '</button>'
            + (p.terrain ? '<button type="button" class="mp-lien" data-action="sansTerrain">' + echapper(t('pc_retirer')) + '</button>' : '') + '</div>';
        var autres = autresComptes(p);
        cadreFiche.innerHTML = enteteFiche(p)
            + '<form class="mp-edition" novalidate>'
            + '<div class="mp-champ-groupe"><span class="mp-etiquette">' + echapper(t('compteur_format')) + '</span>'
            + '<div class="mp-segment" role="group" aria-label="' + echapper(t('compteur_format')) + '">' + formats + '</div>'
            + (fiche.refus ? '<p class="mp-statut erreur">' + echapper(fiche.refus) + '</p>' : '') + '</div>'
            + champ('nomNous', 'mesparties_nom_votre', p.moi)
            + champ('nomEux', 'mesparties_nom_autre', autre)
            + '<div class="mp-champ-groupe"><span class="mp-etiquette">' + echapper(t('mesparties_terrain')) + '</span>' + terrain + '</div>'
            + '<p class="mp-note">' + echapper(t('mesparties_modif_aide') + (autres.length ? ' ' + libelle('mesparties_modif_aussi', { noms: listeEt(autres) }) : '')) + '</p>'
            + '<p class="mp-statut" role="status"></p>'
            + '<div class="mp-actions"><button type="submit" class="mp-btn vert">' + echapper(t('mesparties_enregistrer')) + '</button>'
            + '<button type="button" class="mp-btn ligne" data-action="vue">' + echapper(t('moncompte_annuler')) + '</button></div></form>';
    }

    // Reprend les noms tapés avant de redessiner le formulaire (format changé)
    function lireModifier() {
        if (fiche.mode !== 'modifier' || !fiche.edition) return;
        Array.prototype.forEach.call(cadreFiche.querySelectorAll('[data-champ]'), function (c) {
            fiche.edition[c.dataset.champ] = c.value.replace(/\s+/g, ' ').trim();
        });
    }

    // Ajouter ou changer le terrain : recherche parmi les terrains du site, sans position
    function dessinerTerrain(p) {
        cadreFiche.innerHTML = enteteFiche(p)
            + '<div class="mp-champ-groupe"><label class="mp-etiquette" for="mp-recherche-terrain">' + echapper(t('mesparties_chercher_terrain')) + '</label>'
            + '<div class="mp-recherche">' + PICTOS.chercher + '<input type="search" id="mp-recherche-terrain" class="mp-champ" autocomplete="off" placeholder="' + echapper(t('mesparties_chercher_aide')) + '"></div></div>'
            + '<div class="mp-resultats" id="mp-resultats"></div>'
            + '<p class="mp-statut" role="status"></p>'
            + '<div class="mp-actions">'
            + (p.terrain ? '<button type="button" class="mp-btn ligne" data-action="sansTerrain">' + echapper(t('mesparties_retirer_terrain')) + '</button>' : '')
            + '<button type="button" class="mp-btn ligne" data-action="vue">' + echapper(t('moncompte_annuler')) + '</button></div>';
        var champ = document.getElementById('mp-recherche-terrain');
        var resultats = document.getElementById('mp-resultats');
        champ.addEventListener('input', function () {
            var trouves = chercherTerrains(champ.value);
            resultats.innerHTML = trouves.length
                ? trouves.map(function (l) {
                    return '<button type="button" class="mp-terrain" data-terrain="' + echapper(l.o) + '">' + PICTOS.lieu
                        + '<span>' + echapper(titreLieuRecherche(l)) + '<small>' + echapper(lieuTerrain(l)) + '</small></span></button>';
                }).join('')
                : (cleRecherche(champ.value.trim()).length >= 2 ? '<p class="mp-vide-petit">' + echapper(t('mesparties_aucun_resultat')) + '</p>' : '');
        });
        setTimeout(function () { champ.focus(); }, 50);
    }

    function statutFiche(texte) {
        var statut = cadreFiche.querySelector('.mp-statut');
        if (statut) { statut.textContent = texte || ''; statut.classList.toggle('erreur', !!texte); }
    }

    // Envoie une modification de la partie (format, noms, terrain), pour tous ses joueurs, puis
    // relit toutes les parties : statistiques et fiche suivent
    function envoyerModification(p, champs, boutons) {
        champs.id = p.id;
        boutons.forEach(function (b) { b.disabled = true; });
        compte.appel('POST', '/parties/modifier', champs).then(function (reponse) {
            if (reponse.statut === 401) { compte.oublier(); versConnexion(); return; }
            if (reponse.statut !== 200) {
                boutons.forEach(function (b) { b.disabled = false; });
                if (reponse.donnees.erreur === 'format_trop_petit') {
                    fiche.refus = libelle('mesparties_refus_format', { format: nomFormat(champs.format).toLowerCase(), n: Math.max(p.comptesNous, p.comptesEux) });
                    dessinerFiche();
                    return;
                }
                statutFiche(t(reponse.statut === 0 ? 'mesparties_err' : 'compte_err_generique'));
                return;
            }
            recharger().then(function () {
                if (fiche.id === p.id) { fiche.mode = 'vue'; fiche.refus = ''; fiche.statut = t('mesparties_modifs_ok'); dessinerFiche(); }
            });
        });
    }

    // « Retirer de mes parties » : sa place redevient un joueur invité ; la partie reste chez les
    // autres joueurs avec un compte, ou est effacée s'il n'y en a plus
    function retirer(p, bouton) {
        bouton.disabled = true;
        compte.appel('POST', '/parties/quitter', { id: p.id }).then(function (reponse) {
            if (reponse.statut === 401) { compte.oublier(); versConnexion(); return; }
            if (reponse.statut !== 200 && reponse.statut !== 403 && reponse.statut !== 404) {
                bouton.disabled = false;
                statutFiche(t(reponse.statut === 0 ? 'mesparties_err' : 'compte_err_generique'));
                return;
            }
            statutPage = t(reponse.donnees.effacee ? 'mesparties_retiree_effacee' : 'mesparties_retiree_reste');
            parties = parties.filter(function (q) { return q.id !== p.id; });
            fermerFiche();
            dessiner();
        });
    }

    voile.addEventListener('click', function (ev) {
        if (ev.target === voile) { fermerFiche(); return; }
        var p = trouver(fiche.id);
        var b = ev.target.closest('button');
        if (!b || !p) return;
        if (b.dataset.formatFiche) {
            lireModifier();
            var f = Number(b.dataset.formatFiche);
            // Le format ne descend que si les comptes de chaque équipe y tiennent encore
            if (p.comptesNous > f || p.comptesEux > f) {
                fiche.refus = libelle('mesparties_refus_format', { format: nomFormat(f).toLowerCase(), n: Math.max(p.comptesNous, p.comptesEux) });
            } else {
                fiche.refus = '';
                fiche.edition.format = f;
            }
            dessinerFiche();
            return;
        }
        if (b.dataset.terrain) { envoyerModification(p, { terrain: b.dataset.terrain }, [b]); return; }
        var action = b.dataset.action;
        if (action === 'fermer') fermerFiche();
        if (action === 'vue' || action === 'retirerNon') { fiche.mode = 'vue'; fiche.refus = ''; dessinerFiche(); }
        if (action === 'retirer') {
            fiche.mode = 'retirer';
            fiche.statut = '';
            dessinerFiche();
            cadreFiche.querySelector('[data-action="retirerOk"]').focus();
        }
        if (action === 'retirerOk') retirer(p, b);
        if (action === 'modifier') {
            fiche.mode = 'modifier';
            fiche.statut = '';
            fiche.refus = '';
            fiche.edition = { format: p.format, nomNous: p.nomNous, nomEux: p.nomEux };
            dessinerFiche();
        }
        if (action === 'terrain') { fiche.mode = 'terrain'; fiche.statut = ''; dessinerFiche(); }
        if (action === 'sansTerrain') envoyerModification(p, { terrain: null }, [b]);
    });

    voile.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var p = trouver(fiche.id);
        if (!p || fiche.mode !== 'modifier') return;
        lireModifier();
        var e = fiche.edition;
        var autre = p.moi === 'a' ? 'b' : 'a';
        var champs = {};
        if (e.format !== p.format) champs.format = e.format;
        if (e.nomNous !== p.nomNous) champs['nom_' + p.moi] = e.nomNous || null;
        if (e.nomEux !== p.nomEux) champs['nom_' + autre] = e.nomEux || null;
        if (!Object.keys(champs).length) { fiche.mode = 'vue'; dessinerFiche(); return; }
        envoyerModification(p, champs, Array.prototype.slice.call(cadreFiche.querySelectorAll('button')));
    });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && voile.classList.contains('ouvert')) fermerFiche();
    });


    // --- Page : événements ------------------------------------------------------------------

    zone.addEventListener('click', function (ev) {
        var b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.periode) { F.periode = b.dataset.periode; nbMontrees = PAR_PAGE; dessiner(); return; }
        if (b.dataset.format !== undefined) { F.format = Number(b.dataset.format); nbMontrees = PAR_PAGE; dessiner(); return; }
        if (b.dataset.onglet) { onglet = b.dataset.onglet; dessiner(); return; }
        if (b.dataset.joueur) {
            F.joueur = b.dataset.joueur;
            nbMontrees = PAR_PAGE;
            dessiner();
            zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (b.dataset.partie) { ouvrirFiche(b.dataset.partie); return; }
        var action = b.dataset.action;
        if (action === 'sansJoueur') { F.joueur = null; dessiner(); }
        if (action === 'plus') {
            nbMontrees += PAS;
            dessiner();
            var suivante = zone.querySelectorAll('.mp-partie')[nbMontrees - PAS];
            if (suivante) suivante.focus({ preventScroll: true });
        }
        if (action === 'reduire') {
            nbMontrees = PAR_PAGE;
            dessiner();
            var liste = zone.querySelector('.mp-liste');
            if (liste) liste.scrollIntoView({ block: 'nearest' });
        }
        if (action === 'activite') { activiteOuverte = !activiteOuverte; dessiner(); }
    });

    // --- Démarrage --------------------------------------------------------------------------

    // Relit toutes les parties (après une modification) et redessine la page
    function recharger() {
        return compte.appel('GET', '/parties/mes-parties').then(function (reponse) {
            if (reponse.statut === 401) { compte.oublier(); versConnexion(); return; }
            if (reponse.statut === 200) {
                parties = (reponse.donnees.parties || []).map(preparer)
                    .sort(function (x, y) { return y.debut - x.debut; });
                erreur = false;
            } else if (!parties) {
                erreur = true;
            }
            dessiner();
            if (fiche.id && !trouver(fiche.id)) fermerFiche();
        });
    }

    if (!compte.session()) {
        versConnexion();
        return;
    }
    dessiner();
    var terrainsPrets = chargerTerrains();
    recharger().then(function () {
        // Les noms des terrains arrivent parfois après les parties
        terrainsPrets.then(function () {
            if (parties && parties.length) dessiner();
            if (fiche.id && fiche.mode === 'vue') dessinerFiche();
        });
    });

    // Session effacée depuis un autre appareil, ou déconnexion dans un autre onglet
    compte.verifier().then(function (session) {
        if (!session) versConnexion();
    });
    window.addEventListener('mapetanque:compte', function () {
        if (!compte.session()) versConnexion();
    });
})();
