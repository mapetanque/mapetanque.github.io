"""
Publication des photos de visiteurs validées dans la page admin : publication
directe sur le site, envoi à Mapillary, rattachement de leur identifiant,
reconstruction de data/photos_mapillary.json.

Lancé par .github/workflows/publier-photos.yml, chaque jour et à la demande
(bouton « Publier maintenant » de la page admin). Remplace
scripts/tester_envoi_mapillary.py, dont il reprend la préparation des EXIF.

Sept phases, dans cet ordre. Une phase qui échoue n'empêche pas les suivantes
(sauf le ménage, qui n'a lieu qu'après un export réussi) :

  1. Rattachement. Pour les photos envoyées lors d'un passage précédent, cherche
     leur identifiant : une image de notre compte, à moins de RAYON_RECHERCHE_M
     du terrain, datée à MARGE_DATE près, pas encore utilisée ailleurs. Mapillary
     ne rend l'identifiant qu'après traitement complet (en général un à deux
     jours, parfois plus) : une photo pas encore trouvée sera recherchée au
     passage suivant, sans limite de temps. Une fois rattachée, son fichier est
     effacé de R2 par le Worker.
  1 bis. Publication sur le site. Chaque photo validée « Publier tout de suite »
     dans la page admin reçoit sa miniature 800 × 450 (même cadrage que
     scripts/miniature_plate.py), poussée dans le dépôt public
     mapetanque/mapetanque-photos (servi à https://mapetanque.be/mapetanque-photos/),
     et sa grande version (GRANDE_COTE px), rangée dans R2 par le Worker. La photo
     n'est déclarée publiée qu'une fois la miniature poussée. Avant d'ajouter quoi
     que ce soit, la taille du dépôt des photos est mesurée : alerte (issue GitHub)
     à SEUIL_ALERTE_MO, plus aucun ajout à SEUIL_BLOCAGE_MO. Le dépôt du site, lui,
     ne reçoit jamais d'image de visiteur.
  2. Envoi. Chaque photo validée est préparée (coordonnées du terrain, date,
     orientation, rien d'autre) puis envoyée SEULE par mapillary_tools : deux
     photos d'un même terrain portent les mêmes coordonnées, et envoyées
     ensemble, mapillary_tools écarterait la seconde comme doublon.
  3. Miniatures 360°. Chaque vue 360° à générer (nouvelle, ou recadrée dans la
     page admin) est recadrée par scripts/miniature_360.py et rangée dans
     images/mapillary-360/. Une vue déjà en ligne avec l'ancien circuit, jamais
     recadrée depuis, est seulement marquée comme faite. Rien n'est supprimé ici :
     une même vue sert souvent à plusieurs terrains voisins, chacun avec son
     propre fichier, et un épinglé du carrousel peut pointer sur l'un d'eux.
  4. Export. Le Worker fusionne toutes les décisions (revue des candidats,
     photos manuelles, photos de visiteurs rattachées, vues 360° générées) sur
     le data/photos_mapillary.json du dépôt, puis applique l'ordre et les
     suppressions choisis dans la page admin. Le fichier est réécrit.
  5. Miniatures plates. Sur le photos_mapillary.json tout juste réécrit (et
     pour les tags OSM mapillary= de terrains.geojson), génère la miniature de
     chaque photo plate qui n'en a pas encore (images/mapillary-plates/, par
     scripts/miniature_plate.py) et relève son auteur, ainsi que celui des vues
     360°, dans data/miniatures_plates.json. Ce fichier n'est jamais touché par
     le Worker, ni par le workflow OSM : un seul workflow l'écrit.
  6. Ménage. Supprime de images/mapillary-360/ et de images/mapillary-plates/
     les fichiers que plus rien ne cite : ni photos_mapillary.json (tout juste
     réécrit), ni beaux_terrains.json, ni terrains_promus.json, ni (pour les
     photos plates) un tag OSM mapillary=. Retire aussi de
     miniatures_plates.json les photos disparues, et du dépôt des photos les
     miniatures de visiteurs que plus rien ne cite (photo refusée depuis). N'a
     lieu que si l'export a réussi : sur un fichier pas à jour, les miniatures du
     passage seraient prises pour des orphelines.

Variables d'environnement :
    JETON_WORKFLOW     clé partagée avec le Worker mapetanque-admin
    MAPILLARY_TOKEN    jeton client MLY|... (recherche dans l'API Graph)
    DOSSIER_PHOTOS     clone du dépôt mapetanque-photos, avec le droit de pousser
                       (sans lui, la phase 1 bis échoue et le signale)
    GITHUB_TOKEN, GITHUB_REPOSITORY
                       pour ouvrir les issues d'alerte (fournis par le workflow)
    mapillary_tools doit être authentifié sous le profil PROFIL_MAPILLARY.

En local (depuis la racine du dépôt) :
    python scripts/publier_photos.py --simulation
    -> lit tout, prépare tout, mais n'envoie rien, n'enregistre rien et
       n'écrit pas le fichier.
"""

