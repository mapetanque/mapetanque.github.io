"""
Bascule la navigation « À propos » et « FAQ » du panneau latéral vers les vraies pages, et
retire l'entrée « Contact » du menu.

Six opérations sur les fichiers HTML du site :

  1. suppression du bouton Contact de l'en-tête
  2. suppression de l'entrée Contact du menu burger
  3. À propos, en-tête      -> lien vers a-propos.html
  4. FAQ, en-tête           -> lien vers faq.html
  5. À propos, menu burger  -> chemin réel au lieu de #about
  6. FAQ, menu burger       -> chemin réel au lieu de #faq

Le chemin dépend du dossier : / à la racine, /nl/ et /de/ dans les versions traduites.

Deux précautions apprises à l'usage :

  - tout passe par des expressions régulières tolérant \\r\\n, car les fichiers sont en fins de
    ligne Windows ; une recherche littérale se terminant par \\n n'y trouve rien ;
  - les opérations 3 et 4 acceptent aussi bien le <button> d'origine qu'un <a> déjà converti
    lors d'une passe précédente. Le script est donc idempotent, et corrige au passage un lien
    dont le chemin serait erroné (cas classique : /faq.html laissé tel quel dans nl/ ou de/).

Ce qui n'est PAS touché : la navigation interne du panneau (class="info-nav-link"). Le panneau
reste fonctionnel tant qu'il n'est pas démonté.

À lancer depuis la racine du dépôt :
    python scripts/basculer_nav_pages.py            (aperçu, n'écrit rien)
    python scripts/basculer_nav_pages.py --ecrire   (applique les modifications)
"""

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ECRIRE = "--ecrire" in sys.argv

# --- Suppressions ---------------------------------------------------------------------------
# L'indentation et le saut de ligne sont absorbés pour ne pas laisser de ligne vide.
SUPPRESSIONS = [
    (
        "contact_entete",
        re.compile(
            r'[ \t]*<button[^>]*class="info-nav-trigger"[^>]*data-i18n="menu_contact"[^>]*>'
            r"[^<]*</button>[ \t]*\r?\n"
        ),
    ),
    (
        "contact_menu",
        re.compile(
            r'[ \t]*<li><a href="#contact"[^>]*data-i18n="menu_contact"[^>]*>'
            r"[^<]*</a></li>[ \t]*\r?\n"
        ),
    ),
]

# --- Liens de l'en-tête ---------------------------------------------------------------------
# Accepte le <button> d'origine comme un <a> déjà converti, quel que soit son href actuel.
ENTETE = [
    ("about_entete", "menu_about", "a-propos.html", "À propos"),
    ("faq_entete", "menu_faq", "faq.html", "FAQ"),
]


def motif_entete(cle_i18n):
    return re.compile(
        r'<(?:button|a)[^>]*class="info-nav-trigger"[^>]*data-i18n="'
        + cle_i18n
        + r'"[^>]*>[^<]*</(?:button|a)>'
    )


# --- Liens du menu burger -------------------------------------------------------------------
# Cible l'ancre d'origine (#about) et tout chemin déjà posé, pour rester idempotent.
def motif_menu(cle_i18n):
    return re.compile(r'(<li><a href=")([^"]*)("[^>]*data-i18n="' + cle_i18n + r'")')


MENU = [
    ("about_menu", "menu_about", "a-propos.html"),
    ("faq_menu", "menu_faq", "faq.html"),
]


def chemin_pour(fichier):
    """Les gabarits produisent les pages de la racine : ils suivent la même règle."""
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

    total = {c: 0 for c in
             ("contact_entete", "contact_menu", "about_entete",
              "faq_entete", "about_menu", "faq_menu")}
    corriges = 0          # liens déjà convertis mais dont le chemin était faux
    modifies = 0
    sans_correspondance = []

    for fichier in fichiers:
        # newline="" des deux côtés : sans cela, la lecture convertit les \r\n en \n
        # et l'écriture les rendrait tels quels, transformant les 56 fichiers en LF —
        # soit un diff Git massif pour six modifications réelles.
        with open(fichier, encoding="utf-8", newline="") as f:
            src = f.read()
        origine = src
        chemin = chemin_pour(fichier)

        for cle, motif in SUPPRESSIONS:
            src, n = motif.subn("", src)
            total[cle] += n

        for cle, cle_i18n, page, libelle in ENTETE:
            attendu = (
                f'<a href="{chemin}{page}" class="info-nav-trigger" '
                f'data-i18n="{cle_i18n}">{libelle}</a>'
            )
            motif = motif_entete(cle_i18n)
            trouve = motif.search(src)
            if trouve:
                if trouve.group(0) != attendu:
                    if 'href="' in trouve.group(0):
                        corriges += 1
                    src = motif.sub(lambda _: attendu, src, count=1)
                    total[cle] += 1

        for cle, cle_i18n, page in MENU:
            motif = motif_menu(cle_i18n)

            def remplacer(m):
                return m.group(1) + chemin + page + m.group(3)

            trouve = motif.search(src)
            if trouve and trouve.group(2) != chemin + page:
                src, n = motif.subn(remplacer, src, count=1)
                total[cle] += n

        relatif = fichier.relative_to(RACINE).as_posix()
        if src != origine:
            modifies += 1
            if ECRIRE:
                with open(fichier, "w", encoding="utf-8", newline="") as f:
                    f.write(src)
        else:
            sans_correspondance.append(relatif)

    print(f"{len(fichiers)} fichiers HTML examinés, {modifies} à modifier.\n")
    print(f"  Contact retiré de l'en-tête    : {total['contact_entete']}")
    print(f"  Contact retiré du menu burger  : {total['contact_menu']}")
    print(f"  À propos, en-tête              : {total['about_entete']}")
    print(f"  FAQ, en-tête                   : {total['faq_entete']}")
    print(f"  À propos, menu burger          : {total['about_menu']}")
    print(f"  FAQ, menu burger               : {total['faq_menu']}")
    if corriges:
        print(f"\n  dont {corriges} lien(s) déjà converti(s) mais au mauvais chemin, corrigés.")

    if sans_correspondance:
        print("\nFichiers déjà conformes ou sans en-tête :")
        for a in sans_correspondance:
            print(f"  {a}")

    if ECRIRE:
        print("\nModifications écrites.")
    else:
        print("\nAperçu uniquement, aucun fichier modifié.")
        print("Relancer avec --ecrire pour appliquer.")


if __name__ == "__main__":
    main()