#!/usr/bin/env python3
"""
Préparation de la page admin — trois choses, indépendantes les unes des autres.

1) Fabriquer le secret ADMIN_MOT_DE_PASSE :

       python3 preparer_admin.py --mot-de-passe

   Le script demande l'identifiant et le mot de passe (saisie masquée), puis
   affiche la valeur "<sel>$<empreinte>" à coller telle quelle dans le secret
   ADMIN_MOT_DE_PASSE du Worker mapetanque-admin. Le mot de passe lui-même
   n'est écrit nulle part. Choisis-le LONG : quatre ou cinq mots au hasard
   valent bien mieux qu'un mot court et compliqué.

   Le script affiche aussi une valeur utilisable pour le secret SEL_JETONS.

2) Extraire les candidats de l'ancien outil vers un fichier de données :

       python3 preparer_admin.py --candidats scripts/revue_photos.html

   Produit data/candidats_photos.json, que la page admin ira chercher au
   chargement. Les 850 Ko de données ne sont donc plus embarqués dans le HTML,
   et la page n'a plus besoin d'être régénérée pour être modifiée.

3) Convertir l'ancien export de décisions en instructions SQL :

       python3 preparer_admin.py --import decisions.json data/candidats_photos.json

   Produit import_admin_01.sql, import_admin_02.sql… à coller l'un après
   l'autre dans la console SQL de D1. Le découpage évite de dépasser la taille
   qu'accepte la console. Les instructions sont idempotentes : les rejouer deux
   fois ne crée pas de doublons.

Aucun accès réseau, aucune dépendance en dehors de la bibliothèque standard.
"""

import json
import os
import re
import secrets
import sys
import getpass
import hashlib

# Chemins ancrés sur le dossier du script, jamais sur le dossier courant (même
# précaution que dans le reste du projet).
DOSSIER_SCRIPT = os.path.dirname(os.path.abspath(__file__))
INSTRUCTIONS_PAR_FICHIER = 250


def empreinte(identifiant, mot_de_passe, sel_hex):
    """Doit rester STRICTEMENT identique à empreinteMotDePasse() du Worker."""
    source = sel_hex + "|" + identifiant + "|" + mot_de_passe
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def commande_mot_de_passe():
    identifiant = input("Identifiant : ").strip()
    mot_de_passe = getpass.getpass("Mot de passe : ")
    verification = getpass.getpass("Répète le mot de passe : ")

    if not identifiant or not mot_de_passe:
        print("Identifiant et mot de passe sont obligatoires.")
        sys.exit(1)
    if mot_de_passe != verification:
        print("Les deux saisies diffèrent.")
        sys.exit(1)
    if len(mot_de_passe) < 12:
        print("\n⚠️  Moins de 12 caractères. Continue si tu veux, mais un mot de passe "
              "long est la seule vraie protection ici.\n")

    sel_hex = secrets.token_hex(16)

    print("\n=== Secrets à créer sur le Worker mapetanque-admin ===\n")
    print("ADMIN_IDENTIFIANT")
    print("   " + identifiant)
    print("\nADMIN_MOT_DE_PASSE")
    print("   " + sel_hex + "$" + empreinte(identifiant, mot_de_passe, sel_hex))
    print("\nSEL_JETONS")
    print("   " + secrets.token_hex(32))
    print("\n(le mot de passe lui-même n'apparaît nulle part ci-dessus)")


def commande_candidats(chemin_html):
    with open(chemin_html, "r", encoding="utf-8") as f:
        contenu = f.read()

    # La ligne a la forme : const DONNEES = [...];
    # Le point-virgule de fin de ligne suffit à délimiter : le JSON est produit
    # par json.dumps côté générateur, donc sur une seule ligne, sans saut.
    correspondance = re.search(r"const DONNEES = (\[.*\]);", contenu)
    if not correspondance:
        print("Impossible de retrouver « const DONNEES = [...]; » dans ce fichier.")
        sys.exit(1)

    donnees = json.loads(correspondance.group(1))

    dossier_data = os.path.join(os.path.dirname(DOSSIER_SCRIPT), "data")
    if not os.path.isdir(dossier_data):
        dossier_data = DOSSIER_SCRIPT
    sortie = os.path.join(dossier_data, "candidats_photos.json")

    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, separators=(",", ":"))

    terrains = sum(len(g["terrains"]) for g in donnees)
    candidats = sum(1 for g in donnees for t in g["terrains"] if t.get("candidat"))
    taille_ko = os.path.getsize(sortie) // 1024

    print(f"{sortie}")
    print(f"{len(donnees)} commune(s), {terrains} terrain(s), {candidats} candidat(s), {taille_ko} Ko")


