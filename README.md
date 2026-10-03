# 🎯 Mapetanque

Carte interactive recensant les terrains de pétanque accessibles au public en Belgique.

🔗 **Site en ligne :** [mapetanque.be](https://mapetanque.be/)
📄 **Licence :** [MIT](./LICENSE)

---

## 🗺️ Carte et données

- Carte interactive de la Belgique (Leaflet + fonds OpenStreetMap)
- Deux fonds de carte au choix : "Plan" et "Satellite" (contrôle de calques Leaflet)
- Bouton plein écran (coin haut-droit de la carte, à côté du sélecteur de fond) : masque le reste de l'interface pour n'afficher que la carte, avec la recherche et la géolocalisation toujours accessibles ; touche Échap pour quitter
- Sur la page d'accueil : tous les terrains regroupés en clusters (chiffres colorés) qui se séparent automatiquement au zoom
- Sur les pages province : uniquement les terrains de cette province, en marqueurs individuels sans regroupement (le jeu de données étant déjà restreint)
- Sur les pages région : tous les terrains de la région, avec regroupement en clusters (une région comme la Flandre approche les 1 200 terrains)
- Données des terrains issues d'OpenStreetMap (requête Overpass ciblant `leisure=pitch` + `sport=boules`/`petanque` sur la Belgique)
- Régénération hebdomadaire automatique via le script `scripts/update_terrains.py`
- Nom de rue/lieu le plus proche calculé pour chaque terrain (géocodage inversé Nominatim), **précalculé et stocké directement dans `terrains.geojson`** pour création d'un titre dynamique
- Molette de la souris et glissé tactile désactivés par défaut sur la carte (activés au premier clic/tap), pour ne pas intercepter le défilement normal de la page

## 📍 Localisation et recherche

- Bouton "📍 Me localiser" (géolocalisation native du navigateur)
- Champ de recherche libre (adresse, ville, région) via l'API de recherche Nominatim
- Zoom automatiquement adapté à la nature du résultat trouvé (adresse précise → zoom serré ; ville/région → `fitBounds` sur toute la zone)
- Calcul de distance (formule de Haversine) affiché dans chaque fiche terrain une fois la position de l'utilisateur connue
- Flèche de proximité : si le terrain le plus proche n'est pas visible à l'écran après localisation/recherche, une flèche apparaît en bordure de carte, orientée vers ce terrain, et disparaît dès qu'il entre dans le champ visible ; cliquer dessus centre la carte dessus
- Recherche et géolocalisation masquées sur les pages province/région (la carte y est déjà centrée sur la bonne zone), mais toujours fonctionnelles en coulisses

## 📋 Fiche d'un terrain (popup au clic sur un marqueur)

- Titre dynamique : `Terrain [nom de rue]` si une rue proche a été trouvée, sinon `Terrain de pétanque`
- Fil d'Ariane région › province › commune, avec province cliquable vers sa page dédiée
- Statut d'accès : `public` ou `probablement public` (selon le tag OSM `access`)
- Distance jusqu'au terrain (si géolocalisation ou recherche active), sinon message incitant à se localiser
- Lien "🚗 Afficher l'itinéraire" → ouvre Google Maps en mode itinéraire
- Lien "📤 Partager ce terrain" → ouvre le panneau de partage avec un lien direct vers ce terrain précis
- Même contenu de popup strictement identique sur toutes les pages (accueil, provinces, régions) via une fonction JS unique et réutilisée

## 📤 Partage

- **Partage d'un terrain précis** : génère une URL du type `?lat=...&lon=...&z=18`. À l'ouverture de ce lien, le site retrouve automatiquement le terrain correspondant, centre la carte dessus et rouvre son popup
- **Partage du site** : rangée d'icônes discrètes dans le footer (WhatsApp, Facebook, X, e-mail, copier le lien), alignée à droite
- Petit retour visuel (icône qui change de couleur ~2 sec) lors de la copie du lien

## 🌍 Multilingue (FR / NL / DE)

- Détection automatique de la langue du navigateur au premier passage (repli sur le français si langue non reconnue)
- Mémorisation du choix via `localStorage` (le visiteur retrouve sa langue lors d'une prochaine visite)
- Sélecteur de langue discret (liens texte FR/NL/DE dans la nav desktop et le menu burger mobile) — pas de gros boutons en évidence, la détection automatique suffit dans l'immense majorité des cas
- Traduction complète et dynamique : titre, tagline, menu, panneau À propos/Contact/FAQ, popups des terrains, panneau de partage, footer
- Toutes les traductions centralisées dans `translations.js` — y compris les noms de provinces/régions et les textes d'interface des pages province/région, lus directement par le générateur Python (source unique, pas de duplication)
- **URL dédiée par langue** pour l'indexation Google : `/`, `/nl/`, `/de/` pour l'accueil ; même principe pour chaque page province/région (`/province-<slug>.html`, `/nl/province-<slug>.html`, `/de/province-<slug>.html`), avec balises `hreflang` réciproques
- Une page province/région n'existe dans une langue que si son texte y a été rédigé et vérifié : pas de génération à moitié traduite. Le sélecteur de langue renvoie alors vers la racine de la langue correspondante plutôt que vers un lien mort
- Sur les pages province/région, changer de langue déclenche une vraie navigation vers le fichier correspondant (pas juste un changement de texte en place), puisque le contenu diffère réellement d'une langue à l'autre (pas seulement la traduction, aussi les liens)

## 📖 Panneau d'info coulissant

- Ouverture depuis le menu burger (☰, en haut à droite)
- Mini-navigation interne en haut du panneau (À propos / Contact / FAQ) permettant de changer de sujet **sans refermer le panneau**
- Onglet actif mis en évidence visuellement
- FAQ en accordéon natif (`<details>`/`<summary>`, sans JS dédié)

## 📊 Footer

- Une seule ligne compacte, tenant sur un écran de smartphone : nombre total de terrains + date de dernière mise à jour (format JJ-MM-AA)
- Nombre total de terrains recensés (calculé côté client depuis `terrains.geojson`, aucune configuration manuelle) — toujours le total Belgique, même sur une page province/région
- Date de la dernière mise à jour des données, récupérée via l'API GitHub (date du dernier commit ayant modifié `terrains.geojson`)
- Icônes de partage du site
- Position fixe sur la page d'accueil (`position: fixed`) ; en flux normal de page sur les pages province/région (`position: static`)

## 🏘️ Pages provinces et régions

- 11 pages province (`province-<slug>.html`) + 2 pages région (`region-flandre.html`, `region-wallonie.html`) — Bruxelles n'a pas de page région dédiée (pas de sous-provinces), sa tuile région renvoie directement vers sa page province
- Structure commune : bannière photo (Wikimedia Commons, crédit affiché en toutes lettres), fil d'Ariane cliquable, tuiles chiffres, texte d'intro rédigé et vérifié individuellement (recherche de faits, sources citées), carte, liste des communes officielles (pages province : lien vers la page commune, ou fiche sur la carte pour une commune à un seul lieu ; une commune sans terrain n'apparaît qu'à la recherche, avec le terrain le plus proche) ou des provinces (pages région) en pastilles cliquables
- Textes d'intro jamais inventés : chaque chiffre, anecdote ou fait historique mentionné a été vérifié par recherche avant d'être écrit
- Génération via `scripts/generate_provinces.py`, qui lit `data/provinces.json` / `data/regions.json`, les templates `templates/province_template.html` / `templates/region_template.html`, `translations.js` et `data/terrains.geojson` (liste des communes écrite dans la page, lisible sans JavaScript), puis lance `scripts/generer_referencement.py` (voir Référencement)
- Page d'accueil : grille "Parcourir par province" (10 tuiles photo, sans Bruxelles) puis "Parcourir par région" (Flandre, Wallonie, Bruxelles)

## 🏡 Pages commune

- Une page par commune officielle ayant des terrains à au moins deux endroits (`commune/<slug>.html`, et `nl/`, `de/`, `en/commune/`) : 255 communes en octobre 2026
- Commune officielle (565 communes, fusions de 2025 comprises), et non le champ `commune` des terrains, tiré de Nominatim, qui donne souvent un village ou une ancienne commune (il reste affiché comme localité) : `scripts/communes_officielles.py` rattache chaque terrain et chaque club à sa commune, sans réseau, d'après les limites communales d'OpenStreetMap de `data/communes_belgique.json` (téléchargées une fois par `scripts/telecharger_communes.py`, à relancer après une fusion de communes)
- Contenu tiré des données : intro (terrains, lieux, atouts), une carte par lieu (pistes voisines réunies comme sur la carte, `data/groupes_terrains.json`), regroupées par localité, avec photo, revêtement et pastilles calculées par `criteres.js` lui-même (via Node.js), clubs de la commune, communes voisines, tuiles province et région ; bannière de la province
- Pas de carte sur la page : un clic sur un terrain ouvre sa fiche complète sur place (`commune.js`), avec un lien « Voir sur la carte » ; le terrain s'ajoute à l'adresse (`#way-123`) pour le bouton retour et le partage. Les notes des joueurs s'affichent sur les cartes des terrains
- Noms : nom local, comme sur le reste du site, sauf une courte liste de noms traduits d'usage courant (Anvers, Gand, Luik, Lüttich…, voir EXONYMES dans `scripts/communes_officielles.py`)
- Génération via `scripts/generer_communes.py` (squelette de `comment-jouer.html`, voir `scripts/_squelette.py`), chaque semaine par le workflow OSM ; une commune passée sous deux lieux perd sa page
- Liens depuis les fiches terrain et club : le fil d'Ariane se termine sur la commune officielle, en lien vers sa page, et un lien « Voir les N terrains de … » est ajouté au bas de la fiche ; `generer_communes.py` écrit pour cela `data/communes_liens.json` (commune de chaque terrain et club, noms dans les quatre langues, existence de la page)
- Propositions de la barre de recherche (accueil, pages province et région) : dès deux lettres, communes, villages et terrains, comme sur Komoot ; une commune mène à sa page, un village à son sous-titre sur la page de sa commune, un terrain à sa fiche sur la carte. Plein écran sur téléphone. Tiré de `data/recherche.json`, écrit par `generer_communes.py` et téléchargé au premier caractère tapé : Nominatim interdit l'autocomplétion, il ne sert qu'à la touche Entrée (recherche d'adresse)

## 🎨 Identité visuelle et confort d'usage

- Jeu de mots visuel dans le titre : "**Map**etanque" (Map en couleur)
- Clic sur le logo/nom du site : sur l'accueil, ramène à l'état du tout premier chargement (recherche et géolocalisation réinitialisées, panneaux refermés) ; sur une page province/région, ramène vers l'accueil dans la même langue
- Site entièrement responsive (mobile/desktop)
- Icône de marqueur cohérente sur toutes les cartes (position utilisateur, résultat de recherche, terrains)
- Panneaux coulissants (menu burger, info, partage) avec fond assombri et fermeture au clic extérieur
- Bannières photo (accueil + chaque province/région) traitées avec un filtre visuel homogène (désaturation, contraste, vignettage), converties en WebP et limitées à 2400px de large pour rester légères

## 🛠️ Infrastructure

- Pages statiques : `index.html` (+ `nl/`, `de/`), `province-*.html` × 3 langues, `region-*.html` × 3 langues
- Fichiers partagés : `style.css`, `script.js`, `translations.js`
- Fichiers additifs (n'écrasent aucune règle de `style.css`) : `style-accueil-provinces.css` (page d'accueil), `style-province.css` (pages province et région)
- Hébergé sur GitHub Pages, domaine personnalisé `mapetanque.be`, déploiement automatique à chaque `git push`
- Génération des données terrains via `scripts/update_terrains.py`, à exécuter manuellement ou via tâche planifiée (~30 min d'exécution à cause de la limite Nominatim d'1 requête/seconde) — produit `data/terrains.geojson` et `data/stats_geo.json`
- Génération des pages province/région via `scripts/generate_provinces.py`, à relancer après toute modification de `data/provinces.json`, `data/regions.json`, `templates/province_template.html`, `templates/region_template.html` ou `translations.js`

## 📲 Application installable (PWA)

- Le site s'installe comme une application (icône sur l'écran d'accueil, ouverture en plein écran sans barre d'adresse) : Android/Chrome propose « Installer l'application » ; sur iPhone/iPad, Safari → Partager → « Sur l'écran d'accueil »
- Bouton « Installer l'application » à deux endroits, le haut du menu mobile (grand bouton sombre) et le pied de page (sous les chiffres, même bouton que « Copier le lien ») : ouvre la fenêtre d'installation du navigateur quand elle existe (Chrome, Edge, Android) ; sinon (Safari sur iPhone/iPad, Firefox) affiche dessous la marche à suivre. Caché dans l'application déjà installée, et sur ordinateur quand le navigateur ne sait pas installer
- Chrome sur Android garde aussi son propre bandeau automatique « Ajouter à l'écran d'accueil » (affiché quand Chrome le juge utile), en plus de nos boutons
- `manifest.webmanifest` : nom, couleurs et icônes de l'application (`images/icone-192.png`, `images/icone-512.png`, `images/icone-masquable-512.png` pour les icônes rondes d'Android), lié depuis le `<head>` de chaque page
- `sw.js` (service worker, enregistré en tête de `script.js`) : « le réseau d'abord ». Tout est toujours redemandé au serveur, la copie en cache ne sert qu'hors connexion : l'application reste à jour sans rien faire à chaque publication. Sans connexion, les pages déjà consultées restent lisibles (la carte, elle, a besoin du réseau) ; une page jamais vue affiche « Pas de connexion internet » en 4 langues

---

## 🔎 Référencement (SEO)

- Balise `<meta name="description">` et `<title>` traduits dynamiquement selon la langue affichée (accueil), ou rédigés spécifiquement par page (provinces/régions)
- `scripts/generer_referencement.py` lit les pages publiques (canonical vers elles-mêmes, pas de noindex) et écrit :
  - dans chacune, un bloc de données structurées schema.org (JSON-LD) : fil d'Ariane, type de page (article, application, page province…), et sur l'accueil le site, son auteur et le jeu de données des terrains
  - `sitemap.xml` en entier : chaque page de chaque langue avec ses versions dans les autres langues et sa date de modification (`data/sitemap_dates.json` garde une empreinte de chaque page pour la dater)
  - `llms.txt` : résumé du site pour les IA (convention llmstxt.org), avec les chiffres du jour
- Lancé automatiquement par `generate_provinces.py` (donc chaque semaine par le workflow OSM), `generer_la_petanque.py` et `generer_a_propos.py` ; à relancer à la main après une modification de `index.html`, `comment-jouer.html` ou `compteur.html`
- Listes des communes des pages province écrites dans le HTML : les robots qui n'exécutent pas le JavaScript (la plupart des IA) les voient
- `robots.txt` à la racine, sitemap soumis à Google Search Console
- Balises Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) pour un aperçu soigné lors du partage du lien sur les réseaux sociaux/messageries
- Favicon (logo au format SVG)