import argparse
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER_360 = RACINE / "images" / "mapillary-360"
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"
CHEMIN_PHOTOS = RACINE / "data" / "photos_mapillary.json"
CHEMIN_EPINGLES = RACINE / "data" / "beaux_terrains.json"
CHEMIN_PROMUS = RACINE / "data" / "terrains_promus.json"

# Préfixe des chemins web qui désignent un fichier de DOSSIER_360.
PREFIXE_360 = "/images/mapillary-360/"

URL_WORKER = os.environ.get(
    "MAPETANQUE_ADMIN_URL", "https://mapetanque-admin.mapetanque.workers.dev"
)

PROFIL_MAPILLARY = "mapetanque"
ID_COMPTE_MAPILLARY = "879861261618155"

# Zone de recherche autour du terrain. Large : les coordonnées écrites dans
# l'image sont celles du terrain, mais Mapillary peut recalculer une position
# légèrement différente.
RAYON_RECHERCHE_M = 60

# Tolérance entre la date écrite dans l'image et le captured_at rendu par l'API.
# Les dates EXIF n'ont pas de fuseau : selon que Mapillary les lit en heure
# belge ou en UTC, l'écart peut atteindre deux heures. Un jour de marge en plus
# couvre largement le reste, sans risque réel de confusion : l'image doit aussi
# venir de notre compte et se trouver sur le terrain.
MARGE_DATE = timedelta(hours=26)

# Au-delà, une photo envoyée sans identifiant est signalée dans le journal.
ALERTE_BLOCAGE = timedelta(days=5)

# Publication directe (phase 1 bis). Les miniatures vont dans le dépôt des photos, sous
# SOUS_DOSSIER_SITE ; le site les lit à PREFIXE_SITE (DOIT rester identique à URL_PHOTOS_SITE du
# Worker, qui écrit ces adresses dans photos_mapillary.json).
SOUS_DOSSIER_SITE = "visiteurs"
PREFIXE_SITE = "https://mapetanque.be/mapetanque-photos/" + SOUS_DOSSIER_SITE + "/"
GRANDE_COTE = 1600
GRANDE_QUALITE = 75
# Taille des fichiers suivis du dépôt des photos (GitHub Pages refuse un site de plus de 1 Go).
SEUIL_ALERTE_MO = 700
SEUIL_BLOCAGE_MO = 850

JETON_WORKFLOW = None


# ---------------------------------------------------------------- Worker

def appel_worker(methode, chemin, corps=None, brut=False, binaire=None, type_contenu=None):
    """Appelle une route /workflow/ du Worker. Lève HTTPError si refusée. binaire : contenu
    envoyé tel quel (type_contenu en précise le type), à la place d'un corps JSON."""
    donnees = None
    entetes = {
        "Authorization": "Bearer " + JETON_WORKFLOW,
        "User-Agent": "Mapetanque-publication/1.0",
    }
    if binaire is not None:
        donnees = binaire
        entetes["Content-Type"] = type_contenu or "application/octet-stream"
    elif corps is not None:
        donnees = json.dumps(corps, ensure_ascii=False).encode("utf-8")
        entetes["Content-Type"] = "application/json; charset=utf-8"

    requete = urllib.request.Request(
        URL_WORKER + chemin, data=donnees, headers=entetes, method=methode
    )
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        contenu = reponse.read()
    return contenu if brut else json.loads(contenu.decode("utf-8"))


def detail_erreur(e):
    """Message lisible pour une erreur d'appel, avec la réponse du serveur."""
    if isinstance(e, urllib.error.HTTPError):
        try:
            return f"HTTP {e.code} — {e.read()[:300].decode('utf-8', 'replace')}"
        except Exception:
            return f"HTTP {e.code}"
    return str(e)


# ---------------------------------------------------------------- Données locales

def charger_terrains():
    """{osm_id: (latitude, longitude)} d'après terrains.geojson."""
    with open(CHEMIN_TERRAINS, encoding="utf-8") as f:
        geo = json.load(f)

    terrains = {}
    for feature in geo["features"]:
        lon, lat = feature["geometry"]["coordinates"]
        terrains[feature["properties"]["osm_id"]] = (lat, lon)
    return terrains


def ids_du_fichier():
    """Tous les identifiants déjà présents dans photos_mapillary.json."""
    with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
        photos = json.load(f)

    ids = set()
    for liste in photos.values():
        for entree in liste:
            if entree.get("mapillary_id"):
                ids.add(str(entree["mapillary_id"]))
    return ids


# ---------------------------------------------------------------- Dates

