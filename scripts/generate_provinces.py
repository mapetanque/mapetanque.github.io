#!/usr/bin/env python3
"""
Générateur des pages provinces de Mapetanque (FR + NL + DE).

Lit :
  - templates/province_template.html   (template avec jetons {{...}})
  - data/provinces.json                (contenu propre à chaque province, avec traductions
                                         optionnelles sous province["translations"]["nl"/"de"])
  - data/stats_geo.json                (mêmes données que le site : terrains/communes)
  - data/geo_names.json                (noms de régions/provinces par langue, copiés de translations.js)
  - data/ui_strings.json               (textes fixes de l'interface des pages province, par langue)

Écrit, pour chaque province ET chaque langue dont les champs sont complets :
  - province-<slug>.html               (français, à la racine)
  - nl/province-<slug>.html            (néerlandais, si traduction dispo)
  - de/province-<slug>.html            (allemand, si traduction dispo)
  - data/communes-<slug>.json          (partagé entre les 3 langues, écrit une seule fois)

Une langue "pas encore prête" pour une province (pas d'entrée dans translations.nl/de) est
ignorée avec un message clair, plutôt que de générer une page à moitié traduite. Le sélecteur
de langue de chaque page renvoie alors vers la racine de la langue cible (comportement de repli
déjà existant sur le reste du site) plutôt que vers un lien mort.

Usage :
    python3 generate_provinces.py
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # racine du repo (le script vit dans scripts/)
TEMPLATE_PATH = BASE_DIR / "templates" / "province_template.html"
PROVINCES_PATH = BASE_DIR / "data" / "provinces.json"
STATS_GEO_PATH = BASE_DIR / "data" / "stats_geo.json"
GEO_NAMES_PATH = BASE_DIR / "data" / "geo_names.json"
UI_STRINGS_PATH = BASE_DIR / "data" / "ui_strings.json"
OUTPUT_DIR = BASE_DIR  # écrit directement à la racine du repo, comme index.html

SITEMAP_PATH = BASE_DIR / "sitemap.xml"
MARQUEUR_DEBUT = "<!-- DEBUT PAGES PROVINCES"
MARQUEUR_FIN = "<!-- FIN PAGES PROVINCES -->"

LANGUES = ["fr", "nl", "de"]


def charger_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def recuperer_communes(stats_geo, region_key, province_key):
    region = stats_geo[region_key]
    if province_key is None:
        return region["communes"], region["total"]
    province = region["provinces"][province_key]
    return province["communes"], province["total"]


def calculer_densite(total_terrains, area_km2):
    if not area_km2:
        return None
    valeur = total_terrains / (area_km2 / 100)
    return f"{valeur:.1f}".replace(".", ",")


def construire_bloc_densite(densite, label_100km2):
    if densite is None:
        return ""
    return (
        '        <div class="province-stat-tile">\n'
        f'            <span class="province-stat-tile-number">{densite}</span>\n'
        f'            <span class="province-stat-tile-label">{label_100km2}</span>\n'
        '        </div>\n'
    )


def url_page(slug, langue):
    prefixe = "" if langue == "fr" else f"{langue}/"
    return f"/{prefixe}province-{slug}.html"


def url_racine_langue(langue):
    return "/" if langue == "fr" else f"/{langue}/"


def provinces_pretes(provinces, langue):
    """Sous-ensemble de provinces qui ont du contenu complet pour cette langue."""
    pretes = {}
    for cle, config in provinces.items():
        if cle.startswith("_"):
            continue
        if langue == "fr":
            intro = config.get("intro_html")
        else:
            intro = config.get("translations", {}).get(langue, {}).get("intro_html")
        if intro is not None and config.get("banner_image") is not None:
            pretes[cle] = config
    return pretes


def construire_bloc_autres_provinces(cle_courante, provinces, langue, geo_names, ui_strings):
    """HTML complet du bloc "Autres provinces" (h2 + liens), ou chaîne vide s'il n'y a
    encore aucune autre province prête dans cette langue."""
    ui = ui_strings[langue]
    pretes = provinces_pretes(provinces, langue)
    pretes.pop(cle_courante, None)
    if not pretes:
        return ""

    ordre_regions = ["flandre", "wallonie", "bruxelles"]
    par_region = {}
    for cle, config in pretes.items():
        par_region.setdefault(config["region_key"], []).append((cle, config))

    blocs = []
    for region_key in ordre_regions:
        entrees = par_region.get(region_key)
        if not entrees:
            continue
        nom_region = geo_names["regions"][region_key][langue]
        entrees_triees = sorted(entrees, key=lambda t: geo_names["provinces"][t[0]][langue])
        liens = "\n".join(
            f'            <a href="{url_page(c["slug"], langue)}">{geo_names["provinces"][cle][langue]}</a>'
            for cle, c in entrees_triees
        )
        blocs.append(
            f'        <div class="other-provinces-group">\n'
            f'            <span class="other-provinces-group-label">{nom_region}</span>\n'
            f'            <div class="other-provinces-links">\n{liens}\n            </div>\n'
            f'        </div>'
        )

    liens_html = "\n".join(blocs)
    return (
        '    <div class="other-provinces-section">\n'
        f'        <h2>{ui["autres_provinces"]}</h2>\n'
        f'{liens_html}\n'
        '    </div>'
    )


def construire_hreflang_links(slug, langues_disponibles):
    lignes = []
    for langue in langues_disponibles:
        lignes.append(f'    <link rel="alternate" hreflang="{langue}" href="https://mapetanque.github.io{url_page(slug, langue)}">')
    if langues_disponibles:
        lignes.append(f'    <link rel="alternate" hreflang="x-default" href="https://mapetanque.github.io{url_page(slug, "fr")}">')
    return "\n".join(lignes)


def generer_page(cle, config, langue, langues_disponibles, other_provinces_block, template,
                  stats_geo, geo_names, ui_strings, communes_deja_ecrites):
    ui = ui_strings[langue]

    communes, total_terrains = recuperer_communes(
        stats_geo, config["stats_geo_region"], config["stats_geo_province"]
    )
    nb_communes = len(communes)
    densite = calculer_densite(total_terrains, config.get("area_km2"))

    nom_province = geo_names["provinces"][cle][langue]
    nom_region = geo_names["regions"][config["region_key"]][langue]

    if config["region_key"] == "bruxelles":
        h1 = ui["h1_bruxelles"].format(nom=nom_province)
    elif langue == "fr":
        voyelle_ou_h = nom_province[0].lower() in "aeiouh"
        prefixe = "d'" if voyelle_ou_h else "de "
        h1 = ui["h1_province"].format(nom=nom_province, prefixe=prefixe)
    else:
        h1 = ui["h1_province"].format(nom=nom_province, prefixe="")

    if langue == "fr":
        intro_html = config["intro_html"]
        nominatim_query = config["nominatim_query"]
    else:
        trad = config["translations"][langue]
        intro_html = trad["intro_html"]
        nominatim_query = trad.get("nominatim_query", config["nominatim_query"])

    intro_html = intro_html.replace("{{STAT_TERRAINS}}", str(total_terrains))
    intro_html = intro_html.replace("{{STAT_COMMUNES}}", str(nb_communes))

    remplacements = {
        "{{LANG_CODE}}": langue,
        "{{H1}}": h1,
        "{{BANNER_IMAGE}}": config["banner_image"],
        "{{REGION_NAME}}": nom_region,
        "{{PROVINCE_NAME}}": nom_province,
        "{{BANNER_CREDIT_HTML}}": config["banner_credit_html"],
        "{{INTRO_HTML}}": intro_html,
        "{{STAT_TERRAINS}}": str(total_terrains),
        "{{STAT_COMMUNES}}": str(nb_communes),
        "{{DENSITY_TILE_BLOCK}}": construire_bloc_densite(densite, ui["terrains_100km2"]),
        "{{PROVINCE_NOMINATIM_QUERY}}": nominatim_query,
        "{{STATS_GEO_KEY}}": config["stats_geo_province"] or config["stats_geo_region"],
        "{{SLUG}}": config["slug"],
        "{{HOME_URL}}": url_racine_langue(langue),
        "{{CANONICAL_URL}}": f'https://mapetanque.github.io{url_page(config["slug"], langue)}',
        "{{HREFLANG_LINKS}}": construire_hreflang_links(config["slug"], langues_disponibles),
        "{{URL_FR}}": url_page(config["slug"], "fr") if "fr" in langues_disponibles else url_racine_langue("fr"),
        "{{URL_NL}}": url_page(config["slug"], "nl") if "nl" in langues_disponibles else url_racine_langue("nl"),
        "{{URL_DE}}": url_page(config["slug"], "de") if "de" in langues_disponibles else url_racine_langue("de"),
        "{{UI_ACCUEIL}}": ui["accueil"],
        "{{UI_TERRAINS_RECENSES}}": ui["terrains_recenses"],
        "{{UI_COMMUNES_COUVERTES}}": ui["communes_couvertes"],
        "{{UI_CARTE_DES_TERRAINS}}": ui["carte_des_terrains"],
        "{{UI_COMMUNES_DE_LA_PROVINCE}}": ui["communes_de_la_province"],
        "{{UI_RECHERCHER_UNE_COMMUNE}}": ui["rechercher_une_commune"],
        "{{UI_AUCUNE_COMMUNE}}": ui["aucune_commune"],
        "{{UI_TERRAIN_SINGULIER}}": ui["terrain_singulier"],
        "{{UI_TERRAIN_PLURIEL}}": ui["terrain_pluriel"],
        "{{UI_META_DESCRIPTION}}": ui["meta_description"].format(nom=nom_province),
        "{{OTHER_PROVINCES_BLOCK}}": other_provinces_block,
    }

    page = template
    for jeton, valeur in remplacements.items():
        page = page.replace(jeton, valeur)

    jetons_restants = re.findall(r"\{\{[A-Z_]+\}\}", page)
    if jetons_restants:
        print(f"  [attention] {cle}/{langue}: jetons non remplacés -> {set(jetons_restants)}")

    chemin_sortie = OUTPUT_DIR / url_page(config["slug"], langue).lstrip("/")
    chemin_sortie.parent.mkdir(parents=True, exist_ok=True)
    chemin_sortie.write_text(page, encoding="utf-8")

    if config["slug"] not in communes_deja_ecrites:
        communes_path = OUTPUT_DIR / "data" / f"communes-{config['slug']}.json"
        communes_path.write_text(
            json.dumps(communes, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        communes_deja_ecrites.add(config["slug"])

    extra = f", {densite}/100km²" if densite else ""
    print(f"  [généré]  {cle}/{langue} -> {chemin_sortie.relative_to(OUTPUT_DIR)} "
          f"({total_terrains} terrains, {nb_communes} communes{extra})")


def construire_bloc_sitemap_url(url_absolue, langues_disponibles, url_par_langue):
    """Un <url> de sitemap avec ses <xhtml:link> alternate pour les langues réellement
    disponibles pour cette page (jamais de lien vers une page qui n'existe pas)."""
    lignes = [
        "    <url>",
        f"        <loc>{url_absolue}</loc>",
        "        <changefreq>weekly</changefreq>",
        "        <priority>0.7</priority>",
    ]
    for langue in langues_disponibles:
        lignes.append(
            f'        <xhtml:link rel="alternate" hreflang="{langue}" href="{url_par_langue[langue]}" />'
        )
    if langues_disponibles:
        lignes.append(
            f'        <xhtml:link rel="alternate" hreflang="x-default" href="{url_par_langue["fr"]}" />'
        )
    lignes.append("    </url>")
    return "\n".join(lignes)


def mettre_a_jour_sitemap(provinces_generees):
    """provinces_generees : liste de (slug, langues_disponibles). Remplace uniquement la
    section entre les marqueurs DEBUT/FIN PAGES PROVINCES, laisse tout le reste du fichier
    (page d'accueil FR/NL/DE, etc.) strictement intact."""
    if not SITEMAP_PATH.exists():
        print("  [attention] sitemap.xml introuvable, section provinces non mise à jour.")
        return

    contenu = SITEMAP_PATH.read_text(encoding="utf-8")
    debut = contenu.find(MARQUEUR_DEBUT)
    fin = contenu.find(MARQUEUR_FIN)
    if debut == -1 or fin == -1:
        print("  [attention] Marqueurs PAGES PROVINCES introuvables dans sitemap.xml, "
              "section provinces non mise à jour.")
        return
    fin_marqueur_debut = contenu.find("-->", debut) + len("-->")

    blocs = []
    for slug, langues_disponibles in provinces_generees:
        url_par_langue = {l: f"https://mapetanque.github.io{url_page(slug, l)}" for l in langues_disponibles}
        blocs.append(construire_bloc_sitemap_url(url_par_langue["fr"], langues_disponibles, url_par_langue))

    nouvelle_section = "\n" + "\n".join(blocs) + "\n"
    nouveau_contenu = contenu[:fin_marqueur_debut] + nouvelle_section + contenu[fin:]
    SITEMAP_PATH.write_text(nouveau_contenu, encoding="utf-8")
    print(f"\nsitemap.xml mis à jour ({len(blocs)} page(s) province).")


def main():
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    provinces = charger_json(PROVINCES_PATH)
    stats_geo = charger_json(STATS_GEO_PATH)
    geo_names = charger_json(GEO_NAMES_PATH)
    ui_strings = charger_json(UI_STRINGS_PATH)

    print("Génération des pages provinces (FR + NL + DE)...\n")

    communes_deja_ecrites = set()
    generees, ignorees = 0, 0
    provinces_generees = []  # [(slug, [langues_disponibles]), ...] pour le sitemap

    for cle, config in provinces.items():
        if cle.startswith("_"):
            continue

        langues_disponibles = []
        for langue in LANGUES:
            if langue == "fr":
                pret = config.get("intro_html") is not None
            else:
                pret = config.get("translations", {}).get(langue, {}).get("intro_html") is not None
            if pret and config.get("banner_image") is not None:
                langues_disponibles.append(langue)

        if "fr" not in langues_disponibles:
            print(f"  [ignoré]  {cle}: pas encore de contenu français complet")
            ignorees += 1
            continue

        for langue in langues_disponibles:
            bloc_autres_provinces = construire_bloc_autres_provinces(
                cle, provinces, langue, geo_names, ui_strings
            )
            generer_page(cle, config, langue, langues_disponibles, bloc_autres_provinces,
                         template, stats_geo, geo_names, ui_strings, communes_deja_ecrites)
            generees += 1

        langues_manquantes = [l for l in LANGUES if l not in langues_disponibles]
        if langues_manquantes:
            print(f"            (pas encore traduit en : {', '.join(langues_manquantes)})")

        provinces_generees.append((config["slug"], langues_disponibles))

    print(f"\n{generees} page(s) générée(s), {ignorees} province(s) ignorée(s) (français incomplet).")

    mettre_a_jour_sitemap(provinces_generees)


if __name__ == "__main__":
        main()