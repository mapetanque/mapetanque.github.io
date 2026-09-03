"""
Génère a-propos.html, nl/a-propos.html et de/a-propos.html à partir des pages
« Comment jouer » du dépôt.

Ces dernières servent de squelette : en-tête, logo, menu, feuilles de style, scripts et pied de
page sont donc ceux de la version courante du site. Générer depuis une copie figée produirait
une page en retard d'un correctif.

À lancer depuis la racine du dépôt :
    python scripts/generer_a_propos.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

import html
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BASE = "https://mapetanque.be"

# Les titres reprennent les libellés du menu (menu_about dans translations.js), pour que la page
# annonce la même chose que le lien qui y mène.
META = {
    "fr": {
        "prefixe": "",
        "titre_page": "À propos — Mapetanque.be",
        "h1": "À propos",
        "fil": ("Accueil", "À propos"),
        "description": (
            "Pourquoi Mapetanque.be existe, sur quelles données libres le site s'appuie "
            "(OpenStreetMap, Mapillary), et comment me contacter."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Over ons — Mapetanque.be",
        "h1": "Over ons",
        "fil": ("Home", "Over ons"),
        "description": (
            "Waarom Mapetanque.be bestaat, op welke vrije gegevens de site steunt "
            "(OpenStreetMap, Mapillary), en hoe je me kan bereiken."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Über uns — Mapetanque.be",
        "h1": "Über uns",
        "fil": ("Startseite", "Über uns"),
        "description": (
            "Warum es Mapetanque.be gibt, auf welchen freien Daten die Website beruht "
            "(OpenStreetMap, Mapillary), und wie Sie mich erreichen."
        ),
    },
}

# --- Contenu -------------------------------------------------------------------------------
# Le texte vit ici plutôt que dans translations.js : les pages de contenu du site (comment
# jouer, compteur) suivent déjà ce principe, et le dupliquer créerait deux sources de vérité.
#
# Registre : le néerlandais tutoie (« je »), l'allemand vouvoie (« Sie »), conformément aux
# textes déjà en place dans translations.js.

CONTENU = {
    "fr": [
        {
            "titre": "Pourquoi Mapetanque.be ?",
            "paragraphes": [
                "Mapetanque.be est né d'un constat : aucun site ne permettait de trouver "
                "simplement les terrains de pétanque librement accessibles en Belgique. Il y en "
                "a pourtant plus de mille sept cents.",
                "En quelques secondes, vous pouvez repérer un terrain près de chez vous ou d'une "
                "adresse donnée, voir à quoi il ressemble, afficher l'itinéraire et le partager "
                "avec vos amis.",
            ],
        },
        {
            "titre": "Un projet open source, des données libres",
            "paragraphes": [
                "Le code de Mapetanque.be est ouvert, et les données qu'il exploite le sont "
                "également :",
            ],
            "sources": [
                ("osm", "pour les terrains et leur emplacement"),
                ("mapillary", "pour les photos des terrains"),
            ],
            "paragraphes_apres": [
                "Mais Mapetanque.be ne se contente pas de puiser dans ces bases : il les "
                "alimente. Chaque terrain qui m'est signalé est ajouté à OpenStreetMap, et "
                "chaque photo reçue est publiée sur Mapillary avant d'être affichée ici. Ce qui "
                "est collecté pour ce site profite donc à tout le monde.",
                "Le site est gratuit, sans publicité, et développé sur mon temps libre.",
            ],
        },
        {
            "titre": "Qui suis-je ?",
            "paragraphes": [
                "Liégeois de naissance et toujours installé dans la région, je joue à la "
                "pétanque depuis tout petit : en vacances dans le sud de la France d'abord, puis "
                "brièvement en club à Vottem. Aujourd'hui j'y joue surtout entre amis, sur des "
                "terrains publics, et c'est cette quête du terrain idéal qui a donné naissance "
                "à ce site.",
            ],
            "contact": "Une suggestion, une erreur à signaler, l'envie de participer ? "
                       "Écrivez-moi.",
        },
    ],
    "nl": [
        {
            "titre": "Waarom Mapetanque.be?",
            "paragraphes": [
                "Mapetanque.be is ontstaan uit een vaststelling: geen enkele website liet toe om "
                "op een eenvoudige manier de vrij toegankelijke petanqueterreinen in België te "
                "vinden. Toch zijn er meer dan zeventienhonderd.",
                "In enkele seconden vind je een terrein in je buurt of bij een bepaald adres, "
                "zie je hoe het eruitziet, toon je de route en deel je het met je vrienden.",
            ],
        },
        {
            "titre": "Een opensourceproject, vrije gegevens",
            "paragraphes": [
                "De code van Mapetanque.be is open, en ook de gegevens die de site gebruikt "
                "zijn vrij:",
            ],
            "sources": [
                ("osm", "voor de terreinen en hun locatie"),
                ("mapillary", "voor de foto's van de terreinen"),
            ],
            "paragraphes_apres": [
                "Maar Mapetanque.be put niet alleen uit die bronnen: de site voedt ze ook. Elk "
                "terrein dat mij gemeld wordt, voeg ik toe aan OpenStreetMap, en elke foto die "
                "ik ontvang wordt op Mapillary gepubliceerd voordat ze hier verschijnt. Wat voor "
                "deze site verzameld wordt, komt dus iedereen ten goede.",
                "De site is gratis, zonder reclame, en wordt in mijn vrije tijd ontwikkeld.",
            ],
        },
        {
            "titre": "Wie ben ik?",
            "paragraphes": [
                "Geboren in Luik en er nog altijd woonachtig, speel ik al van kleins af aan "
                "petanque: eerst tijdens vakanties in Zuid-Frankrijk, daarna korte tijd in een "
                "club in Vottem. Vandaag speel ik vooral met vrienden, op openbare terreinen, en "
                "die zoektocht naar het ideale terrein heeft tot deze site geleid.",
            ],
            "contact": "Heb je een suggestie, wil je een fout melden of meewerken aan het "
                       "project? Laat het me gerust weten.",
        },
    ],
    "de": [
        {
            "titre": "Warum Mapetanque.be?",
            "paragraphes": [
                "Mapetanque.be entstand aus einer Feststellung: Es gab keine Website, auf der "
                "sich die frei zugänglichen Pétanque-Plätze in Belgien einfach finden ließen. "
                "Dabei gibt es davon mehr als 1.700.",
                "In wenigen Sekunden finden Sie einen Platz in Ihrer Nähe oder bei einer "
                "bestimmten Adresse, sehen, wie er aussieht, lassen sich die Route anzeigen und "
                "teilen ihn mit Ihren Freunden.",
            ],
        },
        {
            "titre": "Ein Open-Source-Projekt, freie Daten",
            "paragraphes": [
                "Der Code von Mapetanque.be ist offen, und auch die Daten, die die Website "
                "nutzt, sind frei:",
            ],
            "sources": [
                ("osm", "für die Plätze und ihre Standorte"),
                ("mapillary", "für die Fotos der Plätze"),
            ],
            "paragraphes_apres": [
                "Mapetanque.be schöpft aber nicht nur aus diesen Quellen, sondern trägt auch "
                "dazu bei. Jeder Platz, der mir gemeldet wird, wird zu OpenStreetMap "
                "hinzugefügt, und jedes eingesandte Foto wird auf Mapillary veröffentlicht, "
                "bevor es hier erscheint. Was für diese Website gesammelt wird, kommt also allen "
                "zugute.",
                "Die Website ist kostenlos, werbefrei und entsteht in meiner Freizeit.",
            ],
        },
        {
            "titre": "Wer ich bin",
            "paragraphes": [
                "Gebürtiger Lütticher und dort noch immer zu Hause, spiele ich seit meiner "
                "Kindheit Pétanque: zunächst im Urlaub in Südfrankreich, später kurze Zeit in "
                "einem Verein in Vottem. Heute spiele ich vor allem mit Freunden auf "
                "öffentlichen Plätzen, und aus dieser Suche nach dem idealen Platz ist diese "
                "Website entstanden.",
            ],
            "contact": "Sie haben einen Vorschlag, möchten einen Fehler melden oder beim "
                       "Projekt mitwirken? Schreiben Sie mir.",
        },
    ],
}

# Les deux sources sont les mêmes partout : seul leur rôle, défini ci-dessus, est traduit.
SOURCES = {
    "osm": {
        "logo": "/images/logo-openstreetmap.webp",
        "nom": "OpenStreetMap",
        "url": "https://www.openstreetmap.org",
    },
    "mapillary": {
        "logo": "/images/logo-mapillary.webp",
        "nom": "Mapillary",
        "url": "https://www.mapillary.com",
    },
}

EMAIL = "mapetanque@outlook.be"

ICONE_MAIL = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>'
    '<polyline points="22,6 12,13 2,6"></polyline></svg>'
)


def echap(texte):
    return html.escape(texte, quote=False)


def bloc_contenu(langue):
    morceaux = []
    for section in CONTENU[langue]:
        morceaux.append('            <section class="apropos-section">')
        morceaux.append(f'                <h2>{echap(section["titre"])}</h2>')

        for para in section.get("paragraphes", []):
            morceaux.append(f"                <p>{echap(para)}</p>")

        if section.get("sources"):
            morceaux.append('                <ul class="apropos-sources">')
            for cle, role in section["sources"]:
                s = SOURCES[cle]
                morceaux.append(
                    '                    <li class="apropos-source">\n'
                    f'                        <img src="{s["logo"]}" alt="{echap(s["nom"])}" '
                    'width="40" height="40" loading="lazy">\n'
                    '                        <span class="apropos-source-texte">'
                    f'<a href="{s["url"]}" target="_blank" rel="noopener">{echap(s["nom"])}</a> '
                    f"{echap(role)}</span>\n"
                    "                    </li>"
                )
            morceaux.append("                </ul>")

        for para in section.get("paragraphes_apres", []):
            morceaux.append(f"                <p>{echap(para)}</p>")

        if section.get("contact"):
            morceaux.append(
                '                <div class="apropos-contact" id="contact">\n'
                f'                    <p>{echap(section["contact"])}</p>\n'
                f'                    <a class="apropos-mail" href="mailto:{EMAIL}">'
                f"{ICONE_MAIL}{EMAIL}</a>\n"
                "                </div>"
            )

        morceaux.append("            </section>\n")
    return "\n".join(morceaux)


def construire(langue):
    meta = META[langue]
    squelette = RACINE / meta["prefixe"] / "comment-jouer.html"
    if not squelette.exists():
        raise SystemExit(f"Squelette introuvable : {squelette}")
    src = squelette.read_text(encoding="utf-8")

    # --- En-tête ------------------------------------------------------------------------
    src = re.sub(r"<title>.*?</title>", f'<title>{meta["titre_page"]}</title>', src, count=1)
    for prop, valeur in (
        ('<meta name="description" content="', meta["description"]),
        ('<meta property="og:title" content="', meta["titre_page"]),
        ('<meta property="og:description" content="', meta["description"]),
        ('<meta property="og:url" content="', f'{BASE}/{meta["prefixe"]}a-propos.html'),
    ):
        src = re.sub(
            re.escape(prop) + r'[^"]*">',
            prop + html.escape(valeur, quote=True) + '">',
            src, count=1,
        )
    src = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{BASE}/{meta["prefixe"]}a-propos.html">',
        src, count=1,
    )
    for code, prefixe in (("fr", ""), ("nl", "nl/"), ("de", "de/")):
        src = re.sub(
            rf'<link rel="alternate" hreflang="{code}" href="[^"]*">',
            f'<link rel="alternate" hreflang="{code}" href="{BASE}/{prefixe}a-propos.html">',
            src, count=1,
        )
    src = re.sub(
        r'<link rel="alternate" hreflang="x-default" href="[^"]*">',
        f'<link rel="alternate" hreflang="x-default" href="{BASE}/a-propos.html">',
        src, count=1,
    )

    # Feuille propre à la page, après style-comment-jouer.css pour pouvoir la compléter.
    src = src.replace(
        '<link rel="stylesheet" href="/style-comment-jouer.css">',
        '<link rel="stylesheet" href="/style-comment-jouer.css">\n'
        '    <link rel="stylesheet" href="/style-a-propos.css">',
        1,
    )

    # --- Bannière (la même que la FAQ) ----------------------------------------------------
    src = src.replace(
        "url('/images/banniere-comment-jouer.webp')",
        "url('/images/banniere-faq.webp')",
        1,
    )
    src = re.sub(
        r'<div class="hero-banner-credit">.*?</div>',
        '<div class="hero-banner-credit">\n'
        "    « Les Joueurs de pétanque, Marseille » par Émile Loubon\n"
        "</div>",
        src, count=1, flags=re.S,
    )

    # --- Fil d'Ariane et titre ------------------------------------------------------------
    accueil, courant = meta["fil"]
    src = re.sub(
        r'<div class="province-breadcrumb">.*?</div>',
        '<div class="province-breadcrumb">\n'
        f'        <a href="/{meta["prefixe"]}">{accueil}</a>\n'
        '        <span class="sep">›</span>\n'
        f'        <span class="current">{courant}</span>\n'
        "    </div>",
        src, count=1, flags=re.S,
    )
    src = re.sub(
        r'<h1 class="hero-headline">.*?</h1>',
        f'<h1 class="hero-headline">{meta["h1"]}</h1>',
        src, count=1, flags=re.S,
    )

    # --- Contenu ------------------------------------------------------------------------
    debut = src.find('<div class="rules-content">')
    fin = src.find("</div><!-- /.rules-content -->")
    if debut == -1 or fin == -1:
        raise SystemExit(f"{langue} : bornes de .rules-content introuvables dans le squelette")
    src = src[:debut] + '<div class="rules-content">\n\n' + bloc_contenu(langue) + "\n" + src[fin:]

    # --- Sélecteur de langue --------------------------------------------------------------
    for code, prefixe in (("fr", ""), ("nl", "nl/"), ("de", "de/")):
        src = re.sub(
            rf'(<button type="button" class="lang-link" data-lang="{code}" data-lang-url=")[^"]*(")',
            rf"\g<1>/{prefixe}a-propos.html\g<2>",
            src,
        )

    cible = RACINE / meta["prefixe"] / "a-propos.html"
    cible.write_text(src, encoding="utf-8")
    print(f"{meta['prefixe']}a-propos.html : {len(src)} octets, {len(CONTENU[langue])} sections")


for langue in ("fr", "nl", "de"):
    construire(langue)