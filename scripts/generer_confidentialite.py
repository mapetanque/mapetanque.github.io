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
                ("donnez un coup de cœur à un terrain",
                 " : le cœur et les critères que vous confirmez (ombragé, abrité…). Une "
                 "empreinte chiffrée (adresse IP + terrain + mois) empêche d'en donner deux au "
                 "même terrain."),
                ("envoyez une photo",
                 " : la photo, sans ses métadonnées hormis la date (exigée par Mapillary), et "
                 "votre pseudo éventuel pour le crédit. Si vous êtes connecté, vous êtes prévenu par "
                 "mail de la suite donnée."),
                ("signalez un terrain ou une erreur",
                 " : l'emplacement, votre commentaire et votre adresse mail, qui sert à vous "
                 "prévenir de la suite donnée."),
                ("créez un compte",
                 " : votre adresse mail, votre pseudo éventuel, la langue des mails et les "
                 "dates de création et de dernière connexion. Ce que vous envoyez en étant "
                 "connecté est rattaché au compte. Votre adresse n'est jamais affichée."),
                ("jouez une partie en ligne, connecté",
                 " : la partie (date, durée, format, mènes et scores, noms des équipes et "
                 "terrain si vous les indiquez), votre place (équipe ou spectateur) et qui "
                 "marque. Chaque modification est notée : qui, quand, quoi."),
                ("rejoignez une partie",
                 " : avec son code de 4 caractères, en étant connecté, même pour regarder. Les "
                 "inscrits d'une partie voient les pseudos des autres inscrits ; les joueurs "
                 "sans compte n'y sont que des invités, sans nom."),
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
                ("Parties", " : tant qu'un joueur avec un compte la garde dans ses parties ; elle est effacée quand le dernier la retire ou supprime son compte."),
                ("Code d'une partie", " : il sert jusqu'à 7 jours après la dernière modification d'une partie en cours, et 3 jours après sa fin."),
                ("Session", " : un an, ou jusqu'à la déconnexion."),
                ("Lien et code de connexion", " : valables 15 minutes, effacés après 24 heures."),
                ("Photo",
                 " : 30 jours au plus en attente de vérification. Retenue, elle est publiée sur "
                 "le site et, le plus souvent, sur Mapillary, sous licence CC BY-SA ; une photo "
                 "montrant des visages ou des plaques n'est publiée qu'une fois floutée. Sinon, "
                 "elle est supprimée."),
                ("Signalement", " : conservé pour garder une trace des corrections. Envoyé sans compte, son adresse e-mail est effacée après un an. Une photo jointe peut être ajoutée à la fiche du terrain ; sinon, elle est effacée 30 jours après le traitement du signalement."),
                ("Coup de cœur", " : sans limite, de façon anonyme (rattaché au compte si vous êtes connecté)."),
                ("Empreinte de l'adresse IP", " : quelques jours."),
            ],
        },
        {
            "titre": "Prestataires et services tiers",
            "liste": [
                ("Cloudflare",
                 " : traitement des contributions et des connexions, base de données, photos en "
                 "attente, grandes versions des photos publiées, mesure d'audience, protection "
                 "anti-robots."),
                ("Resend", " : envoi des mails de connexion et des mails qui vous préviennent de la suite donnée à vos contributions, depuis l'Europe."),
                ("Google",
                 " : connexion avec un compte Google, si vous la choisissez. Google nous "
                 "transmet votre adresse mail, jamais votre mot de passe."),
                ("GitHub Pages", " : hébergement du site et des photos publiées."),
                ("Mapillary", " : publication des photos retenues."),
                ("Ko-fi",
                 " : dons, si vous choisissez de soutenir le site. Le paiement se fait sur "
                 "son site : Mapetanque.be ne voit jamais vos coordonnées bancaires."),
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
                "de la carte, la partie en cours du compteur et les noms de ses équipes, les "
                "mènes d'une partie en ligne pas encore envoyées, vos "
                "coups de cœur (pour les retrouver et éviter les doublons) et, si vous êtes connecté, votre "
                "session. Ces informations, nécessaires au fonctionnement du site, s'effacent "
                "depuis les réglages du navigateur.",
                "Votre position n'est lue qu'à votre demande (« Me localiser » sur la carte, "
                "terrain d'une partie en ligne) et si vous l'autorisez. Elle sert sur place, "
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
                "La suppression du compte est immédiate : adresse, pseudo, sessions et vos "
                "places dans les parties sont effacés (les parties restent chez les autres "
                "joueurs, votre place y devient un invité) ; vos coups de cœur, photos et signalements restent, mais deviennent anonymes. Les "
                "photos publiées restent en ligne sous licence libre, sauf demande de "
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
                ("een terrein een hartje geeft",
                 ": het hartje en de kenmerken die je bevestigt (schaduw, beschut…). Een "
                 "versleutelde vingerafdruk (IP-adres + terrein + maand) voorkomt dat je "
                 "hetzelfde terrein twee hartjes geeft."),
                ("een foto verstuurt",
                 ": de foto, zonder metagegevens behalve de datum (vereist door Mapillary), en "
                 "je eventuele bijnaam voor de naamsvermelding. Ben je aangemeld, dan laten we je "
                 "per e-mail weten wat ermee gebeurd is."),
                ("een terrein of een fout meldt",
                 ": de plaats, je opmerking en je e-mailadres, waarmee we je laten weten wat "
                 "ermee gebeurd is."),
                ("een account aanmaakt",
                 ": je e-mailadres, je eventuele bijnaam, de taal van de e-mails en de datum "
                 "van aanmaak en van je laatste aanmelding. Wat je verstuurt terwijl je "
                 "aangemeld bent, wordt aan je account gekoppeld. Je adres wordt nooit getoond."),
                ("een online partij speelt terwijl je aangemeld bent",
                 ": de partij (datum, duur, spelvorm, rondes en scores, namen van de teams en "
                 "baan als je ze opgeeft), je plaats (team of toeschouwer) en wie telt. Elke "
                 "wijziging wordt bijgehouden: wie, wanneer, wat."),
                ("meedoet aan een partij",
                 ": met de code van 4 tekens, aangemeld, ook om te kijken. Wie in een partij "
                 "ingeschreven is, ziet de bijnamen van de andere ingeschrevenen; spelers zonder "
                 "account zijn er alleen gasten, zonder naam."),
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
                ("Partijen", ": zolang een speler met een account ze bij zijn partijen houdt; gewist wanneer de laatste ze verwijdert of zijn account verwijdert."),
                ("Code van een partij", ": werkt tot 7 dagen na de laatste wijziging van een lopende partij, en 3 dagen na het einde."),
                ("Sessie", ": een jaar, of tot je je afmeldt."),
                ("Aanmeldlink en -code", ": 15 minuten geldig, na 24 uur gewist."),
                ("Foto",
                 ": hoogstens 30 dagen in afwachting van controle. Een weerhouden foto wordt "
                 "op de site en meestal ook op Mapillary gepubliceerd onder de CC BY-SA-licentie; "
                 "een foto met gezichten of nummerplaten pas nadat die onherkenbaar zijn "
                 "gemaakt. Anders wordt ze verwijderd."),
                ("Melding", ": bewaard als spoor van de correcties. Verstuurd zonder account, wordt het e-mailadres na een jaar gewist. Een bijgevoegde foto kan aan de pagina van het terrein worden toegevoegd; anders wordt ze 30 dagen na de behandeling van de melding gewist."),
                ("Hartje", ": onbeperkt, anoniem (gekoppeld aan je account als je aangemeld bent)."),
                ("Vingerafdruk van het IP-adres", ": enkele dagen."),
            ],
        },
        {
            "titre": "Dienstverleners en externe diensten",
            "liste": [
                ("Cloudflare",
                 ": verwerking van bijdragen en aanmeldingen, database, foto's in "
                 "afwachting, grote versies van de gepubliceerde foto's, bezoekersstatistieken, "
                 "bescherming tegen robots."),
                ("Resend", ": verzending van de aanmeldingsmails en van de e-mails over het gevolg van je bijdragen, vanuit Europa."),
                ("Google",
                 ": aanmelden met een Google-account, als u daarvoor kiest. Google geeft ons "
                 "uw e-mailadres door, nooit uw wachtwoord."),
                ("GitHub Pages", ": hosting van de site en van de gepubliceerde foto's."),
                ("Mapillary", ": publicatie van de weerhouden foto's."),
                ("Ko-fi",
                 ": giften, als u ervoor kiest de site te steunen. De betaling gebeurt op "
                 "hun site: Mapetanque.be ziet nooit uw bankgegevens."),
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
                "de lopende partij in de scoreteller en de namen van de teams, de rondes van "
                "een online partij die nog niet verstuurd zijn, je "
                "favorieten (om ze terug te vinden en dubbels te vermijden) en, als je aangemeld bent, "
                "je sessie. Die gegevens zijn nodig voor de werking van de site; je kunt ze "
                "wissen in de instellingen van je browser.",
                "Je locatie wordt alleen gelezen als je erom vraagt ('Localiseer mij' op de kaart, "
                "baan van een online partij) en als je het toestaat. Ze wordt ter "
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
                "Je account wordt onmiddellijk verwijderd: adres, bijnaam, sessies en je "
                "plaatsen in de partijen worden gewist (de partijen blijven bij de andere "
                "spelers, je plaats wordt er een gast); je hartjes, foto's en meldingen blijven, maar worden anoniem. "
                "Gepubliceerde foto's blijven online onder vrije licentie, "
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
                ("einem Platz ein Herz geben",
                 ": das Herz und die Merkmale, die Sie bestätigen (schattig, überdacht…). Ein "
                 "verschlüsselter Fingerabdruck (IP-Adresse + Platz + Monat) verhindert, dass "
                 "Sie demselben Platz zwei Herzen geben."),
                ("ein Foto einsenden",
                 ": das Foto, ohne Metadaten außer dem Datum (von Mapillary verlangt), und Ihr "
                 "eventueller Spitzname für die Namensnennung. Wenn Sie angemeldet sind, teilen wir "
                 "Ihnen per E-Mail mit, was daraus geworden ist."),
                ("einen Platz oder einen Fehler melden",
                 ": der Ort, Ihr Kommentar und Ihre E-Mail-Adresse, über die wir Ihnen mitteilen, "
                 "was daraus geworden ist."),
                ("ein Konto anlegen",
                 ": Ihre E-Mail-Adresse, Ihr eventueller Spitzname, die Sprache der E-Mails "
                 "sowie das Datum der Erstellung und der letzten Anmeldung. Was Sie im "
                 "angemeldeten Zustand einsenden, wird Ihrem Konto zugeordnet. Ihre Adresse wird "
                 "nie angezeigt."),
                ("angemeldet eine Online-Partie spielen",
                 ": die Partie (Datum, Dauer, Spielform, Runden und Punktestand, Teamnamen und "
                 "Platz, falls Sie sie angeben), Ihr Platz (Team oder Zuschauer) und wer zählt. "
                 "Jede Änderung wird festgehalten: wer, wann, was."),
                ("einer Partie beitreten",
                 ": mit ihrem Code aus 4 Zeichen, angemeldet, auch zum Zuschauen. Wer in einer "
                 "Partie eingetragen ist, sieht die Spitznamen der anderen Eingetragenen; "
                 "Spieler ohne Konto sind dort nur Gäste, ohne Namen."),
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
                ("Partien", ": solange ein Spieler mit Konto sie in seinen Partien behält; gelöscht, wenn der letzte sie entfernt oder sein Konto löscht."),
                ("Code einer Partie", ": gilt bis 7 Tage nach der letzten Änderung einer laufenden Partie und 3 Tage nach ihrem Ende."),
                ("Sitzung", ": ein Jahr oder bis zur Abmeldung."),
                ("Anmeldelink und -code", ": 15 Minuten gültig, nach 24 Stunden gelöscht."),
                ("Foto",
                 ": höchstens 30 Tage bis zur Prüfung. Ein angenommenes Foto wird unter der "
                 "CC-BY-SA-Lizenz auf der Website und meist auch auf Mapillary veröffentlicht; "
                 "ein Foto mit Gesichtern oder Kennzeichen erst, wenn diese unkenntlich gemacht "
                 "sind. Andernfalls wird es gelöscht."),
                ("Meldung", ": wird als Nachweis der Korrekturen aufbewahrt. Ohne Konto gesendet, wird die E-Mail-Adresse nach einem Jahr gelöscht. Ein beigefügtes Foto kann zur Seite des Platzes hinzugefügt werden; sonst wird es 30 Tage nach der Bearbeitung der Meldung gelöscht."),
                ("Herz", ": unbegrenzt, anonym (mit dem Konto verknüpft, wenn Sie angemeldet sind)."),
                ("Fingerabdruck der IP-Adresse", ": einige Tage."),
            ],
        },
        {
            "titre": "Dienstleister und Drittdienste",
            "liste": [
                ("Cloudflare",
                 ": Verarbeitung von Beiträgen und Anmeldungen, Datenbank, Fotos in "
                 "Prüfung, große Versionen der veröffentlichten Fotos, Besucherstatistik, Schutz "
                 "vor Bots."),
                ("Resend", ": Versand der Anmelde-E-Mails und der E-Mails über das Ergebnis Ihrer Beiträge, aus Europa."),
                ("Google",
                 ": Anmeldung mit einem Google-Konto, wenn Sie diese wählen. Google übermittelt "
                 "uns Ihre E-Mail-Adresse, niemals Ihr Passwort."),
                ("GitHub Pages", ": Hosting der Website und der veröffentlichten Fotos."),
                ("Mapillary", ": Veröffentlichung der angenommenen Fotos."),
                ("Ko-fi",
                 ": Spenden, wenn Sie die Website unterstützen möchten. Die Zahlung erfolgt "
                 "auf deren Website: Mapetanque.be sieht Ihre Bankdaten nie."),
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
                "Teams, noch nicht gesendete Runden einer Online-Partie, Ihre Favoriten (um sie wiederzufinden und Doppelungen zu vermeiden) und, "
                "wenn Sie angemeldet sind, Ihre Sitzung. Diese Angaben sind für den Betrieb der "
                "Website erforderlich; Sie können sie in den Einstellungen Ihres Browsers "
                "löschen.",
                "Ihr Standort wird nur auf Ihre Anfrage gelesen („Mein Standort“ auf der Karte, "
                "Platz einer Online-Partie) und nur, wenn Sie es erlauben. Er wird vor "
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
                "Die Löschung des Kontos erfolgt sofort: Adresse, Spitzname, Sitzungen und Ihre "
                "Plätze in den Partien werden gelöscht (die Partien bleiben bei den anderen "
                "Spielern, Ihr Platz wird dort ein Gast); Ihre Herzen, Fotos und Meldungen bleiben erhalten, werden "
                "aber anonym. Veröffentlichte Fotos bleiben unter freier Lizenz online, "
                "sofern Sie nicht ihre Entfernung verlangen.",
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
                ("give a court a heart",
                 ": the heart and the features you confirm (shaded, sheltered…). A hashed "
                 "fingerprint (IP address + court + month) prevents you from giving the same "
                 "court two hearts."),
                ("send a photo",
                 ": the photo, without its metadata except the date (required by Mapillary), "
                 "and your optional nickname for the credit. If you are signed in, we let you know "
                 "by email what came of it."),
                ("report a court or an error",
                 ": the location, your comment and your email address, used to let you know what "
                 "came of it."),
                ("create an account",
                 ": your email address, your optional nickname, the language of your emails, "
                 "and the dates of creation and last sign-in. What you send while signed in is "
                 "linked to your account. Your address is never displayed."),
                ("play an online game while signed in",
                 ": the game (date, length, format, ends and scores, team names and court if "
                 "you add them), your place (team or spectator) and who is scoring. Every change "
                 "is recorded: who, when, what."),
                ("join a game",
                 ": with its 4-character code, signed in, even to watch. Everyone in a game sees "
                 "the nicknames of the others in it; players without an account are only "
                 "guests, with no name."),
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
                ("Games", ": as long as a player with an account keeps them in their games; deleted when the last one removes them or deletes their account."),
                ("Code of a game", ": works until 7 days after the last change to a game in progress, and 3 days after it ends."),
                ("Session", ": one year, or until you sign out."),
                ("Sign-in link and code", ": valid for 15 minutes, erased after 24 hours."),
                ("Photo",
                 ": 30 days at most awaiting review. If kept, it is published on the site and, "
                 "usually, on Mapillary, under a CC BY-SA licence; a photo showing faces or "
                 "licence plates is only published once they are blurred. Otherwise, it is "
                 "deleted."),
                ("Report", ": kept as a record of corrections. If sent without an account, its email address is deleted after one year. An attached photo may be added to the court's page; otherwise it is deleted 30 days after the report has been handled."),
                ("Heart", ": indefinitely, anonymously (linked to your account if you are signed in)."),
                ("IP address fingerprint", ": a few days."),
            ],
        },
        {
            "titre": "Service providers and third-party services",
            "liste": [
                ("Cloudflare",
                 ": processing of contributions and sign-ins, database, photos awaiting review, "
                 "large versions of published photos, visitor statistics, bot protection."),
                ("Resend", ": sending of sign-in emails and of emails about what came of your contributions, from Europe."),
                ("Google",
                 ": sign-in with a Google account, if you choose it. Google passes on your "
                 "email address to us, never your password."),
                ("GitHub Pages", ": hosting of the site and of published photos."),
                ("Mapillary", ": publication of accepted photos."),
                ("Ko-fi",
                 ": donations, if you choose to support the site. Payment takes place on "
                 "their site: Mapetanque.be never sees your bank details."),
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
                "game in progress in the score counter and its team names, the ends of an online "
                "game not yet sent, your favourites "
                "(to find them again and avoid duplicates) and, if you are signed in, your session. This "
                "information is needed for the site to work; you can clear it in your browser "
                "settings.",
                "Your location is only read when you ask for it ('Locate me' on the map, the "
                "court of an online game) and if you allow it. It is used on the "
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
                "Deleting your account takes effect immediately: address, nickname, sessions "
                "and your places in games are erased (the games stay with the other players, "
                "your place becomes a guest); your hearts, photos and reports remain, but become "
                "anonymous. Published photos stay online under an open licence, "
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
