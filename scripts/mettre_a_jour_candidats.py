"""
Met à jour data/candidats_photos.json, la liste des terrains et de leurs photos
que lit la page admin. Lancé chaque semaine par update-osm.yml, juste après
scripts/update_terrains.py.

Ce fichier avait été extrait une seule fois de l'ancien revue_photos.html : un
terrain ajouté à OpenStreetMap depuis n'apparaissait jamais dans la page admin,
et un terrain supprimé y restait. Ce script le tient à jour en cinq temps :

  1. Terrains : la liste suit data/terrains.geojson. Un nouveau terrain reçoit
     son candidat, un terrain disparu d'OSM est retiré (les décisions déjà
     prises à son sujet restent dans la base, rien n'est perdu), et le nom, la
     commune et la position des autres suivent les corrections faites sur OSM.
     La photo venant d'un tag OSM (image=, wikimedia_commons=, mapillary=) est
     reprise dans photo_osm : la page admin compte ces terrains parmi ceux qui
     ont une photo.
  2. Candidats des nouveaux terrains : même recherche et même notation que
     l'ancien scripts/generer_revue_photos.py, pour que les nouveaux candidats
     soient comparables aux anciens.
  3. Aperçu : pour un terrain dont la première photo en ligne est une photo
     plate, son adresse de vignette (apercu). La page admin l'affiche à la
     place du candidat. Une vue 360° n'en a pas besoin : sa miniature est un
     fichier du dépôt.
  4. Veille des terrains « rien trouvé » : pour chacun, les images Mapillary
     proches et bien placées qu'on n'a pas encore vues deviennent des
     « pistes », proposées dans la page admin. La liste de ces terrains vient
     du Worker mapetanque-admin (les décisions vivent dans D1). Voir
     veiller_terrain() pour le détail.
  5. Vignettes : les liens d'images renvoyés par Mapillary sont temporaires
     (environ deux semaines). Ceux qui expirent bientôt sont renouvelés
     (candidats, aperçus, pistes), sinon les images de la page admin finissent
     par ne plus s'afficher.

Usage (depuis la racine du dépôt) :
    $env:MAPILLARY_TOKEN="MLY|..."        (PowerShell)
    $env:JETON_WORKFLOW="..."             (facultatif : sans lui, pas de veille)
    python scripts/mettre_a_jour_candidats.py
"""

import json
import math
import os
import sys
import time
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

RACINE = Path(__file__).resolve().parent.parent
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"
CHEMIN_CANDIDATS = RACINE / "data" / "candidats_photos.json"
CHEMIN_PHOTOS = RACINE / "data" / "photos_mapillary.json"

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")
JETON_WORKFLOW = os.environ.get("JETON_WORKFLOW")
URL_WORKER = os.environ.get(
    "MAPETANQUE_ADMIN_URL", "https://mapetanque-admin.mapetanque.workers.dev"
)

# ----- Recherche et notation : IDENTIQUES à generer_revue_photos.py -----
RAYON_METRES = 50
LIMITE_PAR_TERRAIN = 100
POIDS_DISTANCE = 0.4
POIDS_ANGLE = 0.4
POIDS_RECENCE = 0.2

# ----- Veille des terrains « rien trouvé » -----
# Plus stricte que la recherche des candidats : seules les images vraiment
# proches, et pour une photo plate vraiment tournée vers le terrain, sont
# proposées. Une vue 360° n'a pas d'orientation qui compte : on la cadre dans
# la page admin.
VEILLE_RAYON_M = 30
VEILLE_LIMITE = 200
VEILLE_PLATE_DISTANCE_MAX = 30
VEILLE_PLATE_ANGLE_MAX = 45
VEILLE_PANO_DISTANCE_MAX = 25
# Pistes affichées à la fois, par terrain. Les suivantes attendent : elles
# seront proposées quand celles-ci auront été ajoutées ou écartées.
VEILLE_MAX_PLATES = 3
VEILLE_MAX_PANOS = 2

DELAI_ENTRE_REQUETES = 0.3   # secondes, pour rester raisonnable vis-à-vis de l'API