def lire_date(texte):
    """Date sans fuseau à partir des formats rencontrés, ou None."""
    if not texte:
        return None
    for format_date in ("%Y-%m-%d %H:%M:%S", "%Y:%m:%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(texte)[:19], format_date)
        except ValueError:
            pass
    return None


def date_de(photo):
    """
    Date écrite dans l'image, et donc aussi celle qui sert à la retrouver : la
    prise de vue relevée par le navigateur, sinon la date de réception. Les deux
    phases passent par cette fonction : elles ne peuvent pas diverger.
    """
    return (
        lire_date(photo.get("date_prise"))
        or lire_date(photo.get("cree"))
        or datetime.now(timezone.utc).replace(tzinfo=None)
    )


# ---------------------------------------------------------------- EXIF

def en_fraction_exif(valeur):
    """Angle décimal -> degrés/minutes/secondes en fractions, format EXIF."""
    valeur = abs(valeur)
    degres = int(valeur)
    minutes = int((valeur - degres) * 60)
    secondes = (valeur - degres - minutes / 60) * 3600
    return ((degres, 1), (minutes, 1), (int(round(secondes * 1000000)), 1000000))


def lire_orientation(chemin):
    """
    Étiquette d'orientation d'origine, ou None. L'effacer publie une photo prise
    en portrait couchée : c'est arrivé au premier test. Elle ne révèle ni
    l'appareil ni le lieu.
    """
    import piexif

    try:
        exif = piexif.load(str(chemin))
    except Exception:
        return None
    return exif.get("0th", {}).get(piexif.ImageIFD.Orientation)


def ecrire_exif(chemin, lat, lon, date_prise, orientation=None):
    """
    Écrit les seules informations exigées par mapillary_tools : position du
    terrain et date de prise de vue, plus l'orientation si la photo en portait
    une. Tout le reste des EXIF est REMPLACÉ, pas complété.
    """
    import piexif

    exif = {
        "0th": {} if orientation is None else {piexif.ImageIFD.Orientation: orientation},
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: date_prise.strftime("%Y:%m:%d %H:%M:%S"),
        },
        "GPS": {
            piexif.GPSIFD.GPSVersionID: (2, 3, 0, 0),
            piexif.GPSIFD.GPSLatitudeRef: "N" if lat >= 0 else "S",
            piexif.GPSIFD.GPSLatitude: en_fraction_exif(lat),
            piexif.GPSIFD.GPSLongitudeRef: "E" if lon >= 0 else "W",
            piexif.GPSIFD.GPSLongitude: en_fraction_exif(lon),
            piexif.GPSIFD.GPSDateStamp: date_prise.strftime("%Y:%m:%d"),
        },
        "1st": {},
        "thumbnail": None,
    }
    piexif.insert(piexif.dump(exif), str(chemin))


def preparer_fichier(contenu, dossier, lat, lon, date_prise):
    """
    Écrit la photo prête à l'envoi dans le dossier. mapillary_tools n'accepte
    que le JPEG : un PNG ou un WebP est converti au passage.
    """
    chemin = dossier / "photo.jpg"

    if contenu[:3] == b"\xff\xd8\xff":
        chemin.write_bytes(contenu)
    else:
        from PIL import Image

        image = Image.open(io.BytesIO(contenu)).convert("RGB")
        image.save(chemin, "JPEG", quality=92)

    ecrire_exif(chemin, lat, lon, date_prise, lire_orientation(chemin))
    return chemin


# ---------------------------------------------------------------- Mapillary

def envoyer_mapillary(dossier):
    """Envoie le contenu du dossier. Renvoie (réussi, fin du journal)."""
    commande = [
        "mapillary_tools", "process_and_upload", str(dossier),
        "--user_name", PROFIL_MAPILLARY,
    ]
    resultat = subprocess.run(commande, capture_output=True, text=True)
    journal = (resultat.stdout or "") + (resultat.stderr or "")
    print(journal[-1500:])
    return resultat.returncode == 0, journal[-400:].strip()


def chercher_images(lat, lon, token):
    """Images Mapillary autour d'un point, avec auteur et date."""
    delta_lat = RAYON_RECHERCHE_M / 111000
    delta_lon = RAYON_RECHERCHE_M / 70000
    bbox = f"{lon - delta_lon},{lat - delta_lat},{lon + delta_lon},{lat + delta_lat}"

    parametres = urllib.parse.urlencode({
        "access_token": token,
        "fields": "id,captured_at,creator",
        "bbox": bbox,
        "limit": 100,
    })
    requete = urllib.request.Request(
        "https://graph.mapillary.com/images?" + parametres,
        headers={"User-Agent": "Mapetanque-publication/1.0"},
    )
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode("utf-8")).get("data", [])


def noter_erreur(photo_id, message):
    """Enregistre un échec sur la photo, sans jamais interrompre la phase."""
    try:
        appel_worker("POST", "/workflow/erreur", {"id": photo_id, "message": message})
    except Exception as e:
        print(f"  (erreur non enregistrée : {detail_erreur(e)})")


# ---------------------------------------------------------------- Alertes et dépôt des photos

