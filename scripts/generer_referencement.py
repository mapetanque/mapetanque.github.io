#!/usr/bin/env python3
"""
Référencement : tout ce qui aide Google et les IA à comprendre le site, tiré des pages elles-mêmes.

Parcourt les pages publiques du site (FR à la racine, NL, DE et EN dans leur dossier) et :
  - écrit dans le <head> de chacune un bloc de données structurées schema.org (JSON-LD) :
    fil d'Ariane, type de page, et sur l'accueil le site, son auteur et le jeu de données ;
  - réécrit sitemap.xml en entier : chaque page de chaque langue, ses versions dans les autres
    langues, et la date de sa dernière modification ;
  - réécrit llms.txt, le résumé du site destiné aux IA (convention llmstxt.org), avec les
    chiffres du jour.

Une page est « publique » si elle a une balise canonical qui pointe vers elle-même et pas de
noindex (ce qui écarte admin.html, les anciennes pages faq.html et le fichier de Google).

Tout est déduit des pages (titre, description, fil d'Ariane, hreflang) : une page modifiée ou
ajoutée est prise en compte sans rien changer ici. Lancé automatiquement à la fin de
generate_provinces.py, generer_la_petanque.py et generer_a_propos.py ; à relancer à la main
après une modification de index.html, comment-jouer.html ou compteur.html :
    python scripts/generer_referencement.py

Date de modification des pages : data/sitemap_dates.json garde une empreinte du contenu de
chaque page et la date à laquelle cette empreinte a changé pour la dernière fois. Plus fiable
que l'historique git, que le workflow hebdomadaire ne récupère pas en entier.
"""

import hashlib
import html
import json
import re
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BASE = "https://mapetanque.be"

CHEMIN_SITEMAP = RACINE / "sitemap.xml"
CHEMIN_LLMS = RACINE / "llms.txt"
CHEMIN_DATES = RACINE / "data" / "sitemap_dates.json"
CHEMIN_STATS_GEO = RACINE / "data" / "stats_geo.json"

DOSSIERS_LANGUES = ("", "nl/", "de/", "en/")

# Ordre des pages dans le sitemap et dans llms.txt (les autres suivent, par ordre alphabétique)
ORDRE_PAGES = ["index.html", "comment-jouer.html", "compteur.html", "la-petanque.html",
               "a-propos.html"]

ID_SITE = f"{BASE}/#site"
ID_AUTEUR = f"{BASE}/#mapetanque"

DEBUT_BLOC = ("    <!-- Données structurées schema.org (Google, IA) : écrites par "
              "scripts/generer_referencement.py, ne pas modifier à la main. -->\n")
MOTIF_BLOC = re.compile(
    r'[ \t]*<!-- Données structurées schema\.org.*?-->\n'
    r'[ \t]*<script type="application/ld\+json">.*?</script>\n',
    re.S,
)

# Jeu de données de l'accueil : seuls textes propres à ce script, dans les quatre langues.
JEU_DE_DONNEES = {
    "fr": ("Terrains de pétanque publics en Belgique",
           "Emplacement des terrains de pétanque accessibles au public en Belgique (Wallonie, "
           "Flandre et Bruxelles), tirés d'OpenStreetMap et mis à jour chaque semaine."),
    "nl": ("Openbare petanqueterreinen in België",
           "Ligging van de openbare petanqueterreinen in België (Wallonië, Vlaanderen en "
           "Brussel), afkomstig van OpenStreetMap en wekelijks bijgewerkt."),
    "de": ("Öffentliche Pétanque-Plätze in Belgien",
           "Standorte der öffentlich zugänglichen Pétanque-Plätze in Belgien (Wallonien, "
           "Flandern und Brüssel), aus OpenStreetMap, wöchentlich aktualisiert."),
    "en": ("Public pétanque courts in Belgium",
           "Locations of publicly accessible pétanque courts in Belgium (Wallonia, Flanders "
           "and Brussels), taken from OpenStreetMap and updated every week."),
}
NOM_BELGIQUE = {"fr": "Belgique", "nl": "België", "de": "Belgien", "en": "Belgium"}


# --- Lecture des pages ------------------------------------------------------------------------

