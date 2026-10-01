"""
Génère a-propos.html, nl/a-propos.html, de/a-propos.html et en/a-propos.html à partir des pages
« Comment jouer » du dépôt.

La mécanique commune (métadonnées, bannière, fil d'Ariane, sélecteur de langue) vit dans
_squelette.py, partagée avec generer_la_petanque.py.

À lancer depuis la racine du dépôt :
    python scripts/generer_a_propos.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

from pathlib import Path

from _squelette import construire_page, echap

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
                "a pourtant plus de mille sept cents.",
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
                "alimente. Chaque terrain qui m'est signalé est ajouté à OpenStreetMap, et "
                "chaque photo reçue est publiée sur Mapillary avant d'être affichée ici. Ce qui "
                "est collecté pour ce site profite donc à tout le monde.",
                "Le site est gratuit, sans publicité, et développé sur mon temps libre.",
            ],
        },
        {
            "titre": "Vos données",
            "paragraphes": [
                "En bref : pas de cookie publicitaire, pas de compte, et rien n'est transmis à "
                "qui que ce soit. Votre langue et vos préférences d'affichage restent sur "
                "votre appareil.",
                "Ce qui est enregistré quand vous…",
            ],
            # Une puce par action : l'action en gras, puis ce qui est enregistré.
            "liste": [
                ("notez un terrain",
                 " : la note seule. Une empreinte chiffrée (adresse IP + terrain + mois), qui "
                 "ne permet pas de vous identifier et change chaque mois, empêche de noter "
                 "plusieurs fois le même terrain."),
                ("envoyez une photo",
                 " : la photo, réduite et débarrassée de ses métadonnées (ni modèle "
                 "d'appareil, ni GPS ; seule la date est gardée, car Mapillary l'exige). Elle "
                 "est placée sur le terrain, pas là où vous êtes. Votre prénom ou pseudo "
                 "éventuel sert seulement à vous créditer. Elle attend ma vérification sur un "
                 "serveur européen, 30 jours au plus. Si je la retiens, elle est publiée sur "
                 "Mapillary sous licence CC BY-SA, avec les visages et les plaques floutés. "
                 "Sinon, elle est supprimée."),
                ("rédigez un avis",
                 " : le texte, votre prénom ou pseudo éventuel, la langue et votre note. Un "
                 "identifiant aléatoire gardé par votre navigateur permet à un nouvel avis de "
                 "remplacer l'ancien. L'avis est publié après relecture ; refusé ou remplacé, "
                 "il est supprimé au bout de 30 jours."),
                ("signalez un terrain ou une erreur",
                 " : l'emplacement et votre commentaire, supprimés au plus tard un an après."),
            ],
            "paragraphes_apres": [
                "Pour limiter les abus, une empreinte chiffrée de votre adresse IP compte vos "
                "envois de la journée ; elle est effacée au bout de quelques jours.",
                "Le site est hébergé par GitHub Pages et les envois passent par Cloudflare, "
                "qui tiennent leurs propres journaux techniques. Pour faire retirer une photo "
                "ou un avis : mapetanque@outlook.be.",
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
                "terrein dat mij gemeld wordt, voeg ik toe aan OpenStreetMap, en elke foto die "
                "ik ontvang wordt op Mapillary gepubliceerd voordat ze hier verschijnt. Wat voor "
                "deze site verzameld wordt, komt dus iedereen ten goede.",
                "De site is gratis, zonder reclame, en wordt in mijn vrije tijd ontwikkeld.",
            ],
        },
        {
            "titre": "Je gegevens",
            "paragraphes": [
                "Kort gezegd: geen reclamecookies, geen account, en niets wordt aan wie dan "
                "ook doorgegeven. Je taal en je weergavevoorkeuren blijven op je toestel.",
                "Wat er wordt opgeslagen wanneer je…",
            ],
            # Une puce par action : l'action en gras, puis ce qui est enregistré.
            "liste": [
                ("een terrein beoordeelt",
                 ": alleen de beoordeling. Een versleutelde vingerafdruk (IP-adres + terrein + "
                 "maand), die niet naar jou terugleidt en elke maand verandert, voorkomt dat "
                 "je hetzelfde terrein meermaals beoordeelt."),
                ("een foto verstuurt",
                 ": de foto, verkleind en ontdaan van metagegevens (geen toestelmodel, geen "
                 "GPS; alleen de opnamedatum blijft, omdat Mapillary die vereist). Ze wordt op "
                 "het terrein geplaatst, niet waar jij bent. Je eventuele voornaam of bijnaam "
                 "dient alleen voor de naamsvermelding. De foto wacht op een Europese server "
                 "tot ik ze nakijk, hoogstens 30 dagen. Als ik ze weerhoud, wordt ze op "
                 "Mapillary gepubliceerd onder de CC BY-SA-licentie, met gezichten en "
                 "nummerplaten onherkenbaar gemaakt. Anders wordt ze verwijderd."),
                ("een recensie schrijft",
                 ": de tekst, je eventuele voornaam of bijnaam, de taal en je beoordeling. Een "
                 "willekeurige code die je browser bewaart, laat een nieuwe recensie de "
                 "vorige vervangen. De recensie verschijnt na controle; een geweigerde of "
                 "vervangen recensie wordt na 30 dagen verwijderd."),
                ("een terrein of een fout meldt",
                 ": de plaats en je opmerking, uiterlijk na een jaar verwijderd."),
            ],
            "paragraphes_apres": [
                "Om misbruik te beperken, telt een versleutelde vingerafdruk van je IP-adres "
                "je verzendingen van de dag; die wordt na enkele dagen gewist.",
                "De site wordt gehost door GitHub Pages en de verzendingen lopen via "
                "Cloudflare, die hun eigen technische logboeken bijhouden. Om een foto of "
                "recensie te laten verwijderen: mapetanque@outlook.be.",
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
                "hinzugefügt, und jedes eingesandte Foto wird auf Mapillary veröffentlicht, "
                "bevor es hier erscheint. Was für diese Website gesammelt wird, kommt also allen "
                "zugute.",
                "Die Website ist kostenlos, werbefrei und entsteht in meiner Freizeit.",
            ],
        },
        {
            "titre": "Ihre Daten",
            "paragraphes": [
                "Kurz gesagt: keine Werbe-Cookies, kein Konto, und nichts wird an Dritte "
                "weitergegeben. Ihre Sprache und Ihre Anzeigeeinstellungen bleiben auf Ihrem "
                "Gerät.",
                "Was gespeichert wird, wenn Sie …",
            ],
            # Une puce par action : l'action en gras, puis ce qui est enregistré.
            "liste": [
                ("einen Platz bewerten",
                 ": nur die Bewertung. Ein verschlüsselter Fingerabdruck (IP-Adresse + Platz + "
                 "Monat), der keinen Rückschluss auf Sie zulässt und sich jeden Monat ändert, "
                 "verhindert, dass Sie denselben Platz mehrfach bewerten."),
                ("ein Foto einsenden",
                 ": das Foto, verkleinert und ohne Metadaten (weder Gerätemodell noch GPS; nur "
                 "das Aufnahmedatum bleibt, weil Mapillary es verlangt). Es wird dem Platz "
                 "zugeordnet, nicht Ihrem Standort. Ihr eventueller Vorname oder Spitzname "
                 "dient allein der Namensnennung. Das Foto wartet auf einem europäischen "
                 "Server auf meine Prüfung, höchstens 30 Tage. Nehme ich es an, wird es unter "
                 "der CC-BY-SA-Lizenz auf Mapillary veröffentlicht, mit unkenntlich gemachten "
                 "Gesichtern und Kennzeichen. Andernfalls wird es gelöscht."),
                ("eine Rezension schreiben",
                 ": der Text, Ihr eventueller Vorname oder Spitzname, die Sprache und Ihre "
                 "Bewertung. Eine zufällige Kennung in Ihrem Browser sorgt dafür, dass eine "
                 "neue Rezension die vorherige ersetzt. Die Rezension erscheint nach Prüfung; "
                 "eine abgelehnte oder ersetzte Rezension wird nach 30 Tagen gelöscht."),
                ("einen Platz oder einen Fehler melden",
                 ": der Ort und Ihr Kommentar, spätestens nach einem Jahr gelöscht."),
            ],
            "paragraphes_apres": [
                "Um Missbrauch zu begrenzen, zählt ein verschlüsselter Fingerabdruck Ihrer IP-"
                "Adresse Ihre Einsendungen des Tages; er wird nach einigen Tagen gelöscht.",
                "Die Website wird von GitHub Pages gehostet, und die Einsendungen laufen über "
                "Cloudflare; diese Anbieter führen ihre eigenen technischen Protokolle. Um ein "
                "Foto oder eine Rezension entfernen zu lassen: mapetanque@outlook.be.",
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
                "the freely accessible pétanque courts in Belgium. And yet there are more than "
                "1,700 of them.",
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
                "them. Every court reported to me is added to OpenStreetMap, and every photo I "
                "receive is published on Mapillary before appearing here. What is collected for "
                "this site therefore benefits everyone.",
                "The site is free, ad-free, and developed in my spare time.",
            ],
        },
        {
            "titre": "Your data",
            "paragraphes": [
                "In short: no advertising cookies, no account, and nothing is passed on to "
                "anyone. Your language and display preferences stay on your device.",
                "What is stored when you…",
            ],
            # Une puce par action : l'action en gras, puis ce qui est enregistré.
            "liste": [
                ("rate a court",
                 ": the rating alone. A hashed fingerprint (IP address + court + month), which "
                 "cannot be traced back to you and changes every month, prevents you from "
                 "rating the same court more than once."),
                ("send a photo",
                 ": the photo, shrunk and stripped of its metadata (no device model, no GPS; "
                 "only the date it was taken is kept, because Mapillary requires it). It is "
                 "placed at the court, not where you are. Your optional first name or nickname "
                 "is only used to credit you. The photo waits on a European server for me to "
                 "check it, for 30 days at most. If I keep it, it is published on Mapillary "
                 "under a CC BY-SA licence, with faces and licence plates blurred. Otherwise, "
                 "it is deleted."),
                ("write a review",
                 ": the text, your optional first name or nickname, the site language and your "
                 "rating. A random identifier kept by your browser lets a new review replace "
                 "your previous one. Reviews are published after moderation; a rejected or "
                 "replaced review is deleted after 30 days."),
                ("report a court or an error",
                 ": the location and your comment, deleted within a year at the latest."),
            ],
            "paragraphes_apres": [
                "To limit abuse, a hashed fingerprint of your IP address counts your uploads "
                "for the day; it is erased after a few days.",
                "The site is hosted by GitHub Pages and uploads go through Cloudflare, which "
                "keep their own technical logs. To have a photo or review removed: "
                "mapetanque@outlook.be.",
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

        if section.get("liste"):
            morceaux.append('                <ul class="apropos-liste">')
            for tete, suite in section["liste"]:
                morceaux.append(
                    f"                    <li><strong>{echap(tete)}</strong>{echap(suite)}</li>"
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
        banniere="/images/banniere-a-propos.webp",
        credit=(
            'Photo : jackmac34, '
            '<a href="https://pixabay.com/fr/photos/p%C3%A9tanque-boules-jeu-mains-adresse-3629216/" '
            'target="_blank" rel="noopener">Pixabay</a>'
        ),
    )
    print(f"{meta['prefixe']}a-propos.html : {taille} octets, {len(CONTENU[langue])} sections")