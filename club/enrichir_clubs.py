#!/usr/bin/env python3
"""
Recopie dans data/clubs.json l'adresse et le site web de chaque club, tirés de
club/clubs_petanque_belgique_propre.csv (colonnes "adresse" et "site").

Le CSV reste la source : c'est là qu'on corrige une adresse ou qu'on ajoute un site web, puis on
relance ce script. Les autres champs de clubs.json (coordonnées, région, province, commune,
fédération) ne sont pas touchés.

Correspondance par nom (CSV "nom" <-> JSON "name") : clubs.json ne garde pas le code du CSV.
Vérifié à la création : aucun homonyme, et les 196 clubs de clubs.json sont dans le CSV (les 5
clubs du CSV absents de clubs.json n'ont pas pu être géocodés). Le script s'arrête si ce n'est
plus le cas, plutôt que de rattacher une adresse au mauvais club.

Si la colonne "site" n'existe pas encore dans le CSV, elle y est ajoutée, vide.

Le champ "site" est toujours présent dans clubs.json, vide tant qu'on ne connaît pas le site :
la fiche club n'affiche alors pas le bouton « Site web ».

Usage (depuis n'importe quel dossier) :
    python club/enrichir_clubs.py
"""

import csv
import json
import os
import sys
from collections import Counter

DOSSIER = os.path.dirname(os.path.abspath(__file__))
CHEMIN_CSV = os.path.join(DOSSIER, "clubs_petanque_belgique_propre.csv")
CHEMIN_JSON = os.path.join(DOSSIER, "..", "data", "clubs.json")


def lire_csv():
    with open(CHEMIN_CSV, encoding="utf-8", newline="") as f:
        lecteur = csv.DictReader(f, delimiter=";")
        colonnes = list(lecteur.fieldnames)
        lignes = list(lecteur)
    if "site" not in colonnes:
        colonnes.append("site")
        for ligne in lignes:
            ligne["site"] = ""
        with open(CHEMIN_CSV, "w", encoding="utf-8", newline="") as f:
            ecrivain = csv.DictWriter(f, fieldnames=colonnes, delimiter=";", lineterminator="\n")
            ecrivain.writeheader()
            ecrivain.writerows(lignes)
        print("Colonne « site » ajoutée (vide) au CSV.")
    return lignes


def normaliser_site(adresse):
    """« www.club.be » -> « https://www.club.be » ; vide si rien."""
    adresse = (adresse or "").strip()
    if adresse and not adresse.lower().startswith(("http://", "https://")):
        adresse = "https://" + adresse
    return adresse


def main():
    lignes = lire_csv()

    homonymes = [nom for nom, n in Counter(l["nom"] for l in lignes).items() if n > 1]
    if homonymes:
        sys.exit("Homonymes dans le CSV, correspondance impossible : " + ", ".join(homonymes))
    par_nom = {l["nom"]: l for l in lignes}

    with open(CHEMIN_JSON, encoding="utf-8") as f:
        clubs = json.load(f)

    absents = [c["name"] for c in clubs if c["name"] not in par_nom]
    if absents:
        sys.exit("Clubs de clubs.json absents du CSV : " + ", ".join(absents))

    avec_site = 0
    for club in clubs:
        ligne = par_nom[club["name"]]
        club["adresse"] = " ".join(ligne["adresse"].split())
        club["site"] = normaliser_site(ligne.get("site"))
        avec_site += bool(club["site"])

    with open(CHEMIN_JSON, "w", encoding="utf-8") as f:
        json.dump(clubs, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{len(clubs)} clubs mis à jour dans data/clubs.json ({avec_site} avec un site web).")


if __name__ == "__main__":
    main()
