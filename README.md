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
- Structure commune : bannière photo (Wikimedia Commons, crédit affiché en toutes lettres), fil d'Ariane cliquable, tuiles chiffres, texte d'intro rédigé et vérifié individuellement (recherche de faits, sources citées), carte, liste des communes (pages province) ou des provinces (pages région) en pastilles cliquables
- Textes d'intro jamais inventés : chaque chiffre, anecdote ou fait historique mentionné a été vérifié par recherche avant d'être écrit
- Génération via `scripts/generate_provinces.py`, qui lit `data/provinces.json` / `data/regions.json`, les templates `templates/province_template.html` / `templates/region_template.html`, et `translations.js` — et met aussi à jour automatiquement la section correspondante de `sitemap.xml` (délimitée par des marqueurs, le reste du fichier n'est jamais touché)
- Page d'accueil : grille "Parcourir par province" (10 tuiles photo, sans Bruxelles) puis "Parcourir par région" (Flandre, Wallonie, Bruxelles)

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

---

## 🔎 Référencement (SEO)

- Balise `<meta name="description">` et `<title>` traduits dynamiquement selon la langue affichée (accueil), ou rédigés spécifiquement par page (provinces/régions)
- `sitemap.xml` (16 URLs : accueil + 11 provinces + 2 régions, chacune avec ses variantes de langue disponibles) et `robots.txt` à la racine, soumis à Google Search Console
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
├── style.css                         # Mise en forme du site (base)
├── style-accueil-provinces.css       # Ajouts spécifiques à la page d'accueil
├── style-province.css                # Ajouts spécifiques aux pages province/région
├── script.js                         # Logique de la carte et des interactions
├── translations.js                   # Textes du site en FR / NL / DE (source unique)
├── sitemap.xml                       # Plan du site (accueil + provinces + régions)
├── robots.txt                        # Référence le sitemap pour les robots d'indexation
├── images/
│   ├── logomap.svg                   # Logo (favicon)
│   ├── logomap.png                   # Logo (image de partage Open Graph)
│   ├── banniere-accueil.webp         # Bannière photo de l'accueil
│   └── provinces/                    # Bannières et tuiles photo (provinces + régions)
├── scripts/
│   ├── update_terrains.py            # Génération hebdomadaire des données terrains
│   └── generate_provinces.py         # Génération des pages province/région + sitemap
├── templates/
│   ├── province_template.html        # Gabarit des pages province
│   └── region_template.html          # Gabarit des pages région
├── data/
│   ├── terrains.geojson              # Données des terrains (générées automatiquement)
│   ├── stats_geo.json                # Agrégats région/province/commune
│   ├── provinces.json                # Contenu (textes, crédits photo) des pages province
│   ├── regions.json                  # Contenu des pages région
│   └── communes-<slug>.json          # Liste des communes par province (générées automatiquement)
├── LICENSE                           # Licence MIT
└── README.md                         # Ce fichier
```