"""
Génère connexion.html, nl/connexion.html, de/connexion.html et en/connexion.html.

La page ne contient qu'un emplacement vide : le formulaire (adresse, code, « Me connecter »,
compte connecté) est dessiné par connexion.js, dans la langue de la page, à partir des clés
compte_* de translations.js. Voir NOTES_comptes_utilisateurs.md.

Page en noindex : generer_referencement.py l'écarte du sitemap et de llms.txt.

À lancer depuis la racine du dépôt :
    python scripts/generer_connexion.py
"""

from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Connexion — Mapetanque.be",
        "h1": "Connexion",
        "fil": ("Accueil", "Connexion"),
        "description": "Connectez-vous à Mapetanque.be avec votre adresse mail, sans mot de passe.",
        "noscript": "Cette page a besoin de JavaScript pour vous connecter.",
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Aanmelden — Mapetanque.be",
        "h1": "Aanmelden",
        "fil": ("Home", "Aanmelden"),
        "description": "Meld u aan bij Mapetanque.be met uw e-mailadres, zonder wachtwoord.",
        "noscript": "Deze pagina heeft JavaScript nodig om u aan te melden.",
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Anmelden — Mapetanque.be",
        "h1": "Anmelden",
        "fil": ("Startseite", "Anmelden"),
        "description": "Melden Sie sich bei Mapetanque.be mit Ihrer E-Mail-Adresse an, ohne Passwort.",
        "noscript": "Diese Seite benötigt JavaScript, um Sie anzumelden.",
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "Sign in — Mapetanque.be",
        "h1": "Sign in",
        "fil": ("Home", "Sign in"),
        "description": "Sign in to Mapetanque.be with your email address, no password needed.",
        "noscript": "This page needs JavaScript to sign you in.",
    },
}

# Turnstile (anti-robot du formulaire) : chargé après connexion.js, qui définit la fonction
# appelée quand le script est prêt (onload=mapetanqueTurnstilePret).
TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&amp;onload=mapetanqueTurnstilePret"

for langue, meta in META.items():
    contenu = (
        '            <div id="connexion" class="connexion"></div>\n'
        f'            <noscript><p>{echap(meta["noscript"])}</p></noscript>\n'
    )
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "connexion.html",
        page="connexion.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=contenu,
        feuilles_sup=("/style-connexion.css",),
        # Page personnelle, sans intérêt dans un moteur de recherche
        tete_sup='<meta name="robots" content="noindex">',
        scripts_sup=("/compte.js", "/boule-crayon.js", "/connexion.js", TURNSTILE),
    )
    print(f"{meta['prefixe']}connexion.html : {taille} octets")

# Données structurées des autres pages, sitemap.xml et llms.txt (connexion.html en est écartée)
generer_referencement.main()
