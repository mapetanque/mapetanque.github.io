"""
Génère des miniatures carrées pour la sélection "Les plus beaux terrains" (carrousel/tuiles de la
page d'accueil et des pages région), à partir d'une simple photo Mapillary classique (pas un
panorama 360° — pour ça, voir generer_miniatures_360_batch.py, qui fait une reprojection
équirectangulaire bien plus complexe). Ici, pas de reprojection : juste un recadrage carré centré
(ou légèrement décalé si besoin) sur l'image source.

Usage :
    python3 generer_miniatures_carrees.py beaux_terrains.json

Nécessite la variable d'environnement MAPILLARY_TOKEN (même token que le reste du projet).

Format attendu de beaux_terrains.json : une liste d'objets avec au minimum :
    {
        "osm_id": "node/123456789",
        "mapillary_id": "951746303642023",
        "nom": "Vossenhoek",
        "commune": "Beringen",
        "focal_x": 0.5,   # optionnel, 0.0-1.0, point horizontal à centrer (défaut 0.5 = centre)
        "focal_y": 0.5    # optionnel, 0.0-1.0, point vertical à centrer (défaut 0.5 = centre)
    }

focal_x/focal_y permettent de recentrer le carré quand le terrain n'est pas au milieu de la photo
source (ex. photo prise de travers, terrain sur le côté) — à ajuster à l'oeil après une première
génération, comme le calage x/y des 360°, mais nettement plus simple ici puisqu'il n'y a pas de
FOV/zoom à deviner : juste "où se trouve le centre du carré dans l'image, en proportion 0-1".

Pour retoucher le cadrage d'un terrain déjà généré (après avoir ajusté focal_x/focal_y), ajoute
"forcer": true sur son entrée : sinon le script le laisse tel quel (reprise automatique, voir plus
bas). Pense à retirer "forcer" une fois satisfait du résultat, sinon il regénère à chaque lancement.

Pour chaque candidat :
  - télécharge la photo source (thumb_2048_url, même champ que pour les 360°)
  - recadre un carré centré sur (focal_x, focal_y) via ImageOps.fit (redimensionne + rogne,
    sans déformation)
  - la sauvegarde dans images/miniatures-carrees/{mapillary_id}.webp

Reprend automatiquement là où il s'était arrêté si relancé (fichiers déjà générés ignorés).

En sortie, écrit aussi resultat_miniatures_carrees.json : un résumé prêt à fusionner à la main
dans la liste des "beaux terrains" (regroupé par osm_id, avec le chemin de la miniature générée),
plus la liste des échecs éventuels à retraiter séparément.
"""
import sys
import os
import time
import json
import pathlib
import requests
from io import BytesIO
from PIL import Image, ImageOps

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")

# Résolu par rapport à l'emplacement du script (scripts/), pas au dossier courant — même piège
# déjà rencontré et corrigé pour generer_miniatures_360_batch.py.
DOSSIER_SORTIE = str(pathlib.Path(__file__).resolve().parent.parent / "images" / "miniatures-carrees")
TAILLE_SORTIE = 500  # px, carré — largement suffisant pour les tuiles (420px de large actuellement)
PAUSE_ENTRE_APPELS_S = 1.0  # limite le débit vers l'API Mapillary, par politesse


def telecharger_photo(mapillary_id):
    url = f"https://graph.mapillary.com/{mapillary_id}"
    reponse = requests.get(url, params={
        "access_token": MAPILLARY_TOKEN,
        "fields": "thumb_2048_url,camera_type",
    }, timeout=20)
    reponse.raise_for_status()
    donnees = reponse.json()

    if donnees.get("camera_type") == "spherical":
        print(f"  ⚠️  camera_type = 'spherical' (photo 360°) — ce script attend une photo "
              f"classique, utiliser generer_miniatures_360_batch.py à la place pour celle-ci.")

    thumb_url = donnees.get("thumb_2048_url")
    if not thumb_url:
        raise RuntimeError(f"pas de thumb_2048_url dans la réponse : {donnees}")

    img_reponse = requests.get(thumb_url, timeout=30)
    img_reponse.raise_for_status()
    return Image.open(BytesIO(img_reponse.content)).convert("RGB")