def url_de(chemin_relatif):
    """URL publique d'un fichier : index.html → dossier, le reste tel quel."""
    url = "/" + chemin_relatif
    if url.endswith("/index.html"):
        url = url[: -len("index.html")]
    return BASE + url


def attribut(src, motif):
    m = re.search(motif, src, re.S)
    return html.unescape(m.group(1)).strip() if m else None


def lire_page(chemin):
    """Ce dont on a besoin d'une page, ou None si elle n'est pas publique."""
    relatif = chemin.relative_to(RACINE).as_posix()
    src = chemin.read_text(encoding="utf-8")
    tete = src[: src.find("</head>")]
    url = url_de(relatif)

    if re.search(r'<meta name="robots" content="[^"]*noindex', tete):
        return None
    if attribut(tete, r'<link rel="canonical" href="([^"]*)"') != url:
        return None

    titre = attribut(tete, r"<title>(.*?)</title>")
    # Fil d'Ariane visible : liens puis élément courant
    fil = []
    m = re.search(r'<div class="province-breadcrumb">(.*?)</div>', src, re.S)
    if m:
        for lien, libelle in re.findall(r'<a href="([^"]*)">(.*?)</a>', m.group(1)):
            # Un intermédiaire qui renvoie vers la page elle-même (Bruxelles, dont la page
            # province tient lieu de page région) n'apporte rien : on le saute.
            if BASE + lien != url:
                fil.append((html.unescape(libelle).strip(), BASE + lien))
        courant = re.search(r'<span class="current">(.*?)</span>', m.group(1), re.S)
        if courant:
            fil.append((html.unescape(courant.group(1)).strip(), url))

    banniere = re.search(r"class=\"hero-banner\" style=\"background-image: url\('([^']*)'\)", src)
    return {
        "chemin": chemin,
        "relatif": relatif,
        "fichier": chemin.name,
        "src": src,
        "url": url,
        "langue": attribut(src, r'<html lang="([^"]*)"') or "fr",
        "titre": titre,
        "nom": re.sub(r"\s+—\s+Mapetanque\.be$", "", titre or ""),
        "description": attribut(tete, r'<meta name="description"[^>]*content="([^"]*)"'),
        "image": (BASE + banniere.group(1)) if banniere else
                 attribut(tete, r'<meta property="og:image" content="([^"]*)"'),
        "versions": re.findall(r'<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">', tete),
        "fil": fil,
    }


def lister_pages():
    pages = []
    for dossier in DOSSIERS_LANGUES:
        # Les pages commune (scripts/generer_communes.py) vivent dans un sous-dossier commune/
        for motif in ("*.html", "commune/*.html"):
            for chemin in sorted((RACINE / dossier).glob(motif)):
                page = lire_page(chemin)
                if page:
                    pages.append(page)

    def rang(page):
        """Par page, puis par langue (FR, NL, DE, EN). Les pages commune après les autres."""
        nom = page["fichier"]
        dossier = page["relatif"][: -len(nom)]
        commune = dossier.endswith("commune/")
        langue = dossier[: -len("commune/")] if commune else dossier
        return (commune, ORDRE_PAGES.index(nom) if nom in ORDRE_PAGES else len(ORDRE_PAGES), nom,
                DOSSIERS_LANGUES.index(langue))

    return sorted(pages, key=rang)


# --- Données structurées ----------------------------------------------------------------------

def auteur():
    return {
        "@type": "Organization",
        "@id": ID_AUTEUR,
        "name": "Mapetanque",
        "url": f"{BASE}/",
        "logo": f"{BASE}/images/icone-512.png",
        "email": "mapetanque@outlook.be",
        "sameAs": ["https://github.com/mapetanque/mapetanque.github.io"],
    }


def fil_ariane(page):
    elements = [
        {"@type": "ListItem", "position": position, "name": libelle, "item": url}
        for position, (libelle, url) in enumerate(page["fil"], start=1)
    ]
    return {"@type": "BreadcrumbList", "itemListElement": elements}


