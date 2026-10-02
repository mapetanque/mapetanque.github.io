"""
Rattrapage des miniatures des photos Mapillary plates : génère d'un coup celles qui manquent
(images/mapillary-plates/) et relève l'auteur de chaque photo, plates et vues 360°, dans
data/miniatures_plates.json. Le travail est fait par miniature_plate.py, le même module que la
phase « Miniatures plates » du workflow quotidien (publier_photos.py).

Reprend là où il s'est arrêté : une photo déjà faite est ignorée, sauf avec --refaire.

Usage (PowerShell, depuis la racine du dépôt, avec le .venv activé) :
    $env:MAPILLARY_TOKEN="MLY|..."
    python scripts/generer_miniatures_plates.py --limite 10     premier essai sur 10 photos
    python scripts/generer_miniatures_plates.py                 tout le reste
    python scripts/generer_miniatures_plates.py --refaire 1414852815730471
        refait une photo, par exemple après avoir ajouté "forcer" ou "position_y" à son
        entrée dans data/miniatures_plates.json (voir miniature_plate.py)
    python scripts/generer_miniatures_plates.py --simulation    liste ce qui serait fait
"""
import argparse
import json
import os
import sys

import miniature_plate

CHEMIN_PHOTOS = miniature_plate.RACINE / "data" / "photos_mapillary.json"


def main():
    analyseur = argparse.ArgumentParser(description=__doc__,
                                        formatter_class=argparse.RawDescriptionHelpFormatter)
    analyseur.add_argument("--limite", type=int, help="nombre maximal de photos traitées")
    analyseur.add_argument("--refaire", nargs="+", default=[], metavar="ID",
                           help="identifiant(s) Mapillary à régénérer même si déjà faits")
    analyseur.add_argument("--simulation", action="store_true",
                           help="liste ce qui serait fait, sans rien télécharger ni écrire")
    args = analyseur.parse_args()

    token = os.environ.get("MAPILLARY_TOKEN")
    if not token and not args.simulation:
        sys.exit("MAPILLARY_TOKEN absent de l'environnement.\n"
                 "PowerShell :  $env:MAPILLARY_TOKEN=\"MLY|...\"")

    with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
        plates, vues_360 = miniature_plate.ids_de_photos_mapillary(json.load(f))

    inconnus = [i for i in args.refaire if i not in plates]
    if inconnus:
        print("Pas des photos plates de photos_mapillary.json, ignorés : " + ", ".join(inconnus))

    faites, echecs = miniature_plate.completer(token, plates, vues_360, limite=args.limite,
                                               refaire=args.refaire, simulation=args.simulation)
    if not args.simulation:
        print(f"\nTerminé : {faites} photo(s) traitée(s), {echecs} échec(s).")
        print(f"Miniatures : {miniature_plate.DOSSIER}")
        print(f"Infos      : {miniature_plate.CHEMIN_INFOS}")


if __name__ == "__main__":
    main()
