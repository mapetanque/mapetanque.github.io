// ===================== Page Mon compte =====================
// mon-compte.html (et ses versions nl/, de/, en/), générée par scripts/generer_mon_compte.py.
// Mise en page validée sur maquettes/mon-compte/index.html. Dessinée dans #mon-compte :
//   - en-tête : pastille, « Bonjour {pseudo} ! », adresse du compte ;
//   - pseudo sur une ligne, « Modifier » (ou « Choisir ») ouvre le champ sur place ;
//   - « Mes envois » (route /compte/contributions) : filtres qui servent aussi de résumé,
//     5 envois puis « Voir les N autres », chaque envoi mène au terrain sur la carte ;
//   - « Mes parties » annoncé (bientôt), déconnexion, suppression du compte (écran de
//     confirmation dans la page, route /compte/supprimer).
// Sans session (ou session refusée par le Worker) : renvoi vers la page Connexion, qui ramène
// ici une fois connecté (?retour=).
//
// Chargé après script.js (t, currentLang, chargerIndexRecherche, titreLieuRecherche,
// ouvrirModaleSignalement) et compte.js (window.mapetanqueCompte).
(function () {
    var zone = document.getElementById('mon-compte');
    if (!zone || !window.mapetanqueCompte) return;
    var compte = window.mapetanqueCompte;

    var prefixe = currentLang === 'fr' ? '/' : '/' + currentLang + '/';
    var locale = { fr: 'fr-BE', nl: 'nl-BE', de: 'de-BE', en: 'en-GB' }[currentLang] || 'fr-BE';
    var ADRESSE_CONTACT = 'mapetanque@outlook.be';
    var PAR_PAGE = 5;

    var envois = null;        // liste de tous les envois, du plus récent au plus ancien
    var erreurEnvois = false;
    var filtre = 'tout';
    var toutMontrer = false;
    var lieux = null;         // osm_id -> lieu de data/recherche.json (nom et position du terrain)
    var communes = null;      // slug -> commune de data/recherche.json
    var quitte = false;       // déconnexion ou suppression voulue ici : pas de renvoi vers Connexion

    // Pictos au trait (Lucide), comme ceux de la page Connexion
    function picto(chemins) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
    }
    var PICTOS = {
        note: picto('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
        avis: picto('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
        photo: picto('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
        signalement: picto('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
        parties: picto('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>'),
        carte: picto('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
        ajouter: picto('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>')
    };

    // Filtres, dans l'ordre de la maquette : clé du filtre -> type d'envoi
    var FILTRES = [
        ['tout', null],
        ['notes', 'note'],
        ['avis', 'avis'],
        ['photos', 'photo'],
        ['signalements', 'signalement']
    ];

    // Statuts bruts des tables -> [libellé, couleur de l'étiquette, phrase du filtre Photos].
    // Photos : voir les statuts de la page admin ; une photo rattachée à Mapillary est en ligne.
    var STATUTS_PHOTO = {
        en_attente: ['attente', 'attente'],
        a_generer: ['acceptee', 'ok'],
        validee: ['acceptee', 'ok'],
        envoyee: ['acceptee', 'ok'],
        rattachee: ['publiee', 'ok'],
        publiee: ['publiee', 'ok'],
        refusee: ['refusee', 'non']
    };
    var STATUTS_AVIS = {
        en_attente: ['attente', 'attente'],
        publie: ['publie', 'ok'],
        refuse: ['refuse', 'non'],
        retire: ['retire', 'non']
    };

    function echapper(texte) {
        return echapperAvis(texte);
    }

    function versConnexion() {
        window.location.replace(prefixe + 'connexion.html?retour=' + encodeURIComponent(window.location.pathname));
    }

    // Dates de la base : « AAAA-MM-JJ HH:MM:SS », en UTC
    function lireDate(texte) {
        var date = new Date(String(texte || '').replace(' ', 'T') + 'Z');
        return isNaN(date) ? null : date;
    }

    function dateCourte(texte) {
        var date = lireDate(texte);
        if (!date) return '';
        var options = { day: 'numeric', month: 'short' };
        if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
        return date.toLocaleDateString(locale, options);
    }

    function dateLongue(texte) {
        var date = lireDate(texte);
        return date ? date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    }

    function afficherStatut(texte, erreur) {
        var statut = zone.querySelector('.mc-pseudo .connexion-statut');
        if (!statut) return;
        statut.textContent = texte || '';
        statut.classList.toggle('erreur', !!erreur);
    }


    // --- Terrains ---------------------------------------------------------------------------
    // Nom et position des terrains : l'index de la recherche (data/recherche.json), déjà utilisé
    // par la page carte. Un terrain regroupé avec un voisin (data/groupes_terrains.json) n'y
    // figure que sous l'identifiant du groupe : ses autres identifiants y renvoient.

    function chargerTerrains() {
        var groupes = fetch('/data/groupes_terrains.json')
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; });
        return Promise.all([chargerIndexRecherche(), groupes])
            .then(function (resultats) {
                var index = resultats[0];
                communes = index.communes;
                lieux = {};
                index.lieux.forEach(function (l) { lieux[l.o] = l; });
                (resultats[1] || []).forEach(function (groupe) {
                    var lieu = null;
                    groupe.forEach(function (id) { lieu = lieu || lieux[id]; });
                    if (lieu) groupe.forEach(function (id) { if (!lieux[id]) lieux[id] = lieu; });
                });
            })
            .catch(function () { lieux = {}; communes = {}; });
    }

    // « Vottem · Herstal », ou seulement la commune quand la localité porte son nom
    function lieuTerrain(l) {
        var commune = communes[l.c] ? nomCommuneRecherche(communes[l.c]) : '';
        var localite = l.l ? nomLocaliteRecherche(l.l) : '';
        if (localite && commune && localite !== commune) return localite + ' · ' + commune;
        return localite || commune;
    }

    // Commune dont le centre est le plus proche (signalement d'un terrain manquant)
    function communeProche(lat, lon) {
        var meilleure = null, distance = Infinity;
        Object.keys(communes).forEach(function (slug) {
            var c = communes[slug];
            var d = Math.pow(c.lat - lat, 2) + Math.pow((c.lon - lon) * Math.cos(lat * Math.PI / 180), 2);
            if (d < distance) { distance = d; meilleure = c; }
        });
        return meilleure ? nomCommuneRecherche(meilleure) : '';
    }

    // voir : seulement montrer l'endroit, sans ouvrir de fiche (terrain manquant signalé)
    function lienCarte(lat, lon, voir) {
        return prefixe + 'carte.html?lat=' + Number(lat).toFixed(6) + '&lon=' + Number(lon).toFixed(6) + (voir ? '&voir=1' : '');
    }


    // --- Envois -----------------------------------------------------------------------------
    // Réponse de /compte/contributions : { votes, avis, photos, signalements }, chaque liste du
    // plus récent au plus ancien. Tout est ramené ici à une même forme pour la liste.

    function envoiTerrain(type, ligne) {
        var l = lieux[ligne.osm_id];
        return {
            type: type,
            date: ligne.date,
            titre: l ? titreLieuRecherche(l) : (ligne.titre || t('popup_terrain_default')),
            lieu: l ? lieuTerrain(l) : '',
            lien: l ? lienCarte(l.lat, l.lon) : null
        };
    }

    function preparerEnvois(donnees) {
        var liste = [];
        (donnees.votes || []).forEach(function (v) {
            var e = envoiTerrain('note', v);
            e.note = Math.max(0, Math.min(5, Math.round(Number(v.note) || 0)));
            liste.push(e);
        });
        (donnees.avis || []).forEach(function (a) {
            var e = envoiTerrain('avis', a);
            var texte = String(a.texte || '').replace(/\s+/g, ' ').trim();
            e.extrait = texte.length > 90 ? texte.slice(0, 88).trim() + '…' : texte;
            e.statut = STATUTS_AVIS[a.statut] || STATUTS_AVIS.en_attente;
            liste.push(e);
        });
        (donnees.photos || []).forEach(function (p) {
            var e = envoiTerrain('photo', p);
            e.statut = STATUTS_PHOTO[p.statut] || STATUTS_PHOTO.en_attente;
            liste.push(e);
        });
        (donnees.signalements || []).forEach(function (s) {
            var e;
            var aPosition = s.lat !== null && s.lat !== undefined && s.lon !== null && s.lon !== undefined;
            if (s.type === 'manquant') {
                e = { type: 'signalement', date: s.date, titre: t('moncompte_signal_manquant'), lieu: '', lien: null };
                if (aPosition) {
                    var proche = communeProche(Number(s.lat), Number(s.lon));
                    if (proche) e.lieu = t('moncompte_pres_de').replace('{commune}', proche);
                    e.lien = lienCarte(s.lat, s.lon, true);
                }
            } else {
                e = envoiTerrain('signalement', s);
                if (s.type === 'club') {
                    e.titre = s.titre || t('moncompte_signal_club');
                    e.lieu = '';
                    e.lien = null;
                }
            }
            e.detail = t(s.type === 'erreur' ? 'moncompte_signal_erreur' : s.type === 'club' ? 'moncompte_signal_club' : 'moncompte_type_signalement');
            // Reçu, puis Ajouté (terrain manquant) ou Corrigé, ou Non retenu
            e.statut = s.statut === 'traite' ? [s.type === 'manquant' ? 'ajoute' : 'corrige', 'ok']
                : s.statut === 'refuse' ? ['non_retenu', 'non'] : ['recu', 'attente'];
            liste.push(e);
        });
        liste.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
        return liste;
    }

    function envoiHtml(e) {
        var detail;
        if (e.type === 'note') {
            detail = '<span class="mc-etoiles" role="img" aria-label="' + e.note + '/5">'
                + '★★★★★'.slice(0, e.note) + '<i>' + '★★★★★'.slice(e.note) + '</i></span>';
        } else if (e.type === 'avis') {
            detail = echapper('« ' + e.extrait + ' »');
        } else if (e.type === 'photo') {
            // Dans « Tout », le type suffit ; le filtre Photos explique où en est chaque photo
            detail = echapper(filtre === 'photos' ? t('moncompte_photo_' + e.statut[0]) : t('moncompte_type_photo'));
        } else {
            detail = echapper(e.detail);
        }
        var cote = (e.statut ? '<span class="mc-statut ' + e.statut[1] + '">' + echapper(t('moncompte_statut_' + e.statut[0])) + '</span>' : '')
            + '<span class="mc-date">' + echapper(dateCourte(e.date)) + '</span>';
        var corps = '<span class="connexion-picto mc-picto">' + PICTOS[e.type] + '</span>'
            + '<span class="mc-envoi-corps">'
            + '<span class="mc-envoi-titre">' + echapper(e.titre) + '</span>'
            + (e.lieu ? '<span class="mc-envoi-lieu">' + echapper(e.lieu) + '</span>' : '')
            + '<span class="mc-envoi-detail">' + detail + '</span>'
            + '</span>'
            + '<span class="mc-envoi-cote">' + cote + '</span>';
        return e.lien
            ? '<li><a class="mc-envoi" href="' + echapper(e.lien) + '">' + corps + '</a></li>'
            : '<li><div class="mc-envoi">' + corps + '</div></li>';
    }

    function dessinerEnvois() {
        var cadre = zone.querySelector('.mc-envois-zone');
        if (!cadre) return;

        if (erreurEnvois) {
            cadre.innerHTML = '<p class="connexion-statut erreur">' + echapper(t('moncompte_err_envois')) + '</p>';
            return;
        }
        if (!envois) {
            cadre.innerHTML = '<p class="connexion-mention">' + echapper(t('moncompte_chargement')) + '</p>';
            return;
        }
        if (!envois.length) {
            cadre.innerHTML =
                '<div class="connexion-carte mc-vide">' +
                '  <p>' + echapper(t('moncompte_vide')) + '</p>' +
                '  <div class="mc-raccourcis">' +
                '    <a class="mc-raccourci" href="' + prefixe + 'carte.html"><span class="connexion-picto mc-picto">' + PICTOS.carte + '</span>' + echapper(t('moncompte_raccourci_carte')) + '</a>' +
                '    <button type="button" class="mc-raccourci" data-action="signaler"><span class="connexion-picto mc-picto">' + PICTOS.ajouter + '</span>' + echapper(t('moncompte_raccourci_signaler')) + '</button>' +
                '  </div>' +
                '</div>';
            cadre.querySelector('[data-action="signaler"]').addEventListener('click', function () {
                if (typeof ouvrirModaleSignalement === 'function') ouvrirModaleSignalement({ type: 'manquant' });
            });
            return;
        }

        var filtres = FILTRES.map(function (f) {
            var nombre = f[1] ? envois.filter(function (e) { return e.type === f[1]; }).length : envois.length;
            if (f[1] && !nombre) return '';
            var actif = filtre === f[0];
            return '<button type="button" class="mc-filtre' + (actif ? ' actif' : '') + '" data-filtre="' + f[0] + '" aria-pressed="' + actif + '">'
                + echapper(t('moncompte_filtre_' + f[0])) + '<b>' + nombre + '</b></button>';
        }).join('');

        var type = FILTRES.filter(function (f) { return f[0] === filtre; })[0][1];
        var visibles = type ? envois.filter(function (e) { return e.type === type; }) : envois;
        var montres = toutMontrer ? visibles : visibles.slice(0, PAR_PAGE);
        var reste = visibles.length - montres.length;
        var voirPlus = reste
            ? '<button type="button" class="mc-voir-plus">' + echapper(reste === 1 ? t('moncompte_voir_autre') : t('moncompte_voir_autres').replace('{n}', reste)) + '</button>'
            : '';

        cadre.innerHTML =
            '<div class="mc-filtres">' + filtres + '</div>' +
            '<div class="mc-envois"><ul>' + montres.map(envoiHtml).join('') + '</ul>' + voirPlus + '</div>' +
            (filtre === 'photos' && visibles.some(function (e) { return e.statut[0] === 'refusee'; })
                ? '<p class="connexion-mention mc-apres-liste">' + echapper(t('moncompte_photos_refusees')) + '</p>' : '');

        cadre.querySelectorAll('.mc-filtre').forEach(function (bouton) {
            bouton.addEventListener('click', function () {
                filtre = bouton.dataset.filtre;
                toutMontrer = false;
                dessinerEnvois();
            });
        });
        var bouton = cadre.querySelector('.mc-voir-plus');
        if (bouton) bouton.addEventListener('click', function () {
            toutMontrer = true;
            dessinerEnvois();
        });
    }

    function chargerEnvois() {
        Promise.all([compte.appel('GET', '/compte/contributions'), chargerTerrains()])
            .then(function (resultats) {
                var reponse = resultats[0];
                if (reponse.statut === 401) {
                    compte.oublier();
                    versConnexion();
                    return;
                }
                if (reponse.statut !== 200) {
                    erreurEnvois = true;
                } else {
                    envois = preparerEnvois(reponse.donnees);
                }
                dessinerEnvois();
            });
    }


    // --- Page -------------------------------------------------------------------------------

    function pseudoHtml(session, enEdition) {
        if (enEdition) {
            return '<form class="mc-pseudo-form" novalidate>' +
                '  <label class="connexion-label" for="mc-pseudo">' + echapper(t('compte_pseudo_label')) + '</label>' +
                '  <div class="connexion-pseudo-ligne">' +
                '    <input type="text" id="mc-pseudo" class="connexion-champ" maxlength="20" autocomplete="nickname" placeholder="' + echapper(t('compte_pseudo_aide')) + '" value="' + echapper(session.pseudo || '') + '">' +
                '    <button type="submit" class="connexion-bouton">' + echapper(t('compte_pseudo_ok')) + '</button>' +
                '  </div>' +
                '  <p class="connexion-mention">' + echapper(t('compte_pseudo_pourquoi')) + '</p>' +
                (session.pseudo ? '  <button type="button" class="connexion-lien-texte mc-annuler" data-action="annuler">' + echapper(t('moncompte_annuler')) + '</button>' : '') +
                '</form>';
        }
        return '<div class="mc-pseudo-ligne">' +
            '  <div><span class="mc-libelle">' + echapper(t('compte_pseudo_label')) + '</span>' +
            (session.pseudo
                ? '<strong class="mc-pseudo-valeur">' + echapper(session.pseudo) + '</strong>'
                : '<span class="mc-pseudo-aucun">' + echapper(t('moncompte_pseudo_aucun')) + '</span>') +
            '  </div>' +
            '  <button type="button" class="connexion-lien-texte" data-action="modifier">' + echapper(t(session.pseudo ? 'moncompte_modifier' : 'moncompte_choisir')) + '</button>' +
            '</div>';
    }

    function brancherPseudo(enEdition) {
        var carte = zone.querySelector('.mc-pseudo');
        var session = compte.session();
        carte.innerHTML = pseudoHtml(session, enEdition) + '<p class="connexion-statut" role="status"></p>';

        if (!enEdition) {
            carte.querySelector('[data-action="modifier"]').addEventListener('click', function () {
                brancherPseudo(true);
            });
            return;
        }

        var formulaire = carte.querySelector('form');
        var champ = formulaire.querySelector('input');
        var bouton = formulaire.querySelector('button[type="submit"]');
        champ.focus();
        champ.select();
        // Compte sans pseudo (créé avant qu'il soit obligatoire) : pas d'annulation possible
        var annuler = formulaire.querySelector('[data-action="annuler"]');
        if (annuler) {
            annuler.addEventListener('click', function () { brancherPseudo(false); });
            champ.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') brancherPseudo(false);
            });
        }
        // Pseudo obligatoire et unique sur le site : le Worker refuse un pseudo vide ou déjà pris
        formulaire.addEventListener('submit', function (e) {
            e.preventDefault();
            var pseudo = champ.value.trim();
            if (!pseudo) {
                afficherStatut(t('compte_err_pseudo_vide'), true);
                champ.focus();
                return;
            }
            if (pseudo === session.pseudo) {
                brancherPseudo(false);
                return;
            }
            bouton.disabled = true;
            compte.appel('POST', '/compte/pseudo', { pseudo: pseudo })
                .then(function (reponse) {
                    bouton.disabled = false;
                    if (reponse.statut === 200) {
                        compte.majPseudo(reponse.donnees.pseudo);
                        dessinerEntete();
                        brancherPseudo(false);
                        afficherStatut(t('compte_pseudo_enregistre'));
                    } else if (reponse.statut === 401) {
                        compte.oublier();
                        versConnexion();
                    } else {
                        var cle = { pseudo_vide: 'compte_err_pseudo_vide', pseudo_pris: 'compte_err_pseudo_pris', pseudo_invalide: 'compte_err_pseudo_invalide' }[reponse.donnees.erreur];
                        afficherStatut(t(cle || 'compte_err_generique'), true);
                        champ.focus();
                    }
                });
        });
    }

    function dessinerEntete() {
        var session = compte.session();
        var entete = zone.querySelector('.mc-entete');
        if (!session || !entete) return;
        var nom = session.pseudo || session.email;
        var titre = session.pseudo ? t('compte_bonjour').replace('{pseudo}', session.pseudo) : t('compte_titre_connecte');
        entete.innerHTML =
            '<div class="connexion-avatar" aria-hidden="true">' + echapper(nom.charAt(0).toUpperCase()) + '</div>' +
            '<h2 class="connexion-titre centre">' + echapper(titre) + '</h2>' +
            '<p class="connexion-chapo centre">' + echapper(t('compte_connecte')).replace('{email}', '<strong class="connexion-adresse">' + echapper(session.email) + '</strong>') + '</p>';
        var cree = zone.querySelector('.mc-cree');
        if (cree) cree.textContent = session.cree ? t('moncompte_cree_le').replace('{date}', dateLongue(session.cree)) : '';
    }

    function afficherPage() {
        zone.dataset.etat = 'compte';
        zone.innerHTML =
            '<div class="mc-entete"></div>' +
            '<div class="connexion-carte mc-pseudo"></div>' +

            '<h2 class="mc-titre">' + echapper(t('moncompte_envois_titre')) + '</h2>' +
            '<div class="mc-envois-zone"></div>' +

            '<h2 class="mc-titre">' + echapper(t('moncompte_parties_titre')) + '</h2>' +
            '<div class="connexion-carte">' +
            '  <div class="connexion-avantage mc-parties">' +
            '    <div class="connexion-picto">' + PICTOS.parties + '</div>' +
            '    <div><strong>' + echapper(t('moncompte_parties_nom')) + '<span class="connexion-bientot">' + echapper(t('compte_bientot')) + '</span></strong>' +
            '    <span>' + echapper(t('compte_avantage_parties')) + '</span></div>' +
            '  </div>' +
            '</div>' +

            '<h2 class="mc-titre">' + echapper(t('moncompte_compte_titre')) + '</h2>' +
            '<div class="connexion-carte">' +
            '  <button type="button" class="connexion-bouton secondaire" data-action="deconnecter">' + echapper(t('compte_deconnecter')) + '</button>' +
            '  <p class="connexion-mention centre mc-cree"></p>' +
            '</div>' +
            '<p class="centre mc-supprimer"><button type="button" class="mc-lien-danger" data-action="supprimer">' + echapper(t('moncompte_supprimer')) + '</button></p>' +
            '<p class="centre connexion-mention"><a class="mc-lien" href="' + prefixe + 'confidentialite.html">' + echapper(t('compte_vos_donnees')) + '</a></p>';

        dessinerEntete();
        brancherPseudo(!compte.session().pseudo);
        dessinerEnvois();

        zone.querySelector('[data-action="deconnecter"]').addEventListener('click', function () {
            quitte = true;
            compte.deconnecter();
            window.location.href = prefixe;
        });
        zone.querySelector('[data-action="supprimer"]').addEventListener('click', afficherSuppression);
    }

    function afficherSuppression() {
        zone.dataset.etat = 'suppression';
        var effet3 = echapper(t('moncompte_suppr_effet3')).replace('{email}',
            '<a class="mc-lien" href="mailto:' + ADRESSE_CONTACT + '">' + ADRESSE_CONTACT + '</a>');
        zone.innerHTML =
            '<h2 class="connexion-titre mc-titre-suppression">' + echapper(t('moncompte_suppr_titre')) + '</h2>' +
            '<ul class="mc-effets">' +
            '  <li>' + echapper(t('moncompte_suppr_effet1')) + '</li>' +
            '  <li>' + echapper(t('moncompte_suppr_effet2')) + '</li>' +
            '  <li>' + effet3 + '</li>' +
            '</ul>' +
            '<div class="connexion-carte">' +
            '  <button type="button" class="connexion-bouton mc-danger" data-action="confirmer">' + echapper(t('moncompte_supprimer')) + '</button>' +
            '  <button type="button" class="connexion-bouton secondaire" data-action="annuler">' + echapper(t('moncompte_annuler')) + '</button>' +
            '  <p class="connexion-statut centre" role="status"></p>' +
            '</div>' +
            '<p class="connexion-mention centre mc-apres-liste">' + echapper(t('moncompte_suppr_recreer')) + '</p>';
        window.scrollTo({ top: 0, behavior: 'instant' });

        var confirmer = zone.querySelector('[data-action="confirmer"]');
        zone.querySelector('[data-action="annuler"]').addEventListener('click', function () {
            afficherPage();
        });
        confirmer.addEventListener('click', function () {
            confirmer.disabled = true;
            compte.appel('POST', '/compte/supprimer', { confirmation: true })
                .then(function (reponse) {
                    if (reponse.statut === 200 || reponse.statut === 401) {
                        quitte = true;
                        compte.oublier();
                        afficherSupprime();
                    } else {
                        confirmer.disabled = false;
                        var statut = zone.querySelector('.connexion-statut');
                        statut.textContent = t('compte_err_generique');
                        statut.classList.add('erreur');
                    }
                });
        });
    }

    // Compte supprimé : un mot de fin dans la page, puis l'accueil
    function afficherSupprime() {
        zone.dataset.etat = 'supprime';
        zone.innerHTML =
            '<h2 class="connexion-titre centre mc-titre-suppression">' + echapper(t('moncompte_suppr_fait_titre')) + '</h2>' +
            '<p class="connexion-chapo centre">' + echapper(t('moncompte_suppr_fait')) + '</p>' +
            '<div class="connexion-carte"><a class="connexion-bouton" href="' + prefixe + '">' + echapper(t('moncompte_retour_accueil')) + '</a></div>';
        window.scrollTo({ top: 0, behavior: 'instant' });
    }


    // --- Démarrage --------------------------------------------------------------------------

    if (!compte.session()) {
        versConnexion();
        return;
    }
    afficherPage();
    chargerEnvois();

    // Pseudo changé ou session effacée depuis un autre appareil : la page se met à jour
    compte.verifier().then(function (session) {
        if (!session) {
            versConnexion();
        } else if (zone.dataset.etat === 'compte') {
            dessinerEntete();
            if (!zone.querySelector('.mc-pseudo-form')) brancherPseudo(false);
        }
    });

    // Déconnexion dans un autre onglet
    window.addEventListener('mapetanque:compte', function () {
        if (!compte.session() && !quitte) versConnexion();
    });
})();