def donnees_structurees(page):
    """Graphe schema.org de la page, selon son type (déduit du nom de fichier)."""
    fichier = page["fichier"]
    langue = page["langue"]
    page_web = {
        "@type": "WebPage",
        "@id": page["url"] + "#page",
        "url": page["url"],
        "name": page["nom"],
        "description": page["description"],
        "inLanguage": langue,
        "isPartOf": {"@id": ID_SITE},
        "primaryImageOfPage": page["image"],
    }
    if len(page["fil"]) > 1:
        page_web["breadcrumb"] = fil_ariane(page)
    graphe = [page_web]

    if fichier == "index.html":
        nom_donnees, description_donnees = JEU_DE_DONNEES[langue]
        graphe += [
            {
                "@type": "WebSite",
                "@id": ID_SITE,
                "url": f"{BASE}/",
                "name": "Mapetanque",
                "alternateName": "Mapetanque.be",
                "description": page["description"],
                "inLanguage": ["fr", "nl", "de", "en"],
                "publisher": {"@id": ID_AUTEUR},
            },
            auteur(),
            {
                "@type": "Dataset",
                "name": nom_donnees,
                "description": description_donnees,
                "url": page["url"],
                "inLanguage": langue,
                "isAccessibleForFree": True,
                "license": "https://opendatacommons.org/licenses/odbl/1-0/",
                "creator": {"@type": "Organization", "name": "OpenStreetMap",
                            "url": "https://www.openstreetmap.org/copyright"},
                "publisher": {"@id": ID_AUTEUR},
                "spatialCoverage": {"@type": "Country", "name": NOM_BELGIQUE[langue]},
                "distribution": {"@type": "DataDownload",
                                 "encodingFormat": "application/geo+json",
                                 "contentUrl": f"{BASE}/data/terrains.geojson"},
            },
        ]
        page_web["about"] = {"@id": page["url"] + "#donnees"}
        graphe[-1]["@id"] = page["url"] + "#donnees"
    elif fichier.startswith(("province-", "region-")):
        page_web["@type"] = "CollectionPage"
        # Le dernier élément du fil d'Ariane est le nom de la province ou de la région
        nom_lieu = page["fil"][-1][0] if page["fil"] else page["nom"]
        page_web["about"] = {
            "@type": "AdministrativeArea",
            "name": nom_lieu,
            "containedInPlace": {"@type": "Country", "name": NOM_BELGIQUE[langue]},
        }
    elif "commune/" in page["relatif"]:
        page_web["@type"] = "CollectionPage"
        # Fil d'Ariane : … › province › commune (Bruxelles : … › région › commune)
        nom_commune = page["fil"][-1][0] if page["fil"] else page["nom"]
        englobant = ({"@type": "AdministrativeArea", "name": page["fil"][-2][0]}
                     if len(page["fil"]) > 2 else {"@type": "Country", "name": NOM_BELGIQUE[langue]})
        page_web["about"] = {
            "@type": "AdministrativeArea",
            "name": nom_commune,
            "containedInPlace": englobant,
        }
    elif fichier in ("la-petanque.html", "comment-jouer.html"):
        graphe.append({
            "@type": "Article",
            "headline": page["nom"],
            "description": page["description"],
            "inLanguage": langue,
            "image": page["image"],
            "mainEntityOfPage": {"@id": page_web["@id"]},
            "author": {"@id": ID_AUTEUR},
            "publisher": auteur(),
            "about": {"@type": "Thing", "name": "Pétanque",
                      "sameAs": "https://www.wikidata.org/wiki/Q208491"},
        })
    elif fichier == "a-propos.html":
        page_web["@type"] = "AboutPage"
        page_web["about"] = auteur()
    elif fichier == "compteur.html":
        graphe.append({
            "@type": "WebApplication",
            "name": page["nom"],
            "description": page["description"],
            "url": page["url"],
            "inLanguage": langue,
            "applicationCategory": "SportsApplication",
            "operatingSystem": "Web",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
            "publisher": {"@id": ID_AUTEUR},
        })

    return {"@context": "https://schema.org", "@graph": graphe}


def bloc_json_ld(page):
    contenu = json.dumps(donnees_structurees(page), ensure_ascii=False, indent=2)
    contenu = contenu.replace("</", "<\\/")  # jamais de « </script> » dans le bloc
    contenu = "\n".join("    " + ligne for ligne in contenu.splitlines())
    return DEBUT_BLOC + '    <script type="application/ld+json">\n' + contenu + "\n    </script>\n"


