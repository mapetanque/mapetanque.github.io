#!/usr/bin/env python3
"""
Ajoute un champ "commune" à chaque entrée de data/clubs.json, via géocodage inversé Nominatim
à partir des coordonnées GPS déjà présentes (lat/lon), avec exactement la même logique
d'extraction que recuperer_infos_adresse() dans scripts/update_terrains.py (repli
city > town > village > municipality) — pour garantir des noms de commune strictement
cohérents avec ceux déjà utilisés pour regrouper les terrains dans la liste des pages province.

Respecte la limite d'1 requête/seconde de Nominatim, avec le même en-tête User-Agent que les
autres scripts du projet. Écrit le fichier de sortie après chaque club (pas seulement à la fin),
et le script est reprenable : s'il est interrompu puis relancé avec le même fichier de sortie,
il saute les clubs qui ont déjà une commune renseignée plutôt que de tout refaire.

Rien n'est inventé : si Nominatim ne renvoie aucune des 4 clés attendues pour un club, son champ
"commune" est laissé à null (comme "a_verifier" pour geocoder_clubs.py) plutôt que de deviner.

Usage :
    pip install requests
    python3 club/geocoder_communes_clubs.py data/clubs.json data/clubs.json

    (le fichier d'entrée et de sortie peuvent être les mêmes : le script charge tout en mémoire
    avant d'écrire, donc pas de risque de lire un fichier à moitié écrit)
"""

import json
import sys
import time

import requests

NOMINATIM_HEADERS = {
    "User-Agent": "Mapetanque/1.0 (contact: mapetanque@outlook.be)"
}


def recuperer_commune(lat, lon):
    """Interroge Nominatim (géocodage inversé) et retourne le nom de commune, ou None."""
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "format": "jsonv2",
                "lat": lat,
                "lon": lon,
                "zoom": 17,
                "addressdetails": 1,
            },
            headers=NOMINATIM_HEADERS,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        print(f"  [erreur réseau] {lat},{lon} -> {exc}")
        return None

    adresse = data.get("address", {})

    return (
        adresse.get("city")
        or adresse.get("town")
        or adresse.get("village")
        or adresse.get("municipality")
    )


def main():
    if len(sys.argv) != 3:
        print("Usage : python3 geocoder_communes_clubs.py entree.json sortie.json")
        sys.exit(1)

    chemin_entree, chemin_sortie = sys.argv[1], sys.argv[2]

    with open(chemin_entree, encoding="utf-8") as f:
        clubs = json.load(f)

    # Reprise : si le fichier de sortie existe déjà (ex. relance après interruption) et qu'il
    # contient déjà une commune pour un club (même nom + coordonnées), on ne le regéocode pas.
    communes_deja_connues = {}
    try:
        with open(chemin_sortie, encoding="utf-8") as f:
            for club in json.load(f):
                if club.get("commune"):
                    cle = (club["name"], round(club["lat"], 6), round(club["lon"], 6))
                    communes_deja_connues[cle] = club["commune"]
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    total = len(clubs)
    for i, club in enumerate(clubs, start=1):
        cle = (club["name"], round(club["lat"], 6), round(club["lon"], 6))

        if cle in communes_deja_connues:
            club["commune"] = communes_deja_connues[cle]
            print(f"[{i}/{total}] {club['name']} -> {club['commune']} (déjà connu, ignoré)")
            continue

        commune = recuperer_commune(club["lat"], club["lon"])
        club["commune"] = commune

        with open(chemin_sortie, "w", encoding="utf-8") as f_out:
            json.dump(clubs, f_out, ensure_ascii=False, indent=2)

        statut = commune if commune else "AUCUNE COMMUNE TROUVÉE — à vérifier manuellement"
        print(f"[{i}/{total}] {club['name']} -> {statut}")

        # Respect de la limite Nominatim : max. 1 requête par seconde
        time.sleep(1)

    manquants = [c["name"] for c in clubs if not c.get("commune")]
    print(f"\nTerminé. Résultat écrit dans {chemin_sortie}.")
    if manquants:
        print(f"\n{len(manquants)} club(s) sans commune trouvée, à vérifier manuellement :")
        for nom in manquants:
            print(f"  - {nom}")


if __name__ == "__main__":
    main()