def signaler(titre, texte):
    """
    Ouvre une issue dans le dépôt du site (c'est le bot GitHub Actions qui écrit : GitHub envoie
    donc un mail). Si une issue ouverte porte déjà ce titre, rien de plus : pas un mail par
    passage. Sans GITHUB_TOKEN (passage en local), le message est seulement affiché.
    """
    print(f"ALERTE — {titre} : {texte}")
    jeton, depot = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not jeton or not depot:
        return
    entetes = {
        "Authorization": "Bearer " + jeton,
        "Accept": "application/vnd.github+json",
        "User-Agent": "Mapetanque-publication/1.0",
    }
    try:
        requete = urllib.request.Request(
            f"https://api.github.com/repos/{depot}/issues?state=open&per_page=100", headers=entetes)
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            ouvertes = json.loads(reponse.read().decode("utf-8"))
        if any(i.get("title") == titre and "pull_request" not in i for i in ouvertes):
            print("  (issue déjà ouverte)")
            return
        corps = json.dumps({"title": titre, "body": texte}).encode("utf-8")
        requete = urllib.request.Request(
            f"https://api.github.com/repos/{depot}/issues", data=corps, method="POST",
            headers=dict(entetes, **{"Content-Type": "application/json"}))
        urllib.request.urlopen(requete, timeout=30).close()
        print("  (issue ouverte)")
    except Exception as e:
        print(f"  (issue non ouverte : {detail_erreur(e)})")


def dossier_photos():
    """Clone du dépôt des photos (DOSSIER_PHOTOS), ou None s'il manque."""
    chemin = os.environ.get("DOSSIER_PHOTOS")
    if chemin and (Path(chemin) / ".git").exists():
        return Path(chemin)
    return None


def git_photos(dossier, *arguments):
    """Commande git dans le dépôt des photos. Lève RuntimeError en cas d'échec."""
    resultat = subprocess.run(["git", "-C", str(dossier), *arguments], capture_output=True, text=True)
    if resultat.returncode != 0:
        raise RuntimeError(f"git {arguments[0]} : {(resultat.stderr or resultat.stdout).strip()[-400:]}")
    return resultat.stdout


def taille_depot_mo(dossier):
    """Taille des fichiers suivis par Git (ce que publie GitHub Pages), en Mo."""
    total = 0
    for nom in git_photos(dossier, "ls-files", "-z").split("\0"):
        if nom and (dossier / nom).is_file():
            total += (dossier / nom).stat().st_size
    return total / 1024 / 1024


def pousser_photos(dossier, message):
    """Commite et pousse le dépôt des photos s'il a changé. Un refus (jeton JETON_PHOTOS expiré,
    droits retirés…) est signalé par une issue, puis lève RuntimeError."""
    if not git_photos(dossier, "status", "--porcelain").strip():
        return False
    git_photos(dossier, "add", "-A")
    git_photos(dossier, "commit", "-q", "-m", message)
    try:
        git_photos(dossier, "push", "-q")
    except RuntimeError as e:
        signaler("Publication des photos : envoi vers mapetanque-photos refusé",
                 "Le workflow « Publication des photos » n'a pas pu pousser dans le dépôt "
                 "mapetanque/mapetanque-photos. Cause la plus probable : le jeton JETON_PHOTOS a "
                 "expiré. Le régénérer sur GitHub (Settings → Developer settings → Fine-grained "
                 "tokens), puis remplacer la valeur du secret JETON_PHOTOS du dépôt du site. "
                 f"Les photos concernées seront publiées au passage suivant.\n\nDétail : {e}")
        raise
    return True


# ---------------------------------------------------------------- Phases

def nom_miniature_360(pano):
    """
    Nom du fichier de la miniature. Après un recadrage (maj différent de cree), la date du
    recadrage entre dans le nom : une nouvelle adresse, que les navigateurs ne peuvent pas
    confondre avec l'ancienne image gardée en cache. DOIT rester identique au calcul de
    l'export dans le Worker (exporterPhotosMapillary).
    """
    mapillary_id = str(pano["mapillary_id"])
    if pano.get("cree") == pano.get("maj"):
        return f"{mapillary_id}.webp"
    return f"{mapillary_id}-{''.join(c for c in str(pano.get('maj')) if c.isdigit())}.webp"


