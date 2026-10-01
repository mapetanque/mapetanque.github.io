"""
Groupes de terrains voisins -> data/groupes_terrains.json

Dans OSM, plusieurs pistes côte à côte sont souvent cartographiées comme autant de terrains. Pour
un joueur, c'est pourtant un seul endroit : une note, un critère confirmé (« Plusieurs pistes »,
« Ombragé »…) ou un avis déposé sur une piste vaut pour ses voisines. Ce script repère ces groupes ;
le cumul se fait à la lecture (script.js, admin.html, promouvoir_terrains.py), si bien que les
données déjà déposées en profitent aussi, sans rien changer dans la base.

Deux terrains sont voisins si leurs centres sont à SEUIL_METRES au plus ; un groupe se forme de
proche en proche (une rangée de dix pistes forme un seul groupe, même longue de 80 m). Le seuil de
25 m couvre les pistes accolées ou séparées d'une allée, sans réunir deux terrains distincts d'un
même parc (mesuré en octobre 2026 : 597 terrains en 241 groupes, le plus étendu fait 74 m).

Sortie : liste de groupes, chacun une liste d'osm_id triée ; les terrains isolés n'y figurent pas.
Relancé par le workflow hebdomadaire (update-osm.yml), juste après update_terrains.py.
"""

import json
import math
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHEMIN_TERRAINS = os.path.join(RACINE, "data", "terrains.geojson")
CHEMIN_SORTIE = os.path.join(RACINE, "data", "groupes_terrains.json")

SEUIL_METRES = 25


def distance_metres(lon1, lat1, lon2, lat2):
    # Équirectangulaire : largement assez précis à quelques dizaines de mètres.
    x = (lon2 - lon1) * 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    y = (lat2 - lat1) * 110540
    return math.hypot(x, y)


def calculer_groupes(features, seuil=SEUIL_METRES):
    """Liste des groupes (listes d'osm_id triées) de deux terrains ou plus."""
    points = []
    for f in features:
        osm_id = f["properties"].get("osm_id")
        lon, lat = f["geometry"]["coordinates"][:2]
        if osm_id:
            points.append((lat, lon, osm_id))
    # Tri par latitude : on ne compare chaque terrain qu'aux suivants assez proches en latitude.
    points.sort()

    parent = list(range(len(points)))

    def racine(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    ecart_lat = seuil / 110540
    for i, (lat1, lon1, _) in enumerate(points):
        for j in range(i + 1, len(points)):
            lat2, lon2, _ = points[j]
            if lat2 - lat1 > ecart_lat:
                break
            if distance_metres(lon1, lat1, lon2, lat2) <= seuil:
                parent[racine(i)] = racine(j)

    groupes = {}
    for i, (_, _, osm_id) in enumerate(points):
        groupes.setdefault(racine(i), []).append(osm_id)
    return sorted(sorted(g) for g in groupes.values() if len(g) > 1)


def charger_groupes():
    """osm_id -> liste des osm_id de son groupe (absent pour un terrain isolé)."""
    try:
        with open(CHEMIN_SORTIE, encoding="utf-8") as f:
            groupes = json.load(f)
    except (OSError, ValueError):
        return {}
    return {osm_id: groupe for groupe in groupes for osm_id in groupe}


def main():
    with open(CHEMIN_TERRAINS, encoding="utf-8") as f:
        features = json.load(f)["features"]

    groupes = calculer_groupes(features)

    # Un groupe par ligne : fichier compact mais lisible, et des différences git claires.
    lignes = ",\n".join("  " + json.dumps(g) for g in groupes)
    with open(CHEMIN_SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + lignes + "\n]\n")

    print(f"{len(groupes)} groupe(s) de terrains voisins ({sum(map(len, groupes))} terrains) "
          f"écrit(s) dans {os.path.basename(CHEMIN_SORTIE)}")


if __name__ == "__main__":
    main()
