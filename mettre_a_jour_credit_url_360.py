"""
Met à jour les credit_url des entrées 360° déjà présentes dans data/photos_mapillary.json, avec
les nouvelles valeurs (incluant x/y/zoom) de resultat_batch_360.json — sans toucher au reste
(mapillary_id, miniature_locale restent identiques, et tous les autres terrains/photos du
fichier ne sont pas touchés).

Usage :
    python3 mettre_a_jour_credit_url_360.py resultat_batch_360.json data/photos_mapillary.json

Réécrit data/photos_mapillary.json en place (une sauvegarde .bak est créée avant).
"""
import sys
import json
import shutil


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    chemin_resultat, chemin_photos = sys.argv[1], sys.argv[2]

    with open(chemin_resultat, encoding="utf-8") as f:
        resultat = json.load(f)

    shutil.copy(chemin_photos, chemin_photos + ".bak")
    print(f"Sauvegarde créée : {chemin_photos}.bak")

    with open(chemin_photos, encoding="utf-8") as f:
        photos = json.load(f)

    mis_a_jour = 0
    introuvables = []

    for osm_id, entrees_360 in resultat.get("reussis", {}).items():
        if osm_id not in photos:
            introuvables.append(osm_id)
            continue

        for entree_360 in entrees_360:
            mapillary_id = entree_360["mapillary_id"]
            trouve = False
            for entree_existante in photos[osm_id]:
                if entree_existante.get("mapillary_id") == mapillary_id:
                    entree_existante["credit_url"] = entree_360["credit_url"]
                    mis_a_jour += 1
                    trouve = True
                    break
            if not trouve:
                introuvables.append(f"{osm_id} ({mapillary_id})")

    with open(chemin_photos, "w", encoding="utf-8") as f:
        json.dump(photos, f, ensure_ascii=False, indent=2)

    print(f"\n{mis_a_jour} credit_url mis à jour.")
    if introuvables:
        print(f"\n⚠️  {len(introuvables)} entrée(s) du resultat non trouvée(s) dans "
              f"photos_mapillary.json (pas encore fusionnées ? déjà supprimées ?) :")
        for x in introuvables:
            print(f"  {x}")


if __name__ == "__main__":
    main()
