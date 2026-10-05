"""
Promotion automatique des terrains bien notés vers le carrousel « Les plus beaux terrains ».

Lancé chaque semaine par le workflow GitHub Actions, juste après update_terrains.py (qui vient de
rafraîchir data/terrains.geojson).

Usage :
    python scripts/promouvoir_terrains.py

Pour chaque terrain noté par les visiteurs (lu sur le Worker Cloudflare, route /notes), votes des
pistes voisines cumulés (data/groupes_terrains.json, voir grouper_terrains.py) :
  - écarte les épinglés (déjà dans data/beaux_terrains.json), et leurs pistes voisines ;
  - garde ceux qui ont au moins NB_VOTES_MIN votes et une moyenne d'au moins MOYENNE_MIN ;
  - exige une photo validée dans data/photos_mapillary.json (la première de la liste) ; une seule
    piste par groupe est promue, la plus notée parmi celles qui ont une photo ;
  - reprend sa miniature 16:9, déjà dans le dépôt :
      * photo 360° : sa miniature_locale (images/mapillary-360/) ;
      * photo plate : images/mapillary-plates/<id>.webp, générée par le workflow quotidien de
        publication des photos (voir miniature_plate.py). Pas encore faite : terrain ignoré
        cette semaine, repris la suivante.
    Les tuiles du carrousel sont en 4:3 : elles coupent les bords de la miniature
    (object-fit: cover dans style-beaux-terrains.css) ;
  - écrit TOUS les terrains retenus dans data/terrains_promus.json, SANS plafond.

Le plafond (18 par région), le départage avec les épinglés et le retrait d'un terrain dont la
moyenne est retombée sont faits par beaux-terrains.js au chargement de la page, avec les notes du
moment : ce fichier n'est qu'une liste de candidats, pas l'affichage final.

Pour corriger un cadrage raté : voir les réglages manuels décrits dans miniature_plate.py.

Échecs tolérés : Worker injoignable = fichier laissé tel quel. Rien ici ne doit bloquer la mise à
jour OSM. Aucun appel à l'API Mapillary : ce script n'écrit aucune image.
"""
import json
import sys
import pathlib

import requests

# Python ajoute le dossier du script lancé (scripts/) à sys.path, donc ces imports fonctionnent
# depuis la racine du dépôt comme depuis scripts/.
from grouper_terrains import charger_groupes
from miniature_plate import chemin_miniature, chemin_web

RACINE = pathlib.Path(__file__).resolve().parent.parent
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"
CHEMIN_PHOTOS = RACINE / "data" / "photos_mapillary.json"
CHEMIN_EPINGLES = RACINE / "data" / "beaux_terrains.json"
CHEMIN_SORTIE = RACINE / "data" / "terrains_promus.json"

URL_NOTES = "https://mapetanque-notes.mapetanque.workers.dev/notes"

# Mêmes valeurs que dans beaux-terrains.js : si l'une change, changer l'autre.
NB_VOTES_MIN = 2
MOYENNE_MIN = 4.0
NOTE_A_PRIORI = 4.0   # moyenne pondérée : (somme + NOTE_A_PRIORI × POIDS) / (nombre + POIDS)
POIDS_A_PRIORI = 5

# terrains.geojson porte des identifiants ("flandre_orientale"), beaux_terrains.json des noms
# lisibles ("Flandre orientale") : les promus prennent le format des épinglés, pour que
# beaux-terrains.js les traite sans distinction (fil d'Ariane traduit compris).
REGIONS = {"wallonie": "Wallonie", "flandre": "Flandre", "bruxelles": "Bruxelles"}
PROVINCES = {
    "brabant_wallon": "Brabant wallon", "hainaut": "Hainaut", "liege": "Liège",
    "luxembourg": "Luxembourg", "namur": "Namur", "anvers": "Anvers",
    "brabant_flamand": "Brabant flamand", "limbourg": "Limbourg",
    "flandre_orientale": "Flandre orientale", "flandre_occidentale": "Flandre occidentale",
}


