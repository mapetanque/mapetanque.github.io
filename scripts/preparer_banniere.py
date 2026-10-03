"""Prépare une bannière de page : recadrage en bandeau, vignettage, puis retouche vers un rendu commun.

La retouche ne consiste pas à appliquer les mêmes réglages à toutes les photos : elle fixe le rendu
final à atteindre (répartition des tons, dominante de couleur dans les ombres, les tons moyens et les
lumières, saturation) et corrige chaque photo autant qu'il le faut pour y arriver. Une photo terne,
bleutée ou trop jaune ressort donc comme les autres. Ce rendu cible est l'intensité « douce » choisie
en octobre 2026, calée sur les anciennes bannières de l'accueil et du compteur de points.

Toujours partir de la photo d'origine (pleine résolution), jamais d'une bannière déjà retouchée.
Nécessite Pillow et numpy (pip install pillow numpy).

Exemple (depuis la racine du projet) :
    python scripts/preparer_banniere.py photo.jpg banniere-compteur.webp --centre 0.71

Réglages utilisés pour les bannières actuelles (photos d'origine, voir les crédits sur chaque page) :
    accueil        Jean-Claude Parayre                          --centre 0.5
    compteur       elderly-friends-playing-petanque (Magnific)  --centre 0.71
    comment-jouer  Boule Stadtmeisterschaft 2026 (N. Nagel)     --centre 0.66
    la-petanque    Mondial La Marseillaise 2022 (M. Casamance)  --centre 0.55
    a-propos       petanque-3629216 (jackmac34, Pixabay)        --centre 0.55
"""

import argparse
import os

import numpy as np
from PIL import Image, ImageOps

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER_IMAGES = os.path.join(RACINE, "images")

# Proportions des bannières (2400 × ~700) et largeur maximale
RATIO = 3.4
LARGEUR_MAX = 2400

# Rendu visé. Répartition des tons : luminosité (sur 255) atteinte par 0 %, 2,5 %, 5 %… 100 % des
# pixels (le dernier repère est pris à 99,9 % pour ignorer quelques reflets isolés).
REPERES_TONS = [0, 7, 16, 23, 29, 35, 42, 49, 54, 58, 62, 66, 69, 72, 76, 79, 82, 84, 86, 89, 91,
                94, 97, 99, 102, 106, 108, 112, 115, 118, 122, 126, 130, 135, 140, 144, 148, 153, 158,
                169, 201]
# Dominante visée dans les ombres, les tons moyens et les lumières : écart du rouge, du vert et du
# bleu à la luminosité (sur 1). Bleu négatif = lumière chaude.
DOMINANTES = [(0.000, 0.006, -0.035), (0.015, 0.006, -0.070), (0.020, 0.004, -0.060)]
# Saturation moyenne visée dans les tons moyens (0 à 1)
SATURATION = 0.24
# Assombrissement des bords (0 = aucun)
VIGNETTAGE = 0.30

# Axes de correction des couleurs : chaud/froid (rouge contre bleu), corrigé entièrement, et
# vert/magenta, corrigé à moitié pour ne pas teinter un gravier neutre quand la photo est pleine de
# feuillage.
AXE_CHALEUR = np.array([1.0, 0.0, -1.0]) / np.sqrt(2)
AXE_TEINTE = np.array([-0.5, 1.0, -0.5]) / np.sqrt(1.5)
PART_TEINTE = 0.5

QUANTILES = np.linspace(0, 1, 1001)
CIBLE_TONS = np.interp(QUANTILES, np.linspace(0, 1, len(REPERES_TONS)), np.array(REPERES_TONS) / 255)


