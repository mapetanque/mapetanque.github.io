"""
Génère mon-compte.html, nl/mon-compte.html, de/mon-compte.html et en/mon-compte.html.

Comme la page Connexion, la page ne contient qu'un emplacement vide : pseudo, « Mes envois »,
déconnexion et suppression du compte sont dessinés par mon-compte.js, dans la langue de la page,
à partir des clés compte_* et moncompte_* de translations.js. Sans session, mon-compte.js renvoie
vers la page Connexion. Voir NOTES_comptes_utilisateurs.md.

Page en noindex : generer_referencement.py l'écarte du sitemap et de llms.txt.

À lancer depuis la racine du dépôt :
    python scripts/generer_mon_compte.py
"""

from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Mon compte — Mapetanque.be",
        "h1": "Mon compte",
        "fil": ("Accueil", "Mon compte"),
        "description": "Votre compte Mapetanque.be : pseudo, notes, avis, photos et signalements envoyés.",
        "noscript": "Cette page a besoin de JavaScript pour afficher votre compte.",
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Mijn account — Mapetanque.be",
        "h1": "Mijn account",
        "fil": ("Home", "Mijn account"),
        "description": "Uw account op Mapetanque.be: bijnaam, scores, recensies, foto's en meldingen.",
        "noscript": "Deze pagina heeft JavaScript nodig om uw account te tonen.",
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Mein Konto — Mapetanque.be",
        "h1": "Mein Konto",
        "fil": ("Startseite", "Mein Konto"),
        "description": "Ihr Konto bei Mapetanque.be: Spitzname, Bewertungen, Fotos und Meldungen.",
        "noscript": "Diese Seite benötigt JavaScript, um Ihr Konto anzuzeigen.",
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "My account — Mapetanque.be",
        "h1": "My account",
        "fil": ("Home", "My account"),
        "description": "Your Mapetanque.be account: nickname, ratings, reviews, photos and reports.",
        "noscript": "This page needs JavaScript to show your account.",
    },
}

for langue, meta in META.items():
    contenu = (
        '            <div id="mon-compte" class="connexion mon-compte"></div>\n'
        f'            <noscript><p>{echap(meta["noscript"])}</p></noscript>\n'
    )
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "mon-compte.html",
        page="mon-compte.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=contenu,
        # Mêmes cartes, boutons et pastille que la page Connexion, plus ce qui est propre à la page
        feuilles_sup=("/style-connexion.css", "/style-mon-compte.css"),
        # Page personnelle, sans intérêt dans un moteur de recherche
        tete_sup='<meta name="robots" content="noindex">',
        scripts_sup=("/compte.js", "/mon-compte.js"),
    )
    print(f"{meta['prefixe']}mon-compte.html : {taille} octets")

# Données structurées des autres pages, sitemap.xml et llms.txt (mon-compte.html en est écartée)
generer_referencement.main()
