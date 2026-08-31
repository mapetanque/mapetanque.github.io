"""
Génère une miniature "perspective" (non déformée) à partir d'une photo 360° Mapillary, dans la
direction repérée manuellement via l'app Mapillary (x, y, zoom dans l'URL app.mapillary.com).

Usage :
    python3 generer_miniature_360.py <mapillary_id> <x> <y> <zoom> <fichier_sortie.webp>

Exemple, à partir de l'URL
    https://www.mapillary.com/app/?pKey=620874416913246&...&x=0.8821045280748913&y=0.5321146840880766&zoom=0
    python3 generer_miniature_360.py 620874416913246 0.8821045280748913 0.5321146840880766 0 sortie.webp

Nécessite la variable d'environnement MAPILLARY_TOKEN (même token que le reste du projet).
"""
import sys
import os
import math
import requests
import numpy as np
from io import BytesIO
from PIL import Image

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")


def equirect_vers_perspective(img_equirect, yaw_deg, pitch_deg, fov_deg, largeur_sortie, hauteur_sortie):
    """Reprojection équirectangulaire -> perspective. Convention vérifiée sur mire de test :
    yaw=0/pitch=0 = centre de l'image source, yaw croît vers l'est, pitch positif = vers le haut."""
    img_arr = np.asarray(img_equirect)
    H_in, W_in = img_arr.shape[:2]

    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    fov = math.radians(fov_deg)

    x = np.linspace(np.tan(fov / 2), -np.tan(fov / 2), largeur_sortie)
    y = np.linspace(np.tan(fov / 2) * (hauteur_sortie / largeur_sortie),
                     -np.tan(fov / 2) * (hauteur_sortie / largeur_sortie), hauteur_sortie)
    xx, yy = np.meshgrid(x, y)
    zz = np.ones_like(xx)

    rayons = np.stack([xx, yy, zz], axis=-1)
    rayons /= np.linalg.norm(rayons, axis=-1, keepdims=True)

    cp, sp = np.cos(-pitch), np.sin(-pitch)
    rot_pitch = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    cy, sy = np.cos(-yaw), np.sin(-yaw)
    rot_yaw = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])

    rayons = rayons @ rot_pitch.T @ rot_yaw.T

    lon = np.arctan2(rayons[..., 0], -rayons[..., 2])
    lat = np.arcsin(np.clip(rayons[..., 1], -1, 1))

    map_x = (lon / (2 * np.pi) + 0.5) * W_in
    map_y = (0.5 - lat / np.pi) * H_in

    map_x = np.clip(map_x.astype(np.int32), 0, W_in - 1)
    map_y = np.clip(map_y.astype(np.int32), 0, H_in - 1)

    return Image.fromarray(img_arr[map_y, map_x])


def xy_app_vers_yaw_pitch(x, y):
    """Convertit les x/y de l'URL app.mapillary.com (0..1 dans le viewer) en yaw/pitch degrés.

    Le +180 ci-dessous a été calibré empiriquement (premier test réel : le résultat montrait la
    direction opposée à celle attendue, sans lui le yaw sortait inversé de 180° par rapport à la
    bonne direction). Reste : x=0.5 = centre du champ visé (à +180° du "avant" brut de l'image
    équirectangulaire côté Mapillary, d'où le décalage), x parcourt tout le tour sur [0,1] ;
    y=0.5 = horizon (pitch=0), y=0 = zénith (+90°), y=1 = nadir (-90°) — ce dernier point pas
    encore confirmé, à surveiller sur le prochain test si le haut/bas semble décalé."""
    yaw_deg = (x - 0.5) * 360.0 + 180.0
    pitch_deg = (0.5 - y) * 180.0
    return yaw_deg, pitch_deg


def zoom_app_vers_fov(zoom):
    """HYPOTHÈSE NON VÉRIFIÉE : zoom=0 (le plus dézoomé dans l'app) -> FOV large (~100°).
    Chaque incrément de zoom double grossièrement le niveau de détail -> FOV divisé par ~1.5.
    À recalibrer une fois un premier résultat visuel obtenu."""
    return max(30.0, 100.0 / (1.5 ** zoom))


def telecharger_equirectangulaire(mapillary_id):
    if not MAPILLARY_TOKEN:
        raise RuntimeError("Variable d'environnement MAPILLARY_TOKEN manquante.")
    url = f"https://graph.mapillary.com/{mapillary_id}"
    reponse = requests.get(url, params={
        "access_token": MAPILLARY_TOKEN,
        "fields": "thumb_2048_url,camera_type",
    }, timeout=20)
    reponse.raise_for_status()
    donnees = reponse.json()

    if donnees.get("camera_type") != "spherical":
        print(f"⚠️  Attention : camera_type = {donnees.get('camera_type')!r}, pas 'spherical' — "
              f"ce n'est peut-être pas une vraie photo 360°, le résultat risque d'être bizarre.")

    thumb_url = donnees.get("thumb_2048_url")
    if not thumb_url:
        raise RuntimeError(f"Pas de thumb_2048_url dans la réponse : {donnees}")

    img_reponse = requests.get(thumb_url, timeout=30)
    img_reponse.raise_for_status()
    return Image.open(BytesIO(img_reponse.content)).convert("RGB")


def main():
    if len(sys.argv) != 6:
        print(__doc__)
        sys.exit(1)

    mapillary_id, x, y, zoom, fichier_sortie = sys.argv[1:6]
    x, y, zoom = float(x), float(y), float(zoom)

    print(f"Téléchargement de la photo {mapillary_id}...")
    img_equirect = telecharger_equirectangulaire(mapillary_id)
    print(f"Image équirectangulaire reçue : {img_equirect.size}")

    yaw_deg, pitch_deg = xy_app_vers_yaw_pitch(x, y)
    fov_deg = zoom_app_vers_fov(zoom)
    print(f"Conversion : x={x}, y={y}, zoom={zoom} -> yaw={yaw_deg:.1f}°, "
          f"pitch={pitch_deg:.1f}°, fov={fov_deg:.1f}°")

    resultat = equirect_vers_perspective(img_equirect, yaw_deg, pitch_deg, fov_deg,
                                          largeur_sortie=1200, hauteur_sortie=675)
    resultat.save(fichier_sortie, quality=88)
    print(f"Miniature générée : {fichier_sortie}")
    print("\nVérifie le cadrage obtenu contre l'URL app d'origine. Si ça ne correspond pas, "
          "voir les commentaires de xy_app_vers_yaw_pitch() et zoom_app_vers_fov() ci-dessus.")


if __name__ == "__main__":
    main()