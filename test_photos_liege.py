#!/usr/bin/env python3
"""
Test de rattachement automatique de photos Mapillary aux terrains — commune de Liège.

Script AUTONOME, volontairement séparé de update_terrains.py tant que le résultat n'a pas été
validé visuellement. Ne modifie rien à data/terrains.geojson : produit un dossier de sortie
avec les photos traitées + un rapport JSON détaillant ce qui a été trouvé/choisi/ignoré pour
chaque terrain, à relire avant toute décision d'intégration dans le pipeline hebdomadaire.

Principe :
  1. Charge data/terrains.geojson, filtre sur la commune de Liège.
  2. Pour chaque terrain, interroge l'API Mapillary (recherche par zone) dans un rayon donné.
  3. Parmi les images trouvées, calcule pour chacune la distance et le cap (bearing) vers le
     terrain, puis choisit la "meilleure" selon la règle définie dans choisir_meilleure_image().
  4. Télécharge l'image choisie et, si c'est une 360° (équirectangulaire), en extrait un crop
     plat orienté pile vers le terrain (projection équirectangulaire -> perspective, sans
     dépendance externe, juste numpy/PIL).
  5. Sauvegarde l'image finale + une entrée de rapport par terrain.

Prérequis :
  - Un token d'API Mapillary gratuit (inscription sur https://www.mapillary.com/developer),
    à renseigner ci-dessous ou via la variable d'environnement MAPILLARY_TOKEN.
  - pip install requests pillow numpy

Usage :
    python3 test_photos_liege.py
"""

import json
import math
import os
import time
from pathlib import Path

import numpy as np
import requests
from PIL import Image

# ===================== Configuration =====================

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN", "MLY|28430029179916530|430abb722289aec39e460c5f2753d6d0")

TERRAINS_GEOJSON_PATH = Path("data/terrains.geojson")
OUTPUT_DIR = Path("test_photos_liege_output")

# Nom de commune tel qu'il apparaît dans terrains.geojson (properties.commune). Adapter si le
# format réel diffère (ex. "Liège" vs autre chose) — le script affiche les valeurs uniques
# rencontrées si aucun terrain ne matche, pour débugger facilement.
COMMUNE_FILTRE = "Oostende"

# Rayon de recherche autour de chaque terrain, en mètres. Mapillary plafonne à 50m sur son
# endpoint de recherche par rayon ; on reste sous ce plafond même avec l'approche bbox utilisée
# ici (par souci de cohérence, et parce qu'au-delà la photo a de toute façon peu de chances de
# bien montrer le terrain).
RAYON_RECHERCHE_M = 25

# Écart de cap (degrés) en-dessous duquel une photo plate est considérée "bien orientée". Seuil
# volontairement strict (premier essai à 35° -> trop de photos qui regardaient à côté du
# terrain plutôt que dessus).
ECART_CAP_ACCEPTABLE = 15

# Distance max (m) acceptée pour une 360° recadrée. Plus stricte que pour une photo plate bien
# orientée : sans certitude sur l'orientation exacte de l'objectif d'origine dans l'image, plus
# la distance grandit, plus le risque de recadrer sur autre chose (bâtiment, haie) augmente.
DISTANCE_MAX_PANO_M = 15

# Luminosité moyenne (0-255, niveaux de gris) en-dessous de laquelle une image est jugée trop
# sombre pour être exploitable (nuit, forte pluie, contre-jour extrême) et rejetée d'office,
# avant même de regarder sa géométrie.
LUMINOSITE_MIN = 70

# Champ de vision (degrés) du crop extrait d'une image 360°.
CROP_FOV_DEG = 90
CROP_LARGEUR_PX = 1024
CROP_HAUTEUR_PX = 768


# ===================== Géométrie =====================

def distance_metres(lat1, lon1, lat2, lon2):
    """Distance en mètres entre deux points (formule de Haversine)."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def cap_vers(lat1, lon1, lat2, lon2):
    """Cap (bearing) en degrés [0, 360) du point 1 vers le point 2, 0° = nord, sens horaire."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def ecart_angulaire(a, b):
    """Plus petit écart entre deux angles en degrés, résultat dans [0, 180]."""
    d = abs(a - b) % 360
    return d if d <= 180 else 360 - d


def bbox_autour(lat, lon, rayon_m):
    """Boîte englobante (west, south, east, north) approximative autour d'un point."""
    delta_lat = rayon_m / 111320
    delta_lon = rayon_m / (111320 * math.cos(math.radians(lat)))
    return (lon - delta_lon, lat - delta_lat, lon + delta_lon, lat + delta_lat)


# ===================== Mapillary =====================

def rechercher_images_mapillary(lat, lon, rayon_m):
    """Interroge l'API Mapillary (recherche par bbox) autour d'un point. Retourne la liste
    brute des images trouvées (peut être vide)."""
    west, south, east, north = bbox_autour(lat, lon, rayon_m)
    url = "https://graph.mapillary.com/images"
    params = {
        "access_token": MAPILLARY_TOKEN,
        "bbox": f"{west},{south},{east},{north}",
        "fields": "id,geometry,compass_angle,is_pano,captured_at,thumb_2048_url",
        "limit": 20,
    }
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("data", [])
    except requests.RequestException as e:
        print(f"    [erreur API Mapillary] {e}")
        return []


