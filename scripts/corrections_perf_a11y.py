"""
Corrections de performance et d'accessibilité sur les fichiers HTML du site.

Trois opérations :

  1. Épinglage des versions de Leaflet et Leaflet.markercluster.
     Les URL unpkg sans numéro de version servent toujours la dernière publiée. Leaflet 2.0,
     actuellement en préparation, apporte des ruptures d'API : le jour de sa sortie stable, le
     site basculerait dessus tout seul, sans qu'aucune ligne de code n'ait changé ici. On fige
     donc sur les versions actuellement en production, 1.9.4 et 1.5.3.

  2. Dimensions intrinsèques du logo.
     <img src="/images/logo.svg" class="logo"> n'a ni width ni height. Le navigateur ne peut
     donc pas réserver la place avant d'avoir chargé l'image, ce qui décale le contenu au
     chargement. Le CSS impose de toute façon la taille affichée ; ces attributs ne servent
     qu'à donner le rapport de forme, carré ici.

  3. Titre principal de la page d'accueil.
     Le titre « Trouvez un terrain de pétanque public » est un <p>, si bien que l'accueil n'a
     aucun <h1> — contrairement à toutes les autres pages. C'est pénalisant pour les lecteurs
     d'écran comme pour le référencement. La classe .hero-headline fixant déjà taille, graisse
     et marges, le rendu ne change pas.

À lancer depuis la racine du dépôt :
    python scripts/corrections_perf_a11y.py            (aperçu, n'écrit rien)
    python scripts/corrections_perf_a11y.py --ecrire   (applique les modifications)
"""

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ECRIRE = "--ecrire" in sys.argv

VERSION_LEAFLET = "1.9.4"
VERSION_CLUSTER = "1.5.3"

# (motif, remplacement, libellé)
REMPLACEMENTS = [
    (
        re.compile(r'https://unpkg\.com/leaflet/dist/leaflet\.(js|css)'),
        lambda m: f"https://unpkg.com/leaflet@{VERSION_LEAFLET}/dist/leaflet.{m.group(1)}",
        "leaflet",
    ),
    (
        re.compile(r'https://unpkg\.com/leaflet\.markercluster/dist/([\w.]+)'),
        lambda m: (f"https://unpkg.com/leaflet.markercluster@{VERSION_CLUSTER}"
                   f"/dist/{m.group(1)}"),
        "markercluster",
    ),
    (
        re.compile(r'(<img src="/images/logo\.svg" class="logo")(\s|>)'),
        lambda m: f'{m.group(1)} width="32" height="32"{m.group(2)}',
        "logo",
    ),
    (
        re.compile(r'<p class="hero-headline"([^>]*)>(.*?)</p>', re.S),
        lambda m: f'<h1 class="hero-headline"{m.group(1)}>{m.group(2)}</h1>',
        "h1_accueil",
    ),
]


def main():
    fichiers = sorted(
        f for f in RACINE.rglob("*.html")
        if ".git" not in f.parts and "node_modules" not in f.parts
    )
    if not fichiers:
        raise SystemExit("Aucun fichier HTML trouvé — lancer le script depuis la racine.")

    total = {libelle: 0 for _, _, libelle in REMPLACEMENTS}
    modifies = 0

    for fichier in fichiers:
        with open(fichier, encoding="utf-8", newline="") as f:
            src = f.read()
        origine = src

        for motif, remplacement, libelle in REMPLACEMENTS:
            src, n = motif.subn(remplacement, src)
            total[libelle] += n

        if src != origine:
            modifies += 1
            if ECRIRE:
                with open(fichier, "w", encoding="utf-8", newline="") as f:
                    f.write(src)

    print(f"{len(fichiers)} fichiers HTML examinés, {modifies} à modifier.\n")
    print(f"  URL Leaflet épinglées en {VERSION_LEAFLET}        : {total['leaflet']}")
    print(f"  URL markercluster épinglées en {VERSION_CLUSTER} : {total['markercluster']}")
    print(f"  Logos dotés de width/height              : {total['logo']}")
    print(f"  Titres d'accueil passés en <h1>          : {total['h1_accueil']}")

    if ECRIRE:
        print("\nModifications écrites.")
    else:
        print("\nAperçu uniquement, aucun fichier modifié.")
        print("Relancer avec --ecrire pour appliquer.")


if __name__ == "__main__":
    main()
