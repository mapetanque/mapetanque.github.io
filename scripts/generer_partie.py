"""
Génère partie.html, nl/partie.html, de/partie.html et en/partie.html : la partie en ligne des
connectés (parties communes), où l'on crée, rejoint (QR code, lien ?code=K7P2 ou code tapé), marque
et suit une partie, tous sur le même écran.

Comme Mon compte, la page ne contient qu'un emplacement vide : création, choix d'une équipe, score
et victoire sont dessinés par partie.js, dans la langue de la page, à partir des clés pc_* de
translations.js. Voir NOTES_parties_communes.md du dépôt privé des Workers et la maquette
maquettes/parties-communes/.

Page en noindex : generer_referencement.py l'écarte du sitemap et de llms.txt.

À lancer depuis la racine du dépôt :
    python scripts/generer_partie.py
"""

import re
from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

# Adresse versionnée de translations.js, comme sur le compteur : le service worker sert d'abord sa
# copie en cache, qui peut dater d'avant les clés partie_*.
TRADUCTIONS = "/translations.js?v=24"

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Partie en ligne — Mapetanque.be",
        "h1": "Partie en ligne",
        "fil": ("Accueil", "Partie en ligne"),
        "description": "Créez, rejoignez et suivez une partie de pétanque avec vos amis : un seul score pour tous, en direct, sur Mapetanque.be.",
        "noscript": "Cette page a besoin de JavaScript pour afficher la partie.",
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Online partij — Mapetanque.be",
        "h1": "Online partij",
        "fil": ("Home", "Online partij"),
        "description": "Maak, speel en volg een petanquepartij met uw vrienden: één stand voor iedereen, live, op Mapetanque.be.",
        "noscript": "Deze pagina heeft JavaScript nodig om de partij te tonen.",
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Online-Partie — Mapetanque.be",
        "h1": "Online-Partie",
        "fil": ("Startseite", "Online-Partie"),
        "description": "Eine Pétanque-Partie mit Freunden anlegen, beitreten und verfolgen: ein Stand für alle, live, auf Mapetanque.be.",
        "noscript": "Diese Seite benötigt JavaScript, um die Partie anzuzeigen.",
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "Online game — Mapetanque.be",
        "h1": "Online game",
        "fil": ("Home", "Online game"),
        "description": "Create, join and follow a pétanque game with your friends: one score for everyone, live, on Mapetanque.be.",
        "noscript": "This page needs JavaScript to show the game.",
    },
}

for langue, meta in META.items():
    contenu = (
        '            <div id="partie" class="partie-commune"></div>\n'
        f'            <noscript><p>{echap(meta["noscript"])}</p></noscript>\n'
    )
    cible = RACINE / meta["prefixe"] / "partie.html"
    construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        cible,
        page="partie.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        # Fil sans le compteur : un joueur connecté ne voit que cette page, le compteur simple est
        # pour les autres
        fil=meta["fil"],
        contenu=contenu,
        feuilles_sup=("/style-partie.css?v=11",),
        # Page de passage, propre à chaque partie : sans intérêt dans un moteur de recherche
        tete_sup='<meta name="robots" content="noindex">',
        scripts_sup=("/compte.js", "/partie.js?v=12"),
    )
    html = cible.read_text(encoding="utf-8")
    assert '<script src="/translations.js"></script>' in html
    html = html.replace('<script src="/translations.js"></script>', f'<script src="{TRADUCTIONS}"></script>')
    # Page claire, dans l'esprit de l'écran des joueurs de l'espace des clubs (maquette
    # maquettes/partie-claire/, 31/10/2026) : pas de fil d'Ariane, et le titre masqué à l'écran
    # (gardé pour Google et les lecteurs d'écran), pour laisser la place à la partie. La classe
    # page-partie donne le fond brume (style-partie.css).
    html, n = re.subn(r'\s*<div class="province-breadcrumb">.*?</div>', '', html, count=1, flags=re.S)
    assert n == 1, "fil d'Ariane"
    for avant, apres in (
        ('<h1 class="hero-headline">', '<h1 class="hero-headline titre-masque">'),
        ("<body>", '<body class="page-partie">'),
    ):
        assert html.count(avant) == 1, avant
        html = html.replace(avant, apres)
    cible.write_text(html, encoding="utf-8")
    print(f"{meta['prefixe']}partie.html : {cible.stat().st_size} octets")

# Données structurées des autres pages, sitemap.xml et llms.txt (partie.html en est écartée)
generer_referencement.main()
