"""
Publication des photos de visiteurs validées dans la page admin : envoi à
Mapillary, rattachement de leur identifiant, reconstruction de
data/photos_mapillary.json.

Lancé par .github/workflows/publier-photos.yml, chaque jour et à la demande
(bouton « Publier maintenant » de la page admin). Remplace
scripts/tester_envoi_mapillary.py, dont il reprend la préparation des EXIF.

Trois phases, dans cet ordre. Une phase qui échoue n'empêche pas les suivantes :

  1. Rattachement. Pour les photos envoyées lors d'un passage précédent, cherche
     leur identifiant : une image de notre compte, à moins de RAYON_RECHERCHE_M
     du terrain, datée à MARGE_DATE près, pas encore utilisée ailleurs. Mapillary
     ne rend l'identifiant qu'après traitement complet (en général un à deux
     jours, parfois plus) : une photo pas encore trouvée sera recherchée au
     passage suivant, sans limite de temps. Une fois rattachée, son fichier est
     effacé de R2 par le Worker.
  2. Envoi. Chaque photo validée est préparée (coordonnées du terrain, date,
     orientation, rien d'autre) puis envoyée SEULE par mapillary_tools : deux
     photos d'un même terrain portent les mêmes coordonnées, et envoyées
     ensemble, mapillary_tools écarterait la seconde comme doublon.
  3. Miniatures 360°. Chaque vue 360° à générer (nouvelle, ou recadrée dans la
     page admin) est recadrée par scripts/miniature_360.py et rangée dans
     images/mapillary-360/. Une vue déjà en ligne avec l'ancien circuit, jamais
     recadrée depuis, est seulement marquée comme faite.
  4. Export. Le Worker fusionne toutes les décisions (revue des candidats,
     photos manuelles, photos de visiteurs rattachées, vues 360° générées) sur
     le data/photos_mapillary.json du dépôt, qui est réécrit.

Variables d'environnement :
    JETON_WORKFLOW     clé partagée avec le Worker mapetanque-admin
    MAPILLARY_TOKEN    jeton client MLY|... (recherche dans l'API Graph)
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

JETON_WORKFLOW = None


# ---------------------------------------------------------------- Worker

def appel_worker(methode, chemin, corps=None, brut=False):
    """Appelle une route /workflow/ du Worker. Lève HTTPError si refusée."""
    donnees = None
    entetes = {
        "Authorization": "Bearer " + JETON_WORKFLOW,
        "User-Agent": "Mapetanque-publication/1.0",
    }
    if corps is not None:
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


def retirer_anciennes_miniatures(mapillary_id, nom_garde):
    """Supprime les miniatures précédentes de la même vue (avant un recadrage)."""
    for fichier in DOSSIER_360.glob(f"{mapillary_id}*.webp"):
        meme_vue = fichier.name == f"{mapillary_id}.webp" or fichier.name.startswith(f"{mapillary_id}-")
        if meme_vue and fichier.name != nom_garde:
            fichier.unlink()
            print(f"  ancienne miniature supprimée : {fichier.name}")


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

        retirer_anciennes_miniatures(mapillary_id, chemin.name)
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

    # Garde-fou : le Worker ne fait qu'ajouter. Un résultat qui aurait perdu un
    # terrain ou une photo trahit un problème : on n'écrit rien.
    for osm_id, liste in socle.items():
        if len(fusion.get(osm_id, [])) < len(liste):
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
        ("Envoi", lambda: phase_envoi(terrains, args.simulation)),
        ("Miniatures 360°", lambda: phase_panos(token, args.simulation)),
        ("Export", lambda: phase_export(args.simulation)),
    ]

    echecs = []
    for nom, phase in phases:
        print(f"\n=== {nom} ===")
        try:
            phase()
        except Exception as e:
            print(f"Échec de la phase {nom} : {detail_erreur(e)}")
            echecs.append(nom)

    # Un échec rend le lancement rouge dans l'onglet Actions : GitHub prévient
    # alors par mail. Le fichier déjà écrit est tout de même sauvegardé.
    if echecs:
        sys.exit("Phase(s) en échec : " + ", ".join(echecs))


if __name__ == "__main__":
    main()
