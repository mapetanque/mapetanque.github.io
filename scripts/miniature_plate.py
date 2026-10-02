"""
Miniatures locales des photos Mapillary plates (les 360° ont leur propre circuit, voir
miniature_360.py), partagées par :
  - scripts/generer_miniatures_plates.py (rattrapage sur le PC, et tests) ;
  - scripts/publier_photos.py (phase « Miniatures plates » du workflow quotidien).

Une miniature par photo, quel que soit le terrain : images/mapillary-plates/<id>.webp, 800 × 450
(16:9, comme la photo des fiches), WebP qualité 80. Le carrousel « Les plus beaux terrains » s'en
sert aussi : ses tuiles 4:3 en coupent les bords (object-fit: cover).

Règle de cadrage, d'après les dimensions de la source :
  - paysage (largeur > hauteur × SEUIL_PAYSAGE) : recadrage 16:9, centré ;
  - portrait ou carré : photo entière, centrée sur un fond fait de la même photo, agrandie,
    floutée et assombrie.

Le fichier data/miniatures_plates.json tient, pour chaque identifiant Mapillary :
  {"auteur": "<username Mapillary>", "cadrage": "recadree" | "entiere"}   photo plate
  {"auteur": "<username Mapillary>", "vue_360": true}                    vue 360° (crédit seul)
Le site s'en sert pour savoir si la miniature existe (sinon : l'embed Mapillary, en secours) et
pour afficher l'auteur dans le crédit. Il est écrit uniquement par les scripts du dépôt, jamais
par le Worker mapetanque-admin.

Réglages manuels, pour les rares ratés, à ajouter à la main dans l'entrée de la photo, puis
relancer « python scripts/generer_miniatures_plates.py --refaire <id> » :
  "forcer": "recadree" ou "entiere"   impose le cadrage au lieu de la règle automatique ;
  "position_y": 0.3                   hauteur du recadrage (0 = haut de la photo, 1 = bas ;
                                      0,5 par défaut).
"""
import json
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "images" / "mapillary-plates"
CHEMIN_INFOS = RACINE / "data" / "miniatures_plates.json"
# Préfixe des chemins web qui désignent un fichier de DOSSIER.
PREFIXE_WEB = "/images/mapillary-plates/"

LARGEUR = 800
HAUTEUR = 450
QUALITE_WEBP = 80

# Au-delà de ce rapport largeur / hauteur, la photo est un paysage : on la recadre. En deçà
# (portrait, carré, ou presque carré), on la montre entière sur un fond flou.
SEUIL_PAYSAGE = 1.1
# Fond des photos entières : flou gaussien (rayon en pixels, sur l'image en 800 × 450) et
# luminosité (1 = inchangée).
RAYON_FLOU = 28
LUMINOSITE_FOND = 0.75

CADRAGES = ("recadree", "entiere")


# ---------------------------------------------------------------- Fichier des infos

def charger_infos():
    """Contenu de data/miniatures_plates.json ({} s'il n'existe pas encore)."""
    if not CHEMIN_INFOS.exists():
        return {}
    with open(CHEMIN_INFOS, encoding="utf-8") as f:
        return json.load(f)


def enregistrer_infos(infos):
    """Réécrit le fichier, trié par identifiant : un ajout ne déplace pas les autres lignes,
    ce qui garde les différences lisibles dans le dépôt."""
    CHEMIN_INFOS.parent.mkdir(parents=True, exist_ok=True)
    with open(CHEMIN_INFOS, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(sorted(infos.items())), f, ensure_ascii=False, indent=1)
        f.write("\n")


def chemin_miniature(mapillary_id):
    return DOSSIER / f"{mapillary_id}.webp"


def chemin_web(mapillary_id):
    return f"{PREFIXE_WEB}{mapillary_id}.webp"


# ---------------------------------------------------------------- Mapillary

def lire_mapillary(mapillary_id, token, champs):
    """Champs demandés à l'API Graph pour une image. Lève RuntimeError si elle refuse."""
    reponse = requests.get(f"https://graph.mapillary.com/{mapillary_id}", params={
        "access_token": token,
        "fields": champs,
    }, timeout=20)
    if not reponse.ok:
        raise RuntimeError(f"HTTP {reponse.status_code} — {reponse.text[:200]}")
    return reponse.json()


