"""
Vérifie que chaque photo référencée dans data/photos_mapillary.json existe toujours côté
Mapillary, et produit un rapport des entrées à corriger.

Deux contrôles successifs :
  1. Format  — un identifiant Mapillary valide est un nombre de 15 ou 16 chiffres. Tout ce qui
     s'en écarte (identifiant tronqué, URL mal découpée par extraireIdMapillary, caractère
     isolé) est signalé sans même interroger l'API.
  2. Existence — pour les identifiants bien formés, on demande la photo à l'API Graph. Une
     photo supprimée par son auteur, ou rendue privée, répond en erreur : c'est le seul moyen
     de détecter le cas d'une image qui a disparu après coup.

Usage (depuis la racine du dépôt) :
    set MAPILLARY_TOKEN=MLY|xxxx        (Windows, cmd)
    $env:MAPILLARY_TOKEN="MLY|xxxx"     (Windows, PowerShell)
    export MAPILLARY_TOKEN=MLY|xxxx     (Linux/macOS)
    python scripts/verifier_photos_mapillary.py

Le rapport est écrit dans photos_a_corriger.md, à la racine.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Chemins résolus par rapport à l'emplacement du script, pas au dossier courant : lancer le
# script depuis scripts/ ou depuis la racine doit donner exactement le même résultat.
RACINE = Path(__file__).resolve().parent.parent
CHEMIN_PHOTOS = RACINE / "data" / "photos_mapillary.json"
CHEMIN_TERRAINS = RACINE / "data" / "terrains.geojson"
CHEMIN_RAPPORT = RACINE / "photos_a_corriger.md"

# Un identifiant Mapillary est un entier de 15 ou 16 chiffres, sans zéro initial.
FORMAT_ID = re.compile(r"^[1-9]\d{14,15}$")

# Délai entre deux appels : l'API tolère un rythme soutenu, mais rien ne presse ici et mieux
# vaut rester poli avec un service gratuit.
DELAI_ENTRE_APPELS = 0.12


def charger_token():
    token = os.environ.get("MAPILLARY_TOKEN")
    if not token:
        sys.exit(
            "MAPILLARY_TOKEN absent de l'environnement.\n"
            "PowerShell :  $env:MAPILLARY_TOKEN=\"MLY|...\"\n"
            "cmd        :  set MAPILLARY_TOKEN=MLY|...\n"
            "bash       :  export MAPILLARY_TOKEN=MLY|..."
        )
    return token


def charger_noms_terrains():
    """osm_id -> libellé lisible, pour que le rapport soit exploitable directement."""
    if not CHEMIN_TERRAINS.exists():
        return {}
    with open(CHEMIN_TERRAINS, encoding="utf-8") as f:
        geo = json.load(f)
    noms = {}
    for feature in geo["features"]:
        p = feature["properties"]
        rue = p.get("nearest_street") or "Terrain"
        commune = p.get("commune") or ""
        noms[p["osm_id"]] = f"{rue} ({commune})" if commune else rue
    return noms


def photo_existe(identifiant, token):
    """
    Interroge l'API Graph. Renvoie (True, "") si la photo existe, (False, motif) sinon.
    Le champ demandé est réduit au strict minimum : on veut juste savoir si l'objet répond.
    """
    url = (
        f"https://graph.mapillary.com/{identifiant}"
        f"?access_token={token}&fields=id"
    )
    requete = urllib.request.Request(url, headers={"User-Agent": "Mapetanque/1.0"})
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            donnees = json.loads(reponse.read().decode("utf-8"))
            return (bool(donnees.get("id")), "")
    except urllib.error.HTTPError as e:
        # 400 et 404 signifient typiquement "cet identifiant ne correspond à rien".
        return (False, f"HTTP {e.code}")
    except urllib.error.URLError as e:
        return (False, f"réseau : {e.reason}")
    except json.JSONDecodeError:
        return (False, "réponse illisible")


def main():
    token = charger_token()
    noms = charger_noms_terrains()

    with open(CHEMIN_PHOTOS, encoding="utf-8") as f:
        photos = json.load(f)

    total = sum(len(v) for v in photos.values())
    print(f"{len(photos)} terrains, {total} photos à vérifier.\n")

    format_invalide = []
    introuvables = []
    verifiees = 0

    for osm_id, entrees in photos.items():
        for entree in entrees:
            identifiant = str(entree.get("mapillary_id", ""))
            libelle = noms.get(osm_id, "terrain inconnu")
            local = bool(entree.get("miniature_locale"))

            if not FORMAT_ID.match(identifiant):
                format_invalide.append((osm_id, libelle, identifiant, local))
                print(f"  format  {identifiant!r:20} {libelle}")
                continue

            existe, motif = photo_existe(identifiant, token)
            verifiees += 1
            if not existe:
                introuvables.append((osm_id, libelle, identifiant, local, motif))
                print(f"  absente {identifiant} {libelle}  ({motif})")

            time.sleep(DELAI_ENTRE_APPELS)

            if verifiees % 50 == 0:
                print(f"  … {verifiees} identifiants interrogés")

    # ---- Rapport ----------------------------------------------------------------------
    lignes = ["# Photos Mapillary à corriger", ""]
    lignes.append(
        f"{total} photos examinées sur {len(photos)} terrains. "
        f"{len(format_invalide)} au format invalide, {len(introuvables)} introuvables côté Mapillary."
    )
    lignes.append("")
    lignes.append(
        "La colonne *360°* indique qu'une miniature locale existe déjà pour cette entrée : "
        "l'image reste alors affichée correctement sur le site, seul le lien de crédit est cassé."
    )
    lignes.append("")

    def tableau(titre, rangs, avec_motif=False):
        lignes.append(f"## {titre}")
        lignes.append("")
        entete = "| ✓ | Terrain | osm_id | Identifiant | 360° |"
        sep = "|---|---------|--------|-------------|------|"
        if avec_motif:
            entete += " Motif |"
            sep += "-------|"
        lignes.append(entete)
        lignes.append(sep)
        for rang in rangs:
            osm_id, libelle, identifiant, local = rang[:4]
            kind, num = osm_id.split("/")
            lien = f"[{osm_id}](https://www.openstreetmap.org/{kind}/{num})"
            ligne = f"| ☐ | {libelle} | {lien} | `{identifiant}` | {'oui' if local else ''} |"
            if avec_motif:
                ligne += f" {rang[4]} |"
            lignes.append(ligne)
        lignes.append("")

    if format_invalide:
        tableau("Identifiants au format invalide", format_invalide)
    if introuvables:
        tableau("Photos introuvables côté Mapillary", introuvables, avec_motif=True)
    if not format_invalide and not introuvables:
        lignes.append("Aucune anomalie détectée.")

    CHEMIN_RAPPORT.write_text("\n".join(lignes), encoding="utf-8")

    print(f"\n{len(format_invalide)} format(s) invalide(s), {len(introuvables)} introuvable(s).")
    print(f"Rapport écrit dans {CHEMIN_RAPPORT}")


if __name__ == "__main__":
    main()
