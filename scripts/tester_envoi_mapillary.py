"""
Test d'envoi d'UNE photo vers Mapillary, puis récupération de son identifiant.

But : valider, avant d'écrire le moindre workflow, les deux points incertains de
l'étape 3 :

  1. une photo sans GPS, à laquelle on écrit les coordonnées du terrain, est-elle
     acceptée telle quelle par mapillary_tools ?
  2. au bout de combien de temps l'identifiant de l'image devient-il interrogeable,
     et la recherche par zone suffit-elle à la retrouver sans ambiguïté ?

Rien de ce script n'est destiné à rester : il sera remplacé par le workflow GitHub
Actions une fois ces deux réponses connues.

Préalables (une seule fois) :
    pip install mapillary_tools piexif
    mapillary_tools authenticate          -> e-mail + mot de passe du compte Mapillary

Usage (depuis la racine du dépôt) :
    $env:MAPILLARY_TOKEN="MLY|xxxx"       (PowerShell)
    python scripts/tester_envoi_mapillary.py ma_photo.jpg way/123456789

    # pour ne rien envoyer et seulement voir ce qui serait écrit :
    python scripts/tester_envoi_mapillary.py ma_photo.jpg way/123456789 --simulation

    # pour reprendre la recherche d'un envoi déjà fait, sans réenvoyer :
    python scripts/tester_envoi_mapillary.py ma_photo.jpg way/123456789 --chercher-seulement

L'image d'origine n'est jamais modifiée : le script travaille sur une copie dans un
dossier temporaire, qu'il affiche à la fin.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"

# Rayon de la zone de recherche autour du terrain. Large : les coordonnées écrites
# dans l'image sont celles du terrain, mais Mapillary peut recalculer une position
# légèrement différente.
RAYON_RECHERCHE_M = 60

# Cadence d'interrogation. Mapillary traite et floute l'image avant de lui attribuer
# un identifiant : ça peut prendre de quelques minutes à plusieurs heures, d'où une
# attente longue mais espacée.
DELAI_ENTRE_TENTATIVES_S = 60
NOMBRE_TENTATIVES = 20


def charger_terrain(osm_id):
    """Renvoie (latitude, longitude, libellé) pour un osm_id de terrains.geojson."""
    with open(CHEMIN_TERRAINS, encoding="utf-8") as f:
        geo = json.load(f)

    for feature in geo["features"]:
        p = feature["properties"]
        if p["osm_id"] != osm_id:
            continue
        lon, lat = feature["geometry"]["coordinates"]
        libelle = p.get("nearest_street") or "Terrain"
        commune = p.get("commune") or ""
        return lat, lon, f"{libelle} ({commune})" if commune else libelle

    sys.exit(f"osm_id introuvable dans terrains.geojson : {osm_id}")


def en_fraction_exif(valeur):
    """
    Convertit un angle décimal en degrés/minutes/secondes au format attendu par EXIF,
    qui ne stocke que des fractions d'entiers. Les secondes sont gardées au
    millionième, ce qui vaut environ trois millimètres : très au-delà du nécessaire.
    """
    valeur = abs(valeur)
    degres = int(valeur)
    minutes = int((valeur - degres) * 60)
    secondes = (valeur - degres - minutes / 60) * 3600
    return ((degres, 1), (minutes, 1), (int(round(secondes * 1000000)), 1000000))


def lire_orientation(chemin):
    """
    Étiquette d'orientation d'origine, ou None.

    Une photo prise en portrait est presque toujours stockée à plat, accompagnée de
    cette étiquette qui dit au lecteur de quel quart de tour la redresser. L'effacer
    avec le reste des EXIF publie l'image couchée — c'est arrivé au premier test.
    Elle ne révèle ni l'appareil ni le lieu : rien ne s'oppose à la conserver.
    """
    import piexif

    try:
        exif = piexif.load(str(chemin))
    except Exception:
        return None

    return exif.get("0th", {}).get(piexif.ImageIFD.Orientation)


def ecrire_exif(chemin, lat, lon, date_prise, orientation=None):
    """
    Écrit les informations exigées par mapillary_tools : latitude, longitude et date
    de prise de vue, plus l'orientation si la photo en portait une. Tout le reste des
    EXIF est REMPLACÉ, pas complété : une photo de visiteur ne doit pas emporter le
    modèle de son appareil ni les coordonnées de l'endroit où elle a réellement été
    prise, qui peut être son salon.
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
            # La date GPS sert de secours si DateTimeOriginal venait à être ignorée.
            piexif.GPSIFD.GPSDateStamp: date_prise.strftime("%Y:%m:%d"),
        },
        "1st": {},
        "thumbnail": None,
    }

    piexif.insert(piexif.dump(exif), str(chemin))


