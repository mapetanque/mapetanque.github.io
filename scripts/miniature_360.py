"""
Calcul des miniatures des vues 360° de Mapillary, partagé par :
  - scripts/publier_photos.py (workflow de publication, sur GitHub Actions) ;
  - la page admin, qui refait EXACTEMENT le même calcul en JavaScript pour l'aperçu du
    cadrage (voir « Reprojection » dans admin.html). Toute modification ici doit y être
    reportée, sinon l'aperçu ne correspondra plus à la miniature publiée.

Redressement (septembre 2026) : une photo 360° brute n'est pas forcément de niveau (caméra
penchée à la prise de vue). Mapillary la redresse à l'affichage grâce à l'orientation qu'il a
calculée pour la caméra (champ computed_rotation) ; on fait désormais pareil. Le point visé par
x/y reste exactement le même, seul le « haut » de la vue change : c'est le vrai haut, plus celui
de l'image brute. Sans computed_rotation, le calcul retombe exactement sur l'ancien.

Repère de l'image brute utilisé ici : x/y de l'URL Mapillary = position dans l'image
équirectangulaire (x = 0,5 au centre, y = 0,5 sur l'horizon de l'image). Un rayon (rx, ry, rz)
correspond à la longitude atan2(rx, -rz) et à la latitude asin(ry) : ry pointe vers le haut
de l'image brute.
"""
import math
from io import BytesIO

import numpy as np
import requests
from PIL import Image

LARGEUR_MINIATURE = 1200
HAUTEUR_MINIATURE = 675
QUALITE_WEBP = 88

# Sens de lecture de computed_rotation. +1 : rotation monde -> caméra (convention OpenSfM,
# celle de Mapillary). Si un aperçu penche DEUX FOIS PLUS au lieu d'être droit, passer à -1
# ici ET dans admin.html (constante SENS_ROTATION).
SENS_ROTATION = 1


def haut_reel(computed_rotation):
    """Vertical du monde exprimée dans le repère de l'image brute, ou None si Mapillary n'a
    pas fourni d'orientation (on garde alors le haut de l'image, comme avant)."""
    if not computed_rotation or len(computed_rotation) != 3:
        return None
    v = SENS_ROTATION * np.array(computed_rotation, dtype=float)
    angle = np.linalg.norm(v)
    if angle < 1e-12:
        rot = np.eye(3)
    else:
        k = v / angle
        K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
        rot = np.eye(3) + math.sin(angle) * K + (1 - math.cos(angle)) * (K @ K)
    # Vertical du monde (0, 0, 1) dans le repère caméra d'OpenSfM (x droite, y bas,
    # z avant), puis passage au repère de l'image brute (y haut, avant = -z).
    h = rot[:, 2]
    return np.array([h[0], -h[1], -h[2]])


def inclinaison_deg(haut):
    """Angle entre le vrai haut et le haut de l'image brute : pour les journaux."""
    if haut is None:
        return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, haut[1] / np.linalg.norm(haut)))))


def direction_visee(x, y):
    """Rayon du point visé (x, y de l'URL Mapillary) dans le repère de l'image brute."""
    lon = (x - 0.5) * 2 * math.pi
    lat = (0.5 - y) * math.pi
    return np.array([math.cos(lat) * math.sin(lon), math.sin(lat), -math.cos(lat) * math.cos(lon)])


def axes_vue(x, y, haut):
    """Axes de la vue : avant (point visé), droite et haut de l'écran."""
    avant = direction_visee(x, y)
    for h in (haut, np.array([0.0, 1.0, 0.0]), np.array([0.0, 0.0, -1.0])):
        if h is None:
            continue
        # Haut de l'écran = vertical voulue, débarrassée de sa part dans l'axe de visée.
        ecran_haut = h - np.dot(h, avant) * avant
        n = np.linalg.norm(ecran_haut)
        if n > 1e-6:   # sinon on vise le zénith ou le nadir : axe suivant
            ecran_haut /= n
            return avant, np.cross(avant, ecran_haut), ecran_haut
    raise RuntimeError("axes de vue indéterminés")