def retirer_bloc(src):
    """Page sans données structurées (utilisé par _squelette.py, qui part de comment-jouer.html
    pour fabriquer d'autres pages : le bloc de celle-ci ne doit pas être recopié)."""
    return MOTIF_BLOC.sub("", src)


def ecrire_donnees_structurees(page):
    """Insère ou remplace le bloc juste avant </head>. Renvoie True si la page a changé."""
    src = retirer_bloc(page["src"])
    nouveau = src.replace("</head>", bloc_json_ld(page) + "</head>", 1)
    if nouveau == page["src"]:
        return False
    page["chemin"].write_text(nouveau, encoding="utf-8")
    page["src"] = nouveau
    return True


# --- sitemap.xml ------------------------------------------------------------------------------

def dates_de_modification(pages):
    """Date de dernière modification de chaque page, d'après l'empreinte de son contenu."""
    try:
        connues = json.loads(CHEMIN_DATES.read_text(encoding="utf-8"))
    except FileNotFoundError:
        connues = {}
    aujourd_hui = date.today().isoformat()
    dates = {}
    for page in pages:
        empreinte = hashlib.sha256(page["src"].encode("utf-8")).hexdigest()[:16]
        ancienne = connues.get(page["url"])
        if ancienne and ancienne["empreinte"] == empreinte:
            dates[page["url"]] = ancienne
        else:
            dates[page["url"]] = {"empreinte": empreinte, "date": aujourd_hui}
    if dates != connues:
        CHEMIN_DATES.write_text(json.dumps(dates, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")
    return {url: d["date"] for url, d in dates.items()}


def ecrire_sitemap(pages, dates):
    """Une entrée par page et par langue (Google veut chaque version comme une adresse à part),
    avec les versions dans les autres langues annoncées par la page elle-même."""
    publiques = {page["url"] for page in pages}
    lignes = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!-- Écrit par scripts/generer_referencement.py : ne pas modifier à la main. -->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for page in pages:
        lignes += [
            "    <url>",
            f"        <loc>{page['url']}</loc>",
            f"        <lastmod>{dates[page['url']]}</lastmod>",
        ]
        for langue, url in page["versions"]:
            if url in publiques:
                lignes.append(
                    f'        <xhtml:link rel="alternate" hreflang="{langue}" href="{url}" />'
                )
        lignes.append("    </url>")
    lignes.append("</urlset>")
    contenu = "\n".join(lignes) + "\n"
    if not CHEMIN_SITEMAP.exists() or CHEMIN_SITEMAP.read_text(encoding="utf-8") != contenu:
        CHEMIN_SITEMAP.write_text(contenu, encoding="utf-8")


# --- llms.txt ---------------------------------------------------------------------------------

def nombre(n):
    """1743 → « 1 743 » (espace insécable fine, comme en typographie française)."""
    return f"{n:,}".replace(",", " ")


def ecrire_llms(pages):
    """Résumé du site pour les IA, en français, avec les chiffres du jour et un lien vers chaque
    page. Les versions NL, DE et EN sont signalées sans être détaillées."""
    stats = json.loads(CHEMIN_STATS_GEO.read_text(encoding="utf-8"))
    fr = {page["fichier"]: page for page in pages if page["relatif"] == page["fichier"]}

    # Wallonie et Flandre : communes rangées sous leurs provinces ; Bruxelles : sous la région
    # (comme sur les pages province et région)
    def communes_region(region):
        if region == "bruxelles":
            return set(stats[region]["communes"])
        return {c for province in stats[region]["provinces"].values() for c in province["communes"]}

    total = sum(r["total"] for r in stats.values())
    nb_communes = len(set().union(*(communes_region(r) for r in stats)))

    def lien(fichier, suffixe=""):
        page = fr.get(fichier)
        if not page:
            return None
        return f"- [{page['nom']}]({page['url']}){suffixe}: {page['description']}"

    lignes = [
        "# Mapetanque.be",
        "",
        f"> Carte interactive et gratuite des terrains de pétanque accessibles au public en "
        f"Belgique : {nombre(total)} terrains dans {nombre(nb_communes)} communes, en Wallonie, "
        f"en Flandre et à Bruxelles. Site en français, néerlandais, allemand et anglais.",
        "",
        "Les terrains viennent d'OpenStreetMap et sont mis à jour chaque semaine ; les photos "
        "viennent de Mapillary. Sur la carte, chaque terrain a une fiche : emplacement, "
        "photos, itinéraire, notes et avis de visiteurs. Les clubs de pétanque peuvent aussi "
        "être affichés. Le site est gratuit, sans compte ni publicité, et son code est "
        "ouvert. Contact : mapetanque@outlook.be.",
        "",
        "## Terrains par région et par province",
        "",
    ]

    def ligne_lieu(fichier, total_lieu, communes, retrait=""):
        page = fr.get(fichier)
        if not page:
            return None
        return (f"{retrait}- [{page['fil'][-1][0]}]({page['url']}): {nombre(total_lieu)} "
                f"terrain{'s' if total_lieu > 1 else ''} dans {nombre(communes)} "
                f"commune{'s' if communes > 1 else ''}")

    for region, cle_page in (("wallonie", "region-wallonie.html"),
                             ("flandre", "region-flandre.html"),
                             ("bruxelles", "province-bruxelles.html")):
        donnees = stats[region]
        ligne = ligne_lieu(cle_page, donnees["total"], len(communes_region(region)))
        if ligne:
            lignes.append(ligne)
        if region == "bruxelles":
            continue  # pas de province
        provinces = sorted(donnees["provinces"].items(), key=lambda t: -t[1]["total"])
        for cle, province in provinces:
            ligne = ligne_lieu(f"province-{cle.replace('_', '-')}.html", province["total"],
                               len(province["communes"]), "  ")
            if ligne:
                lignes.append(ligne)

    # Pages commune (FR), rangées par province — Bruxelles, sans province, par région
    communes = [page for page in pages if page["relatif"].startswith("commune/") and page["fil"]]
    if communes:
        lignes += [
            "",
            "## Terrains par commune",
            "",
            f"Une page pour chacune des {nombre(len(communes))} communes ayant des terrains à au "
            "moins deux endroits : liste des terrains avec photos et équipements à proximité, "
            "clubs de la commune et communes voisines.",
            "",
        ]
        par_province = {}
        for page in communes:
            province = page["fil"][-2][0] if len(page["fil"]) > 2 else ""
            par_province.setdefault(province, []).append(page)
        for province in sorted(par_province):
            liens = ", ".join(f"[{p['fil'][-1][0]}]({p['url']})"
                              for p in sorted(par_province[province], key=lambda p: p["fil"][-1][0]))
            lignes.append(f"- {province} : {liens}")

    lignes += ["", "## Jouer à la pétanque", ""]
    lignes += [l for l in (lien("comment-jouer.html"), lien("compteur.html"),
                           lien("la-petanque.html")) if l]

    lignes += [
        "",
        "## Données",
        "",
        f"- [Terrains au format GeoJSON]({BASE}/data/terrains.geojson): un point par terrain, "
        "avec sa commune, sa province et sa région. Données OpenStreetMap, licence ODbL "
        "(© les contributeurs d'OpenStreetMap).",
        "",
        "## Autres langues",
        "",
        f"- [Nederlands]({BASE}/nl/)",
        f"- [Deutsch]({BASE}/de/)",
        f"- [English]({BASE}/en/)",
        "",
        "## Optional",
        "",
    ]
    lignes += [l for l in (lien("a-propos.html"),) if l]

    contenu = "\n".join(lignes) + "\n"
    if not CHEMIN_LLMS.exists() or CHEMIN_LLMS.read_text(encoding="utf-8") != contenu:
        CHEMIN_LLMS.write_text(contenu, encoding="utf-8")


# --- Programme --------------------------------------------------------------------------------

def main():
    pages = lister_pages()
    modifiees = [page["relatif"] for page in pages if ecrire_donnees_structurees(page)]
    dates = dates_de_modification(pages)
    ecrire_sitemap(pages, dates)
    ecrire_llms(pages)
    print(f"Référencement : {len(pages)} pages publiques, données structurées mises à jour "
          f"dans {len(modifiees)} page(s), sitemap.xml et llms.txt à jour.")


if __name__ == "__main__":
    main()
