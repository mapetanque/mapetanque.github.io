# Mapetanque — Photos des visiteurs : publication directe sur le site (réflexion, rien codé)

Note du 7/10/2026, revue le 15/10/2026 (périmètre, taille du dépôt, seuils d'alerte, dépôt
séparé pour les miniatures, découpage en lots).

## Contexte
Circuit actuel (étape 3 de la page admin) : photo visiteur (réduite à 2048 px, redressée et sans
métadonnées par le formulaire, `script.js`) → Worker `mapetanque-admin` → R2 (`mapetanque-photos`)
+ file D1 → modération dans admin.html → `publier-photos.yml` / `scripts/publier_photos.py` écrit
les EXIF et envoie via `mapillary_tools` → traitement Mapillary (24–48 h, parfois une semaine) →
rattachement de l'ID Mapillary (le Worker efface alors le fichier de R2) → la phase « Miniatures
plates » génère la miniature 800×450 dans `images/mapillary-plates/` → affichage sur le site.

Déjà réglé : le site affiche des miniatures locales. L'embed Mapillary ne sert plus qu'en secours
(5 terrains au 15/10). Les URLs qui expirent et la dépendance à l'API ne concernent plus que ce
secours. Problèmes restants : le délai avant affichage, le rattachement fragile, et l'impossibilité
de retirer depuis l'admin une photo déjà envoyée à Mapillary (cas de la photo 873 le 11/10 : il a
fallu passer par la console D1).

État au 15/10/2026 (`data/photos_mapillary.json`) : 936 terrains avec photo, 940 entrées,
742 photos différentes, dont 437 plates (`images/mapillary-plates/`, 437 fichiers, 30 Mo, 70 Ko en
moyenne) et 310 vues 360° (`images/mapillary-360/`, 377 fichiers car un cadrage par terrain,
65 Mo). 137 photos sont partagées par des terrains voisins. Site publié (fichiers suivis par Git) :
136 Mo ; historique Git : 203 Mo. 1 803 terrains en tout.

Depuis le 7/10 : les envois sont rattachés au compte (pseudo et adresse imposés) et limités à
3 photos par terrain et par personne.

## Périmètre
- Seules les NOUVELLES photos de visiteurs passent par le nouveau circuit. Ce qui est en place ne
  change pas : photos Mapillary trouvées par proximité, photos de visiteurs déjà rattachées et
  leurs miniatures dans `images/mapillary-plates/` et `images/mapillary-360/`.
- Le jour de la bascule : les photos au statut `envoyee` finissent par l'ancien circuit ; celles
  encore `en_attente` ou `validee` passent par le nouveau.

## Orientation retenue
- Publier la photo directement sur le site dès la validation, sans attendre Mapillary. « Dès la
  validation » = au passage suivant du workflow (5 h UTC ou bouton « Publier maintenant »), plus
  quelques minutes de déploiement GitHub Pages, car `photos_mapillary.json` est dans le dépôt.
- Générer deux WebP depuis le fichier R2 (déjà flouté, voir plus bas) :
  - miniature 800×450, même format et même règle de cadrage que `scripts/miniature_plate.py`
    (paysage recadré 16:9 ; portrait entier sur fond flou), rangée dans le dépôt PUBLIC SÉPARÉ
    `mapetanque/mapetanque-photos` (voir plus bas), servie à
    `https://mapetanque.be/mapetanque-photos/visiteurs/<id>.webp`. Qualité 80 (~70 Ko) comme les
    miniatures actuelles, ou 72 (~50 Ko) pour économiser de la place : à trancher en comparant à
    l'œil ;
  - version d'affichage pour la visionneuse (~1280–1600 px, qualité ~75, ~125–200 Ko),
    rangée dans R2.
- Pourquoi ce partage (retenu le 15/10, après avoir envisagé de tout mettre dans le dépôt) :
  - la fiche, le carrousel, `promouvoir_terrains.py` et le ménage marchent déjà avec des chemins
    locaux `/images/...` ; les photos restent visibles sur les fiches même si le Worker est en
    panne ou si le quota est atteint ;
  - hypothèse prudente de 3 nouvelles photos par terrain (5 409 photos ; on est aujourd'hui à
    environ une photo sur un terrain sur deux) : miniatures ≈ 370 Mo (≈ 270 Mo en qualité 72),
    grandes versions ≈ 1,1 Go en 1600 px (≈ 680 Mo en 1280 px). Avec les 136 Mo actuels, les
    grandes versions dans le dépôt dépasseraient la limite de 1 Go d'un site GitHub Pages ;
    les miniatures seules donnent ≈ 510 Mo, ce qui passe ;
  - grandes versions dans R2 : ≈ 1,1 Go sur les 10 Go-mois gratuits, sortie gratuite. Le Worker
    n'est appelé qu'à l'ouverture de la visionneuse, pas à l'affichage de la fiche.
  - Une photo retirée reste dans l'historique Git : le dépôt ne fait que grossir. La limite de
    1 Go vise le site publié, mais un gros historique ralentit clonage et manipulations.
