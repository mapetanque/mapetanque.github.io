"""
Démonte le panneau d'information des fichiers HTML du site.

Le panneau (« À propos » / « FAQ » / « Contact ») est remplacé par de vraies pages. Ce script
retire ce qu'il en reste dans le balisage :

  1. le bloc <aside id="info-panel"> ... </aside> et son voile <div id="info-overlay">
  2. le lien « Ajouter un terrain », qui pointait vers # et était intercepté par le JavaScript
     du panneau, devient une vraie ancre vers la question correspondante de la FAQ

Le code correspondant a déjà été retiré de script.js et de translations.js ; ce script ne
s'occupe que du HTML.

Comme pour basculer_nav_pages.py : expressions régulières tolérant \\r\\n, fins de ligne
préservées à l'écriture, et exécution idempotente.

À lancer depuis la racine du dépôt :
    python scripts/demonter_panneau_info.py            (aperçu, n'écrit rien)
    python scripts/demonter_panneau_info.py --ecrire   (applique les modifications)
"""

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ECRIRE = "--ecrire" in sys.argv

# Le panneau et son voile, avec les lignes vides qui les entourent.
PANNEAU = re.compile(
    r'[ \t]*<aside id="info-panel">.*?</aside>[ \t]*\r?\n'
    r'[ \t]*<div id="info-overlay"></div>[ \t]*\r?\n',
    re.S,
)

# Le lien « Ajouter un terrain » : href="#" piloté par le JavaScript du panneau, qui ouvrait la
# FAQ sur la question des terrains manquants. Il devient une vraie ancre vers cette question.
LIEN_TERRAIN = re.compile(r'(<a href=")([^"]*)("[^>]*id="add-terrain-link")')
ANCRE_FAQ = "faq.html#terrain-manquant"


def chemin_pour(fichier):
    relatif = fichier.relative_to(RACINE).as_posix()
    if relatif.startswith("nl/"):
        return "/nl/"
    if relatif.startswith("de/"):
        return "/de/"
    return "/"


def main():
    fichiers = sorted(
        f for f in RACINE.rglob("*.html")
        if ".git" not in f.parts and "node_modules" not in f.parts
    )
    if not fichiers:
        raise SystemExit("Aucun fichier HTML trouvé — lancer le script depuis la racine.")

    panneaux = 0
    liens = 0
    modifies = 0
    restes = []

    for fichier in fichiers:
        with open(fichier, encoding="utf-8", newline="") as f:
            src = f.read()
        origine = src
        chemin = chemin_pour(fichier)

        src, n = PANNEAU.subn("", src)
        panneaux += n

        cible = chemin + ANCRE_FAQ
        trouve = LIEN_TERRAIN.search(src)
        if trouve and trouve.group(2) != cible:
            src = LIEN_TERRAIN.sub(lambda m: m.group(1) + cible + m.group(3), src, count=1)
            liens += 1

        # Contrôle : plus aucune trace du panneau ne doit subsister après coup.
        for motif in ("info-panel", "info-overlay", "info-nav-link", "info-page-"):
            if motif in src:
                restes.append(f"{fichier.relative_to(RACINE).as_posix()} : {motif}")

        if src != origine:
            modifies += 1
            if ECRIRE:
                with open(fichier, "w", encoding="utf-8", newline="") as f:
                    f.write(src)

    print(f"{len(fichiers)} fichiers HTML examinés, {modifies} à modifier.\n")
    print(f"  Panneau + voile retirés             : {panneaux}")
    print(f"  Lien « Ajouter un terrain » rebranché : {liens}")

    if restes:
        print("\nTraces du panneau subsistant après traitement :")
        for r in restes:
            print(f"  {r}")

    if ECRIRE:
        print("\nModifications écrites.")
    else:
        print("\nAperçu uniquement, aucun fichier modifié.")
        print("Relancer avec --ecrire pour appliquer.")


if __name__ == "__main__":
    main()
