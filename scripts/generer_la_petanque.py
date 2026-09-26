"""
Génère la-petanque.html, nl/la-petanque.html et de/la-petanque.html à partir des pages
« Comment jouer » du dépôt.

La mécanique commune (métadonnées, bannière, fil d'Ariane, sélecteur de langue) vit dans
_squelette.py, partagée avec generer_faq.py et generer_a_propos.py.

À lancer depuis la racine du dépôt :
    python scripts/generer_la_petanque.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.

Liens dans les textes
---------------------
Un passage entre crochets suivi d'une référence entre parenthèses devient un lien :
    [s'implante en Belgique](4)   → lien vers la source n° 4 de SOURCES (nouvel onglet)
    [les terrains publics sont partout](carte) → lien vers la carte, dans la langue de la page
"""

import re
from pathlib import Path

from _squelette import construire_page, echap

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre_page": "La pétanque, d'hier à aujourd'hui — Mapetanque.be",
        "h1": "La pétanque, d'hier à aujourd'hui",
        "fil": ("Accueil", "La pétanque"),
        "description": (
            "L'histoire de la pétanque, de son invention à La Ciotat en 1907 aux titres "
            "mondiaux belges, et pourquoi c'est aujourd'hui un sport si accessible et si "
            "convivial."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Petanque, van toen tot nu — Mapetanque.be",
        "h1": "Petanque, van toen tot nu",
        "fil": ("Home", "Petanque"),
        "description": (
            "De geschiedenis van petanque, van de uitvinding in La Ciotat in 1907 tot de "
            "Belgische wereldtitels, en waarom het vandaag zo'n toegankelijke en gezellige "
            "sport is."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Pétanque – gestern und heute — Mapetanque.be",
        "h1": "Pétanque – gestern und heute",
        "fil": ("Startseite", "Pétanque"),
        "description": (
            "Die Geschichte des Pétanque, von seiner Erfindung 1907 in La Ciotat bis zu den "
            "belgischen Weltmeistertiteln, und warum es heute ein so zugänglicher und "
            "geselliger Sport ist."
        ),
    },
}

# Sources, communes aux trois langues. Numérotées pour être appelées dans les textes.
SOURCES = {
    1: "https://home.ffpjp.org/pratiquer/la-pratique/l-histoire-de-la-petanque",
    2: "https://gomet.net/histoire-petanque/",
    3: "https://ffpjp.org/portail/images/2024/Divers/"
       "Appel_%C3%A0_candidatures_Equipementier_FFPJP_2025_2028.pdf",
    4: "https://www.rtbf.be/article/"
       "tu-tires-ou-tu-pointes-decouvrez-les-clubs-de-petanque-pres-de-chez-vous-11056522",
    5: "https://www.fipjp.org/index.php/fr/fipjp/historique",
    6: "https://france3-regions.franceinfo.fr/provence-alpes-cote-d-azur/bouches-du-rhone/"
       "metropole-aix-marseille/marseille/palmares-championnats-du-monde-petanque-98871.html",
    7: "https://www.sportmag.fr/petanque-la-belgique-un-danger-pour-les-bleus/",
    8: "https://www.petanque-dijon2024.fr/infos-pratiques/palmares/",
    9: "https://www.rtbf.be/article/un-belge-devient-champion-du-monde-de-petanque-8852075",
    10: "https://www.fipjp.org/images/pdf/gand/gand_dm.pdf",
    11: "https://www.sportmag.fr/petanque-un-nouveau-record-pour-la-petanque-tricolore/",
    12: "https://www.ffpjp.org/portail/images/2025/PV/COMITE_DIRECTEUR_JUIN_2025_V6.pdf",
    13: "https://www.decathlon.be/fr/p/jeu-de-3-boules-de-petanque-loisir-150/352666/m8871586",
    14: "https://www.decathlon.be/fr/tous-les-sports/petanque/competition",
    15: "https://www.jeminforme.be/federations-sportives-de-a-a-z/",
    16: "https://www.vidal.fr/sante/sport/infos-sport-medicosport-sante/59/"
        "petanque-et-jeu-provencal/",
    17: "https://www.handisport.org/petanque/",
    18: "https://www.gsportvlaanderen.be/sporten/petanque",
}