def luminance(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def saturation(a):
    maxi, mini = a.max(-1), a.min(-1)
    return np.where(maxi > 0, (maxi - mini) / np.maximum(maxi, 1e-6), 0)


def recadrer(image, centre):
    """Découpe un bandeau au ratio des bannières, centré verticalement sur `centre` (0 à 1)."""
    largeur, hauteur = image.size
    hauteur_bandeau = min(hauteur, round(largeur / RATIO))
    haut = round(centre * hauteur - hauteur_bandeau / 2)
    haut = max(0, min(haut, hauteur - hauteur_bandeau))
    return image.crop((0, haut, largeur, haut + hauteur_bandeau))


def vignetter(a, force):
    """Assombrit doucement les bords."""
    hauteur, largeur = a.shape[:2]
    y, x = np.mgrid[0:hauteur, 0:largeur]
    distance = np.minimum(1, ((x / (largeur - 1) - 0.5) * 2) ** 2 + ((y / (hauteur - 1) - 0.5) * 2) ** 2) ** 1.5
    return a * (1 - force * distance)[..., None]


def poids_bandes(lum):
    """Part de chaque pixel dans les ombres, les tons moyens et les lumières (transitions douces)."""
    ombres = np.clip(1 - lum / 0.4, 0, 1)
    lumieres = np.clip((lum - 0.5) / 0.4, 0, 1)
    return ombres, np.clip(1 - ombres - lumieres, 0, 1), lumieres


def dominantes(a):
    lum = luminance(a)
    ecarts = a - lum[..., None]
    return [(ecarts * p[..., None]).sum((0, 1)) / max(p.sum(), 1) for p in poids_bandes(lum)]


def caler_tons(a):
    """Donne à la luminosité la répartition visée, en gardant teinte et saturation."""
    lum = luminance(a)
    rang = np.interp(lum, np.quantile(lum, QUANTILES), QUANTILES)
    cible = np.interp(rang, QUANTILES, CIBLE_TONS)
    return np.clip(a * (cible / np.maximum(lum, 1e-4))[..., None], 0, 1)


def caler_couleurs(a):
    """Amène la dominante de chaque bande de tons sur la dominante visée."""
    lum = luminance(a)
    for poids, actuelle, visee in zip(poids_bandes(lum), dominantes(a), DOMINANTES):
        ecart = np.array(visee) - actuelle
        ecart = AXE_CHALEUR * (ecart @ AXE_CHALEUR) + PART_TEINTE * AXE_TEINTE * (ecart @ AXE_TEINTE)
        a = a + poids[..., None] * ecart
    return np.clip(a, 0, 1)


def caler_saturation(a):
    lum = luminance(a)
    tons_moyens = (lum > 0.2) & (lum < 0.8)
    k = SATURATION / max(saturation(a)[tons_moyens].mean(), 1e-3)
    return np.clip(lum[..., None] + (a - lum[..., None]) * k, 0, 1)


def retoucher(image, vignettage):
    a = np.asarray(image, dtype=np.float32) / 255
    if vignettage:
        a = vignetter(a, vignettage)
    # Chaque correction dérange un peu les autres : quelques passages suffisent à toutes les tenir
    for _ in range(3):
        a = caler_couleurs(caler_tons(a))
        a = caler_saturation(a)
    a = caler_tons(a)
    return Image.fromarray((a * 255 + 0.5).astype(np.uint8))


def mesurer(image):
    """Noirs, médiane, blancs (1 %, 50 %, 99 % des pixels, sur 255), chaleur et saturation."""
    a = np.asarray(image, dtype=np.float32) / 255
    lum = luminance(a)
    noirs, mediane, blancs = np.quantile(lum, [0.01, 0.5, 0.99]) * 255
    moyens = dominantes(a)[1]
    tons_moyens = (lum > 0.2) & (lum < 0.8)
    return noirs, mediane, blancs, (moyens[0] - moyens[2]) * 255, saturation(a)[tons_moyens].mean() * 100


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", help="photo d'origine")
    parser.add_argument("sortie", help="nom du fichier écrit dans images/ (ex. banniere-compteur.webp)")
    parser.add_argument("--centre", type=float, default=0.5,
                        help="hauteur du centre du bandeau dans la photo, de 0 (haut) à 1 (bas) ; 0.5 par défaut")
    parser.add_argument("--vignette", type=float, default=VIGNETTAGE,
                        help=f"force de l'assombrissement des bords, 0 pour aucun ; {VIGNETTAGE} par défaut")
    args = parser.parse_args()

    image = ImageOps.exif_transpose(Image.open(args.source)).convert("RGB")
    image = recadrer(image, args.centre)
    if image.width > LARGEUR_MAX:
        image = image.resize((LARGEUR_MAX, round(image.height * LARGEUR_MAX / image.width)), Image.LANCZOS)

    avant = mesurer(image)
    image = retoucher(image, args.vignette)
    apres = mesurer(image)

    chemin = os.path.join(DOSSIER_IMAGES, args.sortie)
    image.save(chemin, "WEBP", quality=82, method=6)
    print(f"{args.sortie} : {image.width} × {image.height}, {os.path.getsize(chemin) // 1024} Ko")
    for nom, a, b in zip(("noirs", "médiane", "blancs", "chaleur", "saturation"), avant, apres):
        print(f"  {nom} : {a:.0f} -> {b:.0f}")


if __name__ == "__main__":
    main()