def lire_date_prise(chemin):
    """Date de prise de vue d'origine si l'image en porte une, sinon None."""
    import piexif

    try:
        exif = piexif.load(str(chemin))
    except Exception:
        return None

    brut = exif.get("Exif", {}).get(piexif.ExifIFD.DateTimeOriginal)
    if not brut:
        return None

    try:
        return datetime.strptime(brut.decode("ascii"), "%Y:%m:%d %H:%M:%S")
    except (ValueError, UnicodeDecodeError):
        return None


def envoyer(dossier):
    """Lance mapillary_tools sur le dossier préparé. Renvoie True si l'envoi aboutit."""
    commande = ["mapillary_tools", "process_and_upload", str(dossier)]
    print(f"\n$ {' '.join(commande)}\n")

    try:
        resultat = subprocess.run(commande, check=False)
    except FileNotFoundError:
        sys.exit(
            "mapillary_tools introuvable.\n"
            "  pip install mapillary_tools\n"
            "puis, une seule fois :  mapillary_tools authenticate"
        )

    return resultat.returncode == 0


def chercher_image(lat, lon, apres, token):
    """
    Cherche autour du terrain les images postérieures à l'envoi. Renvoie la liste des
    candidates, la plus récente d'abord.

    L'API Graph ne permet pas de demander « les images que je viens d'envoyer » : on
    interroge donc une zone, et on trie sur la date. À l'échelle d'un terrain de
    pétanque, l'ambiguïté est faible, mais c'est justement ce que ce test vérifie.
    """
    # Un degré de latitude vaut environ 111 km ; la longitude se resserre vers les
    # pôles, mais à la latitude de la Belgique l'approximation suffit largement.
    delta_lat = RAYON_RECHERCHE_M / 111000
    delta_lon = RAYON_RECHERCHE_M / 70000

    bbox = f"{lon - delta_lon},{lat - delta_lat},{lon + delta_lon},{lat + delta_lat}"
    parametres = urllib.parse.urlencode({
        "access_token": token,
        "fields": "id,captured_at,creator,is_pano,thumb_1024_url",
        "bbox": bbox,
        "limit": 50,
    })

    requete = urllib.request.Request(
        "https://graph.mapillary.com/images?" + parametres,
        headers={"User-Agent": "Mapetanque/1.0"},
    )

    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            donnees = json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  API : HTTP {e.code} — {e.read()[:200].decode('utf-8', 'replace')}")
        return []
    except urllib.error.URLError as e:
        print(f"  API : réseau — {e.reason}")
        return []

    candidates = []
    for image in donnees.get("data", []):
        # captured_at est en millisecondes depuis 1970, en UTC.
        capture = image.get("captured_at")
        if capture is None:
            continue
        horodatage = datetime.fromtimestamp(capture / 1000, tz=timezone.utc)
        if horodatage >= apres:
            candidates.append((horodatage, image))

    candidates.sort(reverse=True, key=lambda c: c[0])
    return candidates


