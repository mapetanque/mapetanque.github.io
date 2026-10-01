"""Prépare une bannière de page : recadrage en bandeau, vignettage, harmonisation des couleurs.

La référence est la bannière de l'accueil (images/banniere-accueil.webp) : chaque bannière
traitée reprend sa luminosité moyenne, son contraste et sa saturation, pour que toutes les
pages aient le même rendu quelle que soit la photo d'origine.

Exemples (depuis la racine du projet) :
    # Nouvelle photo : recadrage centré à 55 % de la hauteur + vignettage
    python scripts/preparer_banniere.py photo.jpg banniere-compteur.webp --centre 0.55 --vignette
    # Bannière existante : seulement l'harmonisation des couleurs
    python scripts/preparer_banniere.py images/banniere-faq.webp banniere-faq.webp
"""

import argparse
import os

from PIL import Image, ImageEnhance, ImageStat

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER_IMAGES = os.path.join(RACINE, "images")
REFERENCE = os.path.join(DOSSIER_IMAGES, "banniere-accueil.webp")

# Proportions des bannières existantes (2400 × ~700) et largeur maximale
RATIO = 3.4
LARGEUR_MAX = 2400


def mesurer(image):
    """Luminance moyenne, écart-type de la luminance (contraste) et saturation moyenne."""
    luminance = ImageStat.Stat(image.convert("L"))
    saturation = ImageStat.Stat(image.convert("HSV").getchannel("S"))
    return luminance.mean[0], luminance.stddev[0], saturation.mean[0]


def recadrer(image, centre):
    """Découpe un bandeau au ratio des bannières, centré verticalement sur `centre` (0 à 1)."""
    largeur, hauteur = image.size
    hauteur_bandeau = min(hauteur, round(largeur / RATIO))
    haut = round(centre * hauteur - hauteur_bandeau / 2)
    haut = max(0, min(haut, hauteur - hauteur_bandeau))
    return image.crop((0, haut, largeur, haut + hauteur_bandeau))


def vignetter(image, force=0.35):
    """Assombrit doucement les bords, comme sur les autres bannières."""
    largeur, hauteur = image.size
    petit = Image.new("L", (200, 200))
    petit.putdata([
        round(255 * (1 - force * min(1, ((x - 99.5) / 99.5) ** 2 + ((y - 99.5) / 99.5) ** 2) ** 1.5))
        for y in range(200) for x in range(200)
    ])
    masque = petit.resize((largeur, hauteur), Image.BILINEAR)
    noir = Image.new("RGB", image.size, (0, 0, 0))
    return Image.composite(image, noir, masque)


def harmoniser(image, cible):
    """Ajuste luminance (moyenne et écart-type) puis saturation pour rejoindre la cible."""
    lum_cible, contraste_cible, sat_cible = cible
    for _ in range(4):
        lum, contraste, sat = mesurer(image)
        y, cb, cr = image.convert("YCbCr").split()
        k = contraste_cible / contraste
        y = y.point(lambda v: max(0, min(255, round((v - lum) * k + lum_cible))))
        image = Image.merge("YCbCr", (y, cb, cr)).convert("RGB")
        sat = mesurer(image)[2]
        image = ImageEnhance.Color(image).enhance(sat_cible / sat)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", help="photo d'origine")
    parser.add_argument("sortie", help="nom du fichier écrit dans images/ (ex. banniere-faq.webp)")
    parser.add_argument("--centre", type=float, help="recadre en bandeau centré à cette hauteur (0 à 1)")
    parser.add_argument("--vignette", action="store_true", help="ajoute un léger vignettage")
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGB")
    if args.centre is not None:
        image = recadrer(image, args.centre)
    if image.width > LARGEUR_MAX:
        image = image.resize((LARGEUR_MAX, round(image.height * LARGEUR_MAX / image.width)), Image.LANCZOS)
    if args.vignette:
        image = vignetter(image)

    cible = mesurer(Image.open(REFERENCE).convert("RGB"))
    avant = mesurer(image)
    image = harmoniser(image, cible)
    apres = mesurer(image)

    chemin = os.path.join(DOSSIER_IMAGES, args.sortie)
    image.save(chemin, "WEBP", quality=82, method=6)
    print(f"{args.sortie} : {image.width} × {image.height}, {os.path.getsize(chemin) // 1024} Ko")
    for nom, a, b, c in zip(("luminosité", "contraste", "saturation"), avant, apres, cible):
        print(f"  {nom} : {a:.0f} -> {b:.0f} (référence {c:.0f})")


if __name__ == "__main__":
    main()
