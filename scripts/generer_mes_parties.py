"""
Génère mes-parties.html, nl/mes-parties.html, de/mes-parties.html et en/mes-parties.html.

Comme Mon compte, la page ne contient qu'un emplacement vide : filtres, chiffres clés, liste des
parties, records, terrains, carnet de joueurs et fiche d'une partie sont dessinés par
mes-parties.js, dans la langue de la page, à partir des clés mesparties_* de translations.js.
Sans session, mes-parties.js renvoie vers la page Connexion. Voir NOTES_comptes_utilisateurs.md,
« Étape 2, phase 2 — page Mes parties ».

Page en noindex : generer_referencement.py l'écarte du sitemap et de llms.txt.

À lancer depuis la racine du dépôt :
    python scripts/generer_mes_parties.py
"""

from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Mes parties — Mapetanque.be",
        "h1": "Mes parties",
        "fil": ("Accueil", "Mon compte", "Mes parties"),
        "description": "Vos parties de pétanque enregistrées par le compteur de Mapetanque.be, avec vos statistiques.",
        "noscript": "Cette page a besoin de JavaScript pour afficher vos parties.",
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Mijn partijen — Mapetanque.be",
        "h1": "Mijn partijen",
        "fil": ("Home", "Mijn account", "Mijn partijen"),
        "description": "Uw petanquepartijen bewaard door de scoreteller van Mapetanque.be, met uw statistieken.",
        "noscript": "Deze pagina heeft JavaScript nodig om uw partijen te tonen.",
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Meine Partien — Mapetanque.be",
        "h1": "Meine Partien",
        "fil": ("Startseite", "Mein Konto", "Meine Partien"),
        "description": "Ihre Pétanque-Partien, gespeichert vom Punktezähler von Mapetanque.be, mit Ihren Statistiken.",
        "noscript": "Diese Seite benötigt JavaScript, um Ihre Partien anzuzeigen.",
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "My games — Mapetanque.be",
        "h1": "My games",
        "fil": ("Home", "My account", "My games"),
        "description": "Your pétanque games saved by the Mapetanque.be score counter, with your statistics.",
        "noscript": "This page needs JavaScript to show your games.",
    },
}

for langue, meta in META.items():
    contenu = (
        '            <div id="mes-parties" class="mes-parties"></div>\n'
        f'            <noscript><p>{echap(meta["noscript"])}</p></noscript>\n'
    )
    accueil, compte, courant = meta["fil"]
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "mes-parties.html",
        page="mes-parties.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=(accueil, [(compte, f"/{meta['prefixe']}mon-compte.html")], courant),
        contenu=contenu,
        feuilles_sup=("/style-mes-parties.css",),
        # Page personnelle, sans intérêt dans un moteur de recherche
        tete_sup='<meta name="robots" content="noindex">',
        scripts_sup=("/compte.js", "/mes-parties.js"),
    )

    # translations.js à une adresse versionnée, comme sur le compteur : le service worker sert
    # d'abord sa copie en cache, qui peut dater d'avant les clés de la page
    cible = RACINE / meta["prefixe"] / "mes-parties.html"
    html = cible.read_text(encoding="utf-8")
    cible.write_text(html.replace('<script src="/translations.js"></script>', '<script src="/translations.js?v=9"></script>'), encoding="utf-8")
    print(f"{meta['prefixe']}mes-parties.html : {taille} octets")

# Données structurées des autres pages, sitemap.xml et llms.txt (mes-parties.html en est écartée)
generer_referencement.main()
