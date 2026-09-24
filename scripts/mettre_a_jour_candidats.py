"""
Met à jour data/candidats_photos.json, la liste des terrains et de leur photo
candidate que lit la page admin. Lancé chaque semaine par update-osm.yml, juste
après scripts/update_terrains.py.

Ce fichier avait été extrait une seule fois de l'ancien revue_photos.html : un
terrain ajouté à OpenStreetMap depuis n'apparaissait jamais dans la page admin,
et un terrain supprimé y restait. Ce script le tient à jour en trois temps :

  1. Terrains : la liste suit data/terrains.geojson. Un nouveau terrain reçoit
     son candidat, un terrain disparu d'OSM est retiré (les décisions déjà
     prises à son sujet restent dans la base, rien n'est perdu), et le nom, la
     commune et la position des autres suivent les corrections faites sur OSM.
  2. Candidats des nouveaux terrains : même recherche et même notation que
     l'ancien scripts/generer_revue_photos.py, pour que les nouveaux candidats
     soient comparables aux anciens.
  3. Vignettes : les liens d'images renvoyés par Mapillary sont temporaires
     (environ deux semaines). Ceux qui expirent bientôt sont renouvelés, sinon
     les images de la page admin finissent par ne plus s'afficher.

Usage (depuis la racine du dépôt) :
    $env:MAPILLARY_TOKEN="MLY|..."        (PowerShell)
    python scripts/mettre_a_jour_candidats.py
"""

import json
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

RACINE = Path(__file__).resolve().parent.parent
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"
CHEMIN_CANDIDATS = RACINE / "data" / "candidats_photos.json"

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")

# ----- Recherche et notation : IDENTIQUES à generer_revue_photos.py -----
RAYON_METRES = 50
LIMITE_PAR_TERRAIN = 100
POIDS_DISTANCE = 0.4
POIDS_ANGLE = 0.4
POIDS_RECENCE = 0.2

DELAI_ENTRE_REQUETES = 0.3   # secondes, pour rester raisonnable vis-à-vis de l'API

# Au-delà de ce nombre d'échecs consécutifs, quelque chose de systémique se passe
# (quota atteint, jeton invalide, coupure) : inutile de continuer.
MAX_ECHECS_CONSECUTIFS = 5

# Une vignette est renouvelée si son lien expire dans moins de ce délai. Le
# script tournant chaque semaine, huit jours laissent une marge d'un jour.
MARGE_EXPIRATION = timedelta(days=8)


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

def appel_api(url, parametres):
    reponse = requests.get(url, params=parametres, timeout=15,
                           headers={"User-Agent": "Mapetanque/1.0"})
    # Le corps de la réponse porte la vraie cause de l'erreur : on le garde.
    if not reponse.ok:
        raise RuntimeError(f"HTTP {reponse.status_code} — {reponse.text[:300]}")
    return reponse.json()


def images_a_proximite(lat, lon):
    return appel_api("https://graph.mapillary.com/images", {
        "access_token": MAPILLARY_TOKEN,
        "fields": "id,is_pano,captured_at,compass_angle,geometry,thumb_1024_url",
        "lat": lat,
        "lng": lon,
        "radius": RAYON_METRES,
        "limit": LIMITE_PAR_TERRAIN,
    }).get("data", [])


def meilleur_candidat(terrain_lat, terrain_lon, images):
    """Reprise exacte de generer_revue_photos.py : le score le plus BAS gagne."""
    candidats_notes = []
    for img in images:
        if img.get("is_pano"):
            continue

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

        candidats_notes.append({
            "id": img["id"],
            "score": round(score, 3),
            "distance_m": round(dist, 1),
            "ecart_angle_deg": round(ecart_angle, 1),
            "captured_at": capture_ms,
            "thumbnail": img.get("thumb_1024_url"),
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


# ===================== Principal =====================

def description_terrain(feature):
    """Les champs de l'entrée, tels que les écrivait generer_revue_photos.py."""
    lon, lat = feature["geometry"]["coordinates"]
    proprietes = feature["properties"]
    return {
        "osm_id": proprietes["osm_id"],
        "nom": proprietes.get("nearest_street") or f"Terrain ({lat:.5f}, {lon:.5f})",
        "commune": proprietes.get("commune") or "Commune inconnue",
        "lat": lat,
        "lon": lon,
    }


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

    if not features:
        sys.exit("terrains.geojson ne contient aucun terrain : rien n'est modifié.")

    # ---- 1 et 2. Terrains, et candidats des nouveaux ----
    entrees = {}
    trouves_ce_passage = set()   # vignettes toutes fraîches : inutile de les renouveler
    nouveaux = echecs = echecs_consecutifs = 0
    arret = False

    for feature in features:
        entree = description_terrain(feature)
        osm_id = entree["osm_id"]

        if osm_id in existants:
            entree["candidat"] = existants[osm_id].get("candidat")
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
        trouves_ce_passage.add(osm_id)
        nouveaux += 1
        etat = "candidat trouvé" if entree["candidat"] else "aucune photo à proximité"
        print(f"  nouveau : {osm_id} — {entree['nom']} ({entree['commune']}) : {etat}")
        time.sleep(DELAI_ENTRE_REQUETES)

    retires = [osm_id for osm_id in existants if osm_id not in entrees]

    # ---- 3. Vignettes ----
    limite = datetime.now(timezone.utc) + MARGE_EXPIRATION
    renouvelees = disparues = 0
    for osm_id, entree in entrees.items():
        candidat = entree.get("candidat")
        if not candidat or osm_id in trouves_ce_passage:
            continue
        expiration = expiration_vignette(candidat.get("thumbnail"))
        if expiration and expiration > limite:
            continue
        try:
            donnees = appel_api(f"https://graph.mapillary.com/{candidat['id']}", {
                "access_token": MAPILLARY_TOKEN,
                "fields": "thumb_1024_url",
            })
            candidat["thumbnail"] = donnees.get("thumb_1024_url")
            renouvelees += 1
        except RuntimeError as e:
            # Image retirée de Mapillary (ou devenue privée) : la vignette ne
            # reviendra pas. Le candidat reste visible, sans image.
            if "HTTP 4" in str(e):
                candidat["thumbnail"] = None
                disparues += 1
            else:
                print(f"  vignette {candidat['id']} : {e}")
        except Exception as e:
            print(f"  vignette {candidat['id']} : {e}")
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
    print(f"{renouvelees} vignette(s) renouvelée(s), {disparues} image(s) disparue(s) de Mapillary.")
    if echecs:
        print(f"{echecs} recherche(s) en échec, retentée(s) la semaine prochaine.")


if __name__ == "__main__":
    main()