# Au-delà de ce nombre d'échecs consécutifs, quelque chose de systémique se passe
# (quota atteint, jeton invalide, coupure) : inutile de continuer.
MAX_ECHECS_CONSECUTIFS = 5

# Une vignette est renouvelée si son lien expire dans moins de ce délai. Le
# script tournant chaque semaine, huit jours laissent une marge d'un jour.
MARGE_EXPIRATION = timedelta(days=8)

# Format des dates de D1 (colonne maj de revue_terrains), en UTC. Les dates
# écrites ici suivent le même format : elles se comparent comme des chaînes.
FORMAT_DATE = "%Y-%m-%d %H:%M:%S"


# ===================== Géométrie (reprise telle quelle) =====================

def distance_metres(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def cap_vers(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def difference_angulaire(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


# ===================== Mapillary =====================

class ErreurApi(RuntimeError):
    """Refus de l'API Mapillary, avec le corps de la réponse, qui en donne la vraie cause."""

    def __init__(self, code, corps):
        super().__init__(f"HTTP {code} — {corps[:300]}")
        self.corps = corps

    def image_disparue(self):
        # Seul ce message-là signifie que l'image n'existe plus (supprimée ou devenue
        # privée). Un 400 peut aussi venir d'un jeton refusé ou d'une requête mal formée :
        # le confondre avec une image supprimée a effacé 905 vignettes d'un coup.
        return "does not exist" in self.corps


def appel_api(url, parametres):
    reponse = requests.get(url, params=parametres, timeout=15,
                           headers={"User-Agent": "Mapetanque/1.0"})
    if not reponse.ok:
        raise ErreurApi(reponse.status_code, reponse.text)
    return reponse.json()


def images_a_proximite(lat, lon, rayon=RAYON_METRES, limite=LIMITE_PAR_TERRAIN):
    return appel_api("https://graph.mapillary.com/images", {
        "access_token": MAPILLARY_TOKEN,
        "fields": "id,is_pano,captured_at,compass_angle,geometry,thumb_1024_url",
        "lat": lat,
        "lng": lon,
        "radius": rayon,
        "limit": limite,
    }).get("data", [])


def noter(terrain_lat, terrain_lon, img):
    """Distance, écart d'angle et score d'une image. Le score le plus BAS est le meilleur."""
    img_lon, img_lat = img["geometry"]["coordinates"]
    dist = distance_metres(terrain_lat, terrain_lon, img_lat, img_lon)
    cap_cible = cap_vers(img_lat, img_lon, terrain_lat, terrain_lon)

    angle_cam = img.get("compass_angle")
    ecart_angle = difference_angulaire(angle_cam, cap_cible) if angle_cam is not None else 180

    score_distance = min(dist / RAYON_METRES, 1)
    score_angle = ecart_angle / 180

    capture_ms = img.get("captured_at")
    if capture_ms:
        date_capture = datetime.fromtimestamp(capture_ms / 1000, tz=timezone.utc)
        age_annees = (datetime.now(timezone.utc) - date_capture).days / 365
        score_recence = min(max(age_annees / 5, 0), 1)
    else:
        score_recence = 1

    score = (
        POIDS_DISTANCE * score_distance
        + POIDS_ANGLE * score_angle
        + POIDS_RECENCE * score_recence
    )
    return {
        "id": str(img["id"]),
        "score": round(score, 3),
        "distance_m": round(dist, 1),
        "ecart_angle_deg": round(ecart_angle, 1),
        "angle_connu": angle_cam is not None,
        "captured_at": capture_ms,
        "thumbnail": img.get("thumb_1024_url"),
    }


def meilleur_candidat(terrain_lat, terrain_lon, images):
    """Reprise exacte de generer_revue_photos.py : le score le plus BAS gagne."""
    candidats_notes = []
    for img in images:
        if img.get("is_pano"):
            continue
        note = noter(terrain_lat, terrain_lon, img)
        candidats_notes.append({
            "id": img["id"],
            "score": note["score"],
            "distance_m": note["distance_m"],
            "ecart_angle_deg": note["ecart_angle_deg"],
            "captured_at": note["captured_at"],
            "thumbnail": note["thumbnail"],
            "lien": f"https://www.mapillary.com/map/im/{img['id']}",
        })

    if not candidats_notes:
        return None
    return min(candidats_notes, key=lambda c: c["score"])


def expiration_vignette(url):
    """
    Date d'expiration d'un lien de vignette, lue dans son paramètre oe= (un
    horodatage en hexadécimal). None si le lien n'en porte pas : on le
    renouvelle alors par prudence.
    """
    if not url:
        return None
    trouve = re.search(r"[?&]oe=([0-9A-Fa-f]+)", url)
    if not trouve:
        return None
    return datetime.fromtimestamp(int(trouve.group(1), 16), tz=timezone.utc)


# ===================== Worker (liste des terrains « rien trouvé ») =====================

def terrains_rien_trouve():
    """
    { osm_id: date de la dernière décision (ou None) } pour les terrains marqués
    « rien trouvé » ou candidat rejeté, sans aucune photo dans la base. None si le
    Worker n'a pas pu répondre : la veille est alors sautée pour cette fois.
    """
    if not JETON_WORKFLOW:
        print("JETON_WORKFLOW absent : pas de veille des terrains « rien trouvé » cette fois.")
        return None
    try:
        reponse = requests.get(URL_WORKER + "/workflow/rien-trouve", timeout=30,
                               headers={"Authorization": "Bearer " + JETON_WORKFLOW,
                                        "User-Agent": "Mapetanque/1.0"})
        reponse.raise_for_status()
        return {ligne["osm_id"]: ligne.get("maj") for ligne in reponse.json()}
    except Exception as e:
        print(f"Worker injoignable, veille sautée cette fois : {e}")
        return None


# ===================== Veille =====================

def images_bien_placees(entree, images):
    """Images qui passent les seuils de la veille, au format d'une piste (sans trouvee_le)."""
    retenues = []
    for img in images:
        note = noter(entree["lat"], entree["lon"], img)
        if img.get("is_pano"):
            if note["distance_m"] > VEILLE_PANO_DISTANCE_MAX:
                continue
            retenues.append({
                "id": note["id"],
                "type": "360",
                "distance_m": note["distance_m"],
                "captured_at": note["captured_at"],
                "thumbnail": note["thumbnail"],
                "lien": f"https://www.mapillary.com/app/?pKey={note['id']}&focus=photo",
            })
        else:
            if (not note["angle_connu"]
                    or note["distance_m"] > VEILLE_PLATE_DISTANCE_MAX
                    or note["ecart_angle_deg"] > VEILLE_PLATE_ANGLE_MAX):
                continue
            retenues.append({
                "id": note["id"],
                "type": "plate",
                "score": note["score"],
                "distance_m": note["distance_m"],
                "ecart_angle_deg": note["ecart_angle_deg"],
                "captured_at": note["captured_at"],
                "thumbnail": note["thumbnail"],
                "lien": f"https://www.mapillary.com/map/im/{note['id']}",
            })
    return retenues


def veiller_terrain(entree, maj, images, maintenant):
    """
    Met à jour entree["veille"] = { "vues": [...], "pistes": [...] }.

    vues : les images bien placées déjà connues, qu'on ne proposera plus. Suivre
    les identifiants plutôt qu'une date de prise de vue : une photo prise il y a
    un an mais envoyée sur Mapillary la semaine dernière est bien une nouveauté.

    pistes : les images proposées dans la page admin, avec la date où on les a
    trouvées (trouvee_le). Écarter les pistes dans la page admin réenregistre le
    statut du terrain, ce qui met à jour maj : toute piste trouvée avant maj
    passe alors dans vues.

    Premier passage sur un terrain (pas encore de vues) : seules les images
    prises APRÈS la décision (maj) sont proposées, les autres sont celles que tu
    avais sous les yeux en décidant. Sans date de décision, rien n'est proposé
    ce jour-là : tout ce qui existe devient la référence.
    """
    veille = entree.get("veille") or {}
    premier_passage = "vues" not in veille
    vues = set(veille.get("vues", []))
    pistes = veille.get("pistes", [])

    if maj:
        encore = []
        for piste in pistes:
            if piste["trouvee_le"] <= maj:
                vues.add(piste["id"])
            else:
                encore.append(piste)
        pistes = encore

    deja = vues | {p["id"] for p in pistes}
    nouvelles = []
    limite_ms = None
    if premier_passage and maj:
        limite_ms = datetime.strptime(maj, FORMAT_DATE).replace(tzinfo=timezone.utc).timestamp() * 1000

    for image in images_bien_placees(entree, images):
        if image["id"] in deja:
            continue
        if premier_passage and not (limite_ms and image["captured_at"] and image["captured_at"] > limite_ms):
            vues.add(image["id"])
            continue
        image["trouvee_le"] = maintenant
        nouvelles.append(image)

    # Les meilleures d'abord, dans la limite des places libres. Celles qui ne
    # rentrent pas ne sont PAS marquées vues : elles reviendront plus tard.
    for type_image, maximum, cle_tri in (
        ("plate", VEILLE_MAX_PLATES, lambda p: p["score"]),
        ("360", VEILLE_MAX_PANOS, lambda p: p["distance_m"]),
    ):
        places = maximum - sum(1 for p in pistes if p["type"] == type_image)
        candidates = sorted((p for p in nouvelles if p["type"] == type_image), key=cle_tri)
        pistes.extend(candidates[:max(places, 0)])

    ajoutees = sum(1 for p in pistes if p.get("trouvee_le") == maintenant)
    entree["veille"] = {"vues": sorted(vues), "pistes": pistes}
    return ajoutees


# ===================== Principal =====================

def description_terrain(feature):
    """Les champs de l'entrée, tels que les écrivait generer_revue_photos.py."""
    lon, lat = feature["geometry"]["coordinates"]
    proprietes = feature["properties"]
    entree = {
        "osm_id": proprietes["osm_id"],
        "nom": proprietes.get("nearest_street") or f"Terrain ({lat:.5f}, {lon:.5f})",
        "commune": proprietes.get("commune") or "Commune inconnue",
        "lat": lat,
        "lon": lon,
    }
    if proprietes.get("photo_url"):
        entree["photo_osm"] = proprietes["photo_url"]
    return entree


def main():
    if not MAPILLARY_TOKEN:
        sys.exit('MAPILLARY_TOKEN absent. PowerShell :  $env:MAPILLARY_TOKEN="MLY|..."')

    with open(CHEMIN_TERRAINS, encoding="utf-8") as f:
        features = [
            feat for feat in json.load(f)["features"]
            if feat["properties"].get("osm_id")
        ]
    with open(CHEMIN_CANDIDATS, encoding="utf-8") as f:
        existants = {
            t["osm_id"]: t
            for groupe in json.load(f)
            for t in groupe["terrains"]
        }
    try:
        with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
            photos_en_ligne = json.load(f)
    except (OSError, ValueError) as e:
        # Sans ce fichier, pas d'aperçu ni de veille fiable : on garde ce qui existe.
        print(f"photos_mapillary.json illisible ({e}) : aperçus et veille laissés tels quels.")
        photos_en_ligne = None

    if not features:
        sys.exit("terrains.geojson ne contient aucun terrain : rien n'est modifié.")

    maintenant = datetime.now(timezone.utc).strftime(FORMAT_DATE)

    # ---- 1 et 2. Terrains, et candidats des nouveaux ----
    entrees = {}
    nouveaux = echecs = echecs_consecutifs = 0
    arret = False

    for feature in features:
        entree = description_terrain(feature)
        osm_id = entree["osm_id"]

        if osm_id in existants:
            ancien = existants[osm_id]
            entree["candidat"] = ancien.get("candidat")
            for cle in ("apercu", "veille"):
                if ancien.get(cle):
                    entree[cle] = ancien[cle]
            entrees[osm_id] = entree
            continue

        if arret:
            continue

        try:
            images = images_a_proximite(entree["lat"], entree["lon"])
            entree["candidat"] = meilleur_candidat(entree["lat"], entree["lon"], images)
        except Exception as e:
            # Un échec n'écrit RIEN : écrire candidat=None le rendrait indiscernable
            # d'un vrai « aucune photo à proximité », et le terrain ne serait plus
            # jamais réinterrogé. Absent, il sera retenté la semaine suivante.
            echecs += 1
            echecs_consecutifs += 1
            print(f"  {osm_id} : échec ({e})")
            if echecs_consecutifs >= MAX_ECHECS_CONSECUTIFS:
                print(f"{echecs_consecutifs} échecs consécutifs : arrêt des recherches pour cette fois.")
                arret = True
            time.sleep(DELAI_ENTRE_REQUETES)
            continue

        echecs_consecutifs = 0
        entrees[osm_id] = entree
        nouveaux += 1
        etat = "candidat trouvé" if entree["candidat"] else "aucune photo à proximité"
        print(f"  nouveau : {osm_id} — {entree['nom']} ({entree['commune']}) : {etat}")
        time.sleep(DELAI_ENTRE_REQUETES)

    retires = [osm_id for osm_id in existants if osm_id not in entrees]

    # ---- 3. Aperçus : première photo en ligne, si c'est une photo plate ----
    if photos_en_ligne is not None:
        for osm_id, entree in entrees.items():
            liste = photos_en_ligne.get(osm_id) or []
            premiere = liste[0] if liste else None
            if not premiere or premiere.get("miniature_locale"):
                entree.pop("apercu", None)
                continue
            identifiant = str(premiere.get("mapillary_id", ""))
            ancien = entree.get("apercu")
            if ancien and ancien.get("id") == identifiant:
                continue
            candidat = entree.get("candidat")
            if candidat and str(candidat.get("id")) == identifiant and candidat.get("thumbnail"):
                entree["apercu"] = {"id": identifiant, "thumbnail": candidat["thumbnail"]}
            else:
                # Vignette récupérée à l'étape 5, comme un lien expiré.
                entree["apercu"] = {"id": identifiant, "thumbnail": None}

    # ---- 4. Veille des terrains « rien trouvé » ----
    rien_trouve = terrains_rien_trouve() if photos_en_ligne is not None else None
    veilles = pistes_ajoutees = echecs_veille = 0
    if rien_trouve is not None and not arret:
        echecs_consecutifs = 0
        for osm_id, entree in entrees.items():
            a_une_photo = entree.get("photo_osm") or photos_en_ligne.get(osm_id)
            if osm_id not in rien_trouve or a_une_photo:
                # Plus concerné : les pistes n'ont plus lieu d'être. Les vues restent,
                # au cas où le terrain redeviendrait « rien trouvé ».
                if entree.get("veille"):
                    entree["veille"].pop("pistes", None)
                continue
            if echecs_consecutifs >= MAX_ECHECS_CONSECUTIFS:
                print(f"{echecs_consecutifs} échecs consécutifs : arrêt de la veille pour cette fois.")
                arret = True
                break
            try:
                images = images_a_proximite(entree["lat"], entree["lon"],
                                            rayon=VEILLE_RAYON_M, limite=VEILLE_LIMITE)
            except Exception as e:
                # Rien n'est modifié pour ce terrain : il sera revu la semaine prochaine.
                echecs_veille += 1
                echecs_consecutifs += 1
                print(f"  veille {osm_id} : échec ({e})")
                time.sleep(DELAI_ENTRE_REQUETES)
                continue
            echecs_consecutifs = 0
            veilles += 1
            ajout = veiller_terrain(entree, rien_trouve[osm_id], images, maintenant)
            if ajout:
                pistes_ajoutees += ajout
                print(f"  piste(s) : {osm_id} — {entree['nom']} ({entree['commune']}) : {ajout}")
            time.sleep(DELAI_ENTRE_REQUETES)

    # ---- 5. Vignettes (candidats, aperçus, pistes) ----
    a_renouveler = []
    for entree in entrees.values():
        if entree.get("candidat"):
            a_renouveler.append(entree["candidat"])
        if entree.get("apercu"):
            a_renouveler.append(entree["apercu"])
        for piste in (entree.get("veille") or {}).get("pistes", []):
            a_renouveler.append(piste)

    limite = datetime.now(timezone.utc) + MARGE_EXPIRATION
    renouvelees = disparues = echecs_vignettes = 0
    echecs_consecutifs = 0
    for objet in a_renouveler:
        if echecs_consecutifs >= MAX_ECHECS_CONSECUTIFS:
            print(f"{echecs_consecutifs} échecs consécutifs : arrêt du renouvellement des vignettes. "
                  "Les liens existants sont conservés tels quels.")
            arret = True
            break
        expiration = expiration_vignette(objet.get("thumbnail"))
        if expiration and expiration > limite:
            continue
        try:
            donnees = appel_api(f"https://graph.mapillary.com/{objet['id']}", {
                "access_token": MAPILLARY_TOKEN,
                "fields": "thumb_1024_url",
            })
            objet["thumbnail"] = donnees.get("thumb_1024_url")
            renouvelees += 1
            echecs_consecutifs = 0
        except ErreurApi as e:
            if e.image_disparue():
                # L'image n'existe plus : la vignette ne reviendra pas. L'entrée
                # reste visible, sans image. Ce n'est pas un échec de l'API.
                objet["thumbnail"] = None
                disparues += 1
                echecs_consecutifs = 0
            else:
                # Toute autre erreur : on garde le lien existant, même expiré.
                echecs_vignettes += 1
                echecs_consecutifs += 1
                print(f"  vignette {objet['id']} : {e}")
        except Exception as e:
            echecs_vignettes += 1
            echecs_consecutifs += 1
            print(f"  vignette {objet['id']} : {e}")
        time.sleep(DELAI_ENTRE_REQUETES)

    # ---- Écriture, dans le format attendu par la page admin ----
    # Groupes par commune, les plus fournies d'abord, comme avant.
    par_commune = {}
    for entree in entrees.values():
        par_commune.setdefault(entree["commune"], []).append(entree)
    groupes = [
        {"commune": commune, "terrains": sorted(terrains, key=lambda t: t["nom"])}
        for commune, terrains in sorted(par_commune.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]
    with open(CHEMIN_CANDIDATS, "w", encoding="utf-8") as f:
        json.dump(groupes, f, ensure_ascii=False, separators=(",", ":"))

    avec_candidat = sum(1 for e in entrees.values() if e.get("candidat"))
    print(f"\n{len(entrees)} terrain(s) dans la page admin, dont {avec_candidat} avec candidat.")
    print(f"{nouveaux} nouveau(x), {len(retires)} retiré(s) car disparu(s) d'OSM.")
    if rien_trouve is not None:
        print(f"Veille : {veilles} terrain(s) « rien trouvé » revu(s), {pistes_ajoutees} nouvelle(s) piste(s).")
    print(f"{renouvelees} vignette(s) renouvelée(s), {disparues} image(s) disparue(s) de Mapillary.")
    if echecs:
        print(f"{echecs} recherche(s) en échec, retentée(s) la semaine prochaine.")
    if echecs_veille:
        print(f"{echecs_veille} terrain(s) non revu(s) par la veille, retenté(s) la semaine prochaine.")
    if echecs_vignettes:
        print(f"{echecs_vignettes} vignette(s) non renouvelée(s) à cause d'une erreur, retentée(s) la semaine prochaine.")

    # Une série d'échecs trahit un problème d'ensemble (jeton refusé, quota) : l'étape
    # s'affiche alors en échec dans l'onglet Actions au lieu de passer inaperçue. Le
    # fichier a tout de même été écrit, sans rien perdre de ce qui existait.
    if arret:
        sys.exit("Arrêt sur échecs répétés : voir les messages d'erreur ci-dessus.")


if __name__ == "__main__":
    main()
