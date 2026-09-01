"""
Traite en une fois toute une liste de candidats 360° repérés dans l'outil de revue des photos
(bouton "Télécharger la liste des 360° à traiter" de revue_photos.html), au lieu de les lancer un
par un à la main avec generer_miniature_360.py.

Usage :
    python3 generer_miniatures_360_batch.py candidats_360.json

Nécessite la variable d'environnement MAPILLARY_TOKEN (même token que le reste du projet).

Pour chaque candidat :
  - télécharge l'équirectangulaire brute (thumb_2048_url)
  - génère la miniature perspective (reprojection calibrée hier sur mire de test + calage +180°
    confirmé sur un cas réel)
  - la sauvegarde dans images/mapillary-360/{mapillary_id}.webp

Reprend automatiquement là où il s'était arrêté si relancé (les fichiers déjà générés sont
ignorés) — utile vu le volume (plusieurs dizaines) et le risque qu'une erreur réseau interrompe
le lot en cours de route.

En sortie, écrit aussi resultat_batch_360.json : un résumé prêt à fusionner à la main dans
data/photos_mapillary.json (regroupé par osm_id, avec le chemin de la miniature générée), plus la
liste des échecs éventuels à retraiter séparément.
"""
import sys
import os
import time
import math
import json
import requests
import numpy as np
from io import BytesIO
from PIL import Image

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")
import pathlib

# Toujours résolu par rapport à l'emplacement du script lui-même (scripts/), pas au dossier
# courant depuis lequel il est lancé — sinon, lancé depuis scripts/ (comme recommandé), le
# dossier se serait retrouvé créé dans scripts/images/mapillary-360 au lieu de la racine du
# repo, là où le site sert réellement ses images (piège déjà rencontré une fois).
DOSSIER_SORTIE = str(pathlib.Path(__file__).resolve().parent.parent / "images" / "mapillary-360")
PAUSE_ENTRE_APPELS_S = 1.0  # limite le débit vers l'API Mapillary, par politesse


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


def telecharger_equirectangulaire(mapillary_id):
    url = f"https://graph.mapillary.com/{mapillary_id}"
    reponse = requests.get(url, params={
        "access_token": MAPILLARY_TOKEN,
        "fields": "thumb_2048_url,camera_type",
    }, timeout=20)
    reponse.raise_for_status()
    donnees = reponse.json()

    if donnees.get("camera_type") != "spherical":
        print(f"  ⚠️  camera_type = {donnees.get('camera_type')!r}, pas 'spherical' — "
              f"résultat potentiellement incorrect.")

    thumb_url = donnees.get("thumb_2048_url")
    if not thumb_url:
        raise RuntimeError(f"pas de thumb_2048_url dans la réponse : {donnees}")

    img_reponse = requests.get(thumb_url, timeout=30)
    img_reponse.raise_for_status()
    return Image.open(BytesIO(img_reponse.content)).convert("RGB")


def traiter_un_candidat(candidat):
    mapillary_id = candidat["mapillary_id"]
    chemin_sortie = os.path.join(DOSSIER_SORTIE, f"{mapillary_id}.webp")

    if os.path.exists(chemin_sortie):
        print(f"  ↷ déjà généré, ignoré : {chemin_sortie}")
        return chemin_sortie

    img_equirect = telecharger_equirectangulaire(mapillary_id)

    x = candidat.get("x")
    y = candidat.get("y")
    zoom = candidat.get("zoom") or 0
    if x is None or y is None:
        raise RuntimeError("x/y manquants pour ce candidat (URL app incomplète collée dans l'outil de revue ?)")

    yaw_deg, pitch_deg = xy_app_vers_yaw_pitch(x, y)
    fov_deg = zoom_app_vers_fov(zoom)

    resultat = equirect_vers_perspective(img_equirect, yaw_deg, pitch_deg, fov_deg,
                                          largeur_sortie=1200, hauteur_sortie=675)
    os.makedirs(DOSSIER_SORTIE, exist_ok=True)
    resultat.save(chemin_sortie, quality=88)
    return chemin_sortie


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    if not MAPILLARY_TOKEN:
        print("Erreur : variable d'environnement MAPILLARY_TOKEN manquante.")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        candidats = json.load(f)

    print(f"{len(candidats)} candidat(s) 360° à traiter.\n")

    reussis = {}   # osm_id -> [ { mapillary_id, credit_url, miniature_locale } , ... ]
    echecs = []

    for i, candidat in enumerate(candidats, start=1):
        nom = candidat.get("nom", "?")
        commune = candidat.get("commune", "?")
        mapillary_id = candidat["mapillary_id"]
        osm_id = candidat["osm_id"]

        print(f"[{i}/{len(candidats)}] {commune} — {nom} (photo {mapillary_id})")

        try:
            chemin = traiter_un_candidat(candidat)
            reussis.setdefault(osm_id, []).append({
                "mapillary_id": mapillary_id,
                # Construit avec x/y/zoom cette fois (repris de candidats_360.json) : sans eux,
                # le lien "agrandir" atterrissait sur le cadrage par défaut de Mapillary, pas sur
                # celui qu'on avait repéré à la main dans l'outil de revue.
                "credit_url": (
                    f"https://www.mapillary.com/app/?pKey={mapillary_id}"
                    f"&focus=photo&x={candidat.get('x')}&y={candidat.get('y')}&zoom={candidat.get('zoom') or 0}"
                ),
                # Chemin fixe tel que le site le servira réellement (/images/mapillary-360/...),
                # indépendant de DOSSIER_SORTIE (qui, lui, est un chemin absolu sur CE PC pour
                # l'écriture du fichier — les deux ne doivent pas être confondus).
                "miniature_locale": f"/images/mapillary-360/{mapillary_id}.webp",
            })
            print(f"  ✓ {chemin}")
        except Exception as e:
            print(f"  ✗ ÉCHEC : {e}")
            echecs.append({**candidat, "erreur": str(e)})

        # Pause seulement s'il restait du travail réseau à faire (pas sur les "déjà généré")
        if i < len(candidats):
            time.sleep(PAUSE_ENTRE_APPELS_S)

    resume = {"reussis": reussis, "echecs": echecs}
    with open("resultat_batch_360.json", "w", encoding="utf-8") as f:
        json.dump(resume, f, ensure_ascii=False, indent=2)

    print(f"\nTerminé : {sum(len(v) for v in reussis.values())} miniature(s) générée(s), "
          f"{len(echecs)} échec(s).")
    print("Détail écrit dans resultat_batch_360.json — la clé \"reussis\" est prête à fusionner "
          "à la main dans data/photos_mapillary.json (même structure, ajoute juste "
          "\"miniature_locale\" à chaque entrée). Les échecs sont listés à part pour retraitement.")


if __name__ == "__main__":
    main()