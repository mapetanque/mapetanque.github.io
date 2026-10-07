# Mapetanque — Photos des visiteurs : publication directe sur le site (réflexion, rien codé)

## Contexte
Circuit actuel (étape 3 de la page admin) : photo visiteur (réduite à 2048 px, redressée et sans
métadonnées par le formulaire, `script.js`) → Worker `mapetanque-admin` → R2 (`mapetanque-photos`)
+ file D1 → modération dans admin.html → `publier-photos.yml` / `scripts/publier_photos.py` écrit
les EXIF et envoie via `mapillary_tools` → traitement Mapillary (24–48 h, parfois une semaine) →
rattachement de l'ID Mapillary (le Worker efface alors le fichier de R2) → la phase « Miniatures
plates » génère la miniature 800×450 dans `images/mapillary-plates/` → affichage sur le site.

Déjà réglé : le site affiche des miniatures locales (`images/mapillary-plates/`, 432 fichiers,
31 Mo ; `images/mapillary-360/`, 373 fichiers, 65 Mo). L'embed Mapillary ne sert plus qu'en
secours. Les URLs qui expirent et la dépendance à l'API ne concernent plus que ce secours.
Problèmes restants : le délai avant affichage et le rattachement fragile.

## Orientation retenue
- Publier la photo directement sur le site dès la validation, sans attendre Mapillary. « Dès la
  validation » = au passage suivant du workflow (5 h UTC ou bouton « Publier maintenant »), plus
  quelques minutes de déploiement GitHub Pages, car `photos_mapillary.json` est dans le dépôt.
- Générer deux WebP depuis le fichier R2 (déjà flouté, voir plus bas) :
  - miniature 800×450, qualité 80, même format et même règle de cadrage que
    `scripts/miniature_plate.py` (paysage recadré 16:9 ; portrait entier sur fond flou),
    ~70 Ko, rangée DANS LE DÉPÔT (`images/visiteurs/<id>.webp` ou équivalent) ;
  - version d'affichage pour la visionneuse (~1280–1600 px, qualité ~75, ~120–200 Ko),
    rangée dans R2.
- Pourquoi ce partage : la fiche, le carrousel, `promouvoir_terrains.py` et le ménage marchent déjà
  avec des chemins locaux `/images/...`. 2 000 miniatures ≈ 140 Mo, acceptable (le dépôt porte déjà
  96 Mo de miniatures). Les photos restent visibles sur les fiches même si le Worker est en panne
  ou si le quota est atteint. Seules les grandes versions, plus lourdes, vont dans R2 (gratuit
  jusqu'à 10 Go-mois, sortie gratuite).
- Service des grandes versions par le Worker `mapetanque-admin`. Le DNS est chez OVH, donc pas de
  domaine perso pour R2 ; `r2.dev` n'est pas prévu pour la production.
  ⚠️ Le cache de Cloudflare (Cache API) est sans effet sur `*.workers.dev` : seul le cache du
  navigateur jouera (`Cache-Control: public, max-age=31536000, immutable`, avec un nom de fichier
  qui change si l'image change). Chaque première vue = 1 requête Worker + 1 lecture R2, sur le
  quota gratuit de 100 000 requêtes/jour COMMUN à tout le compte (admin, envois, notes).
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
- Les photos Mapillary trouvées par proximité (~754 terrains) ne changent pas.

## À adapter
- `scripts/publier_photos.py` + `publier-photos.yml` :
  - nouvelle phase : flou, génération des deux WebP, miniature dans le dépôt, grande version
    dans R2 ; ajouter le dossier des miniatures au `git add` du workflow ;
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
- `script.js` (fiche terrain) : affichage de la miniature locale + visionneuse (grande version
  servie par le Worker) ; dédoublonnage par identifiant stable, plus seulement par `mapillary_id`.
- `scripts/promouvoir_terrains.py` : prendre la miniature 16:9 locale de la photo du visiteur
  quand elle existe (pas de miniature carrée : les tuiles 4:3 coupent la 16:9 en CSS). Il
  n'écrit toujours aucune image.
- Textes 4 langues (FR/NL/DE/EN) :
  - `scripts/generer_a_propos.py` (pas `translations.js`) : section « Vos données » (photo
    publiée sur le site, et éventuellement sur Mapillary ; floutage fait par moi ; la phrase
    « seule la date est gardée, car Mapillary l'exige » est à revoir) et paragraphe d'intro
    (« chaque photo reçue est publiée sur Mapillary avant d'être affichée ici » devient faux) ;
  - `translations.js` : `add_photo_checkbox_label` (publication sur le site sous CC BY-SA, et
    éventuellement sur Mapillary) et `add_photo_success` (n'annonce plus « quelques jours de
    traitement chez Mapillary ») ;
  - puis relancer `scripts/generate_provinces.py` et `scripts/generer_a_propos.py`.

## Méthode
Partir des versions ACTUELLES de `publier_photos.py`, `miniature_plate.py`, `admin.html`,
`script.js` et du code du Worker (à copier depuis le tableau de bord Cloudflare au début de la
session, puisqu'il n'est pas dans le dépôt).