def auteur_de(donnees):
    return ((donnees.get("creator") or {}).get("username") or "").strip()


def lire_auteur(mapillary_id, token):
    """Nom d'utilisateur Mapillary de l'auteur ("" si l'API ne le donne pas)."""
    return auteur_de(lire_mapillary(mapillary_id, token, "creator"))


# ---------------------------------------------------------------- Cadrage

def est_paysage(image):
    largeur, hauteur = image.size
    return largeur > hauteur * SEUIL_PAYSAGE


def composer(image, forcer=None, position_y=0.5):
    """Miniature 800 × 450 et cadrage retenu ("recadree" ou "entiere")."""
    cadrage = forcer if forcer in CADRAGES else ("recadree" if est_paysage(image) else "entiere")
    taille = (LARGEUR, HAUTEUR)

    if cadrage == "recadree":
        position_y = min(max(float(position_y), 0.0), 1.0)
        return ImageOps.fit(image, taille, Image.LANCZOS, centering=(0.5, position_y)), cadrage

    # Fond : la photo agrandie pour couvrir tout le cadre, floutée puis assombrie.
    fond = ImageOps.fit(image, taille, Image.LANCZOS)
    fond = fond.filter(ImageFilter.GaussianBlur(RAYON_FLOU))
    fond = ImageEnhance.Brightness(fond).enhance(LUMINOSITE_FOND)
    # Devant : la photo entière, à la plus grande taille qui tienne dans le cadre.
    devant = ImageOps.contain(image, taille, Image.LANCZOS)
    fond.paste(devant, ((LARGEUR - devant.width) // 2, (HAUTEUR - devant.height) // 2))
    return fond, cadrage


# ---------------------------------------------------------------- Génération

def generer(mapillary_id, token, reglages=None):
    """
    Télécharge la photo, la cadre et écrit sa miniature (un fichier existant est remplacé).
    reglages : l'entrée actuelle de la photo dans miniatures_plates.json, pour garder « forcer »
    et « position_y ». Renvoie la nouvelle entrée ({"auteur", "vue_360": true}, sans fichier,
    pour une vue 360°). Lève RuntimeError pour une photo introuvable.
    """
    reglages = reglages or {}
    donnees = lire_mapillary(mapillary_id, token, "thumb_2048_url,camera_type,creator")

    # Vue 360° retenue sans miniature 360° : pas de miniature plate (un recadrage 16:9 de
    # l'image équirectangulaire serait déformé). Elle est notée comme vue 360°, pour le crédit
    # et pour ne pas être retentée à chaque passage ; le site garde l'embed Mapillary.
    if donnees.get("camera_type") in ("spherical", "equirectangular"):
        return {"auteur": auteur_de(donnees), "vue_360": True}
    url = donnees.get("thumb_2048_url")
    if not url:
        raise RuntimeError(f"pas de thumb_2048_url dans la réponse : {donnees}")

    reponse = requests.get(url, timeout=30)
    reponse.raise_for_status()
    # exif_transpose : une photo prise en portrait peut être stockée couchée, avec l'étiquette
    # d'orientation pour la redresser.
    image = ImageOps.exif_transpose(Image.open(BytesIO(reponse.content))).convert("RGB")

    miniature, cadrage = composer(image, reglages.get("forcer"), reglages.get("position_y", 0.5))
    chemin = chemin_miniature(mapillary_id)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    miniature.save(chemin, "WEBP", quality=QUALITE_WEBP)

    entree = {"auteur": auteur_de(donnees), "cadrage": cadrage}
    for cle in ("forcer", "position_y"):
        if cle in reglages:
            entree[cle] = reglages[cle]
    return entree


# ---------------------------------------------------------------- Passage complet

def ids_de_photos_mapillary(photos):
    """(plates, vues_360) : identifiants de data/photos_mapillary.json. Une entrée avec
    miniature_locale est une vue 360° (même règle que le site)."""
    plates, vues_360 = set(), set()
    for liste in photos.values():
        for entree in liste:
            mapillary_id = str(entree.get("mapillary_id") or "")
            if not mapillary_id:
                continue
            (vues_360 if entree.get("miniature_locale") else plates).add(mapillary_id)
    return plates - vues_360, vues_360


def completer(token, plates, vues_360, limite=None, refaire=(), simulation=False, pause=1.0):
    """
    Génère les miniatures plates qui manquent (et celles de « refaire »), et note l'auteur des
    vues 360° qui n'en ont pas encore. Le fichier des infos est enregistré après chaque photo :
    un passage interrompu reprend là où il s'est arrêté. limite : nombre maximal de photos
    traitées (pour un essai). Renvoie (faites, échecs).
    """
    infos = charger_infos()
    refaire = {str(i) for i in refaire}
    # Une vue 360° rangée parmi les photos plates (voir generer) n'a pas de fichier : son
    # entrée suffit pour ne pas la retenter.
    a_generer = sorted(i for i in plates
                       if i in refaire or i not in infos
                       or (not infos[i].get("vue_360") and not chemin_miniature(i).exists()))
    a_crediter = sorted(i for i in vues_360 if i not in infos)
    taches = [(i, "plate") for i in a_generer] + [(i, "360") for i in a_crediter]
    if limite is not None:
        taches = taches[:limite]

    print(f"{len(a_generer)} miniature(s) plate(s) à générer, "
          f"{len(a_crediter)} auteur(s) de vue 360° à relever"
          + (f", limité à {len(taches)} pour ce passage" if limite is not None else "") + ".")

    faites, echecs = 0, []
    for numero, (mapillary_id, genre) in enumerate(taches, start=1):
        etiquette = f"[{numero}/{len(taches)}] {mapillary_id}"
        if simulation:
            print(f"{etiquette} : {'miniature' if genre == 'plate' else 'auteur 360°'} à faire.")
            continue
        try:
            if genre == "plate":
                infos[mapillary_id] = generer(mapillary_id, token, infos.get(mapillary_id))
                entree = infos[mapillary_id]
                detail = ("vue 360° sans miniature 360°, embed Mapillary gardé" if entree.get("vue_360")
                          else entree["cadrage"]) + f", par {entree['auteur'] or '?'}"
            else:
                infos[mapillary_id] = {"auteur": lire_auteur(mapillary_id, token), "vue_360": True}
                detail = f"auteur 360° : {infos[mapillary_id]['auteur'] or '?'}"
            enregistrer_infos(infos)
            faites += 1
            print(f"{etiquette} : {detail}.")
        except Exception as e:
            echecs.append(mapillary_id)
            print(f"{etiquette} : échec ({e}), réessai au prochain passage.")
        time.sleep(pause)   # politesse envers l'API Mapillary

    # Récapitulatif : une photo supprimée de Mapillary échoue à chaque passage, jusqu'à ce
    # qu'elle soit retirée du terrain dans la page admin.
    if echecs:
        print(f"Photo(s) en échec : {', '.join(echecs)}")
    return faites, len(echecs)


def menage(ids_cites, simulation=False):
    """
    Retire les miniatures et les entrées que plus rien ne cite. ids_cites : identifiants
    Mapillary encore utilisés (photos_mapillary.json, épinglés, promus, tags OSM). Garde-fou :
    une liste vide (fichier illisible ou vidé) n'efface jamais rien.
    """
    ids_cites = {str(i) for i in ids_cites}
    if not ids_cites:
        print("Aucune photo citée nulle part : ménage annulé par prudence.")
        return

    infos = charger_infos()
    entrees = sorted(i for i in infos if i not in ids_cites)
    fichiers = sorted(f for f in DOSSIER.glob("*.webp") if f.stem not in ids_cites)
    if not entrees and not fichiers:
        print("Aucune miniature plate orpheline.")
        return

    for fichier in fichiers:
        print(f"  {'serait supprimée' if simulation else 'supprimée'} : {fichier.name}")
        if not simulation:
            fichier.unlink()
    if not simulation:
        for mapillary_id in entrees:
            del infos[mapillary_id]
        enregistrer_infos(infos)
    print(f"{len(fichiers)} miniature(s) et {len(entrees)} entrée(s) orpheline(s)"
          + (" repérée(s)." if simulation else " retirée(s)."))
