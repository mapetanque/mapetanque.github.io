# 🎯 Mapetanque

Carte interactive recensant les terrains de pétanque accessibles au public en Belgique.

🔗 **Site en ligne :** [mapetanque.github.io](https://mapetanque.github.io/)
📄 **Licence :** [MIT](./LICENSE)

---

## 🗺️ Carte et données

- Carte interactive de la Belgique (Leaflet + fonds OpenStreetMap)
- Deux fonds de carte au choix : "Plan" et "Satellite" (contrôle de calques Leaflet)
- Bouton plein écran (coin haut-droit de la carte, à côté du sélecteur de fond) : masque le reste de l'interface pour n'afficher que la carte, avec la recherche et la géolocalisation toujours accessibles ; touche Échap pour quitter
- Terrains regroupés en clusters (chiffres colorés) qui se séparent automatiquement au zoom
- Données des terrains issues d'OpenStreetMap (requête Overpass ciblant `leisure=pitch` + `sport=boules`/`petanque` sur la Belgique)
- Régénération hebdomadaire automatique via le script `scripts/update_terrains.py`
- Nom de rue/lieu le plus proche calculé pour chaque terrain (géocodage inversé Nominatim), **précalculé et stocké directement dans `terrains.geojson`** pour création d'un titre dynamique.

## 📍 Localisation et recherche

- Bouton "📍 Me localiser" (géolocalisation native du navigateur)
- Champ de recherche libre (adresse, ville, région) via l'API de recherche Nominatim
- Zoom automatiquement adapté à la nature du résultat trouvé (adresse précise → zoom serré ; ville/région → `fitBounds` sur toute la zone)
- Calcul de distance (formule de Haversine) affiché dans chaque fiche terrain une fois la position de l'utilisateur connue
- Flèche de proximité : si le terrain le plus proche n'est pas visible à l'écran après localisation/recherche, une flèche apparaît en bordure de carte, orientée vers ce terrain, et disparaît dès qu'il entre dans le champ visible ; cliquer dessus centre la carte dessus

## 📋 Fiche d'un terrain (popup au clic sur un marqueur)

- Titre dynamique : `Terrain [nom de rue]` si une rue proche a été trouvée, sinon `Terrain de pétanque`
- Statut d'accès : `public` ou `probablement public` (selon le tag OSM `access`)
- Distance jusqu'au terrain (si géolocalisation ou recherche active), sinon message incitant à se localiser
- Lien "🚗 Afficher l'itinéraire" → ouvre Google Maps en mode itinéraire
- Lien "📤 Partager ce terrain" → ouvre le panneau de partage avec un lien direct vers ce terrain précis

## 📤 Partage

- **Partage d'un terrain précis** : génère une URL du type `?lat=...&lon=...&z=18`. À l'ouverture de ce lien, le site retrouve automatiquement le terrain correspondant, centre la carte dessus et rouvre son popup — sans passer par une page dédiée par terrain (pas encore de fiches individuelles indexées Google, voir section "Pistes futures")
- **Partage du site** : rangée d'icônes discrètes dans le footer (WhatsApp, Facebook, X, e-mail, copier le lien), alignée à droite
- Petit retour visuel (icône qui change de couleur ~2 sec) lors de la copie du lien

## 🌍 Multilingue (FR / NL / DE)

- Détection automatique de la langue du navigateur au premier passage (repli sur le français si langue non reconnue)
- Mémorisation du choix via `localStorage` (le visiteur retrouve sa langue lors d'une prochaine visite)
- Sélecteur de langue discret (liens texte FR/NL/DE dans la nav desktop et le menu burger mobile) — pas de gros boutons en évidence, la détection automatique suffit dans l'immense majorité des cas
- Traduction complète et dynamique : titre, tagline, menu, panneau À propos/Contact/FAQ, popups des terrains, panneau de partage, footer, liste des terrains à parcourir
- Toutes les traductions centralisées dans `translations.js`
- **URL dédiée par langue** pour l'indexation Google : `/` (français), `/nl/`, `/de/` — trois fichiers `index.html` distincts (même contenu, piloté par le même JS), avec balises `hreflang` réciproques pour indiquer à Google qu'il s'agit de 3 versions d'une même page plutôt que de contenu dupliqué. Changer de langue via le sélecteur met aussi à jour l'URL (sans recharger la page), pour que chaque langue reste partageable via sa propre adresse

## 📖 Panneau d'info coulissant

- Ouverture depuis le menu burger (☰, en haut à droite)
- Mini-navigation interne en haut du panneau (À propos / Contact / FAQ) permettant de changer de sujet **sans refermer le panneau**
- Onglet actif mis en évidence visuellement
- FAQ en accordéon natif (`<details>`/`<summary>`, sans JS dédié) 

## 📊 Footer

- Une seule ligne compacte, tenant sur un écran de smartphone : nombre total de terrains + date de dernière mise à jour (format JJ-MM-AA)
- Nombre total de terrains recensés (calculé côté client depuis `terrains.geojson`, aucune configuration manuelle)
- Date de la dernière mise à jour des données, récupérée via l'API GitHub (date du dernier commit ayant modifié `terrains.geojson`)
- Icônes de partage du site
- Toujours visible à l'écran (`position: fixed`), quelle que soit la position de scroll

## 📈 Liste des terrains à parcourir

- Carte plein écran par défaut au chargement ; le contenu qui suit est révélé simplement en scrollant, sans JS de scroll custom (ancres HTML natives + `scroll-behavior: smooth`)
- Accès depuis un bouton "Parcourir la liste" aligné avec les contrôles de recherche, au-dessus de la carte
- Bandeau chiffré global (nombre total de terrains en Belgique)
- Entonnoir complet région → province → commune → terrain, en accordéons `<details>`/`<summary>` imbriqués (même style que la FAQ) :
  - 3 tuiles région en tête, avec densité de terrains affichée en /100km² (superficies Statbel codées en dur dans `script.js`, données géographiques stables)
  - Filigranes régionaux discrets sur les tuiles (lion flamand, coq wallon, iris bruxellois), vectorisés à partir de fichiers SVG du domaine public
  - Bruxelles traité comme cas particulier (région-enclave sans niveau province), avec garde-fou pour fusionner toute commune égarée sous une fausse province
  - Recherche de commune par nom (filtre les lignes déjà en mémoire, insensible aux accents/casse)
  - Clic sur une commune → centre la carte sur la position moyenne de ses terrains ; clic sur un terrain → zoome et ouvre son popup
- Données région/province/commune agrégées côté script Python (`data/stats_geo.json`), canonicalisées via les codes ISO 3166-2 (fiables, indépendants de la langue de réponse de Nominatim)

## 🎨 Identité visuelle et confort d'usage

- Jeu de mots visuel dans le titre : "**Map**etanque" (Map en italique/gras/bleu)
- Clic sur le logo/nom du site : ramène à l'état du tout premier chargement (vue initiale de la carte, recherche et géolocalisation réinitialisées, panneaux refermés, filtres de la liste des terrains remis à zéro)
- Layout en flexbox occupant toute la hauteur d'écran (`min-height: 100vh`) : la carte s'étire pour occuper tout l'espace disponible, sans zone vide ni scrollbar parasite
- Site entièrement responsive (mobile/desktop), avec espace réservé en haut sur mobile pour éviter que le titre ne chevauche les boutons flottants
- Icône de marqueur cohérente (position utilisateur ou résultat de recherche)
- Panneaux coulissants (menu burger, info, partage) avec fond assombri et fermeture au clic extérieur

## 🛠️ Infrastructure

- Site 100 % statique : `index.html` (+ `nl/index.html`, `de/index.html`), `style.css`, `script.js`, `translations.js`, `data/terrains.geojson`, `data/stats_geo.json`
- Hébergé sur GitHub Pages (`mapetanque.github.io`), déploiement automatique à chaque `git push`
- Génération des données via `scripts/update_terrains.py`, à exécuter manuellement ou via tâche planifiée (~30 min d'exécution à cause de la limite Nominatim d'1 requête/seconde) — produit à la fois `data/terrains.geojson` (données brutes) et `data/stats_geo.json` (agrégats région/province/commune pour la liste des terrains à parcourir)

---

## 🔎 Référencement (SEO)

- Balise `<meta name="description">` et `<title>` traduits dynamiquement selon la langue affichée
- `sitemap.xml` et `robots.txt` à la racine, soumis à Google Search Console
- Balises Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) pour un aperçu soigné lors du partage du lien sur les réseaux sociaux/messageries
- Favicon (logo au format SVG)

---

## 🔭 Pistes futures évoquées (non développées)

- Fiches individuelles par terrain avec URL dédiée, pour l'indexation Google (génération statique envisagée)
- Système de notes (/5) et commentaires par terrain (nécessiterait un backend — Supabase/Firebase envisagés)
- Tags associables à un terrain par les usagers (zone ombragée, bar à proximité, terrain en pente, compteur de points, etc. — liste complète déjà brainstormée)
- Nom de domaine personnalisé (ex. `mapetanque.be`) à la place de `mapetanque.github.io`
- Système de versionning des données, pour pouvoir revenir en arrière en cas d'attaque ou de mauvaise utilisation

---

## Outils utilisés

| Outil | Rôle |
|---|---|
| **Visual Studio Code** | Créer et modifier les fichiers du site, organiser le projet |
| **Leaflet** | Afficher la carte interactive (déplacements, marqueurs, popups...) |
| **OpenStreetMap** | Source des données géographiques |
| **Overpass Turbo** | Extraction automatique des données OpenStreetMap via l'API Overpass |
| **Python** | Automatiser la récupération des données OpenStreetMap (1×/semaine, le lundi à 3h) |
| **GitHub** | Stockage du projet, historique Git, automatisation, hébergement du site public |
| **Live Server** (extension VS Code) | Prévisualiser rapidement les changements de code en local |

---

## Structure du projet

```
├── index.html                    # Structure de la page (français, à la racine)
├── nl/index.html                 # Version néerlandaise (même contenu, piloté par le même JS)
├── de/index.html                 # Version allemande (même contenu, piloté par le même JS)
├── style.css                     # Mise en forme
├── script.js                     # Logique de la carte et des interactions
├── translations.js               # Textes du site en FR / NL / DE
├── sitemap.xml                   # Plan du site (3 URLs, avec annotations hreflang)
├── robots.txt                    # Référence le sitemap pour les robots d'indexation
├── images/
│   ├── logomap.svg               # Logo (favicon)
│   └── logomap.png               # Logo (image de partage Open Graph)
├── scripts/
│   └── update_terrains.py        # Script de génération hebdomadaire des données
├── data/
│   ├── terrains.geojson          # Données des terrains (générées automatiquement)
│   └── stats_geo.json            # Agrégats région/province/commune (générés automatiquement)
├── LICENSE                       # Licence MIT
└── README.md                     # Ce fichier
```