"""
Calcul des miniatures des vues 360° de Mapillary, partagé par :
  - scripts/publier_photos.py (workflow de publication, sur GitHub Actions) ;
  - la page admin, qui refait EXACTEMENT le même calcul en JavaScript pour l'aperçu du
    cadrage (voir « Reprojection » dans admin.html). Toute modification ici doit y être
    reportée, sinon l'aperçu ne correspondra plus à la miniature publiée.

Fonctions reprises telles quelles de l'ancien generer_miniatures_360_batch.py : la
reprojection a été calibrée sur mire de test, puis le calage de +180° confirmé sur un cas réel.
"""
import math
from io import BytesIO

import numpy as np
import requests
from PIL import Image

LARGEUR_MINIATURE = 1200
HAUTEUR_MINIATURE = 675
QUALITE_WEBP = 88


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
    """x=0.5 -> yaw=180° (calage confirmé sur un cas réel, voir historique) ; y=0.5 = horizon."""
    yaw_deg = (x - 0.5) * 360.0 + 180.0
    pitch_deg = (0.5 - y) * 180.0
    return yaw_deg, pitch_deg


def zoom_app_vers_fov(zoom):
    """HYPOTHÈSE toujours non vérifiée précisément (voir mémo) : zoom=0 -> FOV large (~100°)."""
    return max(30.0, 100.0 / (1.5 ** zoom))


def telecharger_equirectangulaire(mapillary_id, token):
    """Image 360° brute (équirectangulaire, 2048 px de large) depuis l'API Mapillary."""
    reponse = requests.get(f"https://graph.mapillary.com/{mapillary_id}", params={
        "access_token": token,
        "fields": "thumb_2048_url,camera_type",
    }, timeout=20)
    if not reponse.ok:
        raise RuntimeError(f"HTTP {reponse.status_code} — {reponse.text[:200]}")
    donnees = reponse.json()

    if donnees.get("camera_type") != "spherical":
        print(f"  ⚠ camera_type = {donnees.get('camera_type')!r}, pas 'spherical' : "
              f"résultat potentiellement incorrect.")

    thumb_url = donnees.get("thumb_2048_url")
    if not thumb_url:
        raise RuntimeError(f"pas de thumb_2048_url dans la réponse : {donnees}")

    image = requests.get(thumb_url, timeout=30)
    image.raise_for_status()
    return Image.open(BytesIO(image.content)).convert("RGB")


def generer_miniature(mapillary_id, x, y, zoom, token, chemin_sortie):
    """Télécharge la vue, la recadre selon x/y/zoom (paramètres de l'app Mapillary) et
    écrit la miniature WebP. Écrase un fichier existant : c'est voulu, pour un recadrage."""
    if x is None or y is None:
        raise RuntimeError("cadrage incomplet (x ou y manquant)")

    equirect = telecharger_equirectangulaire(mapillary_id, token)
    yaw_deg, pitch_deg = xy_app_vers_yaw_pitch(x, y)
    fov_deg = zoom_app_vers_fov(zoom or 0)
    resultat = equirect_vers_perspective(equirect, yaw_deg, pitch_deg, fov_deg,
                                         LARGEUR_MINIATURE, HAUTEUR_MINIATURE)
    chemin_sortie.parent.mkdir(parents=True, exist_ok=True)
    resultat.save(chemin_sortie, "WEBP", quality=QUALITE_WEBP)