def phase_panos(token, simulation):
    import miniature_360   # numpy et Pillow ne sont chargés que si cette phase tourne

    panos = appel_worker("GET", "/workflow/panos-a-generer")
    if not panos:
        print("Aucune vue 360° à générer.")
        return

    deja_publiees = ids_du_fichier()
    for pano in panos:
        mapillary_id = str(pano["mapillary_id"])
        etiquette = f"{pano['osm_id']} (360° {mapillary_id})"
        chemin = DOSSIER_360 / nom_miniature_360(pano)

        # Vue déjà en ligne, générée par l'ancien circuit, et jamais recadrée depuis
        # (cree == maj : la ligne n'a pas bougé depuis l'import). Rien à recalculer.
        jamais_recadree = pano.get("cree") == pano.get("maj")
        if jamais_recadree and mapillary_id in deja_publiees and chemin.exists():
            if simulation:
                print(f"{etiquette} : déjà en ligne, serait marquée comme faite.")
                continue
            try:
                appel_worker("POST", "/workflow/pano-genere", {"id": pano["id"]})
                print(f"{etiquette} : déjà en ligne, marquée comme faite.")
            except Exception as e:
                print(f"{etiquette} : statut non enregistré ({detail_erreur(e)}).")
            continue

        if simulation:
            print(f"{etiquette} : serait générée (x={pano.get('pano_x')}, y={pano.get('pano_y')}, "
                  f"zoom={pano.get('pano_zoom')}).")
            continue

        try:
            miniature_360.generer_miniature(mapillary_id, pano.get("pano_x"), pano.get("pano_y"),
                                            pano.get("pano_zoom"), token, chemin)
        except Exception as e:
            print(f"{etiquette} : échec ({e}), réessai au prochain passage.")
            noter_erreur(pano["id"], f"miniature 360° : {e}")
            continue

        try:
            appel_worker("POST", "/workflow/pano-genere", {"id": pano["id"]})
            print(f"{etiquette} : miniature générée ({chemin.name}).")
        except Exception as e:
            # Le fichier est écrit : le passage suivant le régénérera simplement.
            print(f"{etiquette} : miniature écrite, statut non enregistré ({detail_erreur(e)}).")
        time.sleep(1)   # politesse envers l'API Mapillary

def phase_rattachement(terrains, token, simulation):
    reponse = appel_worker("GET", "/workflow/a-rattacher")
    photos = reponse["photos"]
    if not photos:
        print("Aucune photo en attente d'identifiant.")
        return

    utilises = {str(i) for i in reponse["deja_utilises"]} | ids_du_fichier()
    maintenant = datetime.now(timezone.utc).replace(tzinfo=None)

    par_terrain = defaultdict(list)
    for photo in photos:
        par_terrain[photo["osm_id"]].append(photo)

    for osm_id, groupe in par_terrain.items():
        if osm_id not in terrains:
            print(f"{osm_id} : terrain absent de terrains.geojson, ignoré.")
            continue

        lat, lon = terrains[osm_id]
        try:
            images = chercher_images(lat, lon, token)
        except Exception as e:
            print(f"{osm_id} : recherche impossible ({detail_erreur(e)}).")
            continue

        # Nos images seulement, pas encore utilisées, avec une date.
        candidates = []
        for image in images:
            if str((image.get("creator") or {}).get("id")) != ID_COMPTE_MAPILLARY:
                continue
            if str(image["id"]) in utilises or image.get("captured_at") is None:
                continue
            prise = datetime.fromtimestamp(image["captured_at"] / 1000, tz=timezone.utc)
            candidates.append((prise.replace(tzinfo=None), str(image["id"])))

        # Plusieurs photos d'un même terrain : chacune prend l'image la plus
        # proche en date. Laquelle va sur quelle ligne importe peu, elles sont
        # toutes publiées sur le même terrain.
        for photo in sorted(groupe, key=date_de):
            reference = date_de(photo)
            proches = [
                c for c in candidates
                if abs(c[0] - reference) <= MARGE_DATE and c[1] not in utilises
            ]

            if not proches:
                envoyee_le = lire_date(photo.get("maj"))
                attente = f"envoyée le {envoyee_le:%Y-%m-%d}" if envoyee_le else "envoyée"
                message = f"{osm_id} (photo {photo['id']}, {attente}) : pas encore traitée par Mapillary."
                if envoyee_le and maintenant - envoyee_le > ALERTE_BLOCAGE:
                    message += " ATTENTION : plus de 5 jours, à vérifier sur Mapillary."
                print(message)
                continue

            _, mapillary_id = min(proches, key=lambda c: abs(c[0] - reference))
            utilises.add(mapillary_id)

            if simulation:
                print(f"{osm_id} (photo {photo['id']}) : serait rattachée à {mapillary_id}.")
                continue

            try:
                appel_worker("POST", "/workflow/rattachee",
                             {"id": photo["id"], "mapillary_id": mapillary_id})
                print(f"{osm_id} (photo {photo['id']}) : rattachée à {mapillary_id}.")
            except Exception as e:
                print(f"{osm_id} (photo {photo['id']}) : rattachement refusé ({detail_erreur(e)}).")


