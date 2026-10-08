"""
Fabrique une page du site à partir d'une page existante servant de squelette.

Utilisé par generer_a_propos.py et generer_la_petanque.py (et auparavant par generer_faq.py,
supprimé avec la page FAQ), pour que toute correction sur l'en-tête ou les métadonnées ne soit
faite qu'une fois.

Le principe : on part de comment-jouer.html, dont on garde l'en-tête, le logo, le menu, les
feuilles de style, les scripts et le pied de page, et on remplace ce qui est propre à la page.
Partir du fichier réel du dépôt plutôt que d'un gabarit figé garantit que la page produite
n'est jamais en retard d'un correctif appliqué ailleurs.
"""

import html
import re
from pathlib import Path

from generer_referencement import retirer_bloc

BASE = "https://mapetanque.be"

LANGUES = (("fr", ""), ("nl", "nl/"), ("de", "de/"), ("en", "en/"))


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
    scripts_sup=(),
    banniere=None,
    credit=None,
    langues_publiees=LANGUES,
):
    """
    Écrit `cible` à partir de `squelette`.

    page              nom du fichier produit, ex. "a-propos.html" — sert à construire les URL
    prefixe           "", "nl/", "de/" ou "en/"
    titre             contenu de <title> et de og:title
    description       meta description et og:description
    h1                titre affiché dans l'en-tête
    fil               couple (libellé accueil, libellé page) du fil d'Ariane, ou triplet
                      (libellé accueil, [(libellé, url), ...], libellé page) avec des étapes
                      intermédiaires (pages commune : région › province)
    contenu           HTML complet remplaçant l'intérieur de .rules-content
    feuilles_sup      feuilles de style à charger après style-comment-jouer.css
    tete_sup          balisage inséré juste avant </head>, ex. des données structurées
    scripts_sup       adresses de scripts chargés juste après script.js, dans cet ordre
                      (ils peuvent donc utiliser t() et currentLang)
    banniere          chemin d'une photo : la page prend une bannière photo au lieu de
                      l'en-tête sobre du squelette (pages commune)
    credit            texte du crédit sous la bannière (seulement avec `banniere`)
    langues_publiees  langues pour lesquelles la page existe : les hreflang et le sélecteur
                      de langue ne pointent que vers celles-ci, pour ne pas annoncer d'URL
                      répondant 404
    """
    squelette = Path(squelette)
    if not squelette.exists():
        raise SystemExit(f"Squelette introuvable : {squelette}")
    # Les données structurées du squelette décrivent comment-jouer.html, pas la page produite :
    # generer_referencement.py écrit ensuite celles de la nouvelle page.
    src = retirer_bloc(squelette.read_text(encoding="utf-8"))

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

    if scripts_sup:
        balise_script = '<script src="/script.js"></script>'
        if balise_script not in src:
            raise SystemExit(f"{balise_script} introuvable dans {squelette}")
        src = src.replace(
            balise_script,
            balise_script + "".join(f'\n<script src="{s}"></script>' for s in scripts_sup),
            1,
        )

    # --- Bannière -----------------------------------------------------------------------
    # Le squelette a l'en-tête sobre des pages de contenu (fond blanc, logo foncé, sans photo :
    # style-entete-sobre.css). Une page qui demande une bannière photo (pages commune) retrouve
    # l'en-tête des pages province : photo, logo clair, crédit sous la bannière.
    if banniere:
        src = src.replace(
            '\n    <!-- En-tête sans bannière photo des pages de contenu -->'
            '\n    <link rel="stylesheet" href="/style-entete-sobre.css">',
            "",
            1,
        )
        src = src.replace(
            '<div class="entete-sobre">',
            f'<div class="hero-banner" style="background-image: url(\'{banniere}\');">',
            1,
        )
        src = src.replace(
            'src="/images/mapetanque-logo-fonce.svg"', 'src="/images/mapetanque-logo.svg"', 1
        )
        credit_html = ""
        if credit is not None:
            # Typographie anglaise : pas d'espace avant le deux-points (« Photo: … »).
            if prefixe == "en/":
                credit = credit.replace("Photo : ", "Photo: ")
            credit_html = f'<div class="hero-banner-credit">\n    {credit}\n</div>\n\n'
        src = src.replace(
            "</div><!-- /.entete-sobre -->", credit_html + "</div><!-- /.hero-banner -->", 1
        )

    # --- Fil d'Ariane et titre ------------------------------------------------------------
    accueil, courant = fil[0], fil[-1]
    intermediaires = "".join(
        f'        <a href="{url_lien}">{libelle}</a>\n        <span class="sep">›</span>\n'
        for libelle, url_lien in (fil[1] if len(fil) == 3 else [])
    )
    src = re.sub(
        r'<div class="province-breadcrumb">.*?</div>',
        '<div class="province-breadcrumb">\n'
        f'        <a href="/{prefixe}">{accueil}</a>\n'
        '        <span class="sep">›</span>\n'
        + intermediaires +
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