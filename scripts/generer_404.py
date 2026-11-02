"""
Génère 404.html, la page « introuvable » du site, à partir de comment-jouer.html (en-tête, menu,
pied de page), comme a-propos.html et soutenir.html.

Une seule page pour les quatre langues : GitHub Pages sert 404.html (à la racine) pour toute
adresse inconnue, y compris sous /nl/, /de/ et /en/. Les textes portent donc des data-i18n
(clés introuvable_* de translations.js), traduits par script.js d'après l'adresse, et
introuvable.js pose les liens dans la bonne langue. Tous les chemins sont absolus (/style.css) :
la page peut s'afficher à n'importe quelle profondeur (/commune/inconnue.html).

Pas de canonical, de hreflang ni de données structurées, et noindex : generer_referencement.py
l'écarte ainsi du sitemap et de llms.txt.

À lancer depuis n'importe où :
    python scripts/generer_404.py

La page existante est écrasée : modifier le contenu ci-dessous, puis relancer.
"""

import re
from pathlib import Path

from _squelette import construire_page

RACINE = Path(__file__).resolve().parent.parent

# Pictos Lucide (licence ISC), comme les autres pictos du site
PICTO_LOUPE = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>'
)
PICTO_REPERE = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"></path>'
    '<circle cx="12" cy="9.5" r="2.5"></circle></svg>'
)

# Terrain vu de dessus : le cadre, le cochonnet, une boule en jeu, le cercle de lancer à droite
# et la boule qui en part, passe sous le cochonnet et sort du cadre en bas à gauche (trajectoire
# reprise dans style-introuvable.css). La boule n'est pas le logo : boule pleine, deux stries,
# sans cochonnet découpé, d'où la rotation permise. Ses couleurs sont écrites dans le SVG : les
# feuilles de style n'atteignent pas l'intérieur d'un <use>.
DESSIN = """\
                <svg viewBox="0 0 400 260" role="img" aria-labelledby="introuvable-dessin-titre">
                    <title id="introuvable-dessin-titre" data-i18n="introuvable_dessin">Une boule de pétanque roule vers le cochonnet et sort du terrain.</title>
                    <defs>
                        <clipPath id="introuvable-coupe"><circle r="16"></circle></clipPath>
                        <g id="introuvable-boule">
                            <circle r="16" fill="#74C15A"></circle>
                            <g clip-path="url(#introuvable-coupe)">
                                <ellipse rx="7" ry="18" transform="rotate(22)" fill="none" stroke="#FFFFFF" stroke-width="2.6"></ellipse>
                                <ellipse rx="18" ry="6" transform="rotate(22)" fill="none" stroke="#FFFFFF" stroke-width="2.6"></ellipse>
                            </g>
                        </g>
                    </defs>
                    <rect x="14" y="20" width="310" height="180" rx="6" class="cadre"></rect>
                    <circle cx="108" cy="104" r="6" class="cochonnet"></circle>
                    <use href="#introuvable-boule" x="80" y="86"></use>
                    <circle cx="296" cy="112" r="24" class="cercle-lancer"></circle>
                    <path class="trajet" d="M296 112 C 230 112, 160 116, 118 138 S 52 200, 30 232"></path>
                    <g class="roule" transform="translate(30 232)"><g class="tourne"><use href="#introuvable-boule"></use></g></g>
                </svg>"""

# Textes en français dans le HTML (affichés tels quels si le script ne tourne pas) ; script.js
# les remplace par ceux de la langue de l'adresse. data-lien : chemin sans la langue, complété
# par introuvable.js (/nl/carte.html…).
CONTENU = f"""\
            <div class="introuvable">
                <div class="introuvable-texte">
                    <p class="introuvable-sur-titre" data-i18n="introuvable_sur_titre">Erreur 404</p>
                    <h1 data-i18n="introuvable_titre">Cette page est sortie du terrain.</h1>
                    <p class="introuvable-intro" data-i18n="introuvable_texte">On la ramasse et on rejoue.</p>

                    <form class="introuvable-recherche" id="introuvable-recherche" role="search">
                        <label for="introuvable-champ" data-i18n="introuvable_chercher">Chercher une commune</label>
                        <div class="introuvable-champ">
                            {PICTO_LOUPE}
                            <input id="introuvable-champ" type="search" autocomplete="off" enterkeyhint="search" placeholder="Namur, Gand, Arlon…" data-i18n-placeholder="introuvable_chercher_aide">
                        </div>
                        <ul class="introuvable-resultats" id="introuvable-resultats" aria-live="polite" hidden></ul>
                    </form>

                    <div class="introuvable-actions">
                        <a class="introuvable-bouton principal" href="/carte.html?moi=1" data-lien="carte.html?moi=1">{PICTO_REPERE}<span data-i18n="introuvable_pres_de_moi">Trouver un terrain près de moi</span></a>
                        <a class="introuvable-bouton second" href="/" data-lien="" data-i18n="introuvable_accueil">Retour à l'accueil</a>
                    </div>

                    <p class="introuvable-liens">
                        <span data-i18n="introuvable_ou">Ou bien :</span>
                        <a href="/provinces.html" data-lien="provinces.html" data-i18n="pied_toutes_provinces">Toutes les provinces</a>
                        <a href="/compteur.html" data-lien="compteur.html" data-i18n="introuvable_compteur">Compteur de points</a>
                    </p>
                </div>

                <div class="introuvable-dessin">
{DESSIN}
                </div>
            </div>
"""


def main():
    cible = RACINE / "404.html"
    construire_page(
        RACINE / "comment-jouer.html",
        cible,
        page="404.html",
        prefixe="",
        titre="Page introuvable — Mapetanque.be",
        description="Cette page n'existe pas, ou plus.",
        h1="",
        fil=("Accueil", "Page introuvable"),
        contenu=CONTENU,
        feuilles_sup=("/style-introuvable.css",),
        scripts_sup=("/introuvable.js",),
    )

    src = cible.read_text(encoding="utf-8")
    # Ni adresse officielle ni traductions annoncées : la page répond à n'importe quelle adresse.
    src = re.sub(r'\s*<link rel="canonical" href="[^"]*">', "", src)
    src = re.sub(r'\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*">', "", src)
    src = re.sub(r'\s*<meta property="og:url" content="[^"]*">', "", src)
    src = src.replace(
        '<meta name="viewport"',
        '<meta name="robots" content="noindex">\n    <meta name="viewport"',
        1,
    )
    # Pas de fil d'Ariane ni de titre dans l'en-tête : le titre est dans la page, à côté du dessin
    src = re.sub(r'\s*<div class="province-breadcrumb">.*?</div>', "", src, count=1, flags=re.S)
    src = re.sub(r'\s*<h1 class="hero-headline">.*?</h1>', "", src, count=1, flags=re.S)
    src = src.replace("<body>", '<body class="page-introuvable">', 1)

    for attendu in ('name="robots"', 'class="page-introuvable"', "introuvable.js"):
        if attendu not in src:
            raise SystemExit(f"404.html : {attendu} manquant, vérifier comment-jouer.html")
    for interdit in ('rel="canonical"', 'rel="alternate"', 'class="province-breadcrumb"',
                     'class="hero-headline"'):
        if interdit in src:
            raise SystemExit(f"404.html : {interdit} encore présent")

    cible.write_text(src, encoding="utf-8")
    print(f"404.html : {len(src)} octets")


if __name__ == "__main__":
    main()