def charger_json(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def score_pondere(somme, nombre):
    return (somme + NOTE_A_PRIORI * POIDS_A_PRIORI) / (nombre + POIDS_A_PRIORI)


def miniature_de(photo):
    """Chemin web de la miniature 16:9 de la photo, ou None si elle n'est pas encore dans le
    dépôt : le terrain est alors simplement ignoré cette semaine."""
    if photo.get("miniature_locale"):
        if (RACINE / photo["miniature_locale"].lstrip("/")).exists():
            return photo["miniature_locale"]
    elif chemin_miniature(photo["mapillary_id"]).exists():
        return chemin_web(photo["mapillary_id"])
    print(f"  ! pas encore de miniature pour la photo {photo['mapillary_id']}")
    return None


def main():
    try:
        reponse = requests.get(URL_NOTES, timeout=20)
        reponse.raise_for_status()
        notes = reponse.json()
        if not isinstance(notes, dict):
            raise ValueError(f"réponse inattendue : {str(notes)[:200]}")
    except Exception as e:
        print(f"Worker injoignable, {CHEMIN_SORTIE.name} laissé tel quel : {e}")
        return 0

    terrains = {f["properties"]["osm_id"]: f for f in charger_json(CHEMIN_TERRAINS)["features"]}
    photos = charger_json(CHEMIN_PHOTOS)
    epingles = {t.get("osm_id") for t in charger_json(CHEMIN_EPINGLES)}

    # Votes cumulés par groupe de pistes voisines, comme sur le site (script.js).
    groupe_de = charger_groupes()
    cumuls = {}     # tuple des osm_id du groupe -> [somme, nombre]
    votes_piste = {}
    for osm_id, valeurs in notes.items():
        try:
            somme, nombre = int(valeurs[0]), int(valeurs[1])
        except (TypeError, ValueError, IndexError):
            continue
        votes_piste[osm_id] = nombre
        cumul = cumuls.setdefault(tuple(groupe_de.get(osm_id, [osm_id])), [0, 0])
        cumul[0] += somme
        cumul[1] += nombre

    promus = []
    for groupe, (somme, nombre) in cumuls.items():
        if any(m in epingles for m in groupe):
            continue
        if nombre < NB_VOTES_MIN or somme / nombre < MOYENNE_MIN:
            continue

        presents = [m for m in groupe if m in terrains]
        if not presents:
            print(f"  - {', '.join(groupe)} : plus dans terrains.geojson (retiré d'OSM ?), ignoré")
            continue

        # Une seule piste du groupe dans le carrousel : la plus notée parmi celles qui ont une photo.
        presents.sort(key=lambda m: votes_piste.get(m, 0), reverse=True)
        osm_id = next((m for m in presents if photos.get(m)), None)
        if not osm_id:
            print(f"  - {presents[0]} : bien noté mais sans photo validée, ignoré")
            continue

        feature = terrains[osm_id]
        liste_photos = photos[osm_id]

        miniature = miniature_de(liste_photos[0])
        if not miniature:
            continue

        p = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"]
        region = REGIONS.get(p.get("region"), p.get("region") or "")
        # Bruxelles : même convention que les épinglés, province = région (le fil d'Ariane du
        # carrousel l'omet alors, au lieu d'afficher « Bruxelles › Bruxelles »).
        province = region if p.get("region") == "bruxelles" else PROVINCES.get(p.get("province"), "")

        promus.append({
            "osm_id": osm_id,
            # Rue seule, comme les épinglés et le titre de la fiche : le nom OSM est ignoré.
            "nom": p.get("nearest_street") or "",
            "commune": p.get("commune") or "",
            "province": province,
            "region": region,
            "lat": lat,
            "lon": lon,
            "miniature": miniature,
            # Instantané des votes au moment du job : sert au carrousel tant que les notes en
            # direct ne sont pas encore arrivées, pour éviter que les promus n'apparaissent
            # qu'une fraction de seconde après les épinglés.
            "votes": [somme, nombre],
        })

    # Ordre du fichier sans effet sur l'affichage (le carrousel retrie en direct) : le tri par
    # score le rend simplement lisible quand on l'ouvre.
    promus.sort(key=lambda t: score_pondere(*t["votes"]), reverse=True)

    with open(CHEMIN_SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(promus, ensure_ascii=False, indent=2) + "\n")

    print(f"{len(promus)} terrain(s) promu(s) écrit(s) dans {CHEMIN_SORTIE.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
