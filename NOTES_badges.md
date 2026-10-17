# Badges sur mapetanque.be — synthèse de la réflexion (16 octobre 2026)

Statut : réflexion, rien n'est codé. Suite de `NOTES_comptes_utilisateurs.md` (badges et points
prévus à l'étape 3).

## Ce qui se fait ailleurs

| Site | Principe | À retenir pour nous |
|---|---|---|
| Google Maps – Local Guides | Points par avis, photo, correction ; niveaux 1 à 10 affichés près du nom | **Modèle retenu** : sobre (surtout des niveaux, peu de badges) et efficace |
| StreetComplete (OpenStreetMap) | Un badge à paliers par type de contribution | Motive à varier les contributions (piste pour plus tard) |
| Waze | Points et niveaux pour les signalements | Le statut monte avec la fiabilité |
| Foursquare / Swarm | Badges thématiques, « maire » d'un lieu | Le local motive beaucoup |
| Untappd, Geocaching | Des centaines de badges à collectionner | La collection est le cœur de l'appli : pas notre cas |
| Strava | Roi / reine d'un segment, défis mensuels | Idée du « maire du terrain » |
| Stack Overflow | Badges bronze, argent, or ; la réputation donne des droits | Plus tard : publier sans validation au-delà d'un niveau ? |

## Décision : deux badges à niveaux, « à la Google »

Pas de collection de badges au lancement : avec peu d'utilisateurs, une page pleine de cases
grises fait « site désert », et chaque badge coûte quatre traductions, un picto et un cas à tester.
Comme Local Guides, deux compteurs seulement, chacun avec des **niveaux numérotés** :

| Badge | FR | NL | DE | EN | Ce qui compte |
|---|---|---|---|---|---|
| Joueur | Bouliste | Boulespeler | Boulespieler | Boules player | Parties jouées |
| Contributeur | Cartographe | Cartograaf | Kartograf | Mapmaker | Points des contributions |