def recadrer_carre(img, focal_x=0.5, focal_y=0.5):
    """Redimensionne + rogne en carré, centré sur (focal_x, focal_y) exprimés en proportion
    0.0-1.0 de l'image source. ImageOps.fit ne centre que sur le milieu géométrique (0.5, 0.5) ;
    pour un centrage arbitraire, on recrée la même logique à la main : on redimensionne d'abord
    pour que le plus petit côté atteigne TAILLE_SORTIE, puis on rogne une fenêtre TAILLE_SORTIE ×
    TAILLE_SORTIE autour du point focal demandé (en s'assurant de rester dans les bords)."""
    largeur, hauteur = img.size
    ratio = TAILLE_SORTIE / min(largeur, hauteur)
    img_redim = img.resize((round(largeur * ratio), round(hauteur * ratio)), Image.LANCZOS)
    largeur_r, hauteur_r = img_redim.size

    cx = focal_x * largeur_r
    cy = focal_y * hauteur_r

    gauche = min(max(cx - TAILLE_SORTIE / 2, 0), largeur_r - TAILLE_SORTIE)
    haut = min(max(cy - TAILLE_SORTIE / 2, 0), hauteur_r - TAILLE_SORTIE)

    return img_redim.crop((round(gauche), round(haut), round(gauche) + TAILLE_SORTIE, round(haut) + TAILLE_SORTIE))


def traiter_un_candidat(candidat):
    mapillary_id = candidat["mapillary_id"]
    chemin_sortie = os.path.join(DOSSIER_SORTIE, f"{mapillary_id}.webp")

    # "forcer": true permet de régénérer un terrain précis après avoir ajusté focal_x/focal_y,
    # sans devoir supprimer le fichier à la main à chaque essai.
    if os.path.exists(chemin_sortie) and not candidat.get("forcer"):
        print(f"  ↷ déjà généré, ignoré : {chemin_sortie}")
        return chemin_sortie

    img = telecharger_photo(mapillary_id)
    focal_x = candidat.get("focal_x", 0.5)
    focal_y = candidat.get("focal_y", 0.5)

    resultat = recadrer_carre(img, focal_x, focal_y)
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

    print(f"{len(candidats)} candidat(s) à traiter.\n")

    reussis = {}   # osm_id -> { mapillary_id, miniature_locale }
    echecs = []
    ignores_360 = []

    for i, candidat in enumerate(candidats, start=1):
        nom = candidat.get("nom", "?")
        commune = candidat.get("commune", "?")
        mapillary_id = candidat["mapillary_id"]
        osm_id = candidat["osm_id"]

        print(f"[{i}/{len(candidats)}] {commune} — {nom} (photo {mapillary_id})")

        # Marqueur "360" : ce terrain a déjà une miniature générée par le pipeline 360°
        # (generer_miniatures_360_batch.py), stockée dans images/mapillary-360/. Pas de photo
        # classique à télécharger/recadrer ici — on saute, sans compter ça comme un échec.
        if mapillary_id == "360":
            print("  ↷ marqué \"360\" : déjà couvert par le pipeline 360°, ignoré ici.")
            ignores_360.append({"osm_id": osm_id, "nom": nom, "commune": commune})
            continue

        try:
            chemin = traiter_un_candidat(candidat)
            reussis[osm_id] = {
                "mapillary_id": mapillary_id,
                # Chemin fixe tel que le site le servira réellement (/images/miniatures-carrees/...),
                # indépendant de DOSSIER_SORTIE (chemin absolu sur CE PC pour l'écriture du fichier).
                "miniature_locale": f"/images/miniatures-carrees/{mapillary_id}.webp",
            }
            print(f"  ✓ {chemin}")
        except Exception as e:
            print(f"  ✗ ÉCHEC : {e}")
            echecs.append({**candidat, "erreur": str(e)})

        if i < len(candidats):
            time.sleep(PAUSE_ENTRE_APPELS_S)

    resume = {"reussis": reussis, "echecs": echecs, "ignores_360": ignores_360}
    with open("resultat_miniatures_carrees.json", "w", encoding="utf-8") as f:
        json.dump(resume, f, ensure_ascii=False, indent=2)

    print(f"\nTerminé : {len(reussis)} miniature(s) générée(s), {len(echecs)} échec(s), "
          f"{len(ignores_360)} ignorée(s) (déjà couvertes par le pipeline 360°).")
    print("Détail écrit dans resultat_miniatures_carrees.json — la clé \"reussis\" est prête à "
          "fusionner à la main dans la liste des beaux terrains (chaque entrée devient la source "
          "de <img> de la tuile, à la place de l'iframe Mapillary). Les échecs sont listés à part "
          "pour retraitement, avec un aperçu : ajuster focal_x/focal_y dans le JSON d'entrée et "
          "relancer (les fichiers déjà générés avec succès seront ignorés au prochain passage).")

    if reussis:
        print("\nAstuce : ouvre les .webp générés dans images/miniatures-carrees/ pour vérifier "
              "le cadrage avant de fusionner — si un terrain n'est pas bien centré, ajoute/corrige "
              "focal_x et focal_y (0.0 = bord gauche/haut, 1.0 = bord droit/bas) pour ce candidat "
              "dans le JSON d'entrée, supprime le .webp correspondant, et relance.")


if __name__ == "__main__":
    main()