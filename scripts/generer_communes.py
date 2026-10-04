#!/usr/bin/env python3
"""
Pages commune : commune/<slug>.html (FR) et nl/, de/, en/commune/<slug>.html.

Une page par commune officielle (voir communes_officielles.py) ayant au moins MIN_LIEUX lieux.
Pas de carte sur la page : un clic sur un terrain ouvre sa fiche complète sur place
(/commune.js) ; sans JavaScript, le lien mène à la carte de l'accueil (?lat=…&lon=…).

Contenu, tiré des données du jour :
  - intro : nombre de terrains et de lieux, atouts les plus fréquents, clubs ;
  - une carte par lieu : un lieu, ce sont les pistes voisines réunies comme sur la carte
    (data/groupes_terrains.json), si bien que chaque carte correspond à une fiche, avec ses
    notes et avis ; regroupés par localité (le champ « commune » de Nominatim) quand la
    commune en compte plusieurs ;
  - pastilles des critères : calculées par criteres.js lui-même (via Node.js), pour que les
    seuils ne soient écrits qu'à un endroit ; sans Node, les cartes n'ont pas de pastilles ;
  - clubs de la commune, communes voisines ayant des terrains, tuiles province et région.

La page est construite sur le squelette de comment-jouer.html (voir _squelette.py), avec la
bannière de la province. Une page dont la commune n'a plus assez de lieux est supprimée.
À la fin, generer_referencement.py met à jour sitemap.xml, llms.txt et les données structurées.

Écrit aussi data/communes_liens.json : la commune officielle de chaque terrain et de chaque club,
avec son nom dans les quatre langues et l'existence de sa page. Les fiches (script.js) en tirent
le fil d'Ariane et le lien « Voir les N terrains de … ».

Et data/recherche.json, l'index des propositions de la barre de recherche (voir « Propositions
de la recherche » dans script.js) : les 565 communes, les localités et les lieux.

Relancé par le workflow hebdomadaire (update-osm.yml), après les critères d'environnement.

Usage :
    python scripts/generer_communes.py
"""

import collections
import html
import json
import os
import subprocess
from pathlib import Path

import generate_provinces as gp
import generer_referencement
from _squelette import construire_page, echap
from communes_officielles import MIN_LIEUX, Communes, distance_m, regrouper_lieux, slug

RACINE = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = RACINE / "data"

NB_VOISINES = 6

LANGUES = [("fr", ""), ("nl", "nl/"), ("de", "de/"), ("en", "en/")]

# Atouts cités dans l'intro, par ordre de priorité ; les trois premiers présents sont retenus.
ATOUTS_INTRO = ["arret", "parking", "eau", "eclaire", "calme", "jeux"]


def charger(nom):
    with open(DATA / nom, encoding="utf-8") as f:
        return json.load(f)


# ----------------------------------------------------------------------------------------
# Critères : criteres.js exécuté par Node.js, seul endroit où les seuils sont écrits
# ----------------------------------------------------------------------------------------

CODE_NODE = r"""
const fs = require('fs');
const regles = new Function(fs.readFileSync(process.argv[1], 'utf8')
    + '\nreturn { criteresOsmSurPlace, criteresOsmProximite, estAbriteOsm, CRITERES_PROXIMITE };')();
const terrains = JSON.parse(fs.readFileSync(0, 'utf8'));
const resultat = { ordreProximite: regles.CRITERES_PROXIMITE.map(function (c) { return c.cle; }), terrains: {} };
Object.keys(terrains).forEach(function (id) {
    const p = terrains[id];
    const surPlace = regles.criteresOsmSurPlace(p);
    if (regles.estAbriteOsm(p)) surPlace.push('abri_pluie');
    resultat.terrains[id] = { surPlace: surPlace, proximite: regles.criteresOsmProximite(p) };
});
process.stdout.write(JSON.stringify(resultat));
"""