def classer_candidats(images, lat_terrain, lon_terrain):
    """Parmi les images candidates, retourne une liste CLASSÉE (meilleure en premier) des
    candidats jugés géométriquement valables :
       1. photos plates bien orientées (écart de cap <= ECART_CAP_ACCEPTABLE), triées par
          distance croissante,
       2. puis 360° proches (<= DISTANCE_MAX_PANO_M), triées par distance croissante.
       Liste vide si rien de convenable — on ne retombe plus sur une photo mal orientée "à
       défaut", vu ce que ça donnait en pratique sur le premier essai. Retourne une liste (pas
       un seul choix) pour permettre de passer au candidat suivant si le premier échoue ensuite
       au test de luminosité (voir main())."""
    candidats = []
    for img in images:
        lon_img, lat_img = img["geometry"]["coordinates"]
        dist = distance_metres(lat_img, lon_img, lat_terrain, lon_terrain)
        # bbox_autour() délimite un carré, pas un cercle : Mapillary peut donc renvoyer des
        # images jusqu'à ~1.4x RAYON_RECHERCHE_M dans les coins. Retenu ici uniquement pour ne
        # pas fausser cap_vers()/ecart_angulaire() sur des points hors du vrai rayon voulu.
        if dist > RAYON_RECHERCHE_M:
            continue
        cap = cap_vers(lat_img, lon_img, lat_terrain, lon_terrain)
        compass = img.get("compass_angle")
        ecart = ecart_angulaire(compass, cap) if compass is not None else 180
        candidats.append({
            "image": img,
            "distance": dist,
            "cap_vers_terrain": cap,
            "ecart_cap": ecart,
            "est_pano": img.get("is_pano", False),
        })

    plates_bien_orientees = sorted(
        (c for c in candidats if not c["est_pano"] and c["ecart_cap"] <= ECART_CAP_ACCEPTABLE),
        key=lambda c: c["distance"]
    )
    panos_proches = sorted(
        (c for c in candidats if c["est_pano"] and c["distance"] <= DISTANCE_MAX_PANO_M),
        key=lambda c: c["distance"]
    )

    return plates_bien_orientees + panos_proches


def luminosite_moyenne(image):
    """Luminosité moyenne (0-255) d'une image PIL, calculée en niveaux de gris. Sert à rejeter
    d'office les captures nocturnes/sous forte pluie, illisibles quelle que soit leur
    géométrie."""
    gris = np.asarray(image.convert("L"), dtype=np.float32)
    return float(gris.mean())


# ===================== Recadrage équirectangulaire -> perspective =====================

def extraire_vue_perspective(image_equirect, cap_cible_deg, image_compass_deg, fov_deg, largeur_px, hauteur_px):
    """Extrait, depuis une image 360° équirectangulaire, un crop plat centré sur la direction
    cap_cible_deg (cap absolu, 0°=nord) — l'image elle-même étant orientée selon
    image_compass_deg au moment de la capture. Projection perspective classique, sans
    dépendance externe (numpy/PIL uniquement)."""
    src = np.asarray(image_equirect.convert("RGB"), dtype=np.float32)
    src_h, src_w = src.shape[:2]

    # Différence entre le cap absolu voulu et le cap de référence (avant) de la caméra 360°.
    yaw = math.radians(cap_cible_deg - image_compass_deg)
    fov = math.radians(fov_deg)

    # Grille de rayons 3D pour chaque pixel de sortie (caméra perspective standard, pitch=0).
    x = np.linspace(-math.tan(fov / 2), math.tan(fov / 2), largeur_px)
    y = np.linspace(math.tan(fov / 2) * hauteur_px / largeur_px, -math.tan(fov / 2) * hauteur_px / largeur_px, hauteur_px)
    xx, yy = np.meshgrid(x, y)
    zz = np.ones_like(xx)

    norme = np.sqrt(xx**2 + yy**2 + zz**2)
    xx, yy, zz = xx / norme, yy / norme, zz / norme

    # Rotation autour de l'axe vertical selon le yaw calculé.
    xx_rot = xx * math.cos(yaw) + zz * math.sin(yaw)
    zz_rot = -xx * math.sin(yaw) + zz * math.cos(yaw)

    theta = np.arctan2(xx_rot, zz_rot)          # longitude, -pi..pi
    phi = np.arcsin(np.clip(yy, -1, 1))          # latitude, -pi/2..pi/2

    src_x = ((theta / (2 * math.pi)) + 0.5) * src_w
    src_y = (0.5 - (phi / math.pi)) * src_h

    src_x = np.clip(src_x, 0, src_w - 1).astype(np.int32)
    src_y = np.clip(src_y, 0, src_h - 1).astype(np.int32)

    resultat = src[src_y, src_x]
    return Image.fromarray(resultat.astype(np.uint8))


