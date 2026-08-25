#!/usr/bin/env python3
"""
Ajoute UNE photo Mapillary à UN terrain précis, sans avoir à éditer data/photos_mapillary.json à
la main — pour les ajouts ponctuels (photo reçue via le formulaire, que tu as uploadée toi-même
sur Mapillary, à associer au bon terrain).

Le script cherche le terrain par nom de rue ou de commune (récupéré en direct depuis
mapetanque.be, comme les autres scripts de ce dossier), te propose une liste à choisir, puis
ajoute la photo à ce terrain SANS toucher aux photos déjà associées à lui ou aux autres terrains
(fusion, jamais d'écrasement).

Usage :
    pip install requests
    python3 ajouter_photo_manuelle.py

Le fichier photos_mapillary.json (même dossier que ce script) est créé s'il n'existe pas encore,
ou complété s'il existe déjà. Une fois le script exécuté, pense à committer/pousser ce fichier
vers data/photos_mapillary.json de ton dépôt pour que le changement apparaisse sur le site.
"""

import json
import re

import requests

FICHIER_PHOTOS = "photos_mapillary.json"


def rechercher_terrains(terme):
    reponse = requests.get("https://mapetanque.be/data/terrains.geojson", timeout=30)
    reponse.raise_for_status()
    geojson = reponse.json()

    terme = terme.lower()
    resultats = []
    for feature in geojson["features"]:
        props = feature["properties"]
        nom = props.get("nearest_street") or ""
        commune = props.get("commune") or ""
        if terme in nom.lower() or terme in commune.lower():
            resultats.append(feature)
    return resultats


def charger_photos_existantes():
    try:
        with open(FICHIER_PHOTOS, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def extraire_id_mapillary(texte):
    """Accepte un ID brut collé tel quel, ou un lien complet mapillary.com/map/im/ID."""
    correspondance = re.search(r"(\d{10,})", texte)
    return correspondance.group(1) if correspondance else texte.strip()


def main():
    terme = input("Terme de recherche (nom de rue, commune...) : ").strip()
    if not terme:
        print("Terme vide, arrêt.")
        return

    print("Recherche en cours...")
    resultats = rechercher_terrains(terme)

    if not resultats:
        print("Aucun terrain trouvé pour ce terme.")
        return

    print(f"\n{len(resultats)} terrain(s) trouvé(s) :\n")
    for i, feature in enumerate(resultats, start=1):
        props = feature["properties"]
        nom = props.get("nearest_street") or "(sans nom de rue)"
        commune = props.get("commune") or "commune inconnue"
        osm_id = props.get("osm_id") or "SANS osm_id"
        print(f"  {i}. {nom} — {commune} ({osm_id})")

    choix = input("\nNuméro du terrain concerné : ").strip()
    try:
        index = int(choix) - 1
        if index < 0:
            raise ValueError
        feature_choisie = resultats[index]
    except (ValueError, IndexError):
        print("Choix invalide, arrêt.")
        return

    osm_id = feature_choisie["properties"].get("osm_id")
    if not osm_id:
        print("\nCe terrain n'a pas d'osm_id dans terrains.geojson (site pas encore régénéré")
        print("avec la version à jour de update_terrains.py ?) — impossible de l'associer")
        print("proprement, arrêt.")
        return

    id_ou_lien = input("ID Mapillary de la photo (ou lien mapillary.com/map/im/...) : ").strip()
    id_mapillary = extraire_id_mapillary(id_ou_lien)

    photos = charger_photos_existantes()
    photos.setdefault(osm_id, [])

    deja_present = any(p["mapillary_id"] == id_mapillary for p in photos[osm_id])
    if deja_present:
        print("\nCette photo est déjà associée à ce terrain, rien à faire.")
        return

    photos[osm_id].append({
        "mapillary_id": id_mapillary,
        "credit_url": f"https://www.mapillary.com/map/im/{id_mapillary}",
    })

    with open(FICHIER_PHOTOS, "w", encoding="utf-8") as f:
        json.dump(photos, f, ensure_ascii=False, indent=2)

    nom = feature_choisie["properties"].get("nearest_street") or "ce terrain"
    print(f"\nPhoto ajoutée pour {nom} ({osm_id}).")
    print(f"{nom} a maintenant {len(photos[osm_id])} photo(s) validée(s) au total.")
    print(f"\nN'oublie pas de committer/pousser {FICHIER_PHOTOS} (vers data/photos_mapillary.json)")
    print("pour que ça apparaisse sur le site.")


if __name__ == "__main__":
    main()