def calculer_criteres(proprietes):
    """{osm_id: {surPlace: [...], proximite: [{cle, distance}]}} et l'ordre des critères de
    proximité. Sans Node.js : rien (cartes sans pastilles), avec un avertissement."""
    try:
        sortie = subprocess.run(
            ["node", "-e", CODE_NODE, str(RACINE / "criteres.js")],
            input=json.dumps(proprietes), capture_output=True, text=True, encoding="utf-8",
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as erreur:
        print(f"AVERTISSEMENT : critères non calculés, cartes sans pastilles ({erreur})")
        return {}, []
    donnees = json.loads(sortie.stdout)
    return donnees["terrains"], donnees["ordreProximite"]


# Pictos des pastilles : ceux des fiches, lus dans script.js (const PICTOS).
def charger_pictos():
    import re
    src = (RACINE / "script.js").read_text(encoding="utf-8")
    pictos = {}
    for m in re.finditer(r"^\s+(\w+): iconeLucide\('(.*)'\),$", src, re.M):
        pictos[m.group(1)] = (
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + m.group(2) + "</svg>"
        )
    return pictos


def distance_critere(metres):
    """Comme distanceCritere() dans script.js : à 10 m près, rien sous 10 m."""
    return "" if metres < 10 else f"{int(round(metres / 10) * 10)} m"


# ----------------------------------------------------------------------------------------
# Lieux : pistes voisines réunies, exactement comme sur la carte
# ----------------------------------------------------------------------------------------

def photo_terrain(p, photos, plates):
    """(chemin, auteur, source) de la première photo du terrain, comme dans sa fiche."""
    for entree in photos.get(p["osm_id"], []):
        ident = str(entree["mapillary_id"])
        info = plates.get(ident, {})
        auteur = entree.get("credit_nom") or info.get("auteur", "")
        if entree.get("miniature_locale"):
            return entree["miniature_locale"], auteur, "Mapillary"
        if info.get("cadrage"):
            return f"/images/mapillary-plates/{ident}.webp", auteur, "Mapillary"
    if p.get("photo_source") == "mapillary":
        ident = str(p.get("mapillary", "")).strip()
        info = plates.get(ident, {})
        if info.get("cadrage"):
            return f"/images/mapillary-plates/{ident}.webp", info.get("auteur", ""), "Mapillary"
    if p.get("photo_source") == "wikimedia_commons" and p.get("photo_url"):
        return p["photo_url"], "", "Wikimedia Commons"
    return None


def decrire_lieu(pistes, criteres, ordre_proximite, photos, plates):
    rues = collections.Counter(t["nearest_street"] for t in pistes if t.get("nearest_street"))
    noms = [t["name"] for t in pistes if t.get("name")]
    surPlace = []
    proximite = {}
    for t in pistes:
        c = criteres.get(t["osm_id"], {})
        for cle in c.get("surPlace", []):
            if cle not in surPlace:
                surPlace.append(cle)
        for p in c.get("proximite", []):
            proximite[p["cle"]] = min(p["distance"], proximite.get(p["cle"], p["distance"]))
    photo = next((ph for ph in (photo_terrain(t, photos, plates) for t in pistes) if ph), None)
    return {
        "pistes": pistes,
        "nom": noms[0] if noms else None,
        "rue": rues.most_common(1)[0][0] if rues else None,
        "localite": collections.Counter(t.get("commune") for t in pistes).most_common(1)[0][0],
        "surface": next((t["surface"] for t in pistes if t.get("surface")), None),
        "surPlace": surPlace,
        "proximite": sorted(proximite.items(), key=lambda kv: ordre_proximite.index(kv[0])),
        "photo": photo,
        "lat": pistes[0]["lat"],
        "lon": pistes[0]["lon"],
    }


# ----------------------------------------------------------------------------------------
# HTML
# ----------------------------------------------------------------------------------------

def url_commune(slug_commune, prefixe):
    return f"/{prefixe}commune/{slug_commune}.html"


def url_carte(lat, lon, prefixe):
    return f"/{prefixe}?lat={lat}&amp;lon={lon}"


def liste_naturelle(elements, et):
    if len(elements) == 1:
        return elements[0]
    return ", ".join(elements[:-1]) + f" {et} " + elements[-1]


def html_pastille(cle, pictos, tr, complement=""):
    return (
        f'<span class="commune-pastille">{pictos.get(cle, "")}{tr["critere_" + cle]}'
        + (f" · {complement}" if complement else "")
        + "</span>"
    )


def titres_lieux(lieux, tr):
    """Titre de chaque lieu, comme celui de sa fiche (nom OSM, sinon « Terrain » + rue). Deux
    lieux distincts de la même rue porteraient le même titre : on les numérote, (1), (2)…"""
    titres = [l["nom"] or (f'{tr["popup_terrain_prefix"]} {l["rue"]}' if l["rue"]
                           else tr["popup_terrain_prefix"]) for l in lieux]
    total = collections.Counter(titres)
    vus = collections.Counter()
    resultat = []
    for titre in titres:
        if total[titre] > 1:
            vus[titre] += 1
            titre = f"{titre} ({vus[titre]})"
        resultat.append(titre)
    return resultat


def html_lieu(lieu, titre, prefixe, tr, pictos, niveau_titre):
    titre = echap(titre)
    details = []
    if len(lieu["pistes"]) > 1:
        details.append(tr["commune_pistes"].replace("{n}", str(len(lieu["pistes"]))))
    if lieu["surface"] and f'commune_surface_{lieu["surface"]}' in tr:
        details.append(tr[f'commune_surface_{lieu["surface"]}'])

    pastilles = [html_pastille(c, pictos, tr) for c in lieu["surPlace"]]
    pastilles += [html_pastille(c, pictos, tr, distance_critere(d)) for c, d in lieu["proximite"]]

    if lieu["photo"]:
        chemin, auteur, source = lieu["photo"]
        credit = f'{echap(auteur)} · {source}' if auteur else source
        photo = (f'<img src="{html.escape(chemin)}" alt="" loading="lazy" width="320" height="180">'
                 f'<span class="commune-terrain-credit">{credit}</span>')
    else:
        photo = ('<img src="/images/pas-de-photo.webp" alt="" loading="lazy" width="320" '
                 'height="180" class="sans-photo">')

    # Le lien mène à la carte de l'accueil : c'est la destination sans JavaScript (et celle d'un
    # Ctrl+clic). Sinon, /commune.js ouvre la fiche du terrain data-osm sur la page.
    return (
        f'            <a class="commune-terrain" href="{url_carte(lieu["lat"], lieu["lon"], prefixe)}" '
        f'data-osm="{lieu["pistes"][0]["osm_id"]}">\n'
        f'                <span class="commune-terrain-photo">{photo}</span>\n'
        '                <span class="commune-terrain-texte">\n'
        f'                    <h{niveau_titre} class="commune-terrain-nom">{titre}</h{niveau_titre}>\n'
        + (f'                    <span class="commune-terrain-details">{" · ".join(details)}</span>\n'
           if details else "")
        + (f'                    <span class="commune-pastilles">{"".join(pastilles)}</span>\n'
           if pastilles else "")
        + f'                    <span class="commune-terrain-lien">{tr["commune_voir_fiche"]} →</span>\n'
        '                </span>\n'
        '            </a>'
    )


def html_intro(nom, nb_terrains, lieux, clubs, tr):
    terrains = (tr["commune_1_terrain"] if nb_terrains == 1
                else tr["commune_n_terrains"].replace("{n}", str(nb_terrains)))
    if len(lieux) == 1 and nb_terrains > 1:
        detail_lieux = tr["commune_intro_un_lieu"]
    elif len(lieux) != nb_terrains:
        unite = tr["commune_lieu_singulier"] if len(lieux) == 1 else tr["commune_lieux_pluriel"]
        detail_lieux = tr["commune_intro_lieux"].replace("{lieux}", f"<strong>{len(lieux)} {unite}</strong>")
    else:
        detail_lieux = ""
    texte = (tr["commune_intro"].replace("{nom}", echap(nom))
             .replace("{terrains}", f"<strong>{terrains}</strong>").replace("{lieux}", detail_lieux))

    compte = collections.Counter()
    for lieu in lieux:
        for cle in set(lieu["surPlace"]) | {c for c, _ in lieu["proximite"]}:
            compte[cle] += 1
    atouts = [tr[f"commune_atout_{cle}"].replace("{n}", str(compte[cle]))
              for cle in ATOUTS_INTRO if compte[cle]][:3]
    if atouts and len(lieux) > 1:
        # « Parmi ces lieux » seulement si la phrase précédente a parlé de lieux ; sinon « Parmi eux ».
        cle = "commune_intro_atouts" if detail_lieux else "commune_intro_atouts_terrains"
        texte += " " + tr[cle].replace("{liste}", liste_naturelle(atouts, tr["commune_et"]))

    if len(clubs) == 1:
        texte += " " + tr["commune_intro_club"]
    elif clubs:
        texte += " " + tr["commune_intro_clubs"].replace("{n}", str(len(clubs)))
    return f'    <p class="commune-intro">\n        {texte}\n    </p>\n'


def html_clubs(clubs, tr, pictos):
    if not clubs:
        return ""
    titre = tr["commune_club_titre"] if len(clubs) == 1 else tr["commune_clubs_titre"]
    blocs = []
    for club in clubs:
        nom = echap(club["name"])
        if club.get("site"):
            nom = f'<a href="{html.escape(club["site"])}" target="_blank" rel="noopener">{nom}</a>'
        lignes = [f"<strong>{nom}</strong>"]
        if club.get("adresse"):
            lignes.append(echap(club["adresse"]))
        if club.get("federation"):
            lignes.append('<span class="commune-club-federation">'
                          + tr["commune_federation"].replace("{nom}", echap(club["federation"])) + "</span>")
        blocs.append(
            f'            <div class="commune-club"><span class="commune-club-icone">{pictos.get("club", "")}</span>'
            f'<div>{"<br>".join(lignes)}</div></div>'
        )
    return (
        '    <section class="commune-section">\n'
        f'        <h2>{titre}</h2>\n'
        '        <div class="commune-clubs">\n' + "\n".join(blocs) + "\n        </div>\n"
        '    </section>\n'
    )


def html_voisines(nom, voisines, prefixe, tr):
    liens = []
    for v in voisines:
        unite = tr["province_terrain_singulier"] if v["nb"] == 1 else tr["stats_terrains_unit"]
        km = max(1, round(v["distance"] / 1000))
        liens.append(f'            <a href="{v["url"]}">{echap(v["nom"])} '
                     f'<span>{v["nb"]} {unite} · {km} km</span></a>')
    return (
        '    <section class="commune-section">\n'
        f'        <h2>{tr["commune_autour"].replace("{nom}", echap(nom))}</h2>\n'
        '        <div class="commune-voisines">\n' + "\n".join(liens) + "\n        </div>\n"
        '    </section>\n'
    )


def html_fenetres_fiche(tr):
    """Fenêtres où s'affiche la fiche d'un terrain (mêmes identifiants que sur les pages à
    carte, voir ouvrirFicheMobileTerrain dans script.js), et les scripts de la fiche.
    criteres.js doit précéder script.js (pastilles de la fiche) : ce contenu est écrit dans
    la page avant les scripts du squelette. commune.js, en defer, passe après script.js."""
    return (
        '<!-- Fiche terrain : plein écran sur mobile, fenêtre centrée sur ordinateur. -->\n'
        '<div id="mobile-sheet-overlay"></div>\n'
        '<div id="mobile-sheet">\n'
        f'    <button id="mobile-sheet-close" aria-label="{tr["close_panel"]}" data-i18n-aria="close_panel">&#10005;</button>\n'
        '    <div id="mobile-sheet-content"></div>\n'
        '</div>\n'
        '<div id="desktop-modal-overlay"></div>\n'
        '<div id="desktop-modal">\n'
        f'    <button id="desktop-modal-close" aria-label="{tr["close_panel"]}" data-i18n-aria="close_panel">&#10005;</button>\n'
        '    <div id="desktop-modal-content"></div>\n'
        '</div>\n'
        '<script src="/criteres.js"></script>\n'
        '<script src="/commune.js" defer></script>\n'
    )


# ----------------------------------------------------------------------------------------

def ecrire_liens(communes, terrains_par_commune, clubs_par_commune, avec_page):
    """data/communes_liens.json, lu par les fiches terrain et club (voir communeOfficielle dans
    script.js) :
        communes : {slug: {nom | noms {fr, nl, de, en}, terrains, page}}
        terrains : {osm_id: slug}
        clubs    : {"lat,lon": slug} (un club n'a pas d'identifiant ; même écriture qu'en JS)
    Les noms suivent Communes.nom ; « noms » seulement s'ils diffèrent d'une langue à l'autre."""
    liens = {"communes": {}, "terrains": {}, "clubs": {}}
    for ins in sorted(set(terrains_par_commune) | set(clubs_par_commune)):
        commune = communes.par_ins[ins]
        noms = {langue: communes.nom(commune, langue) for langue, _ in LANGUES}
        entree = {"nom": noms["fr"]} if len(set(noms.values())) == 1 else {"noms": noms}
        entree["terrains"] = len(terrains_par_commune.get(ins, []))
        if ins in avec_page:
            entree["page"] = True
        liens["communes"][commune["slug"]] = entree
        for t in terrains_par_commune.get(ins, []):
            liens["terrains"][t["osm_id"]] = commune["slug"]
        for club in clubs_par_commune.get(ins, []):
            liens["clubs"][f"{club['lat']},{club['lon']}"] = commune["slug"]
    with open(DATA / "communes_liens.json", "w", encoding="utf-8") as f:
        json.dump(liens, f, ensure_ascii=False, separators=(",", ":"))


def ecrire_recherche(communes, lieux_par_commune, centres, avec_page):
    """data/recherche.json, chargé par la barre de recherche au premier caractère tapé :
        communes  : [{s: slug, n: nom | {fr, nl, de, en}, a: autres noms, p: province, r: région,
                      lat, lon, t: terrains, pg: page}] — les 565, même sans terrain (la carte se
                      centre alors sur la commune, avec le terrain le plus proche)
        localites : [{n: nom Nominatim, c: commune, t: terrains, ancre}] — les villages dont le
                      nom diffère de celui de la commune ; ancre : sous-titre de la localité sur
                      la page commune, quand elle en a plusieurs
        lieux     : [{o: osm_id de la fiche, n: nom OSM, r: rue, l: localité, c: commune,
                      p: pistes, lat, lon, s: revêtement, sp: critères sur place,
                      px: [[critère de proximité, mètres]], ph: [photo, auteur, source]}] — dans
                      l'ordre des pages commune ; s, sp, px et ph servent aux tuiles de la liste
                      de la page carte (carte.js), les mêmes que sur les pages commune
    Clés courtes : le fichier est téléchargé tel quel par le navigateur."""
    index = {"communes": [], "localites": [], "lieux": []}
    for commune in communes.liste:
        ins = commune["ins"]
        lieux = lieux_par_commune.get(ins, [])
        noms = {langue: communes.nom(commune, langue) for langue, _ in LANGUES}
        autres = {commune["nom"], *commune["nom"].split(" - ")} - set(noms.values())
        lon, lat = centres[ins]
        entree = {"s": commune["slug"],
                  "n": noms["fr"] if len(set(noms.values())) == 1 else noms,
                  "p": commune["province"] or "bruxelles", "r": commune["region"],
                  "lat": round(lat, 5), "lon": round(lon, 5),
                  "t": sum(len(l["pistes"]) for l in lieux)}
        if autres:
            entree["a"] = sorted(autres)
        if ins in avec_page:
            entree["pg"] = 1
        index["communes"].append(entree)

        tous_les_noms = {commune["nom"], *commune["nom"].split(" - "), *noms.values()}
        par_localite = collections.defaultdict(list)
        for lieu in lieux:
            par_localite[lieu["localite"]].append(lieu)
            index["lieux"].append({k: v for k, v in (
                ("o", lieu["pistes"][0]["osm_id"]), ("n", lieu["nom"]), ("r", lieu["rue"]),
                ("l", lieu["localite"]), ("c", commune["slug"]), ("p", len(lieu["pistes"])),
                ("lat", round(lieu["lat"], 6)), ("lon", round(lieu["lon"], 6)),
                ("s", lieu["surface"]), ("sp", lieu["surPlace"] or None),
                ("px", [[c, round(d)] for c, d in lieu["proximite"]] or None),
                ("ph", list(lieu["photo"]) if lieu["photo"] else None)) if v is not None})
        for loc, lieux_loc in par_localite.items():
            if not loc or loc in tous_les_noms:
                continue
            entree = {"n": loc, "c": commune["slug"], "t": sum(len(l["pistes"]) for l in lieux_loc)}
            # Sous-titres seulement sur une page qui regroupe plusieurs localités (voir main)
            if ins in avec_page and len(par_localite) > 1:
                entree["ancre"] = slug(loc)
            index["localites"].append(entree)
    with open(DATA / "recherche.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))


def main():
    communes = Communes()
    traductions = gp.charger_traductions_js(RACINE / "translations.js")
    provinces = charger("provinces.json")
    regions = charger("regions.json")
    stats_geo = charger("stats_geo.json")
    groupes = charger("groupes_terrains.json")
    photos = charger("photos_mapillary.json")
    plates = charger("miniatures_plates.json")
    pictos = charger_pictos()

    # Terrains et clubs rattachés à leur commune officielle
    features = charger("terrains.geojson")["features"]
    terrains_par_commune, hors = communes.rattacher_terrains(features)
    for p in hors:
        print(f"  hors des communes : {p['osm_id']} ({p.get('commune')})")
    clubs_par_commune = communes.rattacher_clubs(charger("clubs.json"))

    criteres, ordre_proximite = calculer_criteres({f["properties"]["osm_id"]: f["properties"] for f in features})

    lieux_par_commune = {}
    for ins, terrains in terrains_par_commune.items():
        lieux = [decrire_lieu(pistes, criteres, ordre_proximite, photos, plates)
                 for pistes in regrouper_lieux(terrains, groupes)]
        # Plus de pistes d'abord, puis ceux qui ont une photo, puis par nom
        lieux.sort(key=lambda l: (-len(l["pistes"]), l["photo"] is None, l["nom"] or l["rue"] or ""))
        lieux_par_commune[ins] = lieux

    avec_page = {ins for ins, lieux in lieux_par_commune.items() if len(lieux) >= MIN_LIEUX}
    centres = {c["ins"]: communes.centre(c) for c in communes.liste}
    print(f"{len(terrains_par_commune)} communes avec des terrains, {len(avec_page)} avec une page "
          f"(au moins {MIN_LIEUX} lieux)")
    ecrire_liens(communes, terrains_par_commune, clubs_par_commune, avec_page)
    ecrire_recherche(communes, lieux_par_commune, centres, avec_page)

    ecrites = set()
    tailles = []
    for ins in sorted(avec_page):
        commune = communes.par_ins[ins]
        lieux = lieux_par_commune[ins]
        terrains = terrains_par_commune[ins]
        clubs = clubs_par_commune.get(ins, [])
        cle_province = commune["province"] or "bruxelles"
        cfg = provinces[cle_province]

        # Communes voisines ayant des terrains, de la plus proche à la plus lointaine
        x, y = centres[ins]
        voisines = sorted(
            (distance_m(x, y, *centres[autre]), autre)
            for autre in terrains_par_commune if autre != ins
        )[:NB_VOISINES]

        for langue, prefixe in LANGUES:
            tr = traductions[langue]
            nom = communes.nom(commune, langue)
            nom_province = gp.nom_traduit_province(cle_province, langue, traductions)
            url_province = gp.url_page(cfg["slug"], langue)

            if commune["region"] == "bruxelles":
                etapes = [(nom_province, url_province)]
                tuiles = [gp.html_tuile(url_province, f"tuile-{cfg['slug']}.webp", nom_province,
                                        stats_geo["bruxelles"]["total"], tr)]
            else:
                nom_region = tr[f"geo_region_{commune['region']}"]
                url_region = gp.url_page_region(cfg["region_slug"], langue)
                etapes = [(nom_region, url_region), (nom_province, url_province)]
                tuiles = [
                    gp.html_tuile(url_province, f"tuile-{cfg['slug']}.webp", nom_province,
                                  stats_geo[commune["region"]]["provinces"][cle_province]["total"], tr),
                    gp.html_tuile(url_region, f"tuile-{cfg['region_slug']}.webp", nom_region,
                                  stats_geo[commune["region"]]["total"], tr),
                ]

            # Cartes des lieux, regroupées par localité quand il y en a plusieurs
            titres = dict(zip(map(id, lieux), titres_lieux(lieux, tr)))
            par_localite = collections.defaultdict(list)
            for lieu in lieux:
                par_localite[lieu["localite"]].append(lieu)
            if len(par_localite) > 1:
                localites = sorted(par_localite, key=lambda l: -sum(len(x["pistes"]) for x in par_localite[l]))
                blocs = "".join(
                    f'        <h3 class="commune-localite" id="{slug(loc)}">{echap(gp.nom_commune_affiche(loc, langue))}</h3>\n'
                    '        <div class="commune-terrains">\n'
                    + "\n".join(html_lieu(l, titres[id(l)], prefixe, tr, pictos, 4) for l in par_localite[loc])
                    + "\n        </div>\n"
                    for loc in localites
                )
            else:
                blocs = ('        <div class="commune-terrains">\n'
                         + "\n".join(html_lieu(l, titres[id(l)], prefixe, tr, pictos, 3) for l in lieux)
                         + "\n        </div>\n")

            infos_voisines = []
            for distance, autre in voisines:
                c_autre = communes.par_ins[autre]
                if autre in avec_page:
                    url = url_commune(c_autre["slug"], prefixe)
                else:
                    premier = lieux_par_commune[autre][0]
                    url = url_carte(premier["lat"], premier["lon"], prefixe)
                infos_voisines.append({"nom": communes.nom(c_autre, langue), "url": url,
                                       "nb": len(terrains_par_commune[autre]), "distance": distance})

            contenu = (
                '<div class="commune-page">\n\n'
                + html_intro(nom, len(terrains), lieux, clubs, tr)
                + '\n    <section class="commune-section">\n'
                f'        <h2>{tr["commune_terrains_titre"].replace("{nom}", echap(nom))}</h2>\n'
                + blocs
                + '    </section>\n\n'
                + html_clubs(clubs, tr, pictos)
                + html_voisines(nom, infos_voisines, prefixe, tr)
                + '\n    <section class="commune-section">\n'
                f'        <h2>{tr["commune_plus_loin"]}</h2>\n'
                f'        <div class="tuiles-provinces tuiles-deux">\n' + "\n".join(tuiles) + "\n        </div>\n"
                '    </section>\n\n'
                '</div>\n\n'
                + html_fenetres_fiche(tr)
            )

            h1 = tr["commune_h1"].replace("{nom}", echap(nom))
            description = (tr["commune_meta_description"].replace("{n}", str(len(terrains)))
                           .replace("{nom}", nom).replace("{province}", nom_province))
            page = f"commune/{commune['slug']}.html"
            taille = construire_page(
                RACINE / prefixe / "comment-jouer.html",
                RACINE / prefixe / page,
                page=page,
                prefixe=prefixe,
                titre=f"{h1} — Mapetanque.be",
                description=description,
                h1=h1,
                fil=(tr["province_accueil_breadcrumb"], etapes, echap(nom)),
                contenu=contenu,
                # Insérées chacune juste après style-comment-jouer.css, donc dans l'ordre inverse :
                # style-commune.css finit en dernier. style-beaux-terrains.css : styles de la fiche.
                feuilles_sup=("/style-commune.css", "/style-province.css", "/style-beaux-terrains.css"),
                banniere=f"/images/provinces/{cfg['banner_image']}",
                credit=gp.credit_banniere(cfg["banner_credit_html"], langue),
            )
            ecrites.add(RACINE / prefixe / page)
            tailles.append(taille)

    # Commune passée sous MIN_LIEUX (terrain supprimé d'OSM, fusion de communes…) : sa page
    # disparaît, plutôt que de rester en ligne avec des données figées.
    for _, prefixe in LANGUES:
        for chemin in sorted((RACINE / prefixe / "commune").glob("*.html")):
            if chemin not in ecrites:
                chemin.unlink()
                print(f"  supprimée : {prefixe}commune/{chemin.name}")

    print(f"{len(ecrites)} pages commune écrites ({len(avec_page)} communes × {len(LANGUES)} langues, "
          f"{sum(tailles) // 1024} Ko en tout)")

    # Données structurées, sitemap.xml et llms.txt
    generer_referencement.main()


if __name__ == "__main__":
    main()