---

## 🔭 Pistes futures évoquées (non développées)

- Système de notes (/5) et commentaires par terrain (nécessiterait un backend — Supabase/Firebase envisagés)
- Tags associables à un terrain par les usagers (zone ombragée, bar à proximité, terrain en pente, compteur de points, etc. — liste complète déjà brainstormée)
- Système de versionning des données, pour pouvoir revenir en arrière en cas d'attaque ou de mauvaise utilisation

---

## Outils utilisés

| Outil | Rôle |
|---|---|
| **Visual Studio Code** | Créer et modifier les fichiers du site, organiser le projet |
| **Leaflet** | Afficher la carte interactive (déplacements, marqueurs, popups...) |
| **OpenStreetMap** | Source des données géographiques |
| **Overpass Turbo** | Extraction automatique des données OpenStreetMap via l'API Overpass |
| **Python** | Automatiser la récupération des données OpenStreetMap et la génération des pages province/région |
| **GitHub** | Stockage du projet, historique Git, automatisation, hébergement du site public |
| **Live Server** (extension VS Code) | Prévisualiser rapidement les changements de code en local |

---

## Structure du projet

```
├── index.html                        # Page d'accueil (français, à la racine)
├── nl/index.html                     # Accueil, version néerlandaise
├── de/index.html                     # Accueil, version allemande
├── province-<slug>.html              # 11 pages province (français, à la racine)
├── nl/province-<slug>.html           # Pages province traduites (selon disponibilité)
├── de/province-<slug>.html           # Pages province traduites (selon disponibilité)
├── region-flandre.html               # Page région Flandre
├── region-wallonie.html              # Page région Wallonie
├── nl/region-*.html, de/region-*.html
├── commune/<slug>.html               # Pages commune (générées), aussi dans nl/, de/, en/
├── commune.js                        # Fiche d'un terrain ouverte sur les pages commune
├── style-commune.css                 # Ajouts spécifiques aux pages commune
├── style.css                         # Mise en forme du site (base)
├── style-accueil-provinces.css       # Ajouts spécifiques à la page d'accueil
├── style-province.css                # Ajouts spécifiques aux pages province/région
├── script.js                         # Logique de la carte et des interactions
├── translations.js                   # Textes du site en FR / NL / DE (source unique)
├── sitemap.xml                       # Plan du site, toutes pages et langues (généré)
├── llms.txt                          # Résumé du site pour les IA (généré)
├── robots.txt                        # Référence le sitemap pour les robots d'indexation
├── manifest.webmanifest              # Fiche de l'application installable (PWA)
├── sw.js                             # Service worker de l'application (doit rester à la racine)
├── images/
│   ├── mapetanque-logo-blanc.svg     # Logo complet (boule + texte vectorisé), en-tête sur bannière
│   ├── mapetanque-boule.svg          # Boule seule (en-tête mobile, favicon SVG, page admin)
│   ├── mapetanque-partage.png        # Image de partage Open Graph (1200 × 630)
│   ├── banniere-accueil.webp         # Bannière photo de l'accueil
│   └── provinces/                    # Bannières et tuiles photo (provinces + régions)
├── scripts/
│   ├── update_terrains.py            # Génération hebdomadaire des données terrains
│   ├── generate_provinces.py         # Génération des pages province/région
│   ├── generer_communes.py           # Génération des pages commune
│   ├── communes_officielles.py       # Rattachement d'un point à sa commune officielle
│   ├── telecharger_communes.py       # Limites des communes (data/communes_belgique.json)
│   └── generer_referencement.py      # Données structurées, sitemap.xml, llms.txt
├── templates/
│   ├── province_template.html        # Gabarit des pages province
│   └── region_template.html          # Gabarit des pages région
├── data/
│   ├── terrains.geojson              # Données des terrains (générées automatiquement)
│   ├── stats_geo.json                # Agrégats région/province/commune
│   ├── communes_belgique.json        # Limites des 565 communes officielles (OSM)
│   ├── communes_liens.json           # Commune officielle de chaque terrain et club (fiches)
│   ├── recherche.json                # Index des propositions de la recherche
│   ├── provinces.json                # Contenu (textes, crédits photo) des pages province
│   └── regions.json                  # Contenu des pages région
├── LICENSE                           # Licence MIT
└── README.md                         # Ce fichier
```