def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("photo", help="chemin de la photo à envoyer")
    analyseur.add_argument("osm_id", help="identifiant du terrain, ex. way/123456789")
    analyseur.add_argument("--simulation", action="store_true",
                           help="prépare la photo sans rien envoyer")
    analyseur.add_argument("--chercher-seulement", action="store_true",
                           help="saute l'envoi et cherche l'identifiant d'un envoi précédent")
    args = analyseur.parse_args()

    token = os.environ.get("MAPILLARY_TOKEN")
    if not token:
        sys.exit('MAPILLARY_TOKEN absent. PowerShell :  $env:MAPILLARY_TOKEN="MLY|..."')

    source = Path(args.photo)
    if not source.exists():
        sys.exit(f"photo introuvable : {source}")

    lat, lon, libelle = charger_terrain(args.osm_id)
    print(f"Terrain  : {libelle}")
    print(f"Position : {lat:.6f}, {lon:.6f}")

    # La date de prise de vue d'origine est réutilisée si l'image en porte une, sinon
    # c'est la date du jour. C'est exactement ce que fera le workflow avec le champ
    # date_prise relevé par le navigateur au moment de l'envoi.
    date_prise = lire_date_prise(source)
    if date_prise:
        print(f"Date     : {date_prise} (lue dans les EXIF d'origine)")
    else:
        date_prise = datetime.now()
        print(f"Date     : {date_prise:%Y-%m-%d %H:%M:%S} (aucune dans les EXIF, date du jour)")

    # Instant de référence pour la recherche : quelques minutes avant l'envoi, pour
    # absorber un décalage d'horloge sans ramener des images d'il y a une semaine.
    #
    # Attention : Mapillary indexe les images sur leur date de PRISE DE VUE, pas sur
    # celle de l'envoi. Une photo de visiteur datée d'il y a un mois sera donc
    # cherchée à partir de cette date-là, d'où ce minimum entre les deux.
    reference = min(
        date_prise.replace(tzinfo=timezone.utc),
        datetime.now(timezone.utc),
    ) - timedelta(minutes=10)

    if not args.chercher_seulement:
        dossier = Path(tempfile.mkdtemp(prefix="mapetanque_envoi_"))
        copie = dossier / source.name
        shutil.copy2(source, copie)

        orientation = lire_orientation(source)
        ecrire_exif(copie, lat, lon, date_prise, orientation)
        if orientation not in (None, 1):
            print(f"Orientation conservée : {orientation} (photo à redresser au lecteur)")
        print(f"\nCopie préparée : {copie}")

        if args.simulation:
            print("\nSimulation : rien n'a été envoyé. Ouvre la copie pour vérifier ses EXIF.")
            return

        if not envoyer(dossier):
            sys.exit("\nL'envoi a échoué. Le dossier préparé reste disponible : " + str(dossier))

        print("\nEnvoi accepté par Mapillary. Reste à savoir quand l'identifiant apparaît.")

    print(f"\nRecherche des images postérieures à {reference:%Y-%m-%d %H:%M} UTC, "
          f"dans un rayon de {RAYON_RECHERCHE_M} m.")
    print("Ctrl+C pour arrêter ; --chercher-seulement permet de reprendre plus tard.\n")

    debut = time.time()
    for tentative in range(1, NOMBRE_TENTATIVES + 1):
        candidates = chercher_image(lat, lon, reference, token)
        minutes = (time.time() - debut) / 60

        if candidates:
            print(f"\n{len(candidates)} image(s) trouvée(s) après {minutes:.0f} minutes :\n")
            for horodatage, image in candidates:
                print(f"  id        {image['id']}")
                print(f"  prise le  {horodatage:%Y-%m-%d %H:%M:%S} UTC")
                print(f"  auteur    {image.get('creator', {})}")
                print(f"  360°      {image.get('is_pano')}")
                print(f"  aperçu    {image.get('thumb_1024_url', '')[:110]}")
                print()
            print("Vérifie que l'aperçu correspond bien à la photo envoyée.")
            return

        print(f"  tentative {tentative}/{NOMBRE_TENTATIVES} — rien pour l'instant "
              f"({minutes:.0f} min écoulées)")
        time.sleep(DELAI_ENTRE_TENTATIVES_S)

    print("\nToujours rien après "
          f"{NOMBRE_TENTATIVES * DELAI_ENTRE_TENTATIVES_S // 60} minutes. "
          "Ce n'est pas forcément un échec : relance plus tard avec --chercher-seulement.")


if __name__ == "__main__":
    main()