# Jalons : (date, lieu, titre, texte, belge). « belge » ajoute l'étiquette et le point plein.
CONTENU = {
    "fr": {
        "intro": (
            "Inventée en 1907 à La Ciotat par un joueur que ses rhumatismes empêchaient de "
            "courir, la pétanque s'est installée en Belgique dès 1949. Voici son histoire, et "
            "ce qu'elle est devenue aujourd'hui."
        ),
        "ancres_label": "Sur cette page",
        "belgique": "Belgique",
        "histoire_titre": "Un peu d'histoire",
        "jalons": [
            ("Avant 1907", "Provence", "Le temps du jeu provençal",
             "Au XIXe siècle, le Midi se passionne pour [le jeu provençal](1), qu'on appelle "
             "aussi « la longue ». Le terrain est long, et les tireurs prennent trois pas "
             "d'élan avant de lancer.", False),
            ("1907", "La Ciotat", "Les pieds tanqués",
             "Champion de jeu provençal, Jules Hugues, dit « Lenoir », ne peut plus courir à "
             "cause de ses rhumatismes. Il trace un rond au sol, lance le but à 5 ou 6 mètres "
             "et joue sans bouger, les pieds bien ancrés. En provençal, on dit « pè tanca » : "
             "[la pétanque est née](1).", False),
            ("1910", "La Ciotat", "Le premier concours",
             "Le 11 juin 1910, huit équipes de deux joueurs disputent [le premier concours "
             "officiel](2) de pétanque, avec 10 francs à la clé.", False),
            ("1945", "France", "Une fédération nationale",
             "[La Fédération française de pétanque et jeu provençal](3) voit le jour pour "
             "rassembler les joueurs d'un sport qui s'organise en concours depuis 1910.",
             False),
            ("1949", "Verviers", "La pétanque arrive en Belgique",
             "C'est par Verviers que la pétanque [s'implante en Belgique](4). C'est même [le "
             "premier club créé hors du sud de la France](2).", True),
            ("1957", "Spa", "L'idée d'une fédération mondiale",
             "Lors d'un concours international organisé à Spa par la Fédération belge, les "
             "délégués de six pays [décident de créer une fédération internationale](5). "
             "Elle voit le jour le 8 mars 1958 à Marseille.", True),
            ("1959", "Spa", "Le premier championnat du monde",
             "C'est à Spa que se dispute [le tout premier championnat du monde](5) de "
             "pétanque.", True),
            ("1981 · 2000", "Mondiaux", "Deux titres mondiaux",
             "La Belgique est [championne du monde en triplette en 1981](7), puis [en "
             "2000](6) avec Jean-François Hémon, Claudy Weibel, André Lozano et Michel Van "
             "Campenhout.", True),
            ("1995 · 2005", "Bruxelles", "Les Mondiaux à Bruxelles",
             "Bruxelles accueille [à deux reprises](8) le championnat du monde, en 1995 puis "
             "en 2005.", True),
            ("2004", "France", "Un sport de haut niveau",
             "Le ministère français des Sports reconnaît officiellement la pétanque comme "
             "[sport de haut niveau](3).", False),
            ("2015", "Nice", "Premier champion du monde en individuel",
             "L'Arlonais Claudy Weibel remporte [le tout premier championnat du monde en "
             "tête-à-tête](9).", True),
            ("2017", "Gand", "Les Mondiaux reviennent en Belgique",
             "Gand accueille [les championnats du monde en tête-à-tête et en doublette](10).",
             True),
        ],
        "aujourdhui_titre": "Et aujourd'hui ?",
        "avant": [
            "La pétanque a le vent en poupe. En France, berceau de la discipline, les chiffres parlent d'eux-mêmes. Le Covid "
            "avait fait chuter le nombre de licenciés à 226 000 en 2021. Depuis, [la courbe ne "
            "fait que remonter](11) : 263 000 en 2022, 282 000 en 2023, puis plus de 300 000 "
            "en 2024. Fin mai 2025, la fédération française comptait déjà [305 470 "
            "licenciés](12), un record. C'est aujourd'hui [la première fédération sportive non "
            "olympique](11) de France.",
        ],
        "transition": (
            "Ce succès ne doit rien au hasard : la pétanque est sans doute le plus accessible "
            "et le plus convivial des sports."
        ),
        "apres": [
            "Pour commencer, il ne faut presque aucun matériel. Chez Decathlon Belgique, un jeu de trois "
            "boules avec cochonnet et sacoche [coûte 20 €](13). Pas d'abonnement, pas de "
            "tenue, pas de réservation. Même en compétition, l'investissement reste modeste : "
            "les boules homologuées [démarrent autour de 60 €](14).",
            "Elle se joue à tout âge. En Belgique francophone, la fédération accueille les "
            "joueurs [dès 6 ans](15), et il n'y a pas de limite vers le haut : en France, [plus "
            "de quatre licenciés sur dix](16) ont plus de 60 ans. C'est l'un des rares sports "
            "où grands-parents et petits-enfants jouent vraiment la même partie.",
            "Elle s'ouvre aussi aux personnes en situation de handicap. [La Fédération "
            "française handisport](17) précise qu'on peut la pratiquer en fauteuil roulant, "
            "avec une déficience visuelle, en étant sourd ou malentendant, ou avec un handicap "
            "moteur. En Flandre, [la G-petanque](18) accueille les personnes avec une "
            "déficience intellectuelle, de l'autisme ou une fragilité psychique.",
            "Autre atout : [les terrains publics sont partout](carte). Il suffit d'y passer "
            "avec son jeu de boules. Et c'est là que la pétanque montre son meilleur visage : un après-midi entre amis "
            "ou en famille, où l'on discute autant qu'on joue, et où l'on croise souvent de "
            "nouvelles têtes.",
            "Pour autant, ne vous y trompez pas : si l'on n'a besoin d'aucune compétence pour "
            "jouer sa première partie, la pétanque se pratique aussi au plus haut niveau. Les "
            "championnats du monde [existent depuis 1959](5), et la Belgique y tient son "
            "rang : c'est [la nation la plus souvent montée sur le podium](7) en triplette, "
            "derrière la France.",
        ],
        "cta_carte": "Trouver un terrain près de chez moi",
        "cta_regles": "Apprendre les règles",
    },
    "nl": {
        "intro": (
            "Petanque werd in 1907 in La Ciotat bedacht door een speler die door reuma niet "
            "meer kon lopen, en raakte al in 1949 in België ingeburgerd. Dit is het verhaal "
            "van de sport, en wat er vandaag van geworden is."
        ),
        "ancres_label": "Op deze pagina",
        "belgique": "België",
        "histoire_titre": "Een stukje geschiedenis",
        "jalons": [
            ("Vóór 1907", "Provence", "De tijd van het jeu provençal",
             "In de 19e eeuw is het zuiden van Frankrijk in de ban van [het jeu "
             "provençal](1), ook wel « la longue » genoemd. Het terrein is lang, en de "
             "schieters nemen drie passen aanloop voor ze werpen.", False),
            ("1907", "La Ciotat", "Voeten stevig op de grond",
             "Jules Hugues, bijgenaamd « Lenoir », kampioen in het jeu provençal, kan door "
             "zijn reuma niet meer lopen. Hij trekt een cirkel op de grond, gooit het "
             "doelballetje op 5 à 6 meter en speelt zonder te bewegen, met de voeten stevig "
             "op de grond. In het Provençaals heet dat « pè tanca »: [petanque is "
             "geboren](1).", False),
            ("1910", "La Ciotat", "De eerste wedstrijd",
             "Op 11 juni 1910 spelen acht ploegen van twee spelers [de eerste officiële "
             "wedstrijd](2) petanque, met 10 frank als prijs.", False),
            ("1945", "Frankrijk", "Een nationale federatie",
             "[De Franse federatie voor petanque en jeu provençal](3) wordt opgericht om de "
             "spelers samen te brengen van een sport die al sinds 1910 wedstrijden "
             "organiseert.", False),
            ("1949", "Verviers", "Petanque komt naar België",
             "Via Verviers [raakt petanque ingeburgerd in België](4). Het is zelfs [de eerste "
             "club buiten Zuid-Frankrijk](2).", True),
            ("1957", "Spa", "Het idee van een wereldfederatie",
             "Tijdens een internationaal toernooi dat de Belgische federatie in Spa "
             "organiseert, [besluiten afgevaardigden uit zes landen een internationale "
             "federatie op te richten](5). Die ziet het levenslicht op 8 maart 1958 in "
             "Marseille.", True),
            ("1959", "Spa", "Het eerste wereldkampioenschap",
             "In Spa wordt [het allereerste wereldkampioenschap](5) petanque gespeeld.", True),
            ("1981 · 2000", "WK", "Twee wereldtitels",
             "België wordt [wereldkampioen triplet in 1981](7), en opnieuw [in 2000](6) met "
             "Jean-François Hémon, Claudy Weibel, André Lozano en Michel Van Campenhout.",
             True),
            ("1995 · 2005", "Brussel", "Het WK in Brussel",
             "Brussel ontvangt [twee keer](8) het wereldkampioenschap, in 1995 en in 2005.",
             True),
            ("2004", "Frankrijk", "Een topsport",
             "Het Franse ministerie van Sport erkent petanque officieel als [topsport](3).",
             False),
            ("2015", "Nice", "Eerste individuele wereldkampioen",
             "Claudy Weibel uit Aarlen wint [het allereerste wereldkampioenschap "
             "tête-à-tête](9).", True),
            ("2017", "Gent", "Het WK keert terug naar België",
             "Gent ontvangt [de wereldkampioenschappen tête-à-tête en doublet](10).", True),
        ],
        "aujourdhui_titre": "En vandaag?",
        "avant": [
            "Petanque zit in de lift. In Frankrijk, de bakermat van de sport, spreken de cijfers voor zich. Door covid "
            "zakte het aantal aangesloten spelers in 2021 tot 226 000. Sindsdien [gaat de "
            "curve alleen maar omhoog](11): 263 000 in 2022, 282 000 in 2023 en meer dan "
            "300 000 in 2024. Eind mei 2025 telde de Franse federatie al [305 470 aangesloten "
            "spelers](12), een record. Het is vandaag [de grootste niet-olympische "
            "sportfederatie](11) van Frankrijk.",
        ],
        "transition": (
            "Dat succes is geen toeval: petanque is wellicht de meest toegankelijke en "
            "gezelligste sport die er bestaat."
        ),
        "apres": [
            "Om te beginnen heb je bijna geen materiaal nodig. Bij Decathlon België kost een set van "
            "drie ballen met but en tasje [amper 20 €](13). Geen abonnement, geen sportoutfit, geen "
            "reservering. Zelfs voor competitie blijft de investering bescheiden: "
            "gehomologeerde ballen [kosten vanaf ongeveer 60 €](14).",
            "Je speelt het op elke leeftijd. In Franstalig België verwelkomt de federatie "
            "spelers [vanaf 6 jaar](15), en naar boven is er geen grens: in Frankrijk is [meer "
            "dan vier op de tien aangesloten spelers](16) ouder dan 60. Het is een van de "
            "weinige sporten waar grootouders en kleinkinderen echt dezelfde partij spelen.",
            "Ook mensen met een beperking kunnen meespelen. [De Franse "
            "Handisportfederatie](17) vermeldt dat je kan spelen in een rolstoel, met een "
            "visuele beperking, als je doof of slechthorend bent, of met een motorische "
            "beperking. In Vlaanderen staat [G-petanque](18) open voor mensen met een "
            "verstandelijke beperking, autisme of een psychische kwetsbaarheid.",
            "Nog een troef: [openbare terreinen vind je overal](carte). Je hoeft er alleen "
            "met je set ballen langs te gaan. En daar toont petanque zijn beste kant: een namiddag met vrienden of familie, "
            "waarin je evenveel praat als speelt, en waar je vaak nieuwe mensen leert kennen.",
            "Maar vergis je niet: ook al heb je geen enkele vaardigheid nodig voor je eerste "
            "partij, petanque wordt ook op het hoogste niveau gespeeld. Wereldkampioenschappen "
            "[bestaan sinds 1959](5), en België doet er volop mee: het is [het land dat het "
            "vaakst op het podium stond](7) in triplet, na Frankrijk.",
        ],
        "cta_carte": "Een terrein in mijn buurt vinden",
        "cta_regles": "De regels leren",
    },
    "de": {
        "intro": (
            "Pétanque wurde 1907 in La Ciotat von einem Spieler erfunden, den sein Rheuma am "
            "Laufen hinderte, und kam bereits 1949 nach Belgien. Hier ist seine Geschichte – "
            "und was heute daraus geworden ist."
        ),
        "ancres_label": "Auf dieser Seite",
        "belgique": "Belgien",
        "histoire_titre": "Ein wenig Geschichte",
        "jalons": [
            ("Vor 1907", "Provence", "Die Zeit des Jeu provençal",
             "Im 19. Jahrhundert begeistert sich Südfrankreich für [das Jeu provençal](1), "
             "auch « la longue » genannt. Das Spielfeld ist lang, und die Schützen nehmen drei "
             "Schritte Anlauf, bevor sie werfen.", False),
            ("1907", "La Ciotat", "Die Füße fest am Boden",
             "Jules Hugues, genannt « Lenoir », Meister im Jeu provençal, kann wegen seines "
             "Rheumas nicht mehr laufen. Er zieht einen Kreis auf den Boden, wirft die "
             "Zielkugel auf 5 bis 6 Meter und spielt, ohne sich zu bewegen, die Füße fest am "
             "Boden. Auf Provenzalisch heißt das « pè tanca »: [Pétanque ist geboren](1).",
             False),
            ("1910", "La Ciotat", "Das erste Turnier",
             "Am 11. Juni 1910 bestreiten acht Zweierteams [das erste offizielle Turnier](2) "
             "im Pétanque, um ein Preisgeld von 10 Francs.", False),
            ("1945", "Frankreich", "Ein nationaler Verband",
             "[Der französische Verband für Pétanque und Jeu provençal](3) wird gegründet, um "
             "die Spieler eines Sports zu vereinen, der seit 1910 Turniere austrägt.", False),
            ("1949", "Verviers", "Pétanque kommt nach Belgien",
             "Über Verviers [fasst Pétanque in Belgien Fuß](4). Es ist sogar [der erste "
             "Verein außerhalb Südfrankreichs](2).", True),
            ("1957", "Spa", "Die Idee eines Weltverbands",
             "Bei einem internationalen Turnier, das der belgische Verband in Spa ausrichtet, "
             "[beschließen Delegierte aus sechs Ländern die Gründung eines internationalen "
             "Verbands](5). Er entsteht am 8. März 1958 in Marseille.", True),
            ("1959", "Spa", "Die erste Weltmeisterschaft",
             "In Spa wird [die allererste Weltmeisterschaft](5) im Pétanque ausgetragen.",
             True),
            ("1981 · 2000", "WM", "Zwei Weltmeistertitel",
             "Belgien wird [1981 Weltmeister im Triplette](7) und erneut [im Jahr 2000](6) "
             "mit Jean-François Hémon, Claudy Weibel, André Lozano und Michel Van Campenhout.",
             True),
            ("1995 · 2005", "Brüssel", "Die WM in Brüssel",
             "Brüssel ist [zweimal](8) Gastgeber der Weltmeisterschaft, 1995 und 2005.", True),
            ("2004", "Frankreich", "Ein Leistungssport",
             "Das französische Sportministerium erkennt Pétanque offiziell als "
             "[Leistungssport](3) an.", False),
            ("2015", "Nizza", "Erster Weltmeister im Einzel",
             "Der Arloner Claudy Weibel gewinnt [die allererste Weltmeisterschaft im "
             "Tête-à-tête](9).", True),
            ("2017", "Gent", "Die WM kehrt nach Belgien zurück",
             "Gent richtet [die Weltmeisterschaften im Tête-à-tête und im Doublette](10) aus.",
             True),
        ],
        "aujourdhui_titre": "Und heute?",
        "avant": [
            "Pétanque hat Rückenwind. In Frankreich, der Wiege des Sports, sprechen die Zahlen für sich. Corona hatte "
            "die Zahl der Lizenzspieler 2021 auf 226 000 sinken lassen. Seitdem [geht die "
            "Kurve nur noch nach oben](11): 263 000 im Jahr 2022, 282 000 im Jahr 2023 und "
            "über 300 000 im Jahr 2024. Ende Mai 2025 zählte der französische Verband bereits "
            "[305 470 Lizenzspieler](12), ein Rekord. Er ist heute [der größte nichtolympische "
            "Sportverband](11) Frankreichs.",
        ],
        "transition": (
            "Dieser Erfolg ist kein Zufall: Pétanque ist wohl der zugänglichste und "
            "geselligste Sport überhaupt."
        ),
        "apres": [
            "Für den Anfang braucht man kaum Ausrüstung. Bei Decathlon Belgien kostet ein Set aus "
            "drei Kugeln mit Zielkugel und Tasche [nur 20 €](13). Kein Abo, keine Sportkleidung, "
            "keine Reservierung. Selbst im Wettkampf bleibt die Investition bescheiden: "
            "zugelassene Wettkampfkugeln [gibt es ab etwa 60 €](14).",
            "Man spielt es in jedem Alter. Im französischsprachigen Belgien nimmt der Verband "
            "Spieler [ab 6 Jahren](15) auf, und nach oben gibt es keine Grenze: In Frankreich "
            "sind [mehr als vier von zehn Lizenzspielern](16) über 60. Es ist eine der wenigen "
            "Sportarten, bei denen Großeltern und Enkel wirklich dieselbe Partie spielen.",
            "Auch Menschen mit Behinderung können mitspielen. [Der französische "
            "Behindertensportverband](17) weist darauf hin, dass man im Rollstuhl, mit einer "
            "Sehbehinderung, gehörlos oder schwerhörig oder mit einer motorischen Behinderung "
            "spielen kann. In Flandern steht [G-Petanque](18) Menschen mit geistiger "
            "Behinderung, Autismus oder psychischer Verletzlichkeit offen.",
            "Noch ein Vorteil: [Öffentliche Plätze gibt es überall](carte). Man muss nur mit "
            "seinen Kugeln vorbeikommen. Und genau da zeigt sich Pétanque von seiner besten Seite: ein Nachmittag mit "
            "Freunden oder Familie, an dem man genauso viel redet wie spielt und oft neue "
            "Leute kennenlernt.",
            "Trotzdem sollte man sich nicht täuschen: Auch wenn man für die erste Partie "
            "keinerlei Vorkenntnisse braucht, wird Pétanque auch auf höchstem Niveau gespielt. "
            "Weltmeisterschaften [gibt es seit 1959](5), und Belgien spielt dort ganz vorne "
            "mit: Es ist [die Nation, die im Triplette am häufigsten auf dem Podium "
            "stand](7), nach Frankreich.",
        ],
        "cta_carte": "Einen Platz in meiner Nähe finden",
        "cta_regles": "Die Regeln lernen",
    },
}