Les deux noms sont épicènes (identiques au masculin et au féminin) : rien à gérer selon le compte.
Ils font la paire : un badge pour jouer, un badge pour la carte (toute contribution l'améliore).
Autres noms envisagés : Guide (comme « Local Guide »), Contributeur (pas épicène).

Traductions NL et DE à faire relire avant mise en ligne.

### Cartographe : points par contribution

Seules comptent les contributions **faites connecté et validées** dans l'admin, jamais l'envoi
seul (sinon, photos floues en série). Petits nombres, faciles à expliquer :

| Contribution | Points |
|---|---|
| Photo acceptée | 2 |
| Bonus : première photo d'un terrain qui n'en avait aucune (« scoop ») | +3 (5 en tout) |
| Erreur corrigée, ou info de club acceptée | 3 |
| Terrain manquant ajouté | 5 |
| Coup de cœur (et cases « Ce terrain est… ») | 0 |

Les notes et les avis ont été remplacés par les coups de cœur (17 octobre 2026). Ceux-ci ne
rapportent aucun point : un geste d'appréciation, sans modération, qu'on ne veut pas voir
distribué en masse pour monter de niveau.

### Cartographe : niveaux

| Niveau | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Points | 1 | 10 | 30 | 75 | 150 |

Ordre de grandeur :
- niveau 1 : une première contribution acceptée ;
- niveau 2 : 2 terrains ajoutés, ou 5 photos ;
- niveau 3 : un contributeur régulier (par exemple 3 terrains, 5 photos dont 2 scoops et
  1 erreur corrigée = 34 points) ;
- niveau 5 : un pilier (30 terrains ajoutés, ou 75 photos).

Les cinq niveaux suffisent au lancement ; on pourra en ajouter au-delà de 150 si des comptes
les atteignent.

### Bouliste : niveaux

| Niveau | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Parties jouées | 1 | 10 | 25 | 50 | 100 |

### Présentation

- Dans Mon compte : niveau, points (ou parties), et barre de progression vers le niveau suivant
  (« encore 12 points pour le niveau 3 »), comme Google.
- Visuel retenu (« médaillon ») : un rond vert tendre `#E7F4E1` avec un picto au trait vert
  feuillage `#3D7A2A` (carte Lucide `map` pour Cartographe, boule striée et cochonnet pour
  Bouliste), entouré de cinq segments, un par niveau : terre battue `#B5502E` une fois atteints,
  ligne `#E2E6DE` sinon. Pas de chiffre sur le badge : le niveau s'écrit dessous
  (« Niveau 3 · 60 points »). Nom du badge en Caveat 700 (`CHARTE.md`).
- Piste écartée : marqueur de carte et boule pleins, avec cinq petites boules sous le badge.
  Pourrait servir pour annoncer un nouveau niveau.
- Niveau public (décidé) : à côté du pseudo dans le crédit des photos, une pastille vert tendre
  avec le petit picto carte et « Niveau 3 » en toutes lettres (comme Google ; pas d'abréviation
  « Nv » ou « niv. »). Traductions : Niveau 3 / Niveau 3 / Stufe 3 / Level 3. Le nom complet
  (« Cartographe, niveau 3 ») en `title` et `aria-label`.
- Caveat une seule fois par écran (charte) : exception acceptée pour les noms des badges (inscrite
  dans `CHARTE.md`). Nom en vert feuillage, comme tout texte en Caveat ; le terre battue reste
  réservé à ce qui progresse (segments, barre de progression).

## Correspondance avec les données (D1)

Tout se calcule à la volée à partir des tables existantes, filtrées sur `compte_id` :

- **Photo acceptée** : `photos` au statut `a_generer`, `validee`, `envoyee`, `rattachee` ou
  `publiee` (ou avec miniature et non `refusee`), comme l'affiche Mon compte.
- **Bonus scoop** (décidé : automatique) : à la validation d'une photo dans l'admin, la page
  regarde si le terrain avait déjà une photo en ligne (tag OSM, `photos_mapillary.json`, photos
  de visiteurs déjà validées), ce qu'elle charge déjà pour la carte de modération. Si aucune, elle
  envoie « première photo » avec la validation ; le Worker l'enregistre dans une nouvelle colonne
  `scoop` de `photos`. Rien à faire pour Rémy : une mention « Première photo de ce terrain · +3 »
  sur la carte de modération montre que le bonus part. Deux photos d'un même terrain en attente :
  seule la première validée a le bonus. À coder dans `admin.html` et dans la route de validation
  du Worker admin (dépôt `mapetanque-workers`), plus la colonne dans D1.
- **Rattrapage des photos déjà validées** (décidé) : une fois, au lancement. On ne sait plus si
  le terrain avait une photo à ce moment-là, d'où une règle approximative : la plus ancienne photo
  de visiteur acceptée de chaque terrain reçoit `scoop = 1` si ce terrain n'a aucune photo d'une
  autre source (ni tag OSM, ni Mapillary hors photos de visiteurs).
- **Terrain manquant ajouté** : `signalements` de type `manquant` au statut `traite`.
- **Erreur corrigée, info de club** : `signalements` de type `erreur` ou `club` au statut
  `traite`.
- Les anciens avis et notes (`avis`, `votes`) ne comptent pas, pas plus que les coups de cœur.
- **Bouliste** : nombre de lignes dans `parties`.

Pas de table au départ. Côté site : une route du Worker (ou un ajout à la réponse de Mon compte)
qui renvoie points et parties, et une section dans Mon compte. Une table ne deviendrait utile
que pour annoncer « Niveau 3 atteint ! » une seule fois.

## Victoires et triche

Une partie saisie seul n'est qu'une déclaration. Bouliste compte les parties, pas les victoires :
peu d'intérêt à tricher. Si un jour il y a des badges de victoire ou un classement public, ne
compter que les parties partagées en direct (`partage_joueurs`), où l'adversaire était présent.

## En réserve (à sortir quand il y aura assez de joueurs)

Badges par type de contribution, calculés sur les mêmes données (noms retenus en cours de
réflexion) :

| FR | NL | DE | EN | Ce qui compte |
|---|---|---|---|---|
| Photographe | Fotograaf | Fotograf | Photographer | Photos acceptées |
| Scoop | Scoop | Scoop | Scoop | Premières photos de terrains sans photo |
| Défricheur | Pionier | Pionier | Pioneer | Terrains manquants ajoutés (nom à revoir : pas épicène) |
| Vigie | Uitkijk | Ausguck | Lookout | Signalements d'erreur corrigés |

Badges de jeu et de lieu :

| FR | NL | DE | EN | Ce qui compte |
|---|---|---|---|---|
| Fanny | Fanny | Fanny | Fanny | Gagner 13-0 (et peut-être « J'ai embrassé Fanny » pour la défaite) |
| Baroudeur | Zwerver | Wandervogel | Wanderer | Parties sur 5 / 15 / 30 terrains différents |
| Remontada | Comeback | Aufholjagd | Comeback | Gagner après avoir été mené de 8 points (calculé sur les mènes) |
| Tour de Belgique | Ronde van België | Belgien-Rundfahrt | Tour of Belgium | Contributions dans 3 / 6 / 11 provinces (Bruxelles comprise) |
| Rassembleur | Samenbrenger | Gastgeber | Host | Parties partagées en direct avec 5 / 15 / 30 joueurs différents |
| Marathon | Marathon | Marathon | Marathon | Une partie de plus d'1 h 30 |
| Boule de neige | Sneeuwbal | Schneeball | Snowball | Une partie entre décembre et février |
| Maire du terrain | Burgemeester | Bürgermeister | Mayor | Titre sur la fiche du terrain : le compte qui y a le plus de contributions validées et de parties |

Noms écartés en cours de route : Premier regard, Premier cliché, Carreau ; Défricheur ; Œil de
lynx ; Chroniqueur, Arbitre, Critique (avis et notes, disparus) ; Habitué.

## À trancher

Rien pour l'instant. Retenu par défaut : une contribution retirée après coup (photo retirée)
perd ses points d'elle-même, puisque tout est recalculé à chaque affichage.