# ===================== Programme principal =====================

def main():
    if MAPILLARY_TOKEN == "COLLE_TON_TOKEN_ICI":
        print("Renseigne d'abord ton token Mapillary (variable MAPILLARY_TOKEN en haut du "
              "script, ou variable d'environnement du même nom).")
        return

    if not TERRAINS_GEOJSON_PATH.exists():
        print(f"Introuvable : {TERRAINS_GEOJSON_PATH} (lance ce script depuis la racine du repo)")
        return

    data = json.loads(TERRAINS_GEOJSON_PATH.read_text(encoding="utf-8"))
    toutes_communes = sorted(set(f["properties"].get("commune") for f in data["features"]))

    terrains = [f for f in data["features"] if f["properties"].get("commune") == COMMUNE_FILTRE]

    if not terrains:
        print(f"Aucun terrain trouvé pour commune == '{COMMUNE_FILTRE}'.")
        print("Valeurs de commune réellement présentes dans les données (échantillon) :")
        for c in toutes_communes[:20]:
            print(f"  - {c}")
        return

    print(f"{len(terrains)} terrain(s) trouvé(s) pour '{COMMUNE_FILTRE}'.\n")

    OUTPUT_DIR.mkdir(exist_ok=True)
    rapport = []

    for i, terrain in enumerate(terrains, 1):
        lon_t, lat_t = terrain["geometry"]["coordinates"]
        rue = terrain["properties"].get("nearest_street") or "(sans rue connue)"
        print(f"[{i}/{len(terrains)}] Terrain près de {rue} ({lat_t:.5f}, {lon_t:.5f})")

        images = rechercher_images_mapillary(lat_t, lon_t, RAYON_RECHERCHE_M)
        print(f"    {len(images)} image(s) Mapillary dans un rayon de {RAYON_RECHERCHE_M}m")

        candidats = classer_candidats(images, lat_t, lon_t)

        entree_rapport = {
            "terrain_id": terrain["properties"].get("id") or i,
            "rue": rue,
            "lat": lat_t,
            "lon": lon_t,
            "nb_images_trouvees": len(images),
            "nb_candidats_geometrie_ok": len(candidats),
        }

        if not candidats:
            print("    -> Aucun candidat ne passe les critères géométriques, ignoré.\n")
            entree_rapport["resultat"] = "aucun_candidat_geometrique"
            rapport.append(entree_rapport)
            continue

        nom_fichier = f"terrain_{i:03d}.jpg"
        image_retenue = None

        for rang, c in enumerate(candidats, 1):
            try:
                reponse = requests.get(c["image"]["thumb_2048_url"], timeout=20)
                reponse.raise_for_status()
                image_brute = Image.open(__import__("io").BytesIO(reponse.content))
            except Exception as e:
                print(f"    [candidat {rang}] erreur de téléchargement ({e}), suivant...")
                continue

            if c["est_pano"]:
                compass = c["image"].get("compass_angle", 0)
                image_test = extraire_vue_perspective(
                    image_brute, c["cap_vers_terrain"], compass, CROP_FOV_DEG, CROP_LARGEUR_PX, CROP_HAUTEUR_PX
                )
            else:
                image_test = image_brute

            luminosite = luminosite_moyenne(image_test)
            if luminosite < LUMINOSITE_MIN:
                print(f"    [candidat {rang}] trop sombre (luminosité {luminosite:.0f} < {LUMINOSITE_MIN}), suivant...")
                continue

            image_retenue = image_test
            candidat_retenu = c
            break

        if image_retenue is None:
            print("    -> Tous les candidats rejetés (téléchargement ou luminosité), ignoré.\n")
            entree_rapport["resultat"] = "tous_candidats_rejetes"
            rapport.append(entree_rapport)
            continue

        type_resultat = "pano_recadree" if candidat_retenu["est_pano"] else "plate_bien_orientee"
        print(f"    -> {type_resultat} (distance {candidat_retenu['distance']:.0f}m, "
              f"écart de cap {candidat_retenu['ecart_cap']:.0f}°, luminosité {luminosite:.0f}) -> {nom_fichier}\n")

        image_retenue.save(OUTPUT_DIR / nom_fichier, quality=88)
        entree_rapport.update({
            "resultat": type_resultat,
            "distance_m": round(candidat_retenu["distance"], 1),
            "ecart_cap_deg": round(candidat_retenu["ecart_cap"], 1),
            "luminosite": round(luminosite, 1),
            "mapillary_image_id": candidat_retenu["image"]["id"],
            "fichier": nom_fichier,
        })
        rapport.append(entree_rapport)

        time.sleep(0.2)  # marge de confort, largement sous la limite de l'API

    (OUTPUT_DIR / "rapport.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    reussis = sum(1 for r in rapport if r.get("resultat") in ("pano_recadree", "plate_bien_orientee"))
    print(f"\nTerminé : {reussis}/{len(terrains)} terrain(s) avec une photo, "
          f"détail dans {OUTPUT_DIR}/rapport.json")


if __name__ == "__main__":
    main()