"""
Génère confidentialite.html, nl/confidentialite.html, de/confidentialite.html et
en/confidentialite.html (politique de confidentialité), sur le modèle de a-propos.html.

Registre comme dans generer_a_propos.py : le néerlandais tutoie, l'allemand vouvoie, l'anglais
suit l'orthographe britannique. Texte volontairement sobre : n'ajouter que l'essentiel.

La mécanique commune (métadonnées, fil d'Ariane, sélecteur de langue) vit dans _squelette.py.
La mise en page reprend les classes de style-a-propos.css.

À lancer depuis la racine du dépôt :
    python scripts/generer_confidentialite.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

from pathlib import Path

from _squelette import construire_page, lier_urls_et_emails
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Confidentialité — Mapetanque.be",
        "h1": "Confidentialité",
        "fil": ("Accueil", "Confidentialité"),
        "description": (
            "Ce que Mapetanque.be enregistre quand vous l'utilisez, pourquoi, combien de temps, "
            "qui d'autre y a accès, et comment faire valoir vos droits."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Privacy — Mapetanque.be",
        "h1": "Privacy",
        "fil": ("Home", "Privacy"),
        "description": (
            "Wat Mapetanque.be opslaat wanneer je de site gebruikt, waarom, hoe lang, wie er "
            "nog toegang toe heeft, en hoe je je rechten uitoefent."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Datenschutz — Mapetanque.be",
        "h1": "Datenschutz",
        "fil": ("Startseite", "Datenschutz"),
        "description": (
            "Was Mapetanque.be speichert, wenn Sie die Website nutzen, warum, wie lange, wer "
            "sonst Zugriff hat, und wie Sie Ihre Rechte wahrnehmen."
        ),
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "Privacy — Mapetanque.be",
        "h1": "Privacy",
        "fil": ("Home", "Privacy"),
        "description": (
            "What Mapetanque.be stores when you use it, why, for how long, who else has access, "
            "and how to exercise your rights."
        ),
    },
}

# --- Contenu -------------------------------------------------------------------------------
# Même structure que dans generer_a_propos.py : une section = un titre, des paragraphes, puis
# éventuellement une liste (« liste » : action en gras + suite ; « puces » : texte simple) et
# des paragraphes après la liste. Les adresses web et mail écrites en clair deviennent des liens.

CONTENU = {
    "fr": [
        {
            "titre": "En bref",
            "puces": [
                "Pas de publicité ni de pistage ; aucune donnée n'est vendue ni cédée.",
                "Le compte est facultatif.",
                "Aucun cookie.",
            ],
        },
        {
            "titre": "Responsable",
            "paragraphes": [
                "Mapetanque.be est un site personnel et non commercial, tenu par Rémy Lhoest, "
                "à Liège (Belgique). Contact : mapetanque@outlook.be",
            ],
        },
        {
            "titre": "Ce qui est enregistré",
            "paragraphes": [
                "Aucune donnée personnelle n'est enregistrée lors d'une simple visite. La "
                "mesure d'audience de Cloudflare compte les pages vues, sans cookie ni "
                "identifiant.",
                "Quand vous…",
            ],
            "liste": [
                ("notez un terrain",
                 " : la note. Une empreinte chiffrée (adresse IP + terrain + mois) empêche de "
                 "noter deux fois le même terrain."),
                ("envoyez une photo",
                 " : la photo, sans ses métadonnées hormis la date (exigée par Mapillary), et "
                 "votre pseudo éventuel pour le crédit."),
                ("rédigez un avis",
                 " : le texte, la note, la langue et votre pseudo éventuel. Un identifiant "
                 "aléatoire gardé par votre navigateur permet de remplacer votre avis."),
                ("signalez un terrain ou une erreur",
                 " : l'emplacement et votre commentaire."),
                ("créez un compte",
                 " : votre adresse mail, votre pseudo éventuel, la langue des mails et les "
                 "dates de création et de dernière connexion. Ce que vous envoyez en étant "
                 "connecté est rattaché au compte. Votre adresse n'est jamais affichée."),
                ("jouez avec le compteur en étant connecté",
                 " : chaque partie terminée (date, durée, format, scores, mènes, votre équipe), "
                 "les noms des autres joueurs tels que vous les tapez et, si vous l'indiquez, le "
                 "terrain. Ces noms ne sont visibles que par vous."),
                ("partagez une partie",
                 " : son code de 4 caractères et l'état de la partie. Toute personne qui a le "
                 "code voit le score, les noms des joueurs et votre pseudo. Les joueurs qui la "
                 "rejoignent la reçoivent dans leurs parties ; leur nom est alors relié à leur "
                 "compte, dans leur carnet comme dans le vôtre."),
            ],
            "paragraphes_apres": [
                "La connexion ne conserve que des empreintes chiffrées du lien, du code et de "
                "la session. Une empreinte chiffrée de l'adresse IP limite le nombre de contributions "
                "et de demandes de connexion par jour.",
            ],
        },
        {
            "titre": "Base légale",
            "liste": [
                ("Votre demande",
                 " : le compte et ce que vous envoyez."),
                ("L'intérêt légitime du site",
                 " : la protection contre les abus et la mesure d'audience."),
            ],
        },
        {
            "titre": "Durée de conservation",
            "liste": [
                ("Compte", " : jusqu'à sa suppression."),
                ("Parties et noms des joueurs", " : jusqu'à ce que vous les retiriez, ou jusqu'à la suppression du compte."),
                ("Code d'une partie partagée", " : il ne sert plus 7 jours après la dernière mène."),
                ("Session", " : un an, ou jusqu'à la déconnexion."),
                ("Lien et code de connexion", " : valables 15 minutes, effacés après 24 heures."),
                ("Photo",
                 " : 30 jours au plus en attente de vérification. Retenue, elle est publiée sur "
                 "Mapillary sous licence CC BY-SA, visages et plaques floutés ; sinon, elle est "
                 "supprimée."),
                ("Avis", " : tant qu'il est publié ; refusé ou remplacé, supprimé après 30 jours."),
                ("Signalement", " : un an au plus."),
                ("Note", " : sans limite, de façon anonyme."),
                ("Empreinte de l'adresse IP", " : quelques jours."),
            ],
        },
        {
            "titre": "Prestataires et services tiers",
            "liste": [
                ("Cloudflare",
                 " : traitement des contributions et des connexions, base de données, photos en "
                 "attente, mesure d'audience, protection anti-robots."),
                ("Resend", " : envoi des mails de connexion, depuis l'Europe."),
                ("Google",
                 " : connexion avec un compte Google, si vous la choisissez. Google nous "
                 "transmet votre adresse mail, jamais votre mot de passe."),
                ("GitHub Pages", " : hébergement du site."),
                ("Mapillary", " : publication des photos retenues."),
            ],
            "paragraphes_apres": [
                "Votre navigateur contacte aussi directement, et leur transmet donc votre "
                "adresse IP : les fonds de carte (OpenFreeMap, OpenStreetMap, Esri), la "
                "recherche d'adresse (Nominatim), la bibliothèque de la carte (unpkg), le "
                "lecteur de photos de Mapillary et, sur l'accueil, ipapi.co, qui estime votre "
                "région.",
                "Certains de ces services sont établis aux États-Unis ; les transferts relèvent "
                "du cadre de protection des données UE–États-Unis (Data Privacy Framework).",
            ],
        },
        {
            "titre": "Stockage sur votre appareil",
            "paragraphes": [
                "Le site ne dépose aucun cookie. Votre navigateur garde la langue, les réglages "
                "de la carte, la partie en cours du compteur et les noms de ses joueurs, vos "
                "notes et avis (pour éviter les doublons) et, si vous êtes connecté, votre "
                "session. Ces informations, nécessaires au fonctionnement du site, s'effacent "
                "depuis les réglages du navigateur.",
                "Votre position n'est lue qu'à votre demande (« Me localiser » sur la carte, "
                "terrain d'une partie au compteur) et si vous l'autorisez. Elle sert sur place, "
                "dans le navigateur, et n'est ni envoyée ni gardée : seul le terrain choisi est "
                "enregistré avec la partie.",
            ],
        },
        {
            "titre": "Vos droits",
            "paragraphes": [
                "Vous pouvez accéder à vos données, les corriger, en obtenir une copie, vous "
                "opposer à leur traitement ou en demander la suppression : depuis « Mon "
                "compte » ou à l'adresse mapetanque@outlook.be. Réponse sous un mois.",
                "La suppression du compte est immédiate : adresse, pseudo, sessions, parties et "
                "noms des joueurs sont effacés ; vos notes, avis et photos restent, mais deviennent anonymes. Les "
                "photos publiées sur Mapillary y restent sous licence libre, sauf demande de "
                "retrait.",
                "Vous pouvez aussi introduire une réclamation auprès de l'Autorité de "
                "protection des données.",
            ],
        },
        {
            "titre": "Mise à jour",
            "paragraphes": ["Octobre 2026."],
        },
    ],
    "nl": [
        {
            "titre": "In het kort",
            "puces": [
                "Geen reclame of tracking; er worden geen gegevens verkocht of doorgegeven.",
                "Een account is niet verplicht.",
                "Geen cookies.",
            ],
        },
        {
            "titre": "Verantwoordelijke",
            "paragraphes": [
                "Mapetanque.be is een persoonlijke, niet-commerciële website van Rémy Lhoest, "
                "in Luik (België). Contact: mapetanque@outlook.be",
            ],
        },
        {
            "titre": "Wat er wordt opgeslagen",
            "paragraphes": [
                "Bij een gewoon bezoek worden geen persoonsgegevens opgeslagen. De "
                "bezoekersstatistieken van Cloudflare tellen de bekeken pagina's, zonder cookie "
                "of identificatie.",
                "Wanneer je…",
            ],
            "liste": [
                ("een terrein beoordeelt",
                 ": de beoordeling. Een versleutelde vingerafdruk (IP-adres + terrein + maand) "
                 "voorkomt dat je hetzelfde terrein twee keer beoordeelt."),
                ("een foto verstuurt",
                 ": de foto, zonder metagegevens behalve de datum (vereist door Mapillary), en "
                 "je eventuele bijnaam voor de naamsvermelding."),
                ("een recensie schrijft",
                 ": de tekst, de beoordeling, de taal en je eventuele bijnaam. Een willekeurige "
                 "code die je browser bewaart, laat je toe je recensie te vervangen."),
                ("een terrein of een fout meldt",
                 ": de plaats en je opmerking."),
                ("een account aanmaakt",
                 ": je e-mailadres, je eventuele bijnaam, de taal van de e-mails en de datum "
                 "van aanmaak en van je laatste aanmelding. Wat je verstuurt terwijl je "
                 "aangemeld bent, wordt aan je account gekoppeld. Je adres wordt nooit getoond."),
                ("met de scoreteller speelt terwijl je aangemeld bent",
                 ": elke afgelopen partij (datum, duur, spelvorm, scores, rondes, je team), de "
                 "namen van de andere spelers zoals je ze intypt en, als je die opgeeft, de "
                 "baan. Alleen jij ziet die namen."),
                ("een partij deelt",
                 ": de code van 4 tekens en de stand van de partij. Wie de code heeft, ziet de "
                 "stand, de namen van de spelers en je bijnaam. Spelers die meedoen, krijgen de "
                 "partij bij hun partijen; hun naam wordt dan aan hun account gekoppeld, in hun "
                 "spelerslijst en in de jouwe."),
            ],
            "paragraphes_apres": [
                "Voor het aanmelden worden alleen versleutelde vingerafdrukken van de link, de "
                "code en de sessie bewaard. Een versleutelde vingerafdruk van het IP-adres "
                "beperkt het aantal bijdragen en aanmeldingsverzoeken per dag.",
            ],
        },
        {
            "titre": "Rechtsgrond",
            "liste": [
                ("Je verzoek",
                 ": het account en wat je verstuurt."),
                ("Het gerechtvaardigd belang van de site",
                 ": bescherming tegen misbruik en de bezoekersstatistieken."),
            ],
        },
        {
            "titre": "Bewaartermijn",
            "liste": [
                ("Account", ": tot het verwijderd wordt."),
                ("Partijen en namen van spelers", ": tot je ze verwijdert, of tot je account verwijderd wordt."),
                ("Code van een gedeelde partij", ": werkt niet meer 7 dagen na de laatste ronde."),
                ("Sessie", ": een jaar, of tot je je afmeldt."),
                ("Aanmeldlink en -code", ": 15 minuten geldig, na 24 uur gewist."),
                ("Foto",
                 ": hoogstens 30 dagen in afwachting van controle. Een weerhouden foto wordt "
                 "op Mapillary gepubliceerd onder de CC BY-SA-licentie, met gezichten en "
                 "nummerplaten onherkenbaar gemaakt; anders wordt ze verwijderd."),
                ("Recensie",
                 ": zolang ze gepubliceerd is; geweigerd of vervangen, na 30 dagen verwijderd."),
                ("Melding", ": hoogstens een jaar."),
                ("Beoordeling", ": onbeperkt, anoniem."),
                ("Vingerafdruk van het IP-adres", ": enkele dagen."),
            ],
        },
        {
            "titre": "Dienstverleners en externe diensten",
            "liste": [
                ("Cloudflare",
                 ": verwerking van bijdragen en aanmeldingen, database, foto's in "
                 "afwachting, bezoekersstatistieken, bescherming tegen robots."),
                ("Resend", ": verzending van de aanmeldingsmails, vanuit Europa."),
                ("Google",
                 ": aanmelden met een Google-account, als u daarvoor kiest. Google geeft ons "
                 "uw e-mailadres door, nooit uw wachtwoord."),
                ("GitHub Pages", ": hosting van de site."),
                ("Mapillary", ": publicatie van de weerhouden foto's."),
            ],
            "paragraphes_apres": [
                "Je browser maakt ook rechtstreeks contact met de volgende diensten, die dus je "
                "IP-adres zien: de kaartachtergronden (OpenFreeMap, OpenStreetMap, Esri), het "
                "zoeken naar adressen (Nominatim), de kaartbibliotheek (unpkg), de fotoviewer "
                "van Mapillary en, op de startpagina, ipapi.co, dat je regio inschat.",
                "Sommige van deze diensten zijn in de Verenigde Staten gevestigd; de doorgiften "
                "vallen onder het gegevensbeschermingskader EU-VS (Data Privacy Framework).",
            ],
        },
        {
            "titre": "Opslag op je toestel",
            "paragraphes": [
                "De site plaatst geen cookies. Je browser bewaart de taal, de kaartinstellingen, "
                "de lopende partij in de scoreteller en de namen van de spelers, je "
                "beoordelingen en recensies (om dubbels te vermijden) en, als je aangemeld bent, "
                "je sessie. Die gegevens zijn nodig voor de werking van de site; je kunt ze "
                "wissen in de instellingen van je browser.",
                "Je locatie wordt alleen gelezen als je erom vraagt ('Localiseer mij' op de kaart, "
                "baan van een partij in de scoreteller) en als je het toestaat. Ze wordt ter "
                "plaatse in de browser gebruikt en niet verstuurd of bewaard: alleen de gekozen "
                "baan wordt met de partij bewaard.",
            ],
        },
        {
            "titre": "Je rechten",
            "paragraphes": [
                "Je kunt je gegevens inzien, verbeteren, er een kopie van krijgen, je verzetten "
                "tegen de verwerking ervan of vragen om ze te verwijderen: via 'Mijn account' "
                "of op mapetanque@outlook.be. Antwoord binnen een maand.",
                "Je account wordt onmiddellijk verwijderd: adres, bijnaam, sessies, partijen en "
                "namen van spelers worden gewist; je beoordelingen, recensies en foto's blijven, maar worden anoniem. "
                "Foto's die op Mapillary gepubliceerd zijn, blijven daar onder vrije licentie, "
                "tenzij je vraagt ze te verwijderen.",
                "Je kunt ook een klacht indienen bij de Gegevensbeschermingsautoriteit.",
            ],
        },
        {
            "titre": "Bijgewerkt",
            "paragraphes": ["Oktober 2026."],
        },
    ],
    "de": [
        {
            "titre": "Kurz gesagt",
            "puces": [
                "Keine Werbung und kein Tracking; es werden keine Daten verkauft oder "
                "weitergegeben.",
                "Ein Konto ist freiwillig.",
                "Keine Cookies.",
            ],
        },
        {
            "titre": "Verantwortlicher",
            "paragraphes": [
                "Mapetanque.be ist eine private, nicht kommerzielle Website von Rémy Lhoest in "
                "Lüttich (Belgien). Kontakt: mapetanque@outlook.be",
            ],
        },
        {
            "titre": "Was gespeichert wird",
            "paragraphes": [
                "Bei einem einfachen Besuch werden keine personenbezogenen Daten gespeichert. "
                "Die Besucherstatistik von Cloudflare zählt die aufgerufenen Seiten, ohne "
                "Cookie und ohne Kennung.",
                "Wenn Sie …",
            ],
            "liste": [
                ("einen Platz bewerten",
                 ": die Bewertung. Ein verschlüsselter Fingerabdruck (IP-Adresse + Platz + "
                 "Monat) verhindert, dass Sie denselben Platz zweimal bewerten."),
                ("ein Foto einsenden",
                 ": das Foto, ohne Metadaten außer dem Datum (von Mapillary verlangt), und Ihr "
                 "eventueller Spitzname für die Namensnennung."),
                ("eine Rezension schreiben",
                 ": der Text, die Bewertung, die Sprache und Ihr eventueller Spitzname. Eine "
                 "zufällige Kennung in Ihrem Browser ermöglicht es, Ihre Rezension zu ersetzen."),
                ("einen Platz oder einen Fehler melden",
                 ": der Ort und Ihr Kommentar."),
                ("ein Konto anlegen",
                 ": Ihre E-Mail-Adresse, Ihr eventueller Spitzname, die Sprache der E-Mails "
                 "sowie das Datum der Erstellung und der letzten Anmeldung. Was Sie im "
                 "angemeldeten Zustand einsenden, wird Ihrem Konto zugeordnet. Ihre Adresse wird "
                 "nie angezeigt."),
                ("angemeldet mit dem Punktezähler spielen",
                 ": jede beendete Partie (Datum, Dauer, Spielform, Punktestand, Runden, Ihr "
                 "Team), die Namen der anderen Spieler so, wie Sie sie eingeben, und, falls Sie "
                 "ihn angeben, der Platz. Nur Sie sehen diese Namen."),
                ("eine Partie teilen",
                 ": ihr Code aus 4 Zeichen und der Stand der Partie. Wer den Code hat, sieht den "
                 "Stand, die Namen der Spieler und Ihren Spitznamen. Spieler, die beitreten, "
                 "erhalten die Partie in ihren Partien; ihr Name wird dann mit ihrem Konto "
                 "verknüpft, in ihrer Spielerliste wie in Ihrer."),
            ],
            "paragraphes_apres": [
                "Für die Anmeldung werden nur verschlüsselte Fingerabdrücke des Links, des Codes "
                "und der Sitzung gespeichert. Ein verschlüsselter Fingerabdruck der IP-Adresse "
                "begrenzt die Zahl der Beiträge und Anmeldeanfragen pro Tag.",
            ],
        },
        {
            "titre": "Rechtsgrundlage",
            "liste": [
                ("Ihre Anfrage",
                 ": das Konto und alles, was Sie einsenden."),
                ("Das berechtigte Interesse der Website",
                 ": Schutz vor Missbrauch und Besucherstatistik."),
            ],
        },
        {
            "titre": "Speicherdauer",
            "liste": [
                ("Konto", ": bis zu seiner Löschung."),
                ("Partien und Namen der Spieler", ": bis Sie sie entfernen oder Ihr Konto gelöscht wird."),
                ("Code einer geteilten Partie", ": gilt bis 7 Tage nach der letzten Runde."),
                ("Sitzung", ": ein Jahr oder bis zur Abmeldung."),
                ("Anmeldelink und -code", ": 15 Minuten gültig, nach 24 Stunden gelöscht."),
                ("Foto",
                 ": höchstens 30 Tage bis zur Prüfung. Ein angenommenes Foto wird unter der "
                 "CC-BY-SA-Lizenz auf Mapillary veröffentlicht, mit unkenntlich gemachten "
                 "Gesichtern und Kennzeichen; andernfalls wird es gelöscht."),
                ("Rezension",
                 ": solange sie veröffentlicht ist; abgelehnt oder ersetzt, nach 30 Tagen "
                 "gelöscht."),
                ("Meldung", ": höchstens ein Jahr."),
                ("Bewertung", ": unbegrenzt, anonym."),
                ("Fingerabdruck der IP-Adresse", ": einige Tage."),
            ],
        },
        {
            "titre": "Dienstleister und Drittdienste",
            "liste": [
                ("Cloudflare",
                 ": Verarbeitung von Beiträgen und Anmeldungen, Datenbank, Fotos in "
                 "Prüfung, Besucherstatistik, Schutz vor Bots."),
                ("Resend", ": Versand der Anmelde-E-Mails, aus Europa."),
                ("Google",
                 ": Anmeldung mit einem Google-Konto, wenn Sie diese wählen. Google übermittelt "
                 "uns Ihre E-Mail-Adresse, niemals Ihr Passwort."),
                ("GitHub Pages", ": Hosting der Website."),
                ("Mapillary", ": Veröffentlichung der angenommenen Fotos."),
            ],
            "paragraphes_apres": [
                "Ihr Browser kontaktiert außerdem direkt folgende Dienste, die dabei Ihre "
                "IP-Adresse erhalten: die Kartenhintergründe (OpenFreeMap, OpenStreetMap, Esri), "
                "die Adresssuche (Nominatim), die Kartenbibliothek (unpkg), den Fotobetrachter "
                "von Mapillary und, auf der Startseite, ipapi.co, das Ihre Region schätzt.",
                "Einige dieser Dienste haben ihren Sitz in den USA; die Übermittlungen erfolgen "
                "im Rahmen des Datenschutzrahmens EU–USA (Data Privacy Framework).",
            ],
        },
        {
            "titre": "Speicherung auf Ihrem Gerät",
            "paragraphes": [
                "Die Website setzt keine Cookies. Ihr Browser speichert die Sprache, die "
                "Karteneinstellungen, die laufende Partie im Punktezähler und die Namen ihrer "
                "Spieler, Ihre Bewertungen und Rezensionen (um Doppelungen zu vermeiden) und, "
                "wenn Sie angemeldet sind, Ihre Sitzung. Diese Angaben sind für den Betrieb der "
                "Website erforderlich; Sie können sie in den Einstellungen Ihres Browsers "
                "löschen.",
                "Ihr Standort wird nur auf Ihre Anfrage gelesen („Mein Standort“ auf der Karte, "
                "Platz einer Partie im Punktezähler) und nur, wenn Sie es erlauben. Er wird vor "
                "Ort im Browser verwendet, weder gesendet noch gespeichert: Nur der gewählte "
                "Platz wird mit der Partie gespeichert.",
            ],
        },
        {
            "titre": "Ihre Rechte",
            "paragraphes": [
                "Sie können Ihre Daten einsehen, berichtigen, eine Kopie erhalten, der "
                "Verarbeitung widersprechen oder ihre Löschung verlangen: unter „Mein Konto“ "
                "oder unter mapetanque@outlook.be. Antwort innerhalb eines Monats.",
                "Die Löschung des Kontos erfolgt sofort: Adresse, Spitzname, Sitzungen, Partien "
                "und Namen der Spieler werden gelöscht; Ihre Bewertungen, Rezensionen und Fotos bleiben erhalten, werden "
                "aber anonym. Auf Mapillary veröffentlichte Fotos bleiben dort unter freier "
                "Lizenz, sofern Sie nicht ihre Entfernung verlangen.",
                "Sie können außerdem Beschwerde bei der belgischen Datenschutzbehörde einreichen.",
            ],
        },
        {
            "titre": "Stand",
            "paragraphes": ["Oktober 2026."],
        },
    ],
    "en": [
        {
            "titre": "In short",
            "puces": [
                "No advertising or tracking; no data is sold or passed on.",
                "An account is optional.",
                "No cookies.",
            ],
        },
        {
            "titre": "Data controller",
            "paragraphes": [
                "Mapetanque.be is a personal, non-commercial website run by Rémy Lhoest in "
                "Liège (Belgium). Contact: mapetanque@outlook.be",
            ],
        },
        {
            "titre": "What is stored",
            "paragraphes": [
                "No personal data is stored during a simple visit. Cloudflare's visitor "
                "statistics count page views, without cookies or identifiers.",
                "When you…",
            ],
            "liste": [
                ("rate a court",
                 ": the rating. A hashed fingerprint (IP address + court + month) prevents you "
                 "from rating the same court twice."),
                ("send a photo",
                 ": the photo, without its metadata except the date (required by Mapillary), "
                 "and your optional nickname for the credit."),
                ("write a review",
                 ": the text, the rating, the language and your optional nickname. A random "
                 "identifier kept by your browser lets you replace your review."),
                ("report a court or an error",
                 ": the location and your comment."),
                ("create an account",
                 ": your email address, your optional nickname, the language of your emails, "
                 "and the dates of creation and last sign-in. What you send while signed in is "
                 "linked to your account. Your address is never displayed."),
                ("play with the score counter while signed in",
                 ": each finished game (date, length, format, scores, ends, your team), the "
                 "names of the other players as you type them and, if you add it, the court. "
                 "Only you can see these names."),
                ("share a game",
                 ": its 4-character code and the state of the game. Anyone with the code sees "
                 "the score, the players' names and your nickname. Players who join get the game "
                 "in their games; their name is then linked to their account, in their player "
                 "list and in yours."),
            ],
            "paragraphes_apres": [
                "Signing in only stores hashed fingerprints of the link, the code and the "
                "session. A hashed fingerprint of the IP address limits the number of contributions "
                "and sign-in requests per day.",
            ],
        },
        {
            "titre": "Legal basis",
            "liste": [
                ("Your request",
                 ": the account and what you send."),
                ("The site's legitimate interest",
                 ": protection against abuse and visitor statistics."),
            ],
        },
        {
            "titre": "Retention period",
            "liste": [
                ("Account", ": until it is deleted."),
                ("Games and player names", ": until you remove them, or until your account is deleted."),
                ("Code of a shared game", ": stops working 7 days after the last end."),
                ("Session", ": one year, or until you sign out."),
                ("Sign-in link and code", ": valid for 15 minutes, erased after 24 hours."),
                ("Photo",
                 ": 30 days at most awaiting review. If kept, it is published on Mapillary "
                 "under a CC BY-SA licence, with faces and licence plates blurred; otherwise, "
                 "it is deleted."),
                ("Review",
                 ": as long as it is published; rejected or replaced, deleted after 30 days."),
                ("Report", ": one year at most."),
                ("Rating", ": indefinitely, anonymously."),
                ("IP address fingerprint", ": a few days."),
            ],
        },
        {
            "titre": "Service providers and third-party services",
            "liste": [
                ("Cloudflare",
                 ": processing of contributions and sign-ins, database, photos awaiting review, "
                 "visitor statistics, bot protection."),
                ("Resend", ": sending of sign-in emails, from Europe."),
                ("Google",
                 ": sign-in with a Google account, if you choose it. Google passes on your "
                 "email address to us, never your password."),
                ("GitHub Pages", ": hosting of the site."),
                ("Mapillary", ": publication of accepted photos."),
            ],
            "paragraphes_apres": [
                "Your browser also contacts the following services directly, which therefore "
                "see your IP address: map backgrounds (OpenFreeMap, OpenStreetMap, Esri), "
                "address search (Nominatim), the map library (unpkg), Mapillary's photo viewer "
                "and, on the home page, ipapi.co, which estimates your region.",
                "Some of these services are based in the United States; transfers fall under "
                "the EU–US Data Privacy Framework.",
            ],
        },
        {
            "titre": "Storage on your device",
            "paragraphes": [
                "The site sets no cookies. Your browser keeps your language, map settings, the "
                "game in progress in the score counter and its player names, your ratings and "
                "reviews (to avoid duplicates) and, if you are signed in, your session. This "
                "information is needed for the site to work; you can clear it in your browser "
                "settings.",
                "Your location is only read when you ask for it ('Locate me' on the map, the "
                "court of a game in the score counter) and if you allow it. It is used on the "
                "spot, in your browser, and is neither sent nor kept: only the chosen court is "
                "saved with the game.",
            ],
        },
        {
            "titre": "Your rights",
            "paragraphes": [
                "You can access your data, correct it, obtain a copy, object to its processing "
                "or ask for it to be deleted: from 'My account' or at mapetanque@outlook.be. "
                "Reply within one month.",
                "Deleting your account takes effect immediately: address, nickname, sessions, "
                "games and player names are erased; your ratings, reviews and photos remain, but become "
                "anonymous. Photos published on Mapillary stay there under an open licence, "
                "unless you ask for them to be removed.",
                "You may also lodge a complaint with the Belgian Data Protection Authority.",
            ],
        },
        {
            "titre": "Last updated",
            "paragraphes": ["October 2026."],
        },
    ],
}


def bloc_contenu(langue):
    morceaux = []
    for section in CONTENU[langue]:
        morceaux.append('            <section class="apropos-section">')
        morceaux.append(f'                <h2>{lier_urls_et_emails(section["titre"])}</h2>')

        for para in section.get("paragraphes", []):
            morceaux.append(f"                <p>{lier_urls_et_emails(para)}</p>")

        if section.get("liste") or section.get("puces"):
            morceaux.append('                <ul class="apropos-liste">')
            for tete, suite in section.get("liste", []):
                morceaux.append(
                    f"                    <li><strong>{lier_urls_et_emails(tete)}</strong>"
                    f"{lier_urls_et_emails(suite)}</li>"
                )
            for puce in section.get("puces", []):
                morceaux.append(f"                    <li>{lier_urls_et_emails(puce)}</li>")
            morceaux.append("                </ul>")

        for para in section.get("paragraphes_apres", []):
            morceaux.append(f"                <p>{lier_urls_et_emails(para)}</p>")

        morceaux.append("            </section>\n")
    return "\n".join(morceaux)


for langue, meta in META.items():
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "confidentialite.html",
        page="confidentialite.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=bloc_contenu(langue),
        feuilles_sup=("/style-a-propos.css",),
    )
    print(f"{meta['prefixe']}confidentialite.html : {taille} octets, {len(CONTENU[langue])} sections")

# Données structurées de la page, sitemap.xml et llms.txt
generer_referencement.main()