def echantillonner_bilineaire(img_arr, map_x, map_y):
    """Lecture bilinéaire dans l'équirectangulaire (raccord horizontal géré par modulo).
    Remplace l'ancienne lecture « au plus proche voisin », qui donnait des bords en escalier
    dès que la miniature agrandit la source."""
    H, W = img_arr.shape[:2]
    fx = map_x - 0.5                      # le pixel i couvre [i, i+1[ : on vise son centre
    fy = np.clip(map_y - 0.5, 0, H - 1)
    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    dx = (fx - x0)[..., None]
    dy = (fy - y0)[..., None]
    x0 %= W
    x1 = (x0 + 1) % W
    y1 = np.minimum(y0 + 1, H - 1)
    src = img_arr.astype(np.float32)
    ligne_haut = src[y0, x0] * (1 - dx) + src[y0, x1] * dx
    ligne_bas = src[y1, x0] * (1 - dx) + src[y1, x1] * dx
    return np.clip(ligne_haut * (1 - dy) + ligne_bas * dy + 0.5, 0, 255).astype(np.uint8)


def equirect_vers_perspective(img_equirect, x, y, fov_deg, largeur_sortie, hauteur_sortie, haut=None):
    """Reprojection équirectangulaire -> perspective, centrée sur le point (x, y) de l'image
    brute. haut = vertical du monde (voir haut_reel) ; None = haut de l'image brute."""
    img_arr = np.asarray(img_equirect)
    H_in, W_in = img_arr.shape[:2]

    avant, droite, ecran_haut = axes_vue(x, y, haut)
    t = math.tan(math.radians(fov_deg) / 2)
    a = np.linspace(-t, t, largeur_sortie)                                    # gauche -> droite
    b = np.linspace(t * hauteur_sortie / largeur_sortie,
                    -t * hauteur_sortie / largeur_sortie, hauteur_sortie)       # haut -> bas

    rayons = (avant[None, None, :]
              + a[None, :, None] * droite[None, None, :]
              + b[:, None, None] * ecran_haut[None, None, :])
    rayons /= np.linalg.norm(rayons, axis=-1, keepdims=True)

    lon = np.arctan2(rayons[..., 0], -rayons[..., 2])
    lat = np.arcsin(np.clip(rayons[..., 1], -1, 1))

    map_x = (lon / (2 * np.pi) + 0.5) * W_in
    map_y = (0.5 - lat / np.pi) * H_in

    return Image.fromarray(echantillonner_bilineaire(img_arr, map_x, map_y))


def zoom_app_vers_fov(zoom):
    """HYPOTHÈSE toujours non vérifiée précisément (voir mémo) : zoom=0 -> FOV large (~100°)."""
    return max(30.0, 100.0 / (1.5 ** zoom))


def telecharger_vue(mapillary_id, token):
    """Image 360° brute (équirectangulaire, en résolution d'origine si Mapillary la fournit,
    sinon 2048 px de large) et orientation calculée de la caméra (computed_rotation, None si
    Mapillary ne la fournit pas)."""
    reponse = requests.get(f"https://graph.mapillary.com/{mapillary_id}", params={
        "access_token": token,
        "fields": "thumb_original_url,thumb_2048_url,camera_type,computed_rotation",
    }, timeout=20)
    if not reponse.ok:
        raise RuntimeError(f"HTTP {reponse.status_code} — {reponse.text[:200]}")
    donnees = reponse.json()

    if donnees.get("camera_type") != "spherical":
        print(f"  ⚠ camera_type = {donnees.get('camera_type')!r}, pas 'spherical' : "
              f"résultat potentiellement incorrect.")

    thumb_url = donnees.get("thumb_original_url") or donnees.get("thumb_2048_url")
    if not thumb_url:
        raise RuntimeError(f"ni thumb_original_url ni thumb_2048_url dans la réponse : {donnees}")

    image = requests.get(thumb_url, timeout=30)
    image.raise_for_status()
    return Image.open(BytesIO(image.content)).convert("RGB"), donnees.get("computed_rotation")


def generer_miniature(mapillary_id, x, y, zoom, token, chemin_sortie):
    """Télécharge la vue, la recadre selon x/y/zoom (paramètres de l'app Mapillary), la
    redresse, et écrit la miniature WebP. Écrase un fichier existant : c'est voulu, pour un
    recadrage."""
    if x is None or y is None:
        raise RuntimeError("cadrage incomplet (x ou y manquant)")

    equirect, rotation = telecharger_vue(mapillary_id, token)
    haut = haut_reel(rotation)
    if haut is None:
        print("  ⚠ pas d'orientation calculée chez Mapillary : vue non redressée.")
    else:
        print(f"  redressement : image brute inclinée de {inclinaison_deg(haut):.1f}°")

    resultat = equirect_vers_perspective(equirect, x, y, zoom_app_vers_fov(zoom or 0),
                                         LARGEUR_MINIATURE, HAUTEUR_MINIATURE, haut)
    chemin_sortie.parent.mkdir(parents=True, exist_ok=True)
    resultat.save(chemin_sortie, "WEBP", quality=QUALITE_WEBP)