def echapper(valeur):
    """Littéral SQL. Les noms de communes contiennent des apostrophes."""
    if valeur is None:
        return "NULL"
    if isinstance(valeur, (int, float)):
        return str(valeur)
    return "'" + str(valeur).replace("'", "''") + "'"


def commande_import(chemin_decisions, chemin_candidats):
    with open(chemin_decisions, "r", encoding="utf-8") as f:
        decisions = json.load(f)

    # Les candidats servent à retrouver, pour chaque terrain accepté, QUELLE
    # photo l'était : l'export de décisions ne contient que le statut.
    with open(chemin_candidats, "r", encoding="utf-8") as f:
        candidats_par_terrain = {}
        for groupe in json.load(f):
            for terrain in groupe["terrains"]:
                candidat = terrain.get("candidat")
                if candidat:
                    candidats_par_terrain[terrain["osm_id"]] = str(candidat["id"])

    instructions = []
    nb_statuts = nb_manuelles = nb_panos = 0

    for osm_id, decision in decisions.items():
        statut = decision.get("statut")
        candidat_id = candidats_par_terrain.get(osm_id)

        if statut or candidat_id:
            instructions.append(
                "INSERT INTO revue_terrains (osm_id, statut, candidat_id) VALUES "
                f"({echapper(osm_id)}, {echapper(statut)}, {echapper(candidat_id)}) "
                "ON CONFLICT(osm_id) DO UPDATE SET statut = excluded.statut, "
                "candidat_id = excluded.candidat_id, maj = datetime('now');"
            )
            if statut:
                nb_statuts += 1

        for identifiant in decision.get("alternatives", []) or []:
            identifiant = str(identifiant).strip()
            if not identifiant.isdigit():
                # Ancien format : une URL collée telle quelle au lieu de l'ID.
                trouve = re.search(r"(\d{10,})", identifiant)
                if not trouve:
                    print(f"  ignoré (identifiant illisible) : {osm_id} -> {identifiant}")
                    continue
                identifiant = trouve.group(1)

            instructions.append(
                "INSERT OR IGNORE INTO photos (osm_id, origine, statut, mapillary_id) VALUES "
                f"({echapper(osm_id)}, 'manuelle', 'rattachee', {echapper(identifiant)});"
            )
            nb_manuelles += 1

        for pano in decision.get("panos", []) or []:
            instructions.append(
                "INSERT OR IGNORE INTO photos (osm_id, origine, statut, mapillary_id, "
                "pano_x, pano_y, pano_zoom, pano_url) VALUES "
                f"({echapper(osm_id)}, 'pano360', 'a_generer', "
                f"{echapper(str(pano.get('mapillary_id')))}, "
                f"{echapper(pano.get('x'))}, {echapper(pano.get('y'))}, "
                f"{echapper(pano.get('zoom'))}, {echapper(pano.get('app_url'))});"
            )
            nb_panos += 1

    fichiers = []
    for debut in range(0, len(instructions), INSTRUCTIONS_PAR_FICHIER):
        numero = debut // INSTRUCTIONS_PAR_FICHIER + 1
        chemin = os.path.join(DOSSIER_SCRIPT, f"import_admin_{numero:02d}.sql")
        with open(chemin, "w", encoding="utf-8") as f:
            f.write("\n".join(instructions[debut:debut + INSTRUCTIONS_PAR_FICHIER]) + "\n")
        fichiers.append(chemin)

    print(f"{nb_statuts} statut(s), {nb_manuelles} photo(s) manuelle(s), {nb_panos} 360°")
    print(f"{len(instructions)} instruction(s) SQL réparties en {len(fichiers)} fichier(s) :")
    for chemin in fichiers:
        print("  " + chemin)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    commande = sys.argv[1]

    if commande == "--mot-de-passe":
        commande_mot_de_passe()
    elif commande == "--candidats" and len(sys.argv) == 3:
        commande_candidats(sys.argv[2])
    elif commande == "--import" and len(sys.argv) == 4:
        commande_import(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