def preparer_images(contenu):
    """(miniature, grande) en WebP, depuis le fichier reçu (déjà réduit à 2048 px et sans
    métadonnées par le formulaire). Miniature : même format et même cadrage que les miniatures
    des photos Mapillary plates."""
    import miniature_plate   # Pillow n'est chargé que si cette phase tourne
    from PIL import Image, ImageOps

    image = ImageOps.exif_transpose(Image.open(io.BytesIO(contenu))).convert("RGB")
    miniature, _ = miniature_plate.composer(image)
    sortie_miniature = io.BytesIO()
    miniature.save(sortie_miniature, "WEBP", quality=miniature_plate.QUALITE_WEBP)

    grande = image.copy()
    grande.thumbnail((GRANDE_COTE, GRANDE_COTE), Image.LANCZOS)
    sortie_grande = io.BytesIO()
    grande.save(sortie_grande, "WEBP", quality=GRANDE_QUALITE)
    return sortie_miniature.getvalue(), sortie_grande.getvalue()


def phase_publication(simulation):
    photos = appel_worker("GET", "/workflow/a-publier")
    if not photos:
        print("Aucune photo à publier sur le site.")
        return

    dossier = dossier_photos()
    if dossier is None and not simulation:
        signaler("Publication des photos : dépôt des photos inaccessible",
                 "Le workflow « Publication des photos » n'a pas trouvé le clone du dépôt "
                 "mapetanque/mapetanque-photos (étape « Récupération du dépôt des photos » en "
                 "échec ?). Cause la plus probable : le jeton JETON_PHOTOS a expiré ou n'a plus "
                 f"accès au dépôt. {len(photos)} photo(s) attendent d'être publiées.")
        raise RuntimeError("dépôt des photos absent (DOSSIER_PHOTOS)")

    if dossier is not None:
        taille = taille_depot_mo(dossier)
        print(f"Dépôt des photos : {taille:.0f} Mo (alerte à {SEUIL_ALERTE_MO}, blocage à {SEUIL_BLOCAGE_MO}).")
        message_taille = (f"Le dépôt mapetanque/mapetanque-photos pèse {taille:.0f} Mo. GitHub Pages "
                          "refuse un site de plus de 1 Go. Pistes : alléger les miniatures (qualité "
                          "WebP), ou ouvrir un second dépôt de photos.")
        if taille >= SEUIL_BLOCAGE_MO:
            signaler("Taille du dépôt des photos : publication bloquée",
                     message_taille + f" Au-delà de {SEUIL_BLOCAGE_MO} Mo, plus aucune photo n'est "
                     f"publiée : {len(photos)} photo(s) restent validées, en attente.")
            print("Publication bloquée : plus aucun ajout au dépôt des photos.")
            return
        if taille >= SEUIL_ALERTE_MO:
            signaler("Taille du dépôt des photos : seuil d'alerte atteint",
                     message_taille + f" Les publications continuent jusqu'à {SEUIL_BLOCAGE_MO} Mo.")

    preparees = []
    for photo in photos:
        etiquette = f"{photo['osm_id']} (photo {photo['id']})"
        try:
            contenu = appel_worker("GET", f"/workflow/fichier?id={photo['id']}", brut=True)
            miniature, grande = preparer_images(contenu)
        except Exception as e:
            print(f"{etiquette} : préparation impossible ({detail_erreur(e)}).")
            if not simulation:
                noter_erreur(photo["id"], f"publication : {detail_erreur(e)}")
            continue

        nom = f"{SOUS_DOSSIER_SITE}/{photo['id']}.webp"
        if simulation:
            print(f"{etiquette} : prête ({len(miniature) // 1024} Ko + {len(grande) // 1024} Ko), "
                  "non publiée.")
            continue
        try:
            appel_worker("PUT", f"/workflow/grande?id={photo['id']}", binaire=grande,
                         type_contenu="image/webp")
        except Exception as e:
            print(f"{etiquette} : grande version refusée ({detail_erreur(e)}).")
            noter_erreur(photo["id"], f"grande version : {detail_erreur(e)}")
            continue
        (dossier / SOUS_DOSSIER_SITE).mkdir(exist_ok=True)
        (dossier / nom).write_bytes(miniature)
        preparees.append((photo, nom))
        print(f"{etiquette} : miniature et grande version prêtes ({len(miniature) // 1024} Ko + "
              f"{len(grande) // 1024} Ko).")

    if not preparees:
        return

    # La photo n'est déclarée publiée qu'une fois sa miniature en ligne dans le dépôt : sans quoi
    # photos_mapillary.json citerait une image absente.
    pousser_photos(dossier, f"Photos de visiteurs : {len(preparees)} nouvelle(s)")
    for photo, nom in preparees:
        etiquette = f"{photo['osm_id']} (photo {photo['id']})"
        try:
            reponse = appel_worker("POST", "/workflow/publiee", {"id": photo["id"], "miniature": nom})
            suite = "envoi à Mapillary ensuite" if reponse.get("statut") == "validee" else "sans Mapillary"
            print(f"{etiquette} : publiée sur le site ({suite}).")
        except Exception as e:
            # La miniature est poussée : le passage suivant la refera à l'identique.
            print(f"{etiquette} : miniature poussée, publication non enregistrée ({detail_erreur(e)}).")


