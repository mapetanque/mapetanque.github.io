"""
Script ponctuel, à lancer UNE fois depuis la racine du dépôt, AVANT de copier les nouvelles
bannières dans images/ :
    python scripts/migration_la_petanque.py

Ce qu'il fait (chaque étape est ignorée si elle a déjà été appliquée, on peut donc le relancer
sans risque) :
  1. Sauvegarde la bannière actuelle de « Comment jouer » sous images/banniere-compteur.webp,
     et fait pointer les trois pages « Compteur de points » vers ce fichier. Sauvegarde aussi
     le tableau de Loubon (bannière actuelle de la FAQ) sous images/banniere-la-petanque.webp,
     puisque la FAQ reçoit une nouvelle image.
  2. Remplace le crédit photo des trois pages « Comment jouer » (Helen Riding → Norbert Nagel).
  3. Ajoute le lien « La pétanque » au menu (barre du haut + menu burger) des pages écrites à la
     main (index, comment-jouer, compteur, en FR/NL/DE) et des deux gabarits province/région.
  4. Ajoute la clé menu_la_petanque dans translations.js (FR/NL/DE).
  5. Ajoute les trois pages au sitemap.xml.

Les pages générées (FAQ, À propos, La pétanque, provinces, régions) récupèrent le lien en
relançant leur générateur ensuite. Ce script peut être supprimé une fois appliqué.
"""

import re
import shutil
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PREFIXES = ("", "nl/", "de/")

ICONE = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path>'
    '<path d="M12 7v5l4 2"></path></svg>'
)

LIBELLES = {  # valeur actuelle de menu_compteur → libellé du nouveau lien, par langue
    "Compteur de points": "La pétanque",
    "Scoreteller": "Petanque",
    "Punktezähler": "Pétanque",
}


def lire(chemin):
    # newline="" : conserve les fins de ligne du fichier telles quelles (CRLF ou LF)
    with open(chemin, encoding="utf-8", newline="") as f:
        return f.read()


def ecrire(chemin, texte):
    with open(chemin, "w", encoding="utf-8", newline="") as f:
        f.write(texte)


def fin_de_ligne(texte):
    return "\r\n" if "\r\n" in texte else "\n"


# --- 1. Sauvegarde des bannières remplacées ----------------------------------------------

def sauvegarder_banniere(nom_source, nom_cible, taille_nouvelle, page_concernee):
    """Copie une bannière actuelle sous un nouveau nom avant qu'elle soit remplacée. Refuse si
    la source est déjà la nouvelle image (reconnue à sa taille), pour ne pas sauvegarder la
    mauvaise."""
    source = RACINE / "images" / nom_source
    cible = RACINE / "images" / nom_cible
    if cible.exists():
        print(f"  images/{nom_cible} existe déjà")
        return
    try:
        from PIL import Image
        with Image.open(source) as im:
            if im.size == taille_nouvelle:
                raise SystemExit(
                    f"images/{nom_source} est déjà la NOUVELLE image : remets l'ancienne en "
                    f"place avant de lancer ce script, sinon {page_concernee} perdrait sa "
                    "bannière actuelle."
                )
    except ImportError:
        pass
    shutil.copy2(source, cible)
    print(f"  images/{nom_cible} créé (copie de l'ancienne {nom_source})")


def etape_banniere_compteur():
    sauvegarder_banniere("banniere-comment-jouer.webp", "banniere-compteur.webp",
                         (2400, 525), "le compteur")
    sauvegarder_banniere("banniere-faq.webp", "banniere-la-petanque.webp",
                         (2400, 680), "la page La pétanque")

    for p in PREFIXES:
        chemin = RACINE / p / "compteur.html"
        src = lire(chemin)
        avant = "url('/images/banniere-comment-jouer.webp')"
        if avant in src:
            ecrire(chemin, src.replace(avant, "url('/images/banniere-compteur.webp')", 1))
            print(f"  {p}compteur.html → banniere-compteur.webp")


# --- 2. Crédit de « Comment jouer » --------------------------------------------------------

def etape_credit_comment_jouer():
    for p in PREFIXES:
        chemin = RACINE / p / "comment-jouer.html"
        src = lire(chemin)
        if "Photo : Helen Riding," in src:
            ecrire(chemin, src.replace("Photo : Helen Riding,", "Photo : Norbert Nagel,", 1))
            print(f"  {p}comment-jouer.html : crédit mis à jour")


# --- 3. Lien de menu -------------------------------------------------------------------------

