"""
Promotion automatique des terrains bien notés vers le carrousel « Les plus beaux terrains ».

Lancé chaque semaine par le workflow GitHub Actions, juste après update_terrains.py (qui vient de
rafraîchir data/terrains.geojson).

Usage :
    python scripts/promouvoir_terrains.py

Pour chaque terrain noté par les visiteurs (lu sur le Worker Cloudflare, route /notes) :
  - écarte les épinglés (déjà dans data/beaux_terrains.json) ;
  - garde ceux qui ont au moins NB_VOTES_MIN votes et une moyenne d'au moins MOYENNE_MIN ;
  - exige une photo validée dans data/photos_mapillary.json (la première de la liste) ;
  - génère sa miniature carrée si elle n'existe pas encore :
      * photo classique : téléchargée via l'API Mapillary et recadrée, exactement comme
        generer_miniatures_carrees.py — ses fonctions sont réutilisées telles quelles ;
      * photo 360° (champ miniature_locale) : la vue déjà reprojetée, présente dans le dépôt,
        est simplement recadrée en carré — aucun appel réseau ;
  - écrit TOUS les terrains retenus dans data/terrains_promus.json, SANS plafond.

Le plafond (18 par région), le départage avec les épinglés et le retrait d'un terrain dont la
moyenne est retombée sont faits par beaux-terrains.js au chargement de la page, avec les notes du
moment : ce fichier n'est qu'une liste de candidats, pas l'affichage final.

Recadrage centré, sans retouche. Pour corriger un cadrage raté, ajouter focal_x / focal_y et
"forcer": true pour ce terrain dans une liste passée à generer_miniatures_carrees.py, comme pour
les épinglés : le fichier régénéré porte le même nom et remplace l'automatique.

Échecs tolérés : Worker injoignable = fichier laissé tel quel ; photo qui ne se télécharge pas =
terrain ignoré cette semaine, retenté à la suivante. Rien ici ne doit bloquer la mise à jour OSM.
"""
import json
import sys
import time
import pathlib

import requests
from PIL import Image

# Réutilisation directe du script existant plutôt qu'une copie : même taille de sortie, même
# algorithme de recadrage, même dossier. Importable grâce à son garde if __name__ == "__main__".
# Python ajoute le dossier du script lancé (scripts/) à sys.path, donc l'import fonctionne depuis
# la racine du dépôt comme depuis scripts/.
from generer_miniatures_carrees import telecharger_photo, recadrer_carre, DOSSIER_SORTIE

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

PAUSE_ENTRE_APPELS_S = 1.0   # vers l'API Mapillary, par politesse (même valeur que l'autre script)

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


def assurer_miniature(photo):
    """Retourne le chemin web de la miniature carrée, en la générant si besoin. None en cas
    d'échec : le terrain est alors simplement ignoré cette semaine."""
    mapillary_id = photo["mapillary_id"]
    chemin_disque = pathlib.Path(DOSSIER_SORTIE) / f"{mapillary_id}.webp"
    chemin_web = f"/images/miniatures-carrees/{mapillary_id}.webp"

    # Déjà présente (générée une semaine précédente, ou à la main pour un ancien épinglé) :
    # on ne la touche pas — c'est aussi ce qui protège un recadrage corrigé à la main.
    if chemin_disque.exists():
        return chemin_web

    try:
        if photo.get("miniature_locale"):
            source = RACINE / photo["miniature_locale"].lstrip("/")
            img = Image.open(source).convert("RGB")
        else:
            img = telecharger_photo(mapillary_id)
            time.sleep(PAUSE_ENTRE_APPELS_S)

        chemin_disque.parent.mkdir(parents=True, exist_ok=True)
        recadrer_carre(img).save(chemin_disque, quality=88)
        print(f"  + miniature générée : {chemin_web}")
        return chemin_web

    except Exception as e:
        print(f"  ! miniature impossible pour {mapillary_id} : {e}")
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

    promus = []
    for osm_id, valeurs in notes.items():
        try:
            somme, nombre = int(valeurs[0]), int(valeurs[1])
        except (TypeError, ValueError, IndexError):
            continue

        if osm_id in epingles:
            continue
        if nombre < NB_VOTES_MIN or somme / nombre < MOYENNE_MIN:
            continue

        feature = terrains.get(osm_id)
        if not feature:
            print(f"  - {osm_id} : plus dans terrains.geojson (retiré d'OSM ?), ignoré")
            continue

        liste_photos = photos.get(osm_id) or []
        if not liste_photos:
            print(f"  - {osm_id} : bien noté mais sans photo validée, ignoré")
            continue

        miniature = assurer_miniature(liste_photos[0])
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
            "nom": p.get("name") or p.get("nearest_street") or "",
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