def phase_envoi(terrains, simulation):
    photos = appel_worker("GET", "/workflow/a-envoyer")
    if not photos:
        print("Aucune photo validée à envoyer.")
        return

    for photo in photos:
        osm_id = photo["osm_id"]
        etiquette = f"{osm_id} (photo {photo['id']})"

        if osm_id not in terrains:
            print(f"{etiquette} : terrain absent de terrains.geojson.")
            if not simulation:
                noter_erreur(photo["id"], "terrain absent de terrains.geojson")
            continue

        lat, lon = terrains[osm_id]
        date_prise = date_de(photo)

        try:
            contenu = appel_worker("GET", f"/workflow/fichier?id={photo['id']}", brut=True)
        except Exception as e:
            print(f"{etiquette} : fichier illisible ({detail_erreur(e)}).")
            continue

        with tempfile.TemporaryDirectory(prefix="mapetanque_") as nom_dossier:
            dossier = Path(nom_dossier)
            try:
                preparer_fichier(contenu, dossier, lat, lon, date_prise)
            except Exception as e:
                print(f"{etiquette} : préparation impossible ({e}).")
                if not simulation:
                    noter_erreur(photo["id"], f"préparation : {e}")
                continue

            if simulation:
                print(f"{etiquette} : prête, datée du {date_prise:%Y-%m-%d %H:%M}, non envoyée.")
                continue

            print(f"\n--- Envoi de {etiquette}")
            reussi, journal = envoyer_mapillary(dossier)

        # Si l'envoi réussit mais que l'enregistrement échoue, la photo sera
        # renvoyée au passage suivant : un doublon chez Mapillary, pas une perte.
        try:
            if reussi:
                appel_worker("POST", "/workflow/envoyee", {"id": photo["id"]})
                print(f"{etiquette} : envoyée.")
            else:
                noter_erreur(photo["id"], "mapillary_tools : " + journal)
                print(f"{etiquette} : échec de l'envoi, réessai au prochain passage.")
        except Exception as e:
            print(f"{etiquette} : statut non enregistré ({detail_erreur(e)}).")


def phase_export(simulation):
    with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
        socle = json.load(f)

    brut = appel_worker("POST", "/workflow/export", socle, brut=True)
    fusion = json.loads(brut.decode("utf-8"))

    # Garde-fou : le Worker ajoute et réordonne, et ne retire que les photos
    # supprimées dans la page admin (panneau « Photos du terrain »). Toute autre
    # photo perdue trahit un problème : on n'écrit rien. Les photos publiées
    # directement sur le site (id_local) n'entrent pas dans le contrôle : le
    # Worker les reconstruit entièrement d'après D1, une photo refusée disparaît.
    socle_controle = {osm_id: [e for e in liste if not e.get("id_local")]
                      for osm_id, liste in socle.items()}
    try:
        reglages = appel_worker("GET", "/workflow/photos-ordre")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        reglages = {}   # Worker sans cette route : aucun retrait admis
    for osm_id, liste in socle_controle.items():
        retirees = {str(i) for i in (reglages.get(osm_id) or {}).get("retirees", [])}
        attendues = {str(e.get("mapillary_id")) for e in liste} - retirees
        restantes = {str(e.get("mapillary_id")) for e in fusion.get(osm_id, [])}
        if attendues - restantes:
            raise RuntimeError(f"l'export a perdu des photos sur {osm_id}, fichier non modifié")

    avant = sum(len(v) for v in socle.values())
    apres = sum(len(v) for v in fusion.values())
    print(f"photos_mapillary.json : {avant} photo(s) avant, {apres} après.")

    if simulation:
        print("Simulation : fichier non modifié.")
        return

    # Écrit tel que le Worker l'a produit : même mise en forme que l'export
    # manuel de la page admin, donc aucune différence parasite dans le dépôt.
    CHEMIN_PHOTOS.write_bytes(brut)


def phase_miniatures_plates(token, simulation):
    import miniature_plate   # Pillow n'est chargé que si cette phase tourne

    with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
        plates, vues_360 = miniature_plate.ids_de_photos_mapillary(json.load(f))
    plates |= miniature_plate.ids_de_tags_osm() - vues_360
    miniature_plate.completer(token, plates, vues_360, simulation=simulation)


def miniatures_citees(prefixe):
    """
    Noms des fichiers désignés par prefixe ("/images/mapillary-360/…") que le site
    utilise encore. Les trois fichiers sont parcourus en entier, quel que soit leur
    format : toute chaîne qui commence par le préfixe compte, où qu'elle se trouve.
    """
    noms = set()

    def parcourir(valeur):
        if isinstance(valeur, str):
            if valeur.startswith(prefixe):
                noms.add(valeur[len(prefixe):])
        elif isinstance(valeur, dict):
            for v in valeur.values():
                parcourir(v)
        elif isinstance(valeur, list):
            for v in valeur:
                parcourir(v)

    for chemin in (CHEMIN_PHOTOS, CHEMIN_EPINGLES, CHEMIN_PROMUS):
        if chemin.exists():
            with open(chemin, encoding="utf-8") as f:
                parcourir(json.load(f))
    return noms


