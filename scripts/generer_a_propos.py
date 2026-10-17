"""
Génère a-propos.html, nl/a-propos.html, de/a-propos.html et en/a-propos.html à partir des pages
« Comment jouer » du dépôt.

La mécanique commune (métadonnées, bannière, fil d'Ariane, sélecteur de langue) vit dans
_squelette.py, partagée avec generer_la_petanque.py.

À lancer depuis la racine du dépôt :
    python scripts/generer_a_propos.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

import json
import re
from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

# Les titres reprennent les libellés du menu, pour que la page annonce la même chose que le
# lien qui y mène.
META = {
    "fr": {
        "prefixe": "",
        "titre_page": "À propos — Mapetanque.be",
        "h1": "À propos",
        "fil": ("Accueil", "À propos"),
        "description": (
            "Pourquoi Mapetanque.be existe, sur quelles données libres le site s'appuie "
            "(OpenStreetMap, Mapillary), ce qu'il fait de vos données, et comment me "
            "contacter."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Over ons — Mapetanque.be",
        "h1": "Over ons",
        "fil": ("Home", "Over ons"),
        "description": (
            "Waarom Mapetanque.be bestaat, op welke vrije gegevens de site steunt "
            "(OpenStreetMap, Mapillary), wat er met je gegevens gebeurt, en hoe je me kan "
            "bereiken."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Über uns — Mapetanque.be",
        "h1": "Über uns",
        "fil": ("Startseite", "Über uns"),
        "description": (
            "Warum es Mapetanque.be gibt, auf welchen freien Daten die Website beruht "
            "(OpenStreetMap, Mapillary), was mit Ihren Daten geschieht, und wie Sie mich "
            "erreichen."
        ),
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "About — Mapetanque.be",
        "h1": "About",
        "fil": ("Home", "About"),
        "description": (
            "Why Mapetanque.be exists, the open data it relies on (OpenStreetMap, Mapillary), "
            "what it does with your data, and how to contact me."
        ),
    },
}

# --- Contenu -------------------------------------------------------------------------------
# Le texte vit ici plutôt que dans translations.js : les pages de contenu du site suivent déjà
# ce principe, et le dupliquer créerait deux sources de vérité.
#
# Registre : le néerlandais tutoie (« je »), l'allemand vouvoie (« Sie »), conformément aux
# textes déjà en place dans translations.js. L'anglais (« you ») suit l'orthographe britannique.

CONTENU = {
    "fr": [
        {
            "titre": "Pourquoi Mapetanque.be ?",
            "paragraphes": [
                "Mapetanque.be est né d'un constat : aucun site ne permettait de trouver "
                "simplement les terrains de pétanque librement accessibles en Belgique. Il y en "
                "a pourtant {n}.",
                "Désormais, vous pouvez repérer un terrain près de chez vous ou près d'une "
                "adresse donnée en quelques secondes, voir à quoi il ressemble, afficher "
                "l'itinéraire et le partager avec vos amis.",
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
                "alimente. Chaque terrain qui m'est signalé est ajouté à OpenStreetMap, et les "
                "photos reçues sont, la plupart du temps, aussi publiées sur Mapillary. Ce qui "
                "est collecté pour ce site profite donc à tout le monde.",
            ],
        },
        {
            # Mention de non-responsabilité : le pied de page y renvoie (a-propos.html#fiabilite).
            "titre": "Fiabilité des informations",
            "id": "fiabilite",
            "paragraphes": [
                "Les terrains proviennent d'OpenStreetMap et la plupart des photos de Mapillary, "
                "deux bases de données ouvertes et collaboratives ; les autres photos sont "
                "envoyées par les visiteurs du site. Ces informations sont données à titre "
                "indicatif : un terrain peut avoir disparu, être mal situé ou ne pas être ouvert "
                "au public (terrain de club, de café, propriété privée…). Sur place, fiez-vous à "
                "la signalisation et au règlement des lieux.",
                "Mapetanque.be ne peut être tenu responsable d'informations inexactes ni de "
                "l'usage qui en est fait.",
            ],
            "page_lien": "a-propos.html#contact",
            "paragraphes_lien": [
                "Une erreur ? [Signalez-la-moi] : je la corrigerai dans OpenStreetMap, au "
                "bénéfice de tous.",
            ],
        },
        {
            "titre": "Vos données",
            # Résumé : le détail est dans confidentialite.html. Les crochets marquent le lien.
            "paragraphes_lien": [
                "Pas de publicité ni de pistage, aucun cookie, et le compte est facultatif. Le "
                "détail figure dans la [politique de confidentialité].",
            ],
        },
        {
            "titre": "Soutenir le site",
            "page_lien": "soutenir.html",
            "paragraphes_lien": [
                "Mapetanque.be est entièrement gratuit. Si vous souhaitez participer à ses "
                "frais, vous pouvez [m'offrir un café].",
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
                "vinden. Toch zijn er {n}.",
                "Voortaan vind je in enkele seconden een terrein in je buurt of bij een "
                "bepaald adres, zie je hoe het eruitziet, toon je de route en deel je het met "
                "je vrienden.",
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
                "terrein dat mij gemeld wordt, voeg ik toe aan OpenStreetMap, en de foto's die ik "
                "ontvang, worden meestal ook op Mapillary gepubliceerd. Wat voor "
                "deze site verzameld wordt, komt dus iedereen ten goede.",
            ],
        },
        {
            "titre": "Betrouwbaarheid van de informatie",
            "id": "fiabilite",
            "paragraphes": [
                "De terreinen komen uit OpenStreetMap en de meeste foto's uit Mapillary, twee open "
                "databanken waaraan iedereen kan bijdragen; de andere foto's worden ingestuurd "
                "door bezoekers van de site. Deze informatie is louter indicatief: "
                "een terrein kan verdwenen zijn, verkeerd gesitueerd zijn of niet openbaar "
                "toegankelijk zijn (terrein van een club of een café, privéterrein…). Volg ter "
                "plaatse de bewegwijzering en het reglement van de plek.",
                "Mapetanque.be kan niet aansprakelijk worden gesteld voor onjuiste informatie of "
                "voor het gebruik dat ervan wordt gemaakt.",
            ],
            "page_lien": "a-propos.html#contact",
            "paragraphes_lien": [
                "Een fout gezien? [Laat het me weten], dan verbeter ik die in OpenStreetMap, zodat "
                "iedereen er baat bij heeft.",
            ],
        },
        {
            "titre": "Je gegevens",
            "paragraphes_lien": [
                "Geen reclame of tracking, geen cookies, en een account is niet verplicht. "
                "Alle details staan in de [privacyverklaring].",
            ],
        },
        {
            "titre": "De site steunen",
            "page_lien": "soutenir.html",
            "paragraphes_lien": [
                "Mapetanque.be is volledig gratis. Wil je bijdragen aan de kosten, dan kan je "
                "[me op een koffie trakteren].",
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
                "Dabei gibt es davon {n}.",
                "Jetzt finden Sie in wenigen Sekunden einen Platz in Ihrer Nähe oder bei "
                "einer bestimmten Adresse, sehen, wie er aussieht, lassen sich die Route "
                "anzeigen und teilen ihn mit Ihren Freunden.",
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
                "hinzugefügt, und die eingesandten Fotos werden meist auch auf Mapillary "
                "veröffentlicht. Was für diese Website gesammelt wird, kommt also allen "
                "zugute.",
            ],
        },
        {
            "titre": "Zuverlässigkeit der Angaben",
            "id": "fiabilite",
            "paragraphes": [
                "Die Plätze stammen aus OpenStreetMap und die meisten Fotos aus Mapillary, zwei "
                "offenen, gemeinschaftlich gepflegten Datenbanken; die übrigen Fotos senden "
                "Besucher der Website ein. Diese Angaben sind unverbindlich: Ein "
                "Platz kann verschwunden, falsch eingetragen oder nicht öffentlich zugänglich "
                "sein (Platz eines Vereins oder eines Cafés, Privatgelände…). Beachten Sie vor "
                "Ort die Beschilderung und die dort geltenden Regeln.",
                "Mapetanque.be übernimmt keine Haftung für ungenaue Angaben oder deren "
                "Verwendung.",
            ],
            "page_lien": "a-propos.html#contact",
            "paragraphes_lien": [
                "Sie haben einen Fehler entdeckt? [Melden Sie ihn mir]: Ich korrigiere ihn in "
                "OpenStreetMap, zum Nutzen aller.",
            ],
        },
        {
            "titre": "Ihre Daten",
            "paragraphes_lien": [
                "Keine Werbung und kein Tracking, keine Cookies, und ein Konto ist freiwillig. "
                "Die Einzelheiten stehen in der [Datenschutzerklärung].",
            ],
        },
        {
            "titre": "Die Website unterstützen",
            "page_lien": "soutenir.html",
            "paragraphes_lien": [
                "Mapetanque.be ist völlig kostenlos. Wenn Sie sich an den Kosten beteiligen "
                "möchten, können Sie [mir einen Kaffee spendieren].",
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
    "en": [
        {
            "titre": "Why Mapetanque.be?",
            "paragraphes": [
                "Mapetanque.be was born of a simple observation: no website made it easy to find "
                "the freely accessible pétanque courts in Belgium. And yet there are {n} of "
                "them.",
                "Now you can find a court near you, or near any address, in a matter of seconds, "
                "see what it looks like, get directions and share it with your friends.",
            ],
        },
        {
            "titre": "An open-source project built on open data",
            "paragraphes": [
                "Mapetanque.be's code is open, and so is the data it uses:",
            ],
            "sources": [
                ("osm", "for the courts and their locations"),
                ("mapillary", "for the photos of the courts"),
            ],
            "paragraphes_apres": [
                "But Mapetanque.be doesn't just draw on these databases: it also contributes to "
                "them. Every court reported to me is added to OpenStreetMap, and the photos I "
                "receive are usually also published on Mapillary. What is collected for "
                "this site therefore benefits everyone.",
            ],
        },
        {
            "titre": "How reliable is the information?",
            "id": "fiabilite",
            "paragraphes": [
                "The courts come from OpenStreetMap and most photos from Mapillary, two open, "
                "collaborative databases; the other photos are sent in by visitors to the site. "
                "This information is provided for guidance only: a "
                "court may have disappeared, be shown in the wrong place or not be open to the "
                "public (a club's or a café's court, private property…). On site, follow the "
                "signs and the rules of the place.",
                "Mapetanque.be cannot be held responsible for inaccurate information or for any "
                "use made of it.",
            ],
            "page_lien": "a-propos.html#contact",
            "paragraphes_lien": [
                "Spotted an error? [Let me know]: I'll correct it in OpenStreetMap, for "
                "everyone's benefit.",
            ],
        },
        {
            "titre": "Your data",
            "paragraphes_lien": [
                "No advertising or tracking, no cookies, and an account is optional. The "
                "details are in the [privacy policy].",
            ],
        },
        {
            "titre": "Support the site",
            "page_lien": "soutenir.html",
            "paragraphes_lien": [
                "Mapetanque.be is completely free. If you'd like to help with its costs, you "
                "can [treat me to a coffee].",
            ],
        },
        {
            "titre": "Who am I?",
            "paragraphes": [
                "Born in Liège and still living in the area, I've been playing pétanque since I "
                "was a child: first on holiday in the south of France, then briefly in a club in "
                "Vottem. These days I mostly play with friends on public courts, and it was this "
                "search for the perfect court that gave rise to this site.",
            ],
            "contact": "A suggestion, an error to report, or keen to get involved? "
                       "Drop me a line.",
        },
    ]
}

# Les deux sources sont les mêmes partout : seul leur rôle, traduit ci-dessus, change.
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


# Nombre de terrains, à la place de {n} dans le texte. Le chiffre écrit dans la page n'est qu'un
# repli (moteurs de recherche, attente du chargement) : script.js le remplace par le total à jour
# dans tout élément .nb-terrains-dynamique, avec le même format que formaterNombre().
with open(RACINE / "data" / "terrains.geojson", encoding="utf-8") as f:
    NB_TERRAINS = len(json.load(f)["features"])

SEPARATEUR_MILLIERS = {"fr": " ", "nl": ".", "de": ".", "en": ","}


def nombre_terrains(langue):
    chiffre = f"{NB_TERRAINS:,}".replace(",", SEPARATEUR_MILLIERS[langue])
    return f'<span class="nb-terrains-dynamique">{chiffre}</span>'


def bloc_contenu(langue):
    morceaux = []
    for section in CONTENU[langue]:
        ident = f' id="{section["id"]}"' if section.get("id") else ""
        morceaux.append(f'            <section class="apropos-section"{ident}>')
        morceaux.append(f'                <h2>{echap(section["titre"])}</h2>')

        for para in section.get("paragraphes", []):
            texte = echap(para).replace("{n}", nombre_terrains(langue))
            morceaux.append(f"                <p>{texte}</p>")

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

        if section.get("liste"):
            morceaux.append('                <ul class="apropos-liste">')
            for tete, suite in section["liste"]:
                morceaux.append(
                    f"                    <li><strong>{echap(tete)}</strong>{echap(suite)}</li>"
                )
            morceaux.append("                </ul>")

        for para in section.get("paragraphes_apres", []):
            morceaux.append(f"                <p>{echap(para)}</p>")

        # Paragraphes dont le passage entre crochets mène à une autre page du site : la
        # politique de confidentialité, sauf si la section en indique une autre (page_lien)
        for para in section.get("paragraphes_lien", []):
            cible = section.get("page_lien", "confidentialite.html")
            lien = f'<a href="/{META[langue]["prefixe"]}{cible}">' + r"\1</a>"
            texte = re.sub(r"\[([^]]+)\]", lien, echap(para))
            morceaux.append(f"                <p>{texte}</p>")

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


for langue, meta in META.items():
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "a-propos.html",
        page="a-propos.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=bloc_contenu(langue),
        feuilles_sup=("/style-a-propos.css",),
    )
    print(f"{meta['prefixe']}a-propos.html : {taille} octets, {len(CONTENU[langue])} sections")

# Données structurées de la page, sitemap.xml et llms.txt
generer_referencement.main()