def ajouter_lien(chemin, url):
    src = lire(chemin)
    if 'data-i18n="menu_la_petanque"' in src:
        return False
    nl = fin_de_ligne(src)

    # Barre du haut : le lien « Compteur » qui n'est PAS suivi de </li>
    motif_barre = re.compile(r'(<span data-i18n="menu_compteur">[^<]*</span></a>)(?!</li>)')
    # Menu burger : le lien « Compteur » suivi de </li>
    motif_burger = re.compile(r'(<span data-i18n="menu_compteur">[^<]*</span></a></li>)')
    if len(motif_barre.findall(src)) != 1 or len(motif_burger.findall(src)) != 1:
        raise SystemExit(f"Structure de menu inattendue dans {chemin}, rien n'a été modifié.")

    lien_barre = (
        f'{nl}            <a href="{url}" class="game-nav-link petanque">{ICONE}'
        '<span data-i18n="menu_la_petanque">La pétanque</span></a>'
    )
    lien_burger = (
        f'{nl}                <li><a href="{url}" class="side-menu-game-link petanque">{ICONE}'
        '<span data-i18n="menu_la_petanque">La pétanque</span></a></li>'
    )
    src = motif_barre.sub(lambda m: m.group(1) + lien_barre, src, count=1)
    src = motif_burger.sub(lambda m: m.group(1) + lien_burger, src, count=1)
    ecrire(chemin, src)
    return True


def etape_menu():
    for p in PREFIXES:
        for page in ("index.html", "comment-jouer.html", "compteur.html"):
            if ajouter_lien(RACINE / p / page, f"/{p}la-petanque.html"):
                print(f"  {p}{page} : lien ajouté")
    for gabarit in ("province_template.html", "region_template.html"):
        # {{HOME_URL}} vaut déjà "/", "/nl/" ou "/de/" selon la langue de la page générée
        if ajouter_lien(RACINE / "templates" / gabarit, "{{HOME_URL}}la-petanque.html"):
            print(f"  templates/{gabarit} : lien ajouté")


# --- 4. translations.js ----------------------------------------------------------------------

def etape_traductions():
    chemin = RACINE / "translations.js"
    src = lire(chemin)
    if "menu_la_petanque:" in src:
        print("  translations.js : clé déjà présente")
        return
    nl = fin_de_ligne(src)
    # (?=\r?$) : s'arrête juste avant la fin de ligne, qu'elle soit LF ou CRLF
    motif = re.compile(r'^([ \t]*)menu_compteur: "([^"]*)",(?=[ \t]*\r?$)', re.M)
    trouves = motif.findall(src)
    if sorted(v for _, v in trouves) != sorted(LIBELLES):
        raise SystemExit("translations.js : lignes menu_compteur inattendues, rien n'a été modifié.")

    def remplacer(m):
        retrait, valeur = m.group(1), m.group(2)
        return f'{m.group(0)}{nl}{retrait}menu_la_petanque: "{LIBELLES[valeur]}",'

    src = motif.sub(remplacer, src)
    ecrire(chemin, src)
    print("  translations.js : menu_la_petanque ajouté (FR/NL/DE)")


# --- 5. sitemap.xml --------------------------------------------------------------------------

def etape_sitemap():
    chemin = RACINE / "sitemap.xml"
    src = lire(chemin)
    if "/la-petanque.html</loc>" in src:
        print("  sitemap.xml : pages déjà présentes")
        return
    nl = fin_de_ligne(src)
    marqueur = src.find("<!-- DEBUT PAGES PROVINCES")
    if marqueur == -1:
        raise SystemExit("sitemap.xml : marqueur DEBUT PAGES PROVINCES introuvable.")

    base = "https://mapetanque.be/"
    blocs = []
    for p, priorite in (("", "0.6"), ("nl/", "0.5"), ("de/", "0.5")):
        lignes = [
            "    <url>",
            f"        <loc>{base}{p}la-petanque.html</loc>",
            "        <changefreq>monthly</changefreq>",
            f"        <priority>{priorite}</priority>",
        ]
        for code, q in (("fr", ""), ("nl", "nl/"), ("de", "de/")):
            lignes.append(
                f'        <xhtml:link rel="alternate" hreflang="{code}" '
                f'href="{base}{q}la-petanque.html" />'
            )
        lignes.append(
            '        <xhtml:link rel="alternate" hreflang="x-default" '
            f'href="{base}la-petanque.html" />'
        )
        lignes.append("    </url>")
        blocs.append(nl.join(lignes))

    insertion = nl.join(blocs) + nl + nl
    ecrire(chemin, src[:marqueur] + insertion + src[marqueur:])
    print("  sitemap.xml : 3 pages ajoutées")


if __name__ == "__main__":
    print("1. Sauvegarde des bannières remplacées")
    etape_banniere_compteur()
    print("2. Crédit de « Comment jouer »")
    etape_credit_comment_jouer()
    print("3. Lien « La pétanque » dans les menus")
    etape_menu()
    print("4. Traductions")
    etape_traductions()
    print("5. Sitemap")
    etape_sitemap()
    print("\nTerminé. Étapes suivantes : voir le message de Claude (copie des images, puis "
          "relance des générateurs).")
