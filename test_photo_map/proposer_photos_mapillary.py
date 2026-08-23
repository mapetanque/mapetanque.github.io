#!/usr/bin/env python3
"""
Pour chaque terrain d'une commune donnée, propose UN SEUL candidat photo Mapillary plutôt que la
liste complète — sélectionné automatiquement parmi les photos plates (non-360°) à proximité, sur
base de 3 critères simples et transparents (pas de boîte noire) :

1. Distance au terrain (plus proche = mieux)
2. Angle de la caméra par rapport à la direction du terrain (une photo qui "regarde vers" le
   terrain vaut mieux qu'une qui regarde ailleurs, même si elle est plus proche)
3. Récence (une photo récente est préférée à une ancienne, à qualité égale sur les 2 critères
   précédents)

Limite connue : c'est une heuristique basée sur les métadonnées (position + angle de la caméra),
pas une analyse du contenu réel de la photo. Le terrain peut être masqué par un arbre, une
clôture, ou l'angle peut être trompeur si les métadonnées sont imprécises. Le candidat proposé
reste donc à valider visuellement un par un — l'objectif ici est de réduire "20-50 photos à
trier par terrain" à "1 photo à valider par terrain".

Usage :
    pip install requests
    python3 proposer_photos_mapillary.py
"""

import json
import math
from datetime import datetime, timezone

import requests

# ===================== Configuration =====================

MAPILLARY_TOKEN = "MLY|28430029179916530|430abb722289aec39e460c5f2753d6d0"
COMMUNE_CIBLE = "Antwerpen"
RAYON_METRES = 50
LIMITE_PAR_TERRAIN = 100

# Poids du score composite (modifiables : plus un poids est élevé, plus ce critère pèse dans le
# choix du candidat). Les 3 doivent rester entre 0 et 1 et sommer à peu près à 1, mais ce n'est
# pas une obligation stricte, juste plus lisible.
POIDS_DISTANCE = 0.4
POIDS_ANGLE = 0.4
POIDS_RECENCE = 0.2

# ===================== Fonctions géométriques =====================

def distance_metres(lat1, lon1, lat2, lon2):
    """Distance approximative entre 2 points (formule haversine)."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def cap_vers(lat1, lon1, lat2, lon2):
    """Cap (0-360°, 0=Nord) du point 1 vers le point 2."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def difference_angulaire(a, b):
    """Écart entre 2 caps (0-180°, sans notion de sens)."""
    d = abs(a - b) % 360
    return min(d, 360 - d)


# ===================== Mapillary =====================

def images_a_proximite(lat, lon):
    reponse = requests.get(
        "https://graph.mapillary.com/images",
        params={
            "access_token": MAPILLARY_TOKEN,
            "fields": "id,is_pano,captured_at,compass_angle,geometry,thumb_1024_url",
            "lat": lat,
            "lng": lon,
            "radius": RAYON_METRES,
            "limit": LIMITE_PAR_TERRAIN,
        },
        timeout=15,
    )
    reponse.raise_for_status()
    return reponse.json().get("data", [])


def meilleur_candidat(terrain_lat, terrain_lon, images):
    """Retourne le meilleur candidat (dict) parmi une liste d'images, ou None si aucune."""
    candidats_notes = []

    for img in images:
        if img.get("is_pano"):
            continue

        img_lon, img_lat = img["geometry"]["coordinates"]
        dist = distance_metres(terrain_lat, terrain_lon, img_lat, img_lon)

        cap_cible = cap_vers(img_lat, img_lon, terrain_lat, terrain_lon)
        angle_cam = img.get("compass_angle")
        ecart_angle = difference_angulaire(angle_cam, cap_cible) if angle_cam is not None else 180

        # Normalisation 0-1 (0 = idéal) pour chaque critère
        score_distance = min(dist / RAYON_METRES, 1)
        score_angle = ecart_angle / 180

        capture_ms = img.get("captured_at")
        if capture_ms:
            date_capture = datetime.fromtimestamp(capture_ms / 1000, tz=timezone.utc)
            age_annees = (datetime.now(timezone.utc) - date_capture).days / 365
            score_recence = min(max(age_annees / 5, 0), 1)  # 5 ans ou plus = score max (le pire)
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


# ===================== Script principal =====================

def main():
    print("Récupération des terrains depuis mapetanque.be...")
    reponse = requests.get("https://mapetanque.be/data/terrains.geojson", timeout=30)
    reponse.raise_for_status()
    geojson = reponse.json()

    terrains_commune = [
        f for f in geojson["features"]
        if f["properties"].get("commune") == COMMUNE_CIBLE
    ]

    print(f"{len(terrains_commune)} terrain(s) trouvé(s) pour '{COMMUNE_CIBLE}'.\n")

    resultats = []
    for feature in terrains_commune:
        lon, lat = feature["geometry"]["coordinates"]
        nom = feature["properties"].get("nearest_street") or f"Terrain ({lat:.5f}, {lon:.5f})"

        try:
            images = images_a_proximite(lat, lon)
            candidat = meilleur_candidat(lat, lon, images)
        except Exception as e:
            print(f"  {nom} → erreur : {e}")
            resultats.append({"nom": nom, "lat": lat, "lon": lon, "candidat": None})
            continue

        if candidat:
            print(f"  {nom} → candidat trouvé (score {candidat['score']}, "
                  f"{candidat['distance_m']} m, écart angle {candidat['ecart_angle_deg']}°)")
            print(f"      {candidat['lien']}")
        else:
            print(f"  {nom} → aucune photo plate à proximité")

        resultats.append({"nom": nom, "lat": lat, "lon": lon, "candidat": candidat})

    fichier_sortie = f"mapillary_candidats_{COMMUNE_CIBLE.lower()}.json"
    with open(fichier_sortie, "w", encoding="utf-8") as f:
        json.dump(resultats, f, ensure_ascii=False, indent=2)

    print(f"\nRésultat écrit dans {fichier_sortie}")
    avec_candidat = sum(1 for r in resultats if r["candidat"])
    print(f"{avec_candidat}/{len(resultats)} terrain(s) avec un candidat proposé.")


if __name__ == "__main__":
    main()