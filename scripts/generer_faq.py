"""
Génère faq.html, nl/faq.html et de/faq.html à partir des pages « Comment jouer » du dépôt.

La mécanique commune (métadonnées, bannière, fil d'Ariane, sélecteur de langue) vit dans
_squelette.py, partagée avec generer_a_propos.py.

À lancer depuis la racine du dépôt :
    python scripts/generer_faq.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

import json
from pathlib import Path

from _squelette import construire_page, echap, lier_urls_et_emails

RACINE = Path(__file__).resolve().parent.parent

META = {
    "fr": {
        "prefixe": "",
        "titre": "FAQ — Mapetanque.be",
        "h1": "Questions fréquentes",
        "fil": ("Accueil", "Questions fréquentes"),
        "description": (
            "Réponses aux questions fréquentes sur Mapetanque.be : origine des données, "
            "recherche d'un terrain, photos, ajout ou retrait d'un terrain de pétanque."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre": "FAQ — Mapetanque.be",
        "h1": "Veelgestelde vragen",
        "fil": ("Home", "Veelgestelde vragen"),
        "description": (
            "Antwoorden op veelgestelde vragen over Mapetanque.be: herkomst van de gegevens, "
            "een terrein zoeken, foto's, een petanqueterrein toevoegen of verwijderen."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre": "FAQ — Mapetanque.be",
        "h1": "Häufige Fragen",
        "fil": ("Startseite", "Häufige Fragen"),
        "description": (
            "Antworten auf häufige Fragen zu Mapetanque.be: Herkunft der Daten, einen Platz "
            "finden, Fotos, einen Pétanque-Platz hinzufügen oder entfernen."
        ),
    },
}

# Ancre stable sur la question des terrains manquants : le lien « Ajouter un terrain » de la
# carte pointe dessus, il ne faut donc pas la renommer sans mettre ce lien à jour.
ANCRES = {3: "terrain-manquant"}

ICONE = (
    '<span class="rule-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<circle cx="12" cy="12" r="10"></circle>'
    '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>'
    '<line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>'
)

CONTENU = {
    "fr": [
        {
            "q": "D'où viennent les informations affichées sur la carte ?",
            "a": "Les terrains affichés proviennent des données libres d'OpenStreetMap. Mapetanque.be récupère chaque lundi ces informations afin de proposer une carte actualisée des terrains de pétanque en Belgique. Les clubs affiliés, quant à eux, proviennent des informations publiées sur les pages des fédérations wallonne et flamande, ainsi que de leurs provinces respectives. Ces informations peuvent parfois ne plus être à jour : n'hésitez pas à me contacter par e-mail mapetanque@outlook.be pour signaler une erreur."
        },
        {
            "q": "Comment trouver un terrain près de moi ?",
            "a": "Cliquez sur le bouton « Me localiser » pour afficher votre position et consulter les terrains proches de vous."
        },
        {
            "q": "Pourquoi tous les terrains n'ont pas de photo et comment en ajouter une ?",
            "a": "Les photos des terrains proviennent principalement de Mapillary (une plateforme collaborative de photos de rue). Si vous avez une photo d'un terrain, n'hésitez pas à me l'envoyer via le lien \"Ajouter une photo ?\" disponible sur chaque fiche de terrain ! Elle sera d'abord déposée sur Mapillary afin qu'elle puisse servir à tous, puis un lien sera créé vers le site."
        },
        {
            "q": "Comment ajouter un terrain manquant ?",
            "a": "Les terrains affichés sur Mapetanque.be proviennent des données libres d'OpenStreetMap (OSM). Si vous connaissez un terrain de pétanque accessible au public qui n'apparaît pas sur la carte, vous pouvez : l'ajouter directement dans OSM grâce à leur outil d'édition ; ou m'envoyer les informations nécessaires par e-mail mapetanque@outlook.be (localisation précise, nombre de pistes si connu, etc.). Après mise à jour des données OSM, le terrain apparaîtra automatiquement sur Mapetanque.be lors de la prochaine synchronisation."
        },
        {
            "q": "Comment retirer un terrain qui n'existe plus ou n'est plus praticable ?",
            "a": "Les terrains affichés sur Mapetanque.be proviennent des données libres d'OpenStreetMap (OSM). Si un terrain n'existe plus ou n'est plus accessible au public, vous pouvez : modifier directement l'information dans OSM via leur outil d'édition ; ou me signaler l'erreur par e-mail mapetanque@outlook.be en précisant l'emplacement du terrain et les informations utiles. Si le terrain existe toujours mais est simplement mal entretenu ou dégradé, le mieux est de contacter la commune concernée (service des sports, travaux ou espaces verts), qui est généralement responsable de l'entretien des équipements publics."
        }
    ],
    "nl": [
        {
            "q": "Waar komt de informatie op de kaart vandaan?",
            "a": "De weergegeven terreinen zijn afkomstig van de vrije gegevens van OpenStreetMap. Mapetanque.be haalt deze informatie elke maandag op om een bijgewerkte kaart van de petanquebanen in België aan te bieden. De aangesloten clubs zijn op hun beurt afkomstig van de informatie gepubliceerd op de pagina's van de Waalse en Vlaamse federatie, evenals van hun respectieve provincies. Deze informatie kan soms verouderd zijn: aarzel niet om ons te contacteren per e-mail mapetanque@outlook.be om een fout te melden."
        },
        {
            "q": "Hoe vind ik een terrein in mijn buurt?",
            "a": "Klik op de knop \"Localiseer mij\" om je positie weer te geven en de terreinen in jouw buurt te bekijken."
        },
        {
            "q": "Waarom hebben niet alle terreinen een foto en hoe voeg ik er een toe?",
            "a": "De foto's van de terreinen komen voornamelijk van Mapillary (een collaboratief platform voor straatfoto's). Heeft u een foto van een terrein? Aarzel niet om ze me te sturen via de link \"Foto toevoegen?\" die op elke terreinfiche beschikbaar is! Ze wordt eerst op Mapillary geplaatst zodat ze voor iedereen bruikbaar is, en er wordt vervolgens een link naar de site aangemaakt."
        },
        {
            "q": "Hoe voeg ik een ontbrekend terrein toe?",
            "a": "De terreinen die op Mapetanque.be worden weergegeven, zijn afkomstig van de vrije gegevens van OpenStreetMap. Als je een openbaar toegankelijke petanquebaan kent die niet op de kaart verschijnt, kun je: het rechtstreeks toevoegen aan OpenStreetMap via hun bewerkingstool; of ons de nodige informatie per e-mail bezorgen mapetanque@outlook.be (precieze locatie, aantal banen indien bekend, enz.). Na bijwerking van de OpenStreetMap-gegevens verschijnt het terrein automatisch op Mapetanque.be bij de volgende synchronisatie."
        },
        {
            "q": "Een terrein op de kaart bestaat niet meer of is niet meer bruikbaar, wat kan ik doen?",
            "a": "De terreinen die op Mapetanque.be worden weergegeven, zijn afkomstig van de vrije gegevens van OpenStreetMap. Aangezien deze database collaboratief is, kan sommige informatie onvolledig of verouderd zijn. Als een terrein niet meer bestaat of niet meer openbaar toegankelijk is, kun je: de informatie rechtstreeks aanpassen in OpenStreetMap via hun bewerkingstool; of de fout aan ons melden per e-mail mapetanque@outlook.be met vermelding van de locatie van het terrein en nuttige informatie. Als het terrein nog wel bestaat maar gewoon slecht onderhouden of beschadigd is, neem je best contact op met de betrokken gemeente (dienst sport, werken of groenvoorziening), die doorgaans verantwoordelijk is voor het onderhoud van openbare voorzieningen."
        }
    ],
    "de": [
        {
            "q": "Woher stammen die auf der Karte angezeigten Informationen?",
            "a": "Die angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. Mapetanque.be ruft diese Informationen jeden Montag ab, um eine aktualisierte Karte der Pétanque-Plätze in Belgien anzubieten. Die angeschlossenen Vereine wiederum stammen aus den Informationen, die auf den Seiten des wallonischen und des flämischen Verbands sowie ihrer jeweiligen Provinzen veröffentlicht wurden. Diese Informationen sind möglicherweise nicht mehr aktuell: Zögern Sie nicht, uns per E-Mail zu kontaktieren mapetanque@outlook.be, um einen Fehler zu melden."
        },
        {
            "q": "Wie finde ich einen Platz in meiner Nähe?",
            "a": "Klicken Sie auf die Schaltfläche \"Meinen Standort finden\", um Ihre Position anzuzeigen und die Plätze in Ihrer Nähe zu sehen."
        },
        {
            "q": "Warum haben nicht alle Plätze ein Foto und wie kann ich eines hinzufügen?",
            "a": "Die Fotos der Plätze stammen hauptsächlich von Mapillary (einer kollaborativen Plattform für Straßenfotos). Falls Sie ein Foto von einem Platz haben, senden Sie es mir gerne über den Link \"Foto hinzufügen?\", der auf jeder Platzkarte verfügbar ist! Es wird zunächst auf Mapillary hochgeladen, damit es allen zugutekommt, und anschließend wird ein Link zur Seite erstellt."
        },
        {
            "q": "Wie füge ich einen fehlenden Platz hinzu?",
            "a": "Die auf Mapetanque.be angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. Wenn Sie einen öffentlich zugänglichen Pétanque-Platz kennen, der nicht auf der Karte erscheint, können Sie: ihn direkt über das Bearbeitungswerkzeug zu OpenStreetMap hinzufügen; oder uns die notwendigen Informationen per E-Mail zusenden mapetanque@outlook.be (genauer Standort, Anzahl der Bahnen, falls bekannt, usw.). Nach der Aktualisierung der OpenStreetMap-Daten erscheint der Platz bei der nächsten Synchronisierung automatisch auf Mapetanque.be."
        },
        {
            "q": "Ein auf der Karte angezeigter Platz existiert nicht mehr oder ist nicht mehr nutzbar, was kann ich tun?",
            "a": "Die auf Mapetanque.be angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. Da diese Datenbank kollaborativ ist, können manche Informationen unvollständig oder veraltet sein. Wenn ein Platz nicht mehr existiert oder nicht mehr öffentlich zugänglich ist, können Sie: die Information direkt über das Bearbeitungswerkzeug in OpenStreetMap ändern; oder uns den Fehler per E-Mail melden mapetanque@outlook.be, mit Angabe des Standorts des Platzes und nützlicher Informationen. Wenn der Platz noch existiert, aber lediglich schlecht gepflegt oder beschädigt ist, wenden Sie sich am besten an die zuständige Gemeinde (Sport-, Bau- oder Grünflächenamt), die in der Regel für die Instandhaltung öffentlicher Einrichtungen zuständig ist."
        }
    ]
}


def bloc_accordeon(items):
    morceaux = []
    for index, item in enumerate(items):
        ancre = ANCRES.get(index)
        attr_id = f' id="{ancre}"' if ancre else ""
        morceaux.append(
            f'            <details class="rule-accordion"{attr_id}>\n'
            f"                <summary>\n"
            f"                    {ICONE}\n"
            f'                    <span class="rule-title">{echap(item["q"])}</span>\n'
            f"                </summary>\n"
            f'                <div class="rule-body">\n'
            f"                    <p>{lier_urls_et_emails(item['a'])}</p>\n"
            f"                </div>\n"
            f"            </details>\n"
        )
    return "\n".join(morceaux)


def donnees_structurees(items):
    """Balisage FAQPage : permet à Google d'afficher les questions dans ses résultats."""
    donnees = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["q"],
                "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
            }
            for item in items
        ],
    }
    return (
        '<script type="application/ld+json">\n'
        + json.dumps(donnees, ensure_ascii=False, indent=2)
        + "\n</script>"
    )


for langue, meta in META.items():
    items = CONTENU[langue]
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "faq.html",
        page="faq.html",
        prefixe=meta["prefixe"],
        titre=meta["titre"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=bloc_accordeon(items),
        tete_sup=donnees_structurees(items),
        banniere="/images/banniere-faq.webp",
        credit="« Les Joueurs de pétanque, Marseille » par Émile Loubon",
    )
    print(f"{meta['prefixe']}faq.html : {taille} octets, {len(items)} questions")