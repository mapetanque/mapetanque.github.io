"""
Génère soutenir.html, nl/soutenir.html, de/soutenir.html et en/soutenir.html (page de dons) à
partir des pages « Comment jouer » du dépôt, sur le modèle de a-propos.html.

Partout ailleurs sur le site (pied de page, À propos), on renvoie vers cette page et jamais
directement vers le service de dons : pour en changer, il suffit de modifier URL_DONS ci-dessous
et de relancer ce script.

À lancer depuis la racine du dépôt :
    python scripts/generer_soutenir.py

Les pages existantes sont écrasées : modifier le contenu ci-dessous, puis relancer.
"""

from pathlib import Path

from _squelette import construire_page, echap
import generer_referencement

RACINE = Path(__file__).resolve().parent.parent

# Seul endroit du site où figure l'adresse du service de dons.
URL_DONS = "https://ko-fi.com/mapetanque"

# Le fil d'Ariane et le titre de l'onglet reprennent le libellé court ; le grand titre est
# l'appel lui-même.
META = {
    "fr": {
        "prefixe": "",
        "titre_page": "Soutenir — Mapetanque.be",
        "h1": "Soutenez Mapetanque.be !",
        "fil": ("Accueil", "Soutenir"),
        "description": (
            "Mapetanque.be est gratuit, sans publicité ni pistage. Si vous l'appréciez, vous "
            "pouvez aider à couvrir ses frais en m'offrant un café."
        ),
    },
    "nl": {
        "prefixe": "nl/",
        "titre_page": "Steunen — Mapetanque.be",
        "h1": "Steun Mapetanque.be!",
        "fil": ("Home", "Steunen"),
        "description": (
            "Mapetanque.be is gratis, zonder reclame of tracking. Vind je de site nuttig, dan "
            "kan je helpen de kosten te dekken door me op een koffie te trakteren."
        ),
    },
    "de": {
        "prefixe": "de/",
        "titre_page": "Unterstützen — Mapetanque.be",
        "h1": "Unterstützen Sie Mapetanque.be!",
        "fil": ("Startseite", "Unterstützen"),
        "description": (
            "Mapetanque.be ist kostenlos, ohne Werbung und Tracking. Wenn Ihnen die Website "
            "gefällt, können Sie mit einem spendierten Kaffee zu ihren Kosten beitragen."
        ),
    },
    "en": {
        "prefixe": "en/",
        "titre_page": "Support — Mapetanque.be",
        "h1": "Support Mapetanque.be!",
        "fil": ("Home", "Support"),
        "description": (
            "Mapetanque.be is free, with no advertising or tracking. If you enjoy it, you can "
            "help cover its costs by treating me to a coffee."
        ),
    },
}

# --- Contenu -------------------------------------------------------------------------------
# Même registre que a-propos.html : le néerlandais tutoie, l'allemand vouvoie, l'anglais suit
# l'orthographe britannique.

CONTENU = {
    "fr": {
        "paragraphes": [
            "Mapetanque.be est un projet 100 % gratuit, sans publicité ni pistage, pour aider la "
            "communauté à trouver des terrains de pétanque en Belgique et à enregistrer ses "
            "parties.",
            "Je développe et entretiens le site seul, sur mon temps libre. Si vous l'appréciez, "
            "vous pouvez m'aider à payer son nom de domaine et à continuer de l'améliorer :",
        ],
        "bouton": "M'offrir un café",
        "note": "Le paiement se fait en toute sécurité sur Ko-fi.",
        "merci": "Merci pour votre soutien et bonnes parties !",
    },
    "nl": {
        "paragraphes": [
            "Mapetanque.be is een 100% gratis project, zonder reclame of tracking, dat de "
            "petanquegemeenschap helpt om terreinen in België te vinden en partijen bij te "
            "houden.",
            "Ik ontwikkel en onderhoud de site alleen, in mijn vrije tijd. Vind je hem nuttig, "
            "dan kan je me helpen om de domeinnaam te betalen en de site verder te verbeteren:",
        ],
        "bouton": "Trakteer me op een koffie",
        "note": "De betaling verloopt veilig via Ko-fi.",
        "merci": "Bedankt voor je steun en veel speelplezier!",
    },
    "de": {
        "paragraphes": [
            "Mapetanque.be ist ein zu 100 % kostenloses Projekt ohne Werbung und Tracking, das "
            "der Pétanque-Gemeinschaft hilft, Plätze in Belgien zu finden und ihre Partien "
            "festzuhalten.",
            "Ich entwickle und pflege die Website allein in meiner Freizeit. Wenn sie Ihnen "
            "gefällt, können Sie mir helfen, den Domainnamen zu bezahlen und sie weiter zu "
            "verbessern:",
        ],
        "bouton": "Spendieren Sie mir einen Kaffee",
        "note": "Die Zahlung erfolgt sicher über Ko-fi.",
        "merci": "Danke für Ihre Unterstützung und viel Spaß beim Spielen!",
    },
    "en": {
        "paragraphes": [
            "Mapetanque.be is a 100% free project, with no advertising or tracking, that helps "
            "the community find pétanque courts in Belgium and keep track of their games.",
            "I build and maintain the site on my own, in my spare time. If you enjoy it, you can "
            "help me pay for its domain name and keep improving it:",
        ],
        "bouton": "Treat me to a coffee",
        "note": "Payment is handled securely by Ko-fi.",
        "merci": "Thanks for your support, and enjoy your games!",
    },
}

# Picto « coffee » de Lucide (licence ISC), comme les autres pictos du site
ICONE_CAFE = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M10 2v2"></path><path d="M14 2v2"></path><path d="M6 2v2"></path>'
    '<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 '
    '0 8h-1"></path></svg>'
)


def bloc_contenu(langue):
    c = CONTENU[langue]
    morceaux = ['            <section class="apropos-section">']
    for para in c["paragraphes"]:
        morceaux.append(f"                <p>{echap(para)}</p>")
    morceaux.append(
        '                <div class="soutenir-appel">\n'
        f'                    <a class="soutenir-bouton" href="{URL_DONS}" target="_blank" '
        f'rel="noopener">{ICONE_CAFE}<span>{echap(c["bouton"])}</span></a>\n'
        f'                    <p class="soutenir-note">{echap(c["note"])}</p>\n'
        "                </div>"
    )
    morceaux.append(f'                <p class="soutenir-merci">{echap(c["merci"])}</p>')
    morceaux.append("            </section>\n")
    return "\n".join(morceaux)


for langue, meta in META.items():
    taille = construire_page(
        RACINE / meta["prefixe"] / "comment-jouer.html",
        RACINE / meta["prefixe"] / "soutenir.html",
        page="soutenir.html",
        prefixe=meta["prefixe"],
        titre=meta["titre_page"],
        description=meta["description"],
        h1=meta["h1"],
        fil=meta["fil"],
        contenu=bloc_contenu(langue),
        feuilles_sup=("/style-a-propos.css", "/style-soutenir.css"),
    )
    print(f"{meta['prefixe']}soutenir.html : {taille} octets")

# Données structurées de la page, sitemap.xml et llms.txt
generer_referencement.main()
