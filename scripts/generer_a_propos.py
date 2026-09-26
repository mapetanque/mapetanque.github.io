"""
Génère a-propos.html, nl/a-propos.html et de/a-propos.html à partir des pages
« Comment jouer » du dépôt.

La mécanique commune (métadonnées, bannière, fil d'Ariane, sélecteur de langue) vit dans
_squelette.py, partagée avec generer_faq.py.

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
}

# --- Contenu -------------------------------------------------------------------------------
# Le texte vit ici plutôt que dans translations.js : les pages de contenu du site suivent déjà
# ce principe, et le dupliquer créerait deux sources de vérité.
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
                "Mapetanque.be ne dépose aucun cookie publicitaire et ne transmet vos données à "
                "personne. Votre navigateur conserve seulement, en local sur votre appareil, votre "
                "langue et vos préférences d'affichage.",
                "Les notes que vous donnez aux terrains sont enregistrées sans votre nom ni "
                "votre adresse IP. Pour éviter qu'un même visiteur note vingt fois le même "
                "terrain, le site calcule une empreinte chiffrée à partir de votre adresse IP, "
                "du terrain concerné et du mois en cours. Cette empreinte ne permet pas de "
                "remonter à vous, et elle change chaque mois.",
                "Quand vous envoyez une photo, votre navigateur la réduit et efface ses "
                "métadonnées avant l'envoi : ni le modèle de votre appareil, ni les coordonnées "
                "GPS d'origine ne quittent votre téléphone. Seule la date de prise de vue est "
                "conservée, car Mapillary l'exige. La position associée à la photo est celle du "
                "terrain, pas la vôtre.",
                "La photo est ensuite stockée sur un serveur européen le temps que je la "
                "vérifie. Si je ne la retiens pas, elle est supprimée immédiatement. Si je ne l'ai "
                "pas vérifiée dans les 30 jours, elle est supprimée automatiquement. Si je la "
                "retiens, elle est publiée sur Mapillary sous licence CC BY-SA, comme la case du "
                "formulaire vous l'indique, puis effacée de ce stockage temporaire. Mapillary "
                "floute automatiquement les visages et les plaques d'immatriculation après "
                "publication.",
                "Pour limiter les envois abusifs, le site calcule aussi une empreinte chiffrée de "
                "votre adresse IP. Elle sert seulement à compter vos envois de la journée, et elle "
                "est effacée au bout de quelques jours.",
                "Si vous indiquez un prénom ou un pseudonyme, il ne sert qu'à vous créditer. "
                "Vous pouvez à tout moment demander le retrait d'une photo que vous avez "
                "envoyée, en écrivant à mapetanque@outlook.be.",
                "Le site est hébergé par GitHub Pages et les envois transitent par Cloudflare. "
                "Ces prestataires conservent des journaux techniques qui leur sont propres.",
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
                "Mapetanque.be plaatst geen reclamecookies en geeft je gegevens aan niemand door. "
                "Je browser bewaart alleen, lokaal op je toestel, je taal en je "
                "weergavevoorkeuren.",
                "De punten die je aan terreinen geeft, worden opgeslagen zonder je naam of je "
                "IP-adres. Om te vermijden dat dezelfde bezoeker twintig keer hetzelfde terrein "
                "beoordeelt, berekent de site een versleutelde vingerafdruk op basis van je "
                "IP-adres, het betrokken terrein en de lopende maand. Die vingerafdruk leidt "
                "niet naar jou terug, en ze verandert elke maand.",
                "Wanneer je een foto verstuurt, verkleint je browser ze en wist hij de "
                "metagegevens vóór het versturen: noch het model van je toestel, noch de "
                "oorspronkelijke GPS-coördinaten verlaten je telefoon. Alleen de opnamedatum "
                "blijft bewaard, omdat Mapillary die vereist. De positie die aan de foto "
                "gekoppeld wordt, is die van het terrein, niet de jouwe.",
                "De foto wordt vervolgens op een Europese server bewaard zolang ik ze nog moet "
                "nakijken. Als ik ze niet weerhoud, wordt ze onmiddellijk verwijderd. Als ik ze "
                "niet binnen 30 dagen heb nagekeken, wordt ze automatisch verwijderd. Als ik ze "
                "wel weerhoud, wordt ze op Mapillary gepubliceerd onder de CC BY-SA-licentie, "
                "zoals het vakje in het formulier aangeeft, en daarna uit die tijdelijke opslag "
                "gewist. Mapillary maakt gezichten en nummerplaten na publicatie automatisch "
                "onherkenbaar.",
                "Om misbruik te beperken, berekent de site ook een versleutelde vingerafdruk van "
                "je IP-adres. Die dient alleen om je verzendingen van de dag te tellen en wordt "
                "na enkele dagen gewist.",
                "Als je een voornaam of een pseudoniem opgeeft, dient dat alleen voor de "
                "naamsvermelding. Je kan op elk moment vragen om een foto die je hebt verstuurd "
                "te verwijderen, via mapetanque@outlook.be.",
                "De site wordt gehost door GitHub Pages en de verzendingen lopen via Cloudflare. "
                "Die dienstverleners houden hun eigen technische logboeken bij.",
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
                "Mapetanque.be setzt keine Werbe-Cookies und gibt Ihre Daten an niemanden weiter. "
                "Ihr Browser speichert lediglich, lokal auf Ihrem Gerät, Ihre Sprache und Ihre "
                "Anzeigeeinstellungen.",
                "Die Bewertungen, die Sie für Plätze abgeben, werden ohne Ihren Namen und ohne "
                "Ihre IP-Adresse gespeichert. Damit nicht derselbe Besucher denselben Platz "
                "zwanzigmal bewertet, berechnet die Website einen verschlüsselten Fingerabdruck "
                "aus Ihrer IP-Adresse, dem betreffenden Platz und dem laufenden Monat. Dieser "
                "Fingerabdruck lässt keinen Rückschluss auf Sie zu und ändert sich jeden Monat.",
                "Wenn Sie ein Foto einsenden, verkleinert Ihr Browser es und löscht seine "
                "Metadaten vor dem Versand: weder das Modell Ihres Geräts noch die "
                "ursprünglichen GPS-Koordinaten verlassen Ihr Telefon. Nur das Aufnahmedatum "
                "bleibt erhalten, weil Mapillary es verlangt. Die dem Foto zugeordnete Position "
                "ist die des Platzes, nicht Ihre.",
                "Das Foto wird anschließend auf einem europäischen Server gespeichert, solange "
                "ich es noch prüfen muss. Nehme ich es nicht an, wird es sofort gelöscht. Habe ich "
                "es nicht innerhalb von 30 Tagen geprüft, wird es automatisch gelöscht. Nehme "
                "ich es an, wird es unter der CC-BY-SA-Lizenz auf Mapillary veröffentlicht, wie "
                "es das Kästchen im Formular angibt, und danach aus diesem Zwischenspeicher "
                "entfernt. Mapillary macht Gesichter und Kennzeichen nach der Veröffentlichung "
                "automatisch unkenntlich.",
                "Um Missbrauch zu begrenzen, berechnet die Website außerdem einen verschlüsselten "
                "Fingerabdruck Ihrer IP-Adresse. Er dient nur dazu, Ihre Einsendungen des Tages zu "
                "zählen, und wird nach einigen Tagen gelöscht.",
                "Wenn Sie einen Vornamen oder ein Pseudonym angeben, dient dies allein der "
                "Namensnennung. Sie können jederzeit die Entfernung eines von Ihnen gesendeten "
                "Fotos verlangen, unter mapetanque@outlook.be.",
                "Die Website wird von GitHub Pages gehostet, und die Einsendungen laufen über "
                "Cloudflare. Diese Anbieter führen ihre eigenen technischen Protokolle.",
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
            'Photo : Marianne Casamance, '
            '<a href="https://creativecommons.org/licenses/by-sa/4.0" target="_blank" '
            'rel="noopener">CC BY-SA 4.0</a>'
        ),
    )
    print(f"{meta['prefixe']}a-propos.html : {taille} octets, {len(CONTENU[langue])} sections")
