# Badges sur mapetanque.be — synthèse de la réflexion (16 octobre 2026)

Statut : réflexion, rien n'est codé. Suite de `NOTES_comptes_utilisateurs.md` (badges prévus à
l'étape 3, « Badges : facile, seuils calculés sur les contributions »).

## Ce qui se fait ailleurs

| Site | Principe | À retenir pour nous |
|---|---|---|
| Google Maps – Local Guides | Points par avis, photo, correction ; niveaux 1 à 10 affichés près du nom | Le modèle le plus proche ; sobre (surtout des niveaux, peu de badges) et efficace |
| StreetComplete (OpenStreetMap) | Un badge à paliers par type de contribution | Motive à varier les contributions |
| Waze | Points et niveaux pour les signalements | Le statut monte avec la fiabilité |
| Foursquare / Swarm | Badges thématiques, « maire » d'un lieu | Le local motive beaucoup |
| Untappd, Geocaching | Des centaines de badges à collectionner | La collection est le cœur de l'appli : pas notre cas |
| Strava | Roi / reine d'un segment, défis mensuels | Idée du « maire du terrain » |
| Stack Overflow | Badges bronze, argent, or ; la réputation donne des droits | Plus tard : publier sans validation au-delà d'un seuil ? |

## Principes

- **Peu de badges au lancement** (6, plus un badge « pour rire ») : avec peu d'utilisateurs, une
  page pleine de cases grises fait « site désert ». Chaque badge coûte quatre traductions, un
  picto et un cas à tester. En ajouter plus tard donne une occasion d'annonce.
- **Seules comptent les contributions faites connecté et validées** dans l'admin (comme prévu
  dans `NOTES_comptes_utilisateurs.md`), jamais l'envoi seul : sinon, photos floues en série.
- **Un badge par type de contribution** plutôt qu'un compteur global.
- **Noms épicènes** autant que possible (identiques au masculin et au féminin) : pas de
  « Défricheur / Défricheuse » à gérer dans le code et les traductions.
- **Trois paliers**, marqués par 1, 2 ou 3 boules sur le badge (comme une triplette).
- Charte (`CHARTE.md`) : nom du badge en Caveat 700, accent terre battue `#B5502E`. Sous chaque
  badge, une petite phrase pour les non-joueurs (« Première photo d'un terrain »).

## Les badges du lancement

| # | FR | NL | DE | EN | Ce qui compte | Paliers |
|---|---|---|---|---|---|---|
| 1 | Photographe | Fotograaf | Fotograf | Photographer | Photos acceptées | 1 / 10 / 50 |
| 2 | Scoop | Scoop | Scoop | Scoop | Première photo d'un terrain qui n'en avait aucune | 1 / 5 / 20 |
| 3 | Cartographe | Cartograaf | Kartograf | Mapmaker | Terrains manquants ajoutés | 1 / 5 / 20 |
| 4 | Vigie | Uitkijk | Ausguck | Lookout | Signalements d'erreur corrigés | 1 / 10 / 30 |
| 5 | Critique | Recensent | Kritiker | Critic | Avis publiés et terrains notés | 5 / 25 / 100 |
| 6 | Bouliste | Boulespeler | Boulespieler | Boules player | Parties jouées | 1 / 25 / 100 |
| + | Fanny | Fanny | Fanny | Fanny | Gagner 13-0 (badge « pour rire », sans palier) | — |

Noms écartés en cours de route : Premier regard, Premier cliché, Carreau (n° 2) ; Défricheur
(n° 3) ; Œil de lynx (n° 4) ; Chroniqueur et Arbitre, fusionnés en Critique (n° 5) ;
Habitué (n° 6).

Traductions NL et DE à faire relire avant mise en ligne.

## Correspondance avec les données (D1)

Tout se calcule à la volée à partir des tables existantes, filtrées sur `compte_id` :

- **Photographe** : `photos` au statut `a_generer`, `validee`, `envoyee`, `rattachee` ou
  `publiee` (ou avec miniature et non `refusee`), comme l'affiche Mon compte.
- **Scoop** : le plus délicat. « Terrain sans photo » dépend du moment (photos Mapillary dans
  `data/photos_mapillary.json`, photos d'autres visiteurs). Le plus simple : noter à la
  validation dans l'admin si le terrain n'avait encore aucune photo (une colonne `scoop` dans
  `photos`), plutôt que de le reconstituer après coup.
- **Cartographe** : `signalements` de type `manquant` au statut `traite`.
- **Vigie** : `signalements` de type `erreur` au statut `traite`. (Les signalements `club` ne
  comptent pas au lancement.)
- **Critique** : `avis` au statut `publie` + `votes` du compte. Les notes ne passent pas par la
  modération : à surveiller si quelqu'un note des terrains en masse.
- **Bouliste** : nombre de lignes dans `parties`.
- **Fanny** : `parties` avec `victoire = 1`, `objectif = 13` et l'équipe adverse à 0.

Date d'obtention : déduite de la date de la Nième contribution (10e photo, 25e partie…), sans la
stocker au départ. Une table ne deviendrait utile que pour annoncer « Nouveau badge ! » une seule
fois.

Côté site : une route du Worker (ou un ajout à la réponse de Mon compte) qui renvoie les
compteurs, et une section « Badges » dans Mon compte.

## Victoires et triche

Une partie saisie seul n'est qu'une déclaration. Les badges liés aux victoires (Fanny, plus tard
Remontada) restent sans enjeu tant qu'ils ne sont visibles que dans Mon compte. Pour un classement
public, ne compter que les parties partagées en direct (`partage_joueurs`), où l'adversaire était
présent.

## En réserve (à sortir quand il y aura assez de joueurs)

| FR | NL | DE | EN | Ce qui compte |
|---|---|---|---|---|
| Baroudeur | Zwerver | Wandervogel | Wanderer | Parties sur 5 / 15 / 30 terrains différents |
| Remontada | Comeback | Aufholjagd | Comeback | Gagner après avoir été mené de 8 points (calculé sur les mènes) |
| Tour de Belgique | Ronde van België | Belgien-Rundfahrt | Tour of Belgium | Contributions dans 3 / 6 / 11 provinces (Bruxelles comprise) |
| Rassembleur | Samenbrenger | Gastgeber | Host | Parties partagées en direct avec 5 / 15 / 30 joueurs différents |
| Marathon | Marathon | Marathon | Marathon | Une partie de plus d'1 h 30 |
| Boule de neige | Sneeuwbal | Schneeball | Snowball | Une partie entre décembre et février |
| Maire du terrain | Burgemeester | Bürgermeister | Mayor | Titre sur la fiche du terrain : le compte qui y a le plus de contributions validées et de parties |

## À trancher

- Badges visibles publiquement (à côté du pseudo sur les avis et les crédits photo) ou seulement
  dans Mon compte ?
- Garder « J'ai embrassé Fanny » (perdre 13-0), en pendant humoristique de Fanny ?
- Scoop : ajouter la colonne `scoop` remplie à la validation (recommandé) ?
- Picto des badges : un dessin par badge, ou un modèle commun (rond terre battue + boules du
  palier) avec un petit picto au centre ?