DRAPEAU = (
    '<svg viewBox="0 0 3 2" aria-hidden="true">'
    '<rect width="1" height="2" fill="#1a1a1a"></rect>'
    '<rect x="1" width="1" height="2" fill="#FAE042"></rect>'
    '<rect x="2" width="1" height="2" fill="#ED2939"></rect></svg>'
)

ICONE_CARTE = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path>'
    '<circle cx="12" cy="9.5" r="2.5"></circle></svg>'
)

LIEN = re.compile(r"\[([^\]]+)\]\((\w+)\)")

INSECABLE = "\u00a0"


def typo(texte, langue):
    """Espaces insécables là où un retour à la ligne serait malvenu : dans les nombres
    (282 000), devant € et à l'intérieur des guillemets ; en français, aussi devant : ; ? !"""
    texte = re.sub(r"(\d) (?=\d{3}\b)", r"\1" + INSECABLE, texte)
    texte = texte.replace(" €", INSECABLE + "€")
    texte = texte.replace("« ", "«" + INSECABLE).replace(" »", INSECABLE + "»")
    if langue == "fr":
        texte = re.sub(r" ([:;?!])", INSECABLE + r"\1", texte)
    return texte


def avec_liens(texte, prefixe, langue):
    """Échappe le texte puis transforme [passage](référence) en lien (voir en-tête)."""

    def remplacer(m):
        passage, ref = m.group(1), m.group(2)
        if ref == "carte":
            return f'<a href="/{prefixe}">{passage}</a>'
        return f'<a href="{SOURCES[int(ref)]}" target="_blank" rel="noopener">{passage}</a>'

    return LIEN.sub(remplacer, echap(typo(texte, langue)))


