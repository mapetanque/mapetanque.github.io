#!/usr/bin/env python3
"""
Générateur des pages provinces de Mapetanque (FR + NL + DE + EN).

Lit :
  - templates/province_template.html   (template avec jetons {{...}})
  - data/provinces.json                (contenu propre à chaque province, avec traductions
                                         optionnelles sous province["translations"]["nl"/"de"/"en"])
  - data/stats_geo.json                (mêmes données que le site : terrains/communes)
  - translations.js                    (SOURCE UNIQUE des noms de provinces/régions et des
                                         textes d'interface des pages province — mêmes clés
                                         que celles utilisées par le reste du site, lues
                                         directement ici plutôt que dupliquées dans un fichier
                                         séparé, pour n'avoir qu'un seul endroit à maintenir)

Écrit, pour chaque province ET chaque langue dont les champs sont complets :
  - province-<slug>.html               (français, à la racine)
  - nl/province-<slug>.html            (néerlandais, si traduction dispo)
  - de/province-<slug>.html            (allemand, si traduction dispo)
  - en/province-<slug>.html            (anglais, si traduction dispo)
  - data/communes-<slug>.json          (partagé entre les 4 langues, écrit une seule fois)

Une langue "pas encore prête" pour une province (pas d'entrée dans translations.nl/de/en) est
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
REGION_TEMPLATE_PATH = BASE_DIR / "templates" / "region_template.html"
PROVINCES_PATH = BASE_DIR / "data" / "provinces.json"
REGIONS_PATH = BASE_DIR / "data" / "regions.json"
STATS_GEO_PATH = BASE_DIR / "data" / "stats_geo.json"
TRANSLATIONS_JS_PATH = BASE_DIR / "translations.js"
OUTPUT_DIR = BASE_DIR  # écrit directement à la racine du repo, comme index.html

SITEMAP_PATH = BASE_DIR / "sitemap.xml"
MARQUEUR_DEBUT = "<!-- DEBUT PAGES PROVINCES"
MARQUEUR_FIN = "<!-- FIN PAGES PROVINCES -->"

LANGUES = ["fr", "nl", "de", "en"]

# Fichiers produits, écrits tous ensemble à la fin de main() : si une page échoue (ex. une
# commune citée dans une intro a disparu des données), aucune n'est modifiée.
FICHIERS_A_ECRIRE = []  # [(chemin, contenu), ...]


def charger_traductions_js(path):
    """Extrait les paires clé/valeur (chaînes simples uniquement) de chaque bloc de langue
    fr:{...}/nl:{...}/de:{...}/en:{...} de translations.js, par une lecture directe du fichier plutôt
    que de dupliquer son contenu dans un fichier séparé à maintenir en parallèle.

    Volontairement limité aux valeurs "chaîne de caractères" (ignore silencieusement les clés
    dont la valeur est une fonction, ex. stats_count, non utilisées par ce générateur) : une
    extraction ciblée par regex est plus robuste face à une simple modification de formatage
    du fichier qu'un parseur JS générique complet, qui serait hors de portée ici sans
    dépendance supplémentaire (Node.js n'est pas requis pour lancer ce script)."""
    contenu = path.read_text(encoding="utf-8")
    resultat = {}
    for bloc in re.finditer(r"\n {4}(\w+): \{(.*?)\n {4}\},?\n", contenu, re.DOTALL):
        langue, corps = bloc.group(1), bloc.group(2)
        if langue not in LANGUES:
            continue
        entrees = {}
        for paire in re.finditer(r'(\w+):\s*"((?:[^"\\]|\\.)*)"', corps):
            cle, valeur = paire.group(1), paire.group(2)
            valeur = valeur.replace('\\"', '"').replace("\\n", "\n")
            entrees[cle] = valeur
        resultat[langue] = entrees
    return resultat


def charger_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def recuperer_communes(stats_geo, region_key, province_key):
    region = stats_geo[region_key]
    if province_key is None:
        return region["communes"], region["total"]
    province = region["provinces"][province_key]
    return province["communes"], province["total"]


def calculer_densite(total_terrains, area_km2, langue="fr"):
    """Densité à une décimale : virgule en français, néerlandais et allemand, point en anglais."""
    if not area_km2:
        return None
    valeur = total_terrains / (area_km2 / 100)
    texte = f"{valeur:.1f}"
    return texte if langue == "en" else texte.replace(".", ",")


def remplacer_nombres(texte, comptages, contexte):
    """Remplace chaque {{NB:clé}} d'un texte d'introduction par le nombre de terrains
    correspondant dans les données du jour : une commune de la province (pages province, ex.
    {{NB:Gent}}, nom tel qu'il figure dans stats_geo.json) ou une province de la région (pages
    région, ex. {{NB:liege}}). Écrits en dur, ces chiffres vieillissaient d'une semaine à
    l'autre et finissaient par contredire la liste des communes affichée juste en dessous."""
    def nombre(m):
        cle = m.group(1)
        if cle not in comptages:
            raise ValueError(f"{contexte} : {{{{NB:{cle}}}}} introuvable dans data/stats_geo.json")
        valeur = comptages[cle]
        return str(valeur["total"] if isinstance(valeur, dict) else valeur)
    return re.sub(r"\{\{NB:([^}]+)\}\}", nombre, texte)


def chaine_js(texte):
    """Texte inséré entre apostrophes dans un script de la page."""
    return texte.replace("\\", "\\\\").replace("'", "\\'")


def credit_banniere(credit_html, langue):
    """Typographie anglaise : pas d'espace avant le deux-points (« Photo: … »)."""
    return credit_html.replace("Photo : ", "Photo: ") if langue == "en" else credit_html


def construire_bloc_beaux_terrains(config, tr):
    """Section "Les plus beaux terrains" pour les pages province.

    Rendue uniquement pour Bruxelles : cette page tient lieu de page région (il n'existe pas de
    region-bruxelles.html, Bruxelles n'ayant pas de sous-provinces), et le carrousel n'est voulu
    que sur l'accueil et les pages région. Les autres provinces reçoivent une chaîne vide, leur
    page reste donc strictement inchangée."""
    if config["region_key"] != "bruxelles":
        return ""
    return (
        '\n'
        '    <!-- Section "Les plus beaux terrains" : cette page province tient lieu de page région\n'
        '         pour Bruxelles. Remplie par /beaux-terrains.js à partir de /data/beaux_terrains.json,\n'
        '         restreinte à la région via data-region. Se masque d\'elle-même si aucun terrain n\'y\n'
        '         est sélectionné. -->\n'
        '    <section id="beaux-terrains" class="beaux-terrains-region" data-region="bruxelles">\n'
        f'        <h2>{tr["beaux_terrains_titre_court"]}</h2>\n'
        '\n'
        '        <div class="beaux-terrains-carrousel">\n'
        '            <div class="beaux-terrains-scroller"></div>\n'
        '        </div>\n'
        '    </section>\n'
    )


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


def url_page_region(slug, langue):
    prefixe = "" if langue == "fr" else f"{langue}/"
    return f"/{prefixe}region-{slug}.html"


def regions_pretes(regions, langue):
    """Sous-ensemble de régions qui ont du contenu complet pour cette langue (même logique
    que provinces_pretes)."""
    pretes = {}
    for cle, config in regions.items():
        if cle.startswith("_"):
            continue
        if langue == "fr":
            intro = config.get("intro_html")
        else:
            intro = config.get("translations", {}).get(langue, {}).get("intro_html")
        if intro is not None and config.get("banner_image") is not None:
            pretes[cle] = config
    return pretes


def recuperer_stats_region(stats_geo, region_key):
    """Total terrains, nombre de provinces, nombre de communes (somme sur les provinces) pour
    une région. Bruxelles n'a pas de page région dédiée (pas de sous-provinces), cette fonction
    n'est donc appelée que pour flandre/wallonie."""
    region = stats_geo[region_key]
    provinces = region["provinces"]
    nb_provinces = len(provinces)
    nb_communes = sum(len(p["communes"]) for p in provinces.values())
    return region["total"], nb_provinces, nb_communes


def html_tuile(url, image, nom, total, tr):
    """Une tuile photo (province ou région) avec son nombre de terrains."""
    if not (BASE_DIR / "images" / "provinces" / image).exists():
        raise FileNotFoundError(f"images/provinces/{image} introuvable (tuile de {nom})")
    unite = tr["province_terrain_singulier"] if total == 1 else tr["stats_terrains_unit"]
    return (
        f'            <a href="{url}" class="tuile-province" '
        f"style=\"background-image: url('/images/provinces/{image}');\">\n"
        f'                <span class="tuile-province-nom">{nom}</span>\n'
        f'                <span class="tuile-province-nombre">{total} {unite}</span>\n'
        '            </a>'
    )


def construire_tuiles_provinces_region(region_key, provinces, stats_geo, langue, traductions,
                                       exclure=None):
    """Tuiles photo vers chaque province de la région (mêmes images que « Parcourir par
    province » sur l'accueil), avec leur nombre de terrains, triées par nombre de terrains
    décroissant — seulement les provinces déjà prêtes dans cette langue, sauf `exclure` (la
    province de la page, pour son rebond)."""
    tr = traductions[langue]
    pretes = provinces_pretes(provinces, langue)
    entrees = [(cle, cfg) for cle, cfg in pretes.items()
               if cfg["region_key"] == region_key and cle != exclure]

    def total_terrains(cle):
        return stats_geo[region_key]["provinces"][cle]["total"]

    entrees.sort(key=lambda t: -total_terrains(t[0]))

    return [
        html_tuile(url_page(cfg["slug"], langue), f"tuile-{cfg['slug']}.webp",
                   nom_traduit_province(cle, langue, traductions), total_terrains(cle), tr)
        for cle, cfg in entrees
    ]


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


def nom_traduit_province(cle, langue, traductions):
    """Nom traduit d'une entrée province.json. Cas particulier de Bruxelles : ce n'est pas une
    province, translations.js n'a donc pas de clé geo_province_bruxelles, seulement
    geo_region_bruxelles."""
    if cle == "bruxelles":
        return traductions[langue]["geo_region_bruxelles"]
    return traductions[langue][f"geo_province_{cle}"]


def construire_bloc_rebond(cle_courante, config, provinces, regions, stats_geo, langue,
                           traductions):
    """Rebond en bas de page province, en tuiles photo comme « Provinces de … » sur les pages
    région. Une province : la tuile de sa région en tête (pleine largeur sur mobile), puis les
    autres provinces de la région. Bruxelles, sans province voisine : les deux régions. Chaîne
    vide si aucune tuile n'est prête dans cette langue."""
    tr = traductions[langue]
    regions_par_cle = {cfg["region_key"]: cfg for cfg in regions_pretes(regions, langue).values()}

    def tuile_region(region_key):
        cfg = regions_par_cle[region_key]
        return html_tuile(url_page_region(cfg["slug"], langue), f"tuile-{cfg['slug']}.webp",
                          tr[f"geo_region_{region_key}"], stats_geo[region_key]["total"], tr)

    if config["region_key"] == "bruxelles":
        titre = tr["province_ailleurs_belgique"]
        cles = sorted(regions_par_cle, key=lambda r: -stats_geo[r]["total"])
        tuiles = [tuile_region(r) for r in cles]
    else:
        region_key = config["region_key"]
        titre = tr["province_ailleurs_region"].format(nom=tr[f"geo_region_{region_key}"])
        tuiles = [tuile_region(region_key)] if region_key in regions_par_cle else []
        tuiles += construire_tuiles_provinces_region(
            region_key, provinces, stats_geo, langue, traductions, exclure=cle_courante
        )

    if not tuiles:
        return ""
    # Deux tuiles seulement (Bruxelles) : grille à deux colonnes, tuiles moins hautes
    classe = "tuiles-provinces tuiles-deux" if len(tuiles) == 2 else "tuiles-provinces"
    return (
        '    <div class="other-provinces-section">\n'
        f'        <h2>{titre}</h2>\n'
        f'        <div class="{classe}">\n'
        + "\n".join(tuiles) + "\n"
        '        </div>\n'
        '    </div>'
    )


def construire_hreflang_links(slug, langues_disponibles, fonction_url=url_page):
    lignes = []
    for langue in langues_disponibles:
        lignes.append(f'    <link rel="alternate" hreflang="{langue}" href="https://mapetanque.be{fonction_url(slug, langue)}">')
    if langues_disponibles:
        lignes.append(f'    <link rel="alternate" hreflang="x-default" href="https://mapetanque.be{fonction_url(slug, "fr")}">')
    return "\n".join(lignes)


def generer_page(cle, config, langue, langues_disponibles, other_provinces_block, template,
                  stats_geo, traductions, communes_deja_ecrites):
    tr = traductions[langue]

    communes, total_terrains = recuperer_communes(
        stats_geo, config["stats_geo_region"], config["stats_geo_province"]
    )
    nb_communes = len(communes)
    densite = calculer_densite(total_terrains, config.get("area_km2"), langue)

    nom_province = nom_traduit_province(cle, langue, traductions)
    nom_region = tr[f"geo_region_{config['region_key']}"]

    if config["region_key"] == "bruxelles":
        h1 = tr["province_h1_bruxelles_template"].format(nom=nom_province)
    elif langue == "fr":
        voyelle_ou_h = nom_province[0].lower() in "aeiouh"
        prefixe = "d'" if voyelle_ou_h else "de "
        h1 = tr["province_h1_template"].format(nom=nom_province, prefixe=prefixe)
    else:
        h1 = tr["province_h1_template"].format(nom=nom_province, prefixe="")

    if langue == "fr":
        intro_html = config["intro_html"]
        nominatim_query = config["nominatim_query"]
    else:
        trad = config["translations"][langue]
        intro_html = trad["intro_html"]
        nominatim_query = trad.get("nominatim_query", config["nominatim_query"])

    intro_html = intro_html.replace("{{STAT_TERRAINS}}", str(total_terrains))
    intro_html = intro_html.replace("{{STAT_COMMUNES}}", str(nb_communes))
    intro_html = remplacer_nombres(intro_html, communes, f"{cle}/{langue}")

    # Bruxelles n'a pas de page région dédiée (pas de sous-provinces) : sa tuile région sur la
    # page d'accueil renvoie directement vers cette page province. Le fil d'Ariane fait pareil
    # plutôt que de pointer vers une page inexistante.
    if config["region_key"] == "bruxelles":
        region_url = url_page(cle, langue)
    else:
        region_url = url_page_region(config["region_key"], langue)

    remplacements = {
        "{{LANG_CODE}}": langue,
        "{{H1}}": h1,
        "{{BANNER_IMAGE}}": config["banner_image"],
        "{{REGION_NAME}}": nom_region,
        "{{REGION_URL}}": region_url,
        "{{PROVINCE_NAME}}": nom_province,
        "{{BANNER_CREDIT_HTML}}": credit_banniere(config["banner_credit_html"], langue),
        "{{INTRO_HTML}}": intro_html,
        "{{STAT_TERRAINS}}": str(total_terrains),
        "{{STAT_COMMUNES}}": str(nb_communes),
        "{{DENSITY_TILE_BLOCK}}": construire_bloc_densite(densite, tr["province_terrains_100km2"]),
        "{{BEAUX_TERRAINS_SECTION}}": construire_bloc_beaux_terrains(config, tr),
        "{{PROVINCE_NOMINATIM_QUERY}}": nominatim_query,
        "{{STATS_GEO_KEY}}": config["stats_geo_province"] or config["stats_geo_region"],
        "{{SLUG}}": config["slug"],
        "{{HOME_URL}}": url_racine_langue(langue),
        "{{COMMENT_JOUER_URL}}": url_racine_langue(langue) + "comment-jouer.html",
        "{{COMPTEUR_URL}}": url_racine_langue(langue) + "compteur.html",
        "{{CANONICAL_URL}}": f'https://mapetanque.be{url_page(config["slug"], langue)}',
        "{{HREFLANG_LINKS}}": construire_hreflang_links(config["slug"], langues_disponibles),
        "{{URL_FR}}": url_page(config["slug"], "fr") if "fr" in langues_disponibles else url_racine_langue("fr"),
        "{{URL_NL}}": url_page(config["slug"], "nl") if "nl" in langues_disponibles else url_racine_langue("nl"),
        "{{URL_DE}}": url_page(config["slug"], "de") if "de" in langues_disponibles else url_racine_langue("de"),
        "{{URL_EN}}": url_page(config["slug"], "en") if "en" in langues_disponibles else url_racine_langue("en"),
        "{{UI_ACCUEIL}}": tr["province_accueil_breadcrumb"],
        "{{UI_TERRAINS_RECENSES}}": tr["province_terrains_recenses"],
        "{{UI_COMMUNES_COUVERTES}}": tr["province_communes_couvertes"],
        "{{UI_COMMUNES_DE_LA_PROVINCE}}": (
            tr["province_communes_de_la_region_bruxelles"]
            if config["region_key"] == "bruxelles"
            else tr["province_communes_de_la_province"]
        ),
        "{{UI_RECHERCHER_UNE_COMMUNE}}": tr["stats_search_commune_placeholder"],
        "{{UI_AUCUNE_COMMUNE}}": tr["stats_no_results"],
        "{{UI_TERRAIN_SINGULIER}}": tr["province_terrain_singulier"],
        "{{UI_TERRAIN_PLURIEL}}": tr["stats_terrains_unit"],
        "{{UI_CLUB_SINGULIER}}": tr["province_club_singulier"],
        "{{UI_CLUB_PLURIEL}}": tr["province_clubs_pluriel"],
        "{{UI_META_DESCRIPTION}}": tr["province_meta_description"].format(nom=nom_province),
        "{{OTHER_PROVINCES_BLOCK}}": other_provinces_block,
        "{{UI_VOIR_TOUTES_COMMUNES}}": tr["province_voir_toutes_communes"],
        "{{UI_REDUIRE_COMMUNES}}": tr["province_reduire_communes"],
        "{{UI_RECHERCHER}}": tr["signalement_search_btn"],
        "{{UI_FERMER}}": tr["close_panel"],
        # Bruxelles n'est pas une province : message des pages région
        "{{UI_AUCUN_TERRAIN}}": chaine_js(
            tr["carte_aucun_terrain_region"] if config["region_key"] == "bruxelles"
            else tr["carte_aucun_terrain_province"]
        ),
        "{{UI_ERREUR_CHARGEMENT}}": chaine_js(tr["carte_erreur_chargement"]),
    }

    page = template
    for jeton, valeur in remplacements.items():
        page = page.replace(jeton, valeur)

    jetons_restants = re.findall(r"\{\{[A-Z_]+\}\}", page)
    if jetons_restants:
        print(f"  [attention] {cle}/{langue}: jetons non remplacés -> {set(jetons_restants)}")

    chemin_sortie = OUTPUT_DIR / url_page(config["slug"], langue).lstrip("/")
    FICHIERS_A_ECRIRE.append((chemin_sortie, page))

    if config["slug"] not in communes_deja_ecrites:
        communes_path = OUTPUT_DIR / "data" / f"communes-{config['slug']}.json"
        FICHIERS_A_ECRIRE.append((communes_path, json.dumps(communes, ensure_ascii=False, indent=2)))
        communes_deja_ecrites.add(config["slug"])

    extra = f", {densite}/100km²" if densite else ""
    print(f"  [généré]  {cle}/{langue} -> {chemin_sortie.relative_to(OUTPUT_DIR)} "
          f"({total_terrains} terrains, {nb_communes} communes{extra})")


def generer_page_region(cle, config, langue, langues_disponibles, template, stats_geo,
                         provinces, traductions):
    tr = traductions[langue]

    total_terrains, nb_provinces, nb_communes = recuperer_stats_region(stats_geo, config["region_key"])
    nom_region = tr[f"geo_region_{config['region_key']}"]

    h1 = tr["region_h1_template"].format(nom=nom_region)

    if langue == "fr":
        intro_html = config["intro_html"]
    else:
        intro_html = config["translations"][langue]["intro_html"]

    intro_html = intro_html.replace("{{STAT_TERRAINS}}", str(total_terrains))
    intro_html = intro_html.replace("{{STAT_PROVINCES}}", str(nb_provinces))
    intro_html = intro_html.replace("{{STAT_COMMUNES}}", str(nb_communes))
    intro_html = remplacer_nombres(intro_html, stats_geo[config["region_key"]]["provinces"], f"{cle}/{langue}")

    densite = calculer_densite(total_terrains, config.get("area_km2"), langue)
    if densite is None:
        raise ValueError(f"{cle} : area_km2 manquant dans data/regions.json")

    tuiles_provinces = "\n".join(construire_tuiles_provinces_region(
        config["region_key"], provinces, stats_geo, langue, traductions
    ))

    remplacements = {
        "{{LANG_CODE}}": langue,
        "{{H1}}": h1,
        "{{BANNER_IMAGE}}": config["banner_image"],
        "{{REGION_NAME}}": nom_region,
        "{{BANNER_CREDIT_HTML}}": credit_banniere(config["banner_credit_html"], langue),
        "{{INTRO_HTML}}": intro_html,
        "{{STAT_TERRAINS}}": str(total_terrains),
        "{{STAT_COMMUNES}}": str(nb_communes),
        "{{STAT_DENSITE}}": densite,
        "{{STATS_GEO_KEY}}": config["region_key"],
        "{{SLUG}}": config["slug"],
        "{{HOME_URL}}": url_racine_langue(langue),
        "{{COMMENT_JOUER_URL}}": url_racine_langue(langue) + "comment-jouer.html",
        "{{COMPTEUR_URL}}": url_racine_langue(langue) + "compteur.html",
        "{{CANONICAL_URL}}": f'https://mapetanque.be{url_page_region(config["slug"], langue)}',
        "{{HREFLANG_LINKS}}": construire_hreflang_links(config["slug"], langues_disponibles, url_page_region),
        "{{URL_FR}}": url_page_region(config["slug"], "fr") if "fr" in langues_disponibles else url_racine_langue("fr"),
        "{{URL_NL}}": url_page_region(config["slug"], "nl") if "nl" in langues_disponibles else url_racine_langue("nl"),
        "{{URL_DE}}": url_page_region(config["slug"], "de") if "de" in langues_disponibles else url_racine_langue("de"),
        "{{URL_EN}}": url_page_region(config["slug"], "en") if "en" in langues_disponibles else url_racine_langue("en"),
        "{{UI_ACCUEIL}}": tr["province_accueil_breadcrumb"],
        "{{UI_TERRAINS_RECENSES}}": tr["province_terrains_recenses"],
        "{{UI_COMMUNES_COUVERTES}}": tr["province_communes_couvertes"],
        "{{UI_TERRAINS_100KM2}}": tr["province_terrains_100km2"],
        "{{UI_PROVINCES_DE_LA_REGION}}": tr["region_provinces_de_la_region"].format(nom=nom_region),
        "{{UI_BEAUX_TERRAINS}}": tr["beaux_terrains_titre_court"],
        "{{UI_META_DESCRIPTION}}": tr["region_meta_description"].format(nom=nom_region),
        "{{PROVINCES_TUILES}}": tuiles_provinces,
        "{{UI_RECHERCHER}}": tr["signalement_search_btn"],
        "{{UI_FERMER}}": tr["close_panel"],
        "{{UI_AUCUN_TERRAIN}}": chaine_js(tr["carte_aucun_terrain_region"]),
        "{{UI_ERREUR_CHARGEMENT}}": chaine_js(tr["carte_erreur_chargement"]),
    }

    page = template
    for jeton, valeur in remplacements.items():
        page = page.replace(jeton, valeur)

    jetons_restants = re.findall(r"\{\{[A-Z_]+\}\}", page)
    if jetons_restants:
        print(f"  [attention] {cle}/{langue}: jetons non remplacés -> {set(jetons_restants)}")

    chemin_sortie = OUTPUT_DIR / url_page_region(config["slug"], langue).lstrip("/")
    FICHIERS_A_ECRIRE.append((chemin_sortie, page))

    print(f"  [généré]  {cle}/{langue} -> {chemin_sortie.relative_to(OUTPUT_DIR)} "
          f"({total_terrains} terrains, {nb_provinces} provinces, {nb_communes} communes, {densite}/100km²)")


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


def mettre_a_jour_sitemap(pages_generees):
    """pages_generees : liste de (slug, langues_disponibles, fonction_url). Remplace uniquement
    la section entre les marqueurs DEBUT/FIN PAGES PROVINCES, laisse tout le reste du fichier
    (page d'accueil FR/NL/DE/EN, etc.) strictement intact. Contient aussi bien les pages province
    que les pages région, malgré le nom des marqueurs conservé tel quel pour ne pas avoir à
    retoucher sitemap.xml une nouvelle fois."""
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
    for slug, langues_disponibles, fonction_url in pages_generees:
        url_par_langue = {l: f"https://mapetanque.be{fonction_url(slug, l)}" for l in langues_disponibles}
        blocs.append(construire_bloc_sitemap_url(url_par_langue["fr"], langues_disponibles, url_par_langue))

    nouvelle_section = "\n" + "\n".join(blocs) + "\n"
    nouveau_contenu = contenu[:fin_marqueur_debut] + nouvelle_section + contenu[fin:]
    SITEMAP_PATH.write_text(nouveau_contenu, encoding="utf-8")
    print(f"\nsitemap.xml mis à jour ({len(blocs)} page(s) province/région).")


def main():
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    region_template = REGION_TEMPLATE_PATH.read_text(encoding="utf-8")
    provinces = charger_json(PROVINCES_PATH)
    regions = charger_json(REGIONS_PATH)
    stats_geo = charger_json(STATS_GEO_PATH)
    traductions = charger_traductions_js(TRANSLATIONS_JS_PATH)

    print("Génération des pages provinces (FR + NL + DE + EN)...\n")

    communes_deja_ecrites = set()
    generees, ignorees = 0, 0
    pages_generees = []  # [(slug, [langues_disponibles], fonction_url), ...] pour le sitemap

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
            bloc_rebond = construire_bloc_rebond(
                cle, config, provinces, regions, stats_geo, langue, traductions
            )
            generer_page(cle, config, langue, langues_disponibles, bloc_rebond,
                         template, stats_geo, traductions, communes_deja_ecrites)
            generees += 1

        langues_manquantes = [l for l in LANGUES if l not in langues_disponibles]
        if langues_manquantes:
            print(f"            (pas encore traduit en : {', '.join(langues_manquantes)})")

        pages_generees.append((config["slug"], langues_disponibles, url_page))

    print(f"\n{generees} page(s) province générée(s), {ignorees} ignorée(s) (français incomplet).")

    print("\nGénération des pages régions (FR + NL + DE + EN)...\n")
    generees_regions, ignorees_regions = 0, 0

    for cle, config in regions.items():
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
            ignorees_regions += 1
            continue

        for langue in langues_disponibles:
            generer_page_region(cle, config, langue, langues_disponibles, region_template,
                                 stats_geo, provinces, traductions)
            generees_regions += 1

        langues_manquantes = [l for l in LANGUES if l not in langues_disponibles]
        if langues_manquantes:
            print(f"            (pas encore traduit en : {', '.join(langues_manquantes)})")

        pages_generees.append((config["slug"], langues_disponibles, url_page_region))

    print(f"\n{generees_regions} page(s) région générée(s), {ignorees_regions} ignorée(s) (français incomplet).")

    for chemin, contenu in FICHIERS_A_ECRIRE:
        chemin.parent.mkdir(parents=True, exist_ok=True)
        chemin.write_text(contenu, encoding="utf-8")

    mettre_a_jour_sitemap(pages_generees)


if __name__ == "__main__":
    main()