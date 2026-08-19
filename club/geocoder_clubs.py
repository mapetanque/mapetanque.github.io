#!/usr/bin/env python3
"""
Géocode le fichier clubs_petanque_belgique.csv (colonnes code;nom;province;region;adresse)
via Nominatim, et écrit un fichier de sortie avec deux colonnes ajoutées : latitude, longitude,
plus une colonne "type_resultat" (précision du résultat renvoyé par Nominatim : "house" = numéro
précis trouvé, "road"/"street" = rue trouvée mais pas le numéro, etc.) et une colonne
"a_verifier" pour repérer les adresses pour lesquelles Nominatim n'a pas trouvé de résultat
précis (rien n'est inventé : ces lignes restent vides plutôt que de deviner des coordonnées).

Respecte la limite d'1 requête/seconde de Nominatim, avec le même en-tête User-Agent que
scripts/update_terrains.py. Écrit une ligne à la fois (pas seulement à la fin), pour ne rien
perdre en cas d'interruption.

Usage :
    pip install requests
    python3 geocoder_clubs.py clubs_petanque_belgique.csv clubs_petanque_belgique_geocodes.csv
"""

import csv
import sys
import time

import requests

NOMINATIM_HEADERS = {
    "User-Agent": "Mapetanque/1.0 (contact: mapetanque@outlook.be)"
}


def geocoder_adresse(adresse, code_postal_attendu=None):
    """Interroge Nominatim (géocodage direct) pour une adresse belge. Retourne un dict avec
    lat, lon, type_resultat, a_verifier (booléen) — ou None partout si rien n'est trouvé."""
    resultat = {"lat": None, "lon": None, "type_resultat": None, "a_verifier": True}

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": f"{adresse}, Belgique",
                "format": "jsonv2",
                "limit": 1,
                "addressdetails": 1,
            },
            headers=NOMINATIM_HEADERS,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        print(f"  [erreur réseau] {adresse} -> {exc}")
        return resultat

    if not data:
        return resultat

    top = data[0]
    resultat["lat"] = top.get("lat")
    resultat["lon"] = top.get("lon")

    # "class"/"type" Nominatim (ex. "building"/"house", "highway"/"residential") donnent une
    # idée de la précision. On dérive un type_resultat simplifié pour trier facilement ensuite.
    osm_class = top.get("class", "")
    osm_type = top.get("type", "")
    resultat["type_resultat"] = f"{osm_class}/{osm_type}"

    # Heuristique de confiance : si Nominatim renvoie un code postal dans son adresse détaillée
    # et qu'il correspond à celui de l'adresse d'origine, on considère le résultat fiable.
    # Sinon (pas de code postal en commun, ou résultat trop générique comme une ville entière),
    # on marque la ligne "à vérifier" plutôt que de l'accepter silencieusement.
    cp_resultat = top.get("address", {}).get("postcode")
    precis = osm_class in ("building", "place") or osm_type in ("house", "yes")
    cp_coherent = (
        code_postal_attendu is not None
        and cp_resultat is not None
        and code_postal_attendu in cp_resultat
    )
    resultat["a_verifier"] = not (precis and cp_coherent)

    return resultat


def extraire_code_postal(adresse):
    """Extrait le premier nombre à 4 chiffres de l'adresse (convention belge), ou None."""
    import re

    m = re.search(r"\b(\d{4})\b", adresse)
    return m.group(1) if m else None


def main():
    if len(sys.argv) != 3:
        print("Usage : python3 geocoder_clubs.py entree.csv sortie.csv")
        sys.exit(1)

    chemin_entree, chemin_sortie = sys.argv[1], sys.argv[2]

    with open(chemin_entree, encoding="utf-8") as f:
        lecteur = csv.DictReader(f, delimiter=";")
        lignes = list(lecteur)

    champs_sortie = list(lignes[0].keys()) + ["latitude", "longitude", "type_resultat", "a_verifier"]

    with open(chemin_sortie, "w", encoding="utf-8", newline="") as f_out:
        ecrivain = csv.DictWriter(f_out, fieldnames=champs_sortie, delimiter=";")
        ecrivain.writeheader()

        for i, ligne in enumerate(lignes, start=1):
            adresse = ligne["adresse"]
            code_postal = extraire_code_postal(adresse)

            resultat = geocoder_adresse(adresse, code_postal)

            ligne_sortie = dict(ligne)
            ligne_sortie["latitude"] = resultat["lat"] or ""
            ligne_sortie["longitude"] = resultat["lon"] or ""
            ligne_sortie["type_resultat"] = resultat["type_resultat"] or ""
            ligne_sortie["a_verifier"] = "oui" if resultat["a_verifier"] else ""

            ecrivain.writerow(ligne_sortie)
            f_out.flush()

            statut = "à vérifier" if resultat["a_verifier"] else "ok"
            print(f"[{i}/{len(lignes)}] {ligne['nom']} -> {resultat['lat']}, {resultat['lon']} ({statut})")

            # Respect de la limite Nominatim : max. 1 requête par seconde
            time.sleep(1)

    print(f"\nTerminé. Résultat écrit dans {chemin_sortie}.")


if __name__ == "__main__":
    main()