- Dépôt séparé pour les miniatures (retenu et mis en place le 15/10) : `mapetanque/mapetanque-photos`,
  public, GitHub Pages activé sur `main` (racine), `.nojekyll`, licence CC BY-SA 4.0 (`LICENSE` et
  `README.md` : chaque photo appartient à son auteur). Comme le site principal a le domaine
  `mapetanque.be`, GitHub le sert à `https://mapetanque.be/mapetanque-photos/` (testé : 200 en
  HTTPS, même origine que le site). Pourquoi :
  - la limite de 1 Go de GitHub Pages compte par dépôt : les photos ne peuvent jamais bloquer
    le site, et le dépôt du site ne reçoit plus aucune image de visiteur ;
  - l'historique du site reste léger ; si celui du dépôt des photos devient trop lourd, on peut
    le repartir de zéro (une seule version des fichiers actuels) sans toucher au site.
  Le dépôt privé `mapetanque/mapetanque-workers` ne convient pas : un site public ne peut pas
  charger d'images depuis un dépôt privé.
- Service des grandes versions par le Worker `mapetanque-admin`. Le DNS est chez OVH, donc pas de
  domaine perso pour R2 ; `r2.dev` n'est pas prévu pour la production.
  ⚠️ Le cache de Cloudflare (Cache API) est sans effet sur `*.workers.dev` : seul le cache du
  navigateur jouera (`Cache-Control: public, max-age=31536000, immutable`, avec un nom de fichier
  qui change si l'image change). Chaque première vue = 1 requête Worker + 1 lecture R2, sur le
  quota gratuit de 100 000 requêtes/jour COMMUN à tout le compte (admin, envois, notes).
- Taille du dépôt des photos : alerte et blocage (retenu le 15/10). Avant d'ajouter des
  miniatures, `publier-photos.yml` mesure la taille des fichiers suivis de `mapetanque-photos` :
  - à 700 Mo : alerte. Une issue « Taille du dépôt des photos » est ouverte ou complétée dans le
    dépôt du site, comme le fait `alerte-photo.yml` ; c'est le bot qui écrit, donc GitHub envoie
    un mail. Les publications continuent ;
  - à 850 Mo : blocage. Le script n'ajoute plus de miniatures ; les photos restent au statut
    `validee`, non publiées, et l'issue le dit. Le site n'est jamais touché ; la décision se prend
    à froid (alléger les miniatures, ouvrir un second dépôt de photos…).
  - Pas d'alerte prévue pour R2 (≈ 1,1 Go sur 10 Go dans l'hypothèse prudente).
- Le dépôt garde le JSON de correspondance photo ↔ terrain : `photos_mapillary.json` (nom
  inchangé), avec un champ source `mapillary` / `locale`. La fiche gère les deux cas (photo locale →
  visionneuse simple au lieu du lien Mapillary).
- Identifiant stable d'une photo locale : la clé `visiteur-<id>` déjà utilisée par la page admin
  (`admin.html`, `photosTerrain`, ordre des photos). Au rattachement Mapillary, l'entrée existante
  est COMPLÉTÉE avec `mapillary_id`, jamais doublée.
- Envoi sur Mapillary = OPTION, case cochée par défaut à la validation dans l'admin (réutilise tel
  quel le circuit de l'étape 3). La miniature locale reste affichée même après rattachement.
- Floutage manuel dans l'admin : plusieurs zones (rectangles) par photo, avant publication.
  L'admin enregistre les rectangles (coordonnées relatives 0–1) ; le script applique le flou
  (Pillow), puis la version floutée REMPLACE l'original dans R2 : aucun original non flouté gardé
  pour une photo publiée. C'est cette version qui est publiée sur le site ET envoyée à Mapillary
  (leur floutage auto ne couvre que visages/plaques et rate des cas).
- 360° de visiteurs : n'existent pas aujourd'hui. Le formulaire réduit à 2048 px et réencode, ce
  qui efface les métadonnées 360° (XMP GPano) : Mapillary recevrait une photo plate. À traiter à
  part plus tard (envoi sans réduction, métadonnées conservées, envoi Mapillary systématique pour
  garder leur visionneuse), ou à laisser de côté.

## Découpage (validé le 15/10)
Le floutage est le plus gros morceau, et sans lui une photo publiée directement s'afficherait non
floutée (aujourd'hui, c'est Mapillary qui floute visages et plaques).
- Lot 1 : à la validation, choix « Publier tout de suite » ou « Attendre le floutage de Mapillary »
  (circuit actuel, pour les photos avec des personnes ou des plaques) ; case « Aussi envoyer sur
  Mapillary » ; statut `publiee` ; « Retirer du site » ; miniature dans `mapetanque-photos`,
  grande version dans R2 ; alerte et blocage de taille ; fiche ; textes 4 langues.
- Lot 2 : outil de floutage multi-zones dans l'admin. Le choix « Attendre Mapillary » disparaît.
- Plus tard, peut-être : retrait de sa propre photo par l'auteur depuis Mon compte, comme les avis.

## À adapter
- `scripts/publier_photos.py` + `publier-photos.yml` :
  - nouvelle phase : flou, génération des deux WebP, miniature dans `mapetanque-photos`
    (`visiteurs/<id>.webp`), grande version dans R2 ;
  - le workflow récupère aussi `mapetanque-photos` (second `actions/checkout`) et y pousse. Le
    `GITHUB_TOKEN` ne couvre que le dépôt du site : il faut un jeton à accès fin limité à
    `mapetanque-photos` (Contents en écriture), créé par Rémy et rangé dans un secret du dépôt du
    site (ex. `JETON_PHOTOS`) ;
  - ordre des poussées : les miniatures d'abord, puis `photos_mapillary.json` (le dépôt des photos
    met ~1 min à se publier ; une image pas encore en ligne est masquée par la fiche) ;
  - mesure de la taille de `mapetanque-photos` avant d'ajouter des miniatures : alerte (issue) à
    700 Mo, blocage à 850 Mo (les photos restent `validee`) ;
  - envoi Mapillary seulement si la case est cochée ;
  - garde-fou de l'export : il compare par `mapillary_id` (une photo locale donnerait `"None"`) ;
    il doit utiliser l'identifiant stable ;
  - phase « Miniatures plates » : sauter une photo qui a déjà sa miniature locale (sinon deux
    miniatures pour la même photo après rattachement) ;
  - ménage : ne jamais effacer les miniatures des visiteurs encore citées.
- Worker `mapetanque-admin` (vit dans le tableau de bord Cloudflare, pas dans le dépôt) :
  - route publique de lecture des grandes versions R2, avec Cache-Control long ;
  - nouveau statut (ex. `publiee`) pour une photo en ligne sans Mapillary ;
  - ne plus effacer le fichier R2 au rattachement (`/workflow/rattachee`) ;
  - ne plus purger les photos publiées : la purge à 30 jours ne concerne que les non modérées ;
  - export : fusionner les entrées locales, et compléter l'entrée au rattachement au lieu d'en
    ajouter une ;
  - route de retrait d'une photo publiée (efface R2 + retire de l'export).
- `admin.html` :
  - outil de floutage multi-zones + case « Aussi envoyer sur Mapillary » ;
  - ajouter le nouveau statut à la liste `["validee", "envoyee", "rattachee"]` de
    `photosTerrain` ⚠️ sinon le terrain reste dans « Nouveaux » : c'est la logique « un terrain
    nouveau traité sort de Nouveaux » à préserver ;
  - bouton « Retirer du site » pour une photo déjà publiée (« Refuser » ne vaut que pour les
    photos pas encore publiées).
- `script.js` (fiche terrain) : affichage de la miniature (`/mapetanque-photos/visiteurs/...`) +
  visionneuse (grande version servie par le Worker) ; dédoublonnage par identifiant stable, plus
  seulement par `mapillary_id`.
- Service worker du site : sa portée couvre aussi `/mapetanque-photos/` (même origine) ; vérifier
  que sa stratégie de cache convient à ces images.
- `scripts/promouvoir_terrains.py` : prendre la miniature 16:9 locale de la photo du visiteur
  quand elle existe (pas de miniature carrée : les tuiles 4:3 coupent la 16:9 en CSS). Il
  n'écrit toujours aucune image.
- Textes 4 langues (FR/NL/DE/EN) :
  - `scripts/generer_a_propos.py` (pas `translations.js`) : section « Vos données » (photo
    publiée sur le site, et éventuellement sur Mapillary ; floutage fait par moi ; la phrase
    « seule la date est gardée, car Mapillary l'exige » est à revoir) et paragraphe d'intro
    (« chaque photo reçue est publiée sur Mapillary avant d'être affichée ici » devient faux) ;
  - `scripts/generer_confidentialite.py` : vérifier ce qui y est dit des photos (publication,
    conservation dans R2) ;
  - `translations.js` : `add_photo_checkbox_label` (publication sur le site sous CC BY-SA, et
    éventuellement sur Mapillary) et `add_photo_success` (n'annonce plus « quelques jours de
    traitement chez Mapillary ») ;
  - puis relancer `scripts/generate_provinces.py`, `scripts/generer_a_propos.py` et
    `scripts/generer_confidentialite.py`.

## Méthode
Partir des versions ACTUELLES de `publier_photos.py`, `miniature_plate.py`, `admin.html`,
`script.js` et du code du Worker. Depuis le 15/10/2026, le code des Workers est dans le dossier
local `..\Mapetanque-workers` (dépôt privé `mapetanque/mapetanque-workers`), géré avec Wrangler ;
voir son `CLAUDE.md`. Déploiement seulement à la demande de Rémy.
