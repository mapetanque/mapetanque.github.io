"""
Génère partie.html, nl/partie.html, de/partie.html et en/partie.html : la page qu'ouvre le QR code
« Rejoindre cette partie » du compteur (?code=K7P2), ou où l'on tape le code.

Comme Mon compte, la page ne contient qu'un emplacement vide : le score, « Qui êtes-vous ? » et la
fin de partie sont dessinés par partie.js, dans la langue de la page, à partir des clés partie_*
de translations.js. Voir NOTES_comptes_utilisateurs.md, « Étapes B et C fusionnées : la partie
partagée ».

Page en noindex : generer_referencement.py l'écarte du sitemap et de llms.txt.

À lancer depuis la racine du dépôt :
    python scripts/generer_partie.py
"""

from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

# Adresse versionnée de translations.js, comme sur le compteur : le service worker sert d'abord sa
# copie en cache, qui peut dater d'avant les clés partie_*.
TRADUCTIONS = "/translations.js?v=14"

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Partie partagée — Mapetanque.be",
        "h1": "Partie partagée",
        "fil": ("Accueil", "Compteur de points", "Partie partagée"),
        "description": "Suivez le score d'une partie de pétanque partagée depuis le compteur de Mapetanque.be.",
        "noscript": "Cette page a besoin de JavaScript pour afficher la partie.",
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Gedeelde partij — Mapetanque.be",
        "h1": "Gedeelde partij",
        "fil": ("Home", "Scoreteller", "Gedeelde partij"),
        "description": "Volg de stand van een petanquepartij die gedeeld werd vanuit de scoreteller van Mapetanque.be.",
        "noscript": "Deze pagina heeft JavaScript nodig om de partij te tonen.",
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Geteilte Partie — Mapetanque.be",
        "h1": "Geteilte Partie",
        "fil": ("Startseite", "Punktezähler", "Geteilte Partie"),
        "description": "Verfolgen Sie den Stand einer Pétanque-Partie, die im Punktezähler von Mapetanque.be geteilt wurde.",
        "noscript": "Diese Seite benötigt JavaScript, um die Partie anzuzeigen.",
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "Shared game — Mapetanque.be",
        "h1": "Shared game",
        "fil": ("Home", "Score counter", "Shared game"),
        "description": "Follow the score of a pétanque game shared from the Mapetanque.be score counter.",
        "noscript": "This page needs JavaScript to show the game.",
    },
}

for langue, meta in META.items():
    contenu = (
        '            <div id="partie" class="partie-partagee"></div>\n'
        f'            <noscript><p>{echap(meta["noscript"])}</p></noscript>\n'
    )
    accueil, compteur, courant = meta["fil"]
    cible = RACINE / meta["prefixe"] / "partie.html"
    construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        cible,
        page="partie.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=(accueil, [(compteur, f"/{meta['prefixe']}compteur.html")], courant),
        contenu=contenu,
        feuilles_sup=("/style-partie.css?v=2",),
        # Page de passage, propre à chaque partie : sans intérêt dans un moteur de recherche
        tete_sup='<meta name="robots" content="noindex">',
        scripts_sup=("/compte.js", "/partie.js?v=3"),
    )
    html = cible.read_text(encoding="utf-8")
    assert '<script src="/translations.js"></script>' in html
    html = html.replace('<script src="/translations.js"></script>', f'<script src="{TRADUCTIONS}"></script>')
    # Page sombre, comme le compteur qu'on y suit (style-partie.css, « Page et en-tête sombres ») :
    # fond foncé, logo en version négative, barre du téléphone assortie
    for avant, apres in (
        ("<body>", '<body class="page-sombre">'),
        ("/images/mapetanque-logo-fonce.svg", "/images/mapetanque-logo.svg"),
        ('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex">\n    <meta name="theme-color" content="#1c1b17">'),
    ):
        assert html.count(avant) == 1, avant
        html = html.replace(avant, apres)
    cible.write_text(html, encoding="utf-8")
    print(f"{meta['prefixe']}partie.html : {cible.stat().st_size} octets")

# Données structurées des autres pages, sitemap.xml et llms.txt (partie.html en est écartée)
generer_referencement.main()