def bloc_contenu(langue, prefixe):
    c = CONTENU[langue]
    t = lambda texte: avec_liens(texte, prefixe, langue)  # noqa: E731
    e = lambda texte: echap(typo(texte, langue))  # noqa: E731
    m = []

    m.append(f'            <p class="petanque-intro">{e(c["intro"])}</p>')
    m.append(
        f'            <nav class="petanque-ancres" aria-label="{e(c["ancres_label"])}">\n'
        f'                <a href="#histoire">{e(c["histoire_titre"])}</a>\n'
        f'                <a href="#aujourdhui">{e(c["aujourdhui_titre"])}</a>\n'
        "            </nav>\n"
    )

    # --- Frise ---
    m.append('            <section class="petanque-section" id="histoire">')
    m.append(f'                <h2>{e(c["histoire_titre"])}</h2>')
    m.append('                <ol class="frise">')
    for date, lieu, titre, texte, belge in c["jalons"]:
        classe = "jalon jalon-belge" if belge else "jalon"
        badge = (
            f'<span class="badge-belgique">{DRAPEAU}{e(c["belgique"])}</span>'
            if belge else ""
        )
        m.append(
            f'                    <li class="{classe}">\n'
            '                        <div class="jalon-date">'
            f'<span class="jalon-annee">{e(date)}</span>'
            f'<span class="jalon-lieu">{e(lieu)}</span></div>\n'
            '                        <div class="jalon-contenu">\n'
            f'                            <div class="jalon-titre"><h3>{e(titre)}</h3>'
            f"{badge}</div>\n"
            f"                            <p>{t(texte)}</p>\n"
            "                        </div>\n"
            "                    </li>"
        )
    m.append("                </ol>")
    m.append("            </section>\n")

    # --- Aujourd'hui ---
    m.append('            <section class="petanque-section" id="aujourdhui">')
    m.append(f'                <h2>{e(c["aujourdhui_titre"])}</h2>')
    for para in c["avant"]:
        m.append(f"                <p>{t(para)}</p>")
    m.append(f'                <p class="petanque-transition">{e(c["transition"])}</p>')
    for para in c["apres"]:
        m.append(f"                <p>{t(para)}</p>")
    m.append(
        '                <div class="petanque-cta">\n'
        f'                    <a class="petanque-cta-carte" href="/{prefixe}">'
        f'{ICONE_CARTE}{e(c["cta_carte"])}</a>\n'
        f'                    <a class="petanque-cta-regles" href="/{prefixe}comment-jouer.html">'
        f'{e(c["cta_regles"])}</a>\n'
        "                </div>"
    )
    m.append("            </section>\n")
    return "\n".join(m)


for langue, meta in META.items():
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "la-petanque.html",
        page="la-petanque.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=bloc_contenu(langue, meta["prefixe"]),
        feuilles_sup=("/style-la-petanque.css",),
        banniere="/images/banniere-la-petanque.webp",
        credit="« Les Joueurs de pétanque, Marseille » par Émile Loubon",
    )
    print(
        f"{meta['prefixe']}la-petanque.html : {taille} octets, "
        f"{len(CONTENU[langue]['jalons'])} jalons"
    )
