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
seul (sinon, photos floues en série). Barème inspiré de Google, adapté :

| Contribution | Points | Comme Google ? |
|---|---|---|
| Avis publié | 10 | Oui |
| Photo acceptée | 5 | Oui |
| Bonus : première photo d'un terrain qui n'en avait aucune (« scoop ») | +10 | Non, propre à nous : c'est ce qui sert le plus la carte |
| Erreur corrigée (signalement d'erreur traité) | 5 | Oui (modification) |
| Terrain manquant ajouté | 15 | Oui (ajout d'un lieu) |
| Note (étoiles) | 1 | Oui ; les notes ne passent pas par la modération, d'où le point unique |

### Cartographe : niveaux

Les cinq premiers seuils de Google, prolongeables plus tard avec les suivants (1 500, 5 000…) :

| Niveau | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Points | 1 | 15 | 75 | 250 | 500 |

Ordre de grandeur : 1 terrain ajouté = niveau 2 ; 3 avis + 5 photos = niveau 3.

### Bouliste : niveaux

| Niveau | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Parties jouées | 1 | 10 | 25 | 50 | 100 |

### Présentation

- Dans Mon compte : niveau, points (ou parties), et barre de progression vers le niveau suivant
  (« encore 12 points pour le niveau 3 »), comme Google.
- Charte (`CHARTE.md`) : nom du badge en Caveat 700, accent terre battue `#B5502E`, numéro du
  niveau en Manrope.

## Correspondance avec les données (D1)

Tout se calcule à la volée à partir des tables existantes, filtrées sur `compte_id` :

- **Photo acceptée** : `photos` au statut `a_generer`, `validee`, `envoyee`, `rattachee` ou
  `publiee` (ou avec miniature et non `refusee`), comme l'affiche Mon compte.
- **Bonus scoop** : « terrain sans photo » dépend du moment (photos Mapillary dans
  `data/photos_mapillary.json`, photos d'autres visiteurs). Le plus simple : le noter à la
  validation dans l'admin (une colonne `scoop` dans `photos`) plutôt que de le reconstituer
  après coup.
- **Terrain manquant ajouté** : `signalements` de type `manquant` au statut `traite`.
- **Erreur corrigée** : `signalements` de type `erreur` au statut `traite`. (Les signalements
  `club` ne comptent pas au lancement.)
- **Avis publié** : `avis` au statut `publie`.
- **Note** : `votes` du compte.
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
| Critique | Recensent | Kritiker | Critic | Avis publiés et terrains notés |

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
lynx ; Chroniqueur, Arbitre ; Habitué.

## À trancher

- Niveau visible publiquement (à côté du pseudo sur les avis et les crédits photo, comme
  Google) ou seulement dans Mon compte ?
- Bonus scoop : ajouter la colonne `scoop` remplie à la validation (recommandé) ?
- Points retirés si une contribution est retirée ensuite (avis `retire`) ? Logique avec un
  calcul à la volée : oui, automatiquement.
