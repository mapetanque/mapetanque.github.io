"""
Fabrique une page du site à partir d'une page existante servant de squelette.

Utilisé par generer_faq.py et generer_a_propos.py, qui partageaient jusqu'ici 129 lignes
identiques : toute correction sur l'en-tête ou les métadonnées devait être faite deux fois.

Le principe : on part de comment-jouer.html, dont on garde l'en-tête, le logo, le menu, les
feuilles de style, les scripts et le pied de page, et on remplace ce qui est propre à la page.
Partir du fichier réel du dépôt plutôt que d'un gabarit figé garantit que la page produite
n'est jamais en retard d'un correctif appliqué ailleurs.
"""

import html
import re
from pathlib import Path

BASE = "https://mapetanque.be"

LANGUES = (("fr", ""), ("nl", "nl/"), ("de", "de/"))


def _remplacer_meta(src, balise, valeur):
    """Remplace la valeur d'une balise <meta ... content="..."> déjà présente."""
    return re.sub(
        re.escape(balise) + r'[^"]*">',
        balise + html.escape(valeur, quote=True) + '">',
        src,
        count=1,
    )


def construire_page(
    squelette,
    cible,
    *,
    page,
    prefixe,
    titre,
    description,
    h1,
    fil,
    contenu,
    feuilles_sup=(),
    tete_sup="",
    banniere=None,
    credit=None,
    langues_publiees=LANGUES,
):
    """
    Écrit `cible` à partir de `squelette`.

    page              nom du fichier produit, ex. "faq.html" — sert à construire les URL
    prefixe           "", "nl/" ou "de/"
    titre             contenu de <title> et de og:title
    description       meta description et og:description
    h1                titre affiché dans la bannière
    fil               couple (libellé accueil, libellé page) du fil d'Ariane
    contenu           HTML complet remplaçant l'intérieur de .rules-content
    feuilles_sup      feuilles de style à charger après style-comment-jouer.css
    tete_sup          balisage inséré juste avant </head>, ex. des données structurées
    banniere          chemin d'image remplaçant la bannière du squelette
    credit            texte du crédit sous la bannière
    langues_publiees  langues pour lesquelles la page existe : les hreflang et le sélecteur
                      de langue ne pointent que vers celles-ci, pour ne pas annoncer d'URL
                      répondant 404
    """
    squelette = Path(squelette)
    if not squelette.exists():
        raise SystemExit(f"Squelette introuvable : {squelette}")
    src = squelette.read_text(encoding="utf-8")

    url = f"{BASE}/{prefixe}{page}"

    # --- Métadonnées --------------------------------------------------------------------
    src = re.sub(r"<title>.*?</title>", f"<title>{titre}</title>", src, count=1)
    src = _remplacer_meta(src, '<meta name="description" content="', description)
    src = _remplacer_meta(src, '<meta property="og:title" content="', titre)
    src = _remplacer_meta(src, '<meta property="og:description" content="', description)
    src = _remplacer_meta(src, '<meta property="og:url" content="', url)
    src = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{url}">',
        src,
        count=1,
    )

    codes_publies = {code for code, _ in langues_publiees}
    for code, p in LANGUES:
        if code in codes_publies:
            src = re.sub(
                rf'<link rel="alternate" hreflang="{code}" href="[^"]*">',
                f'<link rel="alternate" hreflang="{code}" href="{BASE}/{p}{page}">',
                src,
                count=1,
            )
        else:
            # Annoncer une traduction inexistante nuit au référencement : on retire la balise.
            src = re.sub(
                rf'\s*<link rel="alternate" hreflang="{code}" href="[^"]*">', "", src
            )
    src = re.sub(
        r'<link rel="alternate" hreflang="x-default" href="[^"]*">',
        f'<link rel="alternate" hreflang="x-default" href="{BASE}/{page}">',
        src,
        count=1,
    )

    for feuille in feuilles_sup:
        src = src.replace(
            '<link rel="stylesheet" href="/style-comment-jouer.css">',
            '<link rel="stylesheet" href="/style-comment-jouer.css">\n'
            f'    <link rel="stylesheet" href="{feuille}">',
            1,
        )

    if tete_sup:
        src = src.replace("</head>", "    " + tete_sup + "\n</head>", 1)

    # --- Bannière -----------------------------------------------------------------------
    if banniere:
        src = src.replace(
            "url('/images/banniere-comment-jouer.webp')", f"url('{banniere}')", 1
        )
    if credit:
        src = re.sub(
            r'<div class="hero-banner-credit">.*?</div>',
            f'<div class="hero-banner-credit">\n    {credit}\n</div>',
            src,
            count=1,
            flags=re.S,
        )

    # --- Fil d'Ariane et titre ------------------------------------------------------------
    accueil, courant = fil
    src = re.sub(
        r'<div class="province-breadcrumb">.*?</div>',
        '<div class="province-breadcrumb">\n'
        f'        <a href="/{prefixe}">{accueil}</a>\n'
        '        <span class="sep">›</span>\n'
        f'        <span class="current">{courant}</span>\n'
        "    </div>",
        src,
        count=1,
        flags=re.S,
    )
    src = re.sub(
        r'<h1 class="hero-headline">.*?</h1>',
        f'<h1 class="hero-headline">{h1}</h1>',
        src,
        count=1,
        flags=re.S,
    )

    # --- Contenu ------------------------------------------------------------------------
    debut = src.find('<div class="rules-content">')
    fin = src.find("</div><!-- /.rules-content -->")
    if debut == -1 or fin == -1:
        raise SystemExit(f"Bornes de .rules-content introuvables dans {squelette}")
    src = src[:debut] + '<div class="rules-content">\n\n' + contenu + "\n" + src[fin:]

    # --- Sélecteur de langue --------------------------------------------------------------
    for code, p in LANGUES:
        destination = f"/{p}{page}" if code in codes_publies else f"/{p}"
        src = re.sub(
            rf'(<button type="button" class="lang-link" data-lang="{code}" '
            r'data-lang-url=")[^"]*(")',
            rf"\g<1>{destination}\g<2>",
            src,
        )

    cible = Path(cible)
    cible.parent.mkdir(parents=True, exist_ok=True)
    cible.write_text(src, encoding="utf-8")
    return len(src)


def echap(texte):
    """Échappement HTML du texte courant, apostrophes et guillemets laissés lisibles."""
    return html.escape(texte, quote=False)


def lier_urls_et_emails(texte):
    """
    Échappe le HTML, puis rend cliquables les URL et adresses e-mail écrites en clair.
    Dans l'ancien panneau elles restaient en texte brut ; sur une vraie page ce serait un recul.
    """
    echappe = echap(texte)
    echappe = re.sub(
        r'(https?://[^\s<>"\)]+)',
        r'<a href="\1" target="_blank" rel="noopener">\1</a>',
        echappe,
    )
    return re.sub(
        r"\b([\w.+-]+@[\w-]+\.[\w.]*[\w])", r'<a href="mailto:\1">\1</a>', echappe
    )