def phase_menage_360(simulation):
    citees = miniatures_citees(PREFIXE_360)
    # Garde-fou : un fichier illisible ou vidé ne doit jamais faire tout effacer.
    if not citees:
        print("Aucune miniature 360° citée nulle part : ménage annulé par prudence.")
        return

    orphelines = [f for f in sorted(DOSSIER_360.glob("*.webp")) if f.name not in citees]
    if not orphelines:
        print("Aucune miniature 360° orpheline.")
        return

    for fichier in orphelines:
        if simulation:
            print(f"  serait supprimée : {fichier.name}")
        else:
            fichier.unlink()
            print(f"  supprimée : {fichier.name}")
    print(f"{len(orphelines)} miniature(s) 360° orpheline(s)"
          + (" repérée(s)." if simulation else " supprimée(s)."))


def phase_menage_plates(simulation):
    import miniature_plate

    # Identifiants encore utilisés : toutes les photos de photos_mapillary.json, celles des
    # tags OSM mapillary=, plus les miniatures citées par les épinglés et les promus.
    cites = set(ids_du_fichier()) | miniature_plate.ids_de_tags_osm()
    cites |= {nom[:-len(".webp")] for nom in miniatures_citees(miniature_plate.PREFIXE_WEB)}
    miniature_plate.menage(cites, simulation)


def phase_menage_site(simulation):
    """Miniatures de visiteurs du dépôt des photos que plus rien ne cite (photo refusée depuis sa
    publication) : supprimées, puis le dépôt est poussé."""
    dossier = dossier_photos()
    if dossier is None:
        print("Dépôt des photos absent : rien à faire.")
        return
    fichiers = sorted((dossier / SOUS_DOSSIER_SITE).glob("*.webp"))
    citees = miniatures_citees(PREFIXE_SITE)
    # Garde-fou : un fichier illisible ou vidé ne doit jamais faire tout effacer.
    if fichiers and not citees:
        print("Aucune miniature de visiteur citée nulle part : ménage annulé par prudence.")
        return
    orphelines = [f for f in fichiers if f.name not in citees]
    if not orphelines:
        print("Aucune miniature de visiteur orpheline.")
        return
    for fichier in orphelines:
        print(f"  {'serait supprimée' if simulation else 'supprimée'} : {fichier.name}")
        if not simulation:
            fichier.unlink()
    if not simulation:
        pousser_photos(dossier, f"Photos de visiteurs : {len(orphelines)} retirée(s)")


# ---------------------------------------------------------------- Principal

def main():
    global JETON_WORKFLOW

    analyseur = argparse.ArgumentParser(description=__doc__,
                                        formatter_class=argparse.RawDescriptionHelpFormatter)
    analyseur.add_argument("--simulation", action="store_true",
                           help="n'envoie rien, n'enregistre rien, n'écrit pas le fichier")
    args = analyseur.parse_args()

    JETON_WORKFLOW = os.environ.get("JETON_WORKFLOW")
    token = os.environ.get("MAPILLARY_TOKEN")
    if not JETON_WORKFLOW or not token:
        sys.exit("JETON_WORKFLOW et MAPILLARY_TOKEN sont tous deux nécessaires.")

    terrains = charger_terrains()

    phases = [
        ("Rattachement", lambda: phase_rattachement(terrains, token, args.simulation)),
        ("Publication sur le site", lambda: phase_publication(args.simulation)),
        ("Envoi", lambda: phase_envoi(terrains, args.simulation)),
        ("Miniatures 360°", lambda: phase_panos(token, args.simulation)),
        ("Export", lambda: phase_export(args.simulation)),
        ("Miniatures plates", lambda: phase_miniatures_plates(token, args.simulation)),
    ]

    echecs = []
    for nom, phase in phases:
        print(f"\n=== {nom} ===")
        try:
            phase()
        except Exception as e:
            print(f"Échec de la phase {nom} : {detail_erreur(e)}")
            echecs.append(nom)

    # Ménage seulement sur un photos_mapillary.json à jour (voir la phase 6).
    for nom, menage in (("Ménage 360°", phase_menage_360), ("Ménage plates", phase_menage_plates),
                        ("Ménage du dépôt des photos", phase_menage_site)):
        print(f"\n=== {nom} ===")
        if "Export" in echecs:
            print("Export en échec : ménage reporté au prochain passage.")
            continue
        try:
            menage(args.simulation)
        except Exception as e:
            print(f"Échec de la phase {nom} : {e}")
            echecs.append(nom)

    # Un échec rend le lancement rouge dans l'onglet Actions : GitHub prévient
    # alors par mail. Le fichier déjà écrit est tout de même sauvegardé.
    if echecs:
        sys.exit("Phase(s) en échec : " + ", ".join(echecs))


if __name__ == "__main__":
    main()
