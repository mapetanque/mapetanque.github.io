"""
Critères d'environnement des terrains, tirés d'OpenStreetMap.

Pour chaque terrain, mesure la distance aux éléments OSM proches (bancs, jeux, WC, eau
potable, parkings, arrêts, routes, eau, voies vertes) et repère s'il est dans une zone
nature. Les résultats vont dans data/environnement.json, indexé par osm_id, puis sont
recopiés dans data/terrains.geojson (propriété « env ») pour que le site n'ait qu'un fichier
à charger. update_terrains.py refait cette recopie à chaque mise à jour hebdomadaire.

On stocke les distances réelles (en m, jusqu'au rayon interrogé) et les types trouvés, pas
des oui/non : les seuils d'affichage et de filtre sont appliqués par le site, et peuvent
donc changer sans relancer la collecte. Éclairé et Abrité ne passent pas par ici : ils
viennent des tags du terrain lui-même (lit, covered, indoor, building), déjà dans le GeoJSON.

Usage :
  python scripts/enrichir_environnement.py              terrains absents de environnement.json
  python scripts/enrichir_environnement.py --tous       tous les terrains (rafraîchissement complet)
  options : --limite N (au plus N terrains), --minutes N (ne plus commencer de lot après N min)

Le travail se fait par lots de terrains, et environnement.json est enregistré après chaque
lot : un passage interrompu garde ce qui est fait, le suivant reprend la suite. Un terrain
disparu d'OSM garde sa ligne (inoffensif, et prête s'il revient).

Seuils et définitions validés le 1er octobre 2026 sur un test des 1 745 terrains (seuils appliqués par le site).
"""

import argparse
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from datetime import date

import requests

DOSSIER_SCRIPT = os.path.dirname(os.path.abspath(__file__))
DOSSIER_DATA = os.path.join(DOSSIER_SCRIPT, "..", "data")
CHEMIN_GEOJSON = os.path.join(DOSSIER_DATA, "terrains.geojson")
CHEMIN_ENVIRONNEMENT = os.path.join(DOSSIER_DATA, "environnement.json")

# Même liste de serveurs que update_terrains.py
OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

TAILLE_LOT = 250

# Requêtes par lot de terrains (set .t), découpées en petits morceaux : les serveurs saturés
# refusent les grosses requêtes. Rayon d'interrogation = au moins le double du seuil retenu.
REQUETES = {
    "bancs": """(
  nwr(around.t:30)["amenity"="bench"];
  nwr(around.t:30)["leisure"="picnic_table"];
);
out geom;""",
    "jeux": 'nwr(around.t:300)["leisure"="playground"];\nout geom;',
    "wc_eau": """(
  nwr(around.t:400)["amenity"="toilets"];
  nwr(around.t:400)["amenity"="drinking_water"];
  nwr(around.t:400)["drinking_water"="yes"];
);
out geom;""",
    "parking": 'nwr(around.t:600)["amenity"="parking"];\nout geom;',
    "arrets": """(
  nwr(around.t:600)["highway"="bus_stop"];
  nwr(around.t:600)["railway"="tram_stop"];
);
out geom;""",
    "grands_axes": """(
  way(around.t:400)["highway"~"^(motorway|trunk)(_link)?$"];
  way(around.t:200)["highway"~"^primary(_link)?$"];
  way(around.t:150)["highway"~"^secondary(_link)?$"];
);
out geom tags;""",
    "petites_routes": """(
  way(around.t:100)["highway"~"^tertiary(_link)?$"];
  way(around.t:40)["highway"~"^(residential|unclassified)$"];
);
out geom tags;""",
    "eau": """(
  nwr(around.t:200)["natural"="water"];
  way(around.t:200)["waterway"~"^(river|canal|stream|riverbank)$"];
  way(around.t:200)["natural"="coastline"];
  nwr(around.t:200)["natural"="beach"];
);
out geom;""",
    # Zones nature : is_in sur les sommets des terrains, puis retour aux objets des zones.
    # Overpass ne dit pas quel terrain est dans quelle zone : le test est refait localement.
    "nature": """(node.t; node(w.t);)->.pts;
.pts is_in->.a;
(
  area.a["leisure"="park"];
  area.a["leisure"="nature_reserve"];
  area.a["natural"="wood"];
  area.a["landuse"="forest"];
  area.a["landuse"="recreation_ground"];
)->.z;
(way(pivot.z); rel(pivot.z););
out geom;""",
    # Voies vertes : chemins sans voitures proches, avec les itinéraires vélo qui les contiennent
    "velo": """(
  way(around.t:400)["highway"="cycleway"];
  way(around.t:400)["highway"~"^(path|track)$"]["bicycle"~"^(designated|yes)$"];
)->.w;
.w out geom tags;
rel(bw.w)["route"="bicycle"];
out body;""",
}

# Rayons d'interrogation, repris pour le calcul (au-delà, rien n'est stocké)
RAYONS = {"banc": 30, "jeux": 300, "wc": 400, "eau_potable": 400, "parking": 600, "arret": 600,
          "eau": 200, "voie_verte": 400, "fietssnelweg": 400}
RAYONS_ROUTES = {"motorway": 400, "trunk": 400, "primary": 200, "secondary": 150, "tertiary": 100,
                 "residential": 40, "unclassified": 40}

# ---------------------------------------------------------------------------------------
# Interrogation d'Overpass
# ---------------------------------------------------------------------------------------


def attente_slot(server):
    """Secondes à attendre avant un créneau libre, d'après /api/status (limite par adresse IP)."""
    try:
        texte = requests.get(server.replace("/interpreter", "/status"), timeout=30).text
        if "slots available now" in texte:
            return 0
        attentes = [int(x) for x in re.findall(r"in (\d+) seconds", texte)]
        return min(attentes) if attentes else 30
    except Exception:
        return 30


def envoyer(requete, etiquette, valider=None):
    """Envoie une requête. Serveur principal d'abord, en respectant sa limite de requêtes par
    adresse (429 ou 504 : on attend un créneau libre), puis les serveurs de secours.
    `valider(donnees)` refuse une réponse incomplète (serveur de secours en retard)."""
    for tour in range(5):
        if tour:
            print(f"    … nouvel essai dans {30 * tour} s", flush=True)
            time.sleep(30 * tour)
        for server in OVERPASS_SERVERS:
            essais = 6 if server == OVERPASS_SERVERS[0] else 1
            for _ in range(essais):
                debut = time.time()
                try:
                    r = requests.post(
                        server, data={"data": requete}, headers={"User-Agent": "Mapetanque/1.0"}, timeout=280
                    )
                    if r.status_code in (429, 504) and essais > 1:
                        attente = max(5, min(120, attente_slot(server) + 2))
                        print(f"  … {etiquette} : serveur occupé ({r.status_code}), attente {attente} s", flush=True)
                        time.sleep(attente)
                        continue
                    r.raise_for_status()
                    donnees = r.json()
                    if donnees.get("remark"):
                        raise RuntimeError(donnees["remark"])
                    if valider and not valider(donnees):
                        raise RuntimeError("réponse incomplète (serveur en retard ?)")
                    print(f"  ✓ {etiquette} : {len(donnees['elements'])} objets, "
                          f"{time.time() - debut:.0f} s ({server.split('/')[2]})", flush=True)
                    return donnees
                except Exception as e:
                    print(f"  ✗ {etiquette} ({server.split('/')[2]}) : {type(e).__name__} "
                          f"{str(e)[:120]} ({time.time() - debut:.0f} s)", flush=True)
                    break
    raise RuntimeError(f"Tous les serveurs Overpass ont échoué pour « {etiquette} »")


def selection(ids):
    """Set .t désigné par identifiants (ex. ["way/12", "node/34"])."""
    par_type = defaultdict(list)
    for osm_id in ids:
        t, i = osm_id.split("/")
        par_type[t].append(i)
    return "(" + "".join(f"{t}(id:{','.join(v)});" for t, v in par_type.items()) + ")->.t;"


def interroger_lot(ids, etiquette):
    """Géométrie des terrains du lot, puis toutes les requêtes de critères pour ces terrains."""
    terrains = envoyer(f"[out:json][timeout:180];\n{selection(ids)}\n.t out geom tags;",
                       f"{etiquette} terrains")
    trouves = [f"{e['type']}/{e['id']}" for e in terrains["elements"]]
    if not trouves:
        return terrains, {}
    entete = f"[out:json][timeout:180];\n{selection(trouves)}\n"

    # « .t out count » en fin de requête : chaque réponse doit connaître tous les terrains du
    # lot, sinon un serveur en retard donnerait des critères incomplets pour les plus récents
    def valider(donnees):
        compte = [e for e in donnees["elements"] if e["type"] == "count"]
        return bool(compte) and int(compte[0]["tags"]["total"]) == len(trouves)

    reponses = {}
    for nom, corps in REQUETES.items():
        donnees = envoyer(entete + corps + "\n.t out count;", f"{etiquette} {nom}", valider)
        reponses[nom] = [e for e in donnees["elements"] if e["type"] != "count"]
        time.sleep(2)  # ménager le serveur
    return terrains, reponses


# ---------------------------------------------------------------------------------------
# Géométrie : projection locale en mètres (écart d'échelle < 3 % sur la Belgique)
# ---------------------------------------------------------------------------------------

LAT0 = 50.5
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574


def proj(lat, lon):
    return (lon * KX, lat * KY)


def dist_point_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _orient(ax, ay, bx, by, cx, cy):
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)


def dist_segments(s, u):
    ax, ay, bx, by = s
    cx, cy, dx, dy = u
    d1, d2 = _orient(ax, ay, bx, by, cx, cy), _orient(ax, ay, bx, by, dx, dy)
    d3, d4 = _orient(cx, cy, dx, dy, ax, ay), _orient(cx, cy, dx, dy, bx, by)
    if ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0)) and d1 and d2 and d3 and d4:
        return 0.0
    return min(
        dist_point_segment(ax, ay, cx, cy, dx, dy),
        dist_point_segment(bx, by, cx, cy, dx, dy),
        dist_point_segment(cx, cy, ax, ay, bx, by),
        dist_point_segment(dx, dy, ax, ay, bx, by),
    )


def point_dans(px, py, segments):
    """Parité des croisements : marche sur des anneaux non assemblés (multipolygones)."""
    dedans = False
    for ax, ay, bx, by in segments:
        if (ay > py) != (by > py):
            x = ax + (py - ay) * (bx - ax) / (by - ay)
            if x > px:
                dedans = not dedans
    return dedans


def lignes_de(el):
    """Polylignes projetées d'un élément `out geom` (un nœud = polyligne d'un seul point)."""
    if el["type"] == "node":
        return [[proj(el["lat"], el["lon"])]]
    if el["type"] == "way":
        return [[proj(p["lat"], p["lon"]) for p in el.get("geometry", []) if p]]
    lignes = []
    for m in el.get("members", []):
        if m["type"] == "way" and m.get("geometry"):
            lignes.append([proj(p["lat"], p["lon"]) for p in m["geometry"] if p])
        elif m["type"] == "node" and "lat" in m:
            lignes.append([proj(m["lat"], m["lon"])])
    return lignes


def segments_de(lignes):
    segs = []
    for l in lignes:
        if len(l) == 1:
            segs.append((l[0][0], l[0][1], l[0][0], l[0][1]))
        for a, b in zip(l, l[1:]):
            segs.append((a[0], a[1], b[0], b[1]))
    return segs


def est_surface(el):
    if el["type"] == "relation":
        return el.get("tags", {}).get("type") in ("multipolygon", "boundary")
    if el["type"] == "way":
        g = el.get("geometry") or []
        return len(g) > 3 and g[0] == g[-1] and el.get("tags", {}).get("highway") is None
    return False


def assembler_anneaux(lignes):
    """Assemble des morceaux de lignes en anneaux fermés (par extrémités communes)."""
    morceaux = [list(l) for l in lignes if len(l) > 1]
    anneaux = []
    while morceaux:
        anneau = morceaux.pop()
        progres = True
        while anneau[0] != anneau[-1] and progres:
            progres = False
            for i, m in enumerate(morceaux):
                if m[0] == anneau[-1]:
                    anneau += m[1:]
                elif m[-1] == anneau[-1]:
                    anneau += m[-2::-1]
                elif m[-1] == anneau[0]:
                    anneau = m[:-1] + anneau
                elif m[0] == anneau[0]:
                    anneau = m[:0:-1] + anneau
                else:
                    continue
                morceaux.pop(i)
                progres = True
                break
        if anneau[0] == anneau[-1]:
            anneaux.append(anneau)
    return anneaux


def aire_ha(el):
    """Surface en hectares (extérieurs moins intérieurs) d'un polygone ou multipolygone."""
    def shoelace(r):
        return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:]))) / 2

    if el["type"] == "way":
        return shoelace(lignes_de(el)[0]) / 1e4
    membres = [m for m in el.get("members", []) if m["type"] == "way" and m.get("geometry")]
    ext = [[proj(p["lat"], p["lon"]) for p in m["geometry"] if p] for m in membres if m.get("role") != "inner"]
    inn = [[proj(p["lat"], p["lon"]) for p in m["geometry"] if p] for m in membres if m.get("role") == "inner"]
    return (sum(shoelace(r) for r in assembler_anneaux(ext)) - sum(shoelace(r) for r in assembler_anneaux(inn))) / 1e4


class Index:
    """Grille de segments pour trouver vite les éléments proches d'un terrain."""

    TAILLE = 100.0

    def __init__(self):
        self.cases = defaultdict(list)
        self.elements = []

    def ajouter(self, el, info=None):
        i = len(self.elements)
        segs = segments_de(lignes_de(el))
        self.elements.append({"info": info or {}, "segs": segs, "surface": est_surface(el)})
        for s in segs:
            x0, x1 = sorted((s[0], s[2]))
            y0, y1 = sorted((s[1], s[3]))
            for cx in range(int(x0 // self.TAILLE), int(x1 // self.TAILLE) + 1):
                for cy in range(int(y0 // self.TAILLE), int(y1 // self.TAILLE) + 1):
                    self.cases[(cx, cy)].append((i, s))

    def proches(self, terrain, rayon):
        """{indice élément: distance en m} pour les éléments à moins de `rayon` du terrain."""
        x0, y0, x1, y1 = terrain["bbox"]
        res = {}
        vus = set()
        for cx in range(int((x0 - rayon) // self.TAILLE), int((x1 + rayon) // self.TAILLE) + 1):
            for cy in range(int((y0 - rayon) // self.TAILLE), int((y1 + rayon) // self.TAILLE) + 1):
                for i, s in self.cases.get((cx, cy), ()):
                    if (i, s) in vus or res.get(i) == 0:
                        continue
                    vus.add((i, s))
                    d = min(dist_segments(s, t) for t in terrain["segs"])
                    # Élément ponctuel posé dans le terrain (banc…) : distance nulle
                    if s[0] == s[2] and s[1] == s[3] and terrain["surface"] and point_dans(s[0], s[1], terrain["segs"]):
                        d = 0.0
                    if d <= rayon and d < res.get(i, math.inf):
                        res[i] = d
        # Terrain posé dans une surface (plaine de jeux, parking…) : distance nulle
        for i in list(res):
            e = self.elements[i]
            if e["surface"] and res[i] > 0 and point_dans(terrain["cx"], terrain["cy"], e["segs"]):
                res[i] = 0.0
        return res

    def plus_proche(self, terrain, rayon):
        d = self.proches(terrain, rayon)
        return min(d.values()) if d else None


# ---------------------------------------------------------------------------------------
# Classement des éléments trouvés
# ---------------------------------------------------------------------------------------

# Voie verte : chemin sans voitures (piste cyclable, ou chemin autorisé aux vélos) qui fait
# partie d'un itinéraire national ou international, ou dont le nom ou celui de l'itinéraire
# évoque une voie verte : RAVeL (mot entier : « Ravels » est une commune), chemin de halage,
# jaagpad, EuroVelo, ancienne voie ferrée (spoorweg…).
RE_VOIE_VERTE = re.compile(r"\bravel\b|halage|jaagpad|towpath|eurovelo|spoorweg", re.I)
# Les Fietssnelwegen flamandes (F1, F400…) sont au réseau national, mais ce sont des axes
# vélo domicile-travail, parfois le long d'un grand axe (F40 le long du R4) : stockées à part
# (« fietssnelweg »), le site décide de les compter ou non comme voie verte.
RE_FIETSSNELWEG = re.compile(r"fietssnelweg|^f\d", re.I)


def acces_ok(tags):
    return tags.get("access") not in ("private", "customers", "no", "permit")


def classer_point(tags):
    if tags.get("amenity") == "bench" or tags.get("leisure") == "picnic_table":
        return "banc"
    if tags.get("leisure") == "playground":
        return "jeux"
    if tags.get("amenity") == "toilets":
        return "wc" if acces_ok(tags) else None
    if tags.get("amenity") == "drinking_water" or tags.get("drinking_water") == "yes":
        return "eau_potable" if tags.get("drinking_water") != "no" and acces_ok(tags) else None
    if tags.get("amenity") == "parking":
        return "parking" if acces_ok(tags) else None
    if tags.get("highway") == "bus_stop" or tags.get("railway") == "tram_stop":
        return "arret"
    return None


def classer_eau(el):
    """Type d'eau, ou None si exclu (bassins d'orage, d'épuration, fontaines…)."""
    tags = el.get("tags", {})
    if tags.get("natural") == "water":
        w = tags.get("water")
        if w in ("basin", "wastewater", "reservoir_covered", "fountain", "reflecting_pool", "pool", "ditch"):
            return None
        return {None: "plan_eau", "": "plan_eau", "lake": "lac", "pond": "etang", "oxbow": "etang",
                "river": "riviere", "canal": "canal", "lock": "canal", "stream": "ruisseau",
                "reservoir": "reservoir", "moat": "douves"}.get(w, "plan_eau")
    if tags.get("waterway") in ("river", "riverbank"):
        return "riviere"
    if tags.get("waterway") == "canal":
        return "canal"
    if tags.get("waterway") == "stream":
        return "ruisseau"
    if tags.get("natural") == "coastline":
        return "mer"
    if tags.get("natural") == "beach":
        return "plage"
    return None


# Plans d'eau de moins de 0,5 ha (étangs décoratifs…) : stockés à part, sous « …_petit »
SURFACES_EAU = ("plan_eau", "lac", "etang", "reservoir", "douves")


def type_nature(tags):
    if tags.get("leisure") == "park":
        return "parc"
    if tags.get("leisure") == "nature_reserve":
        return "reserve"
    if tags.get("natural") == "wood" or tags.get("landuse") == "forest":
        return "bois"
    if tags.get("landuse") == "recreation_ground":
        return "loisirs"
    return None


# ---------------------------------------------------------------------------------------
# Calcul des critères d'un lot
# ---------------------------------------------------------------------------------------


def preparer_terrain(el):
    segs = segments_de(lignes_de(el))
    if not segs:
        return None
    xs = [c for s in segs for c in (s[0], s[2])]
    ys = [c for s in segs for c in (s[1], s[3])]
    return {"id": f"{el['type']}/{el['id']}", "segs": segs, "surface": el["type"] != "node",
            "bbox": (min(xs), min(ys), max(xs), max(ys)), "cx": sum(xs) / len(xs), "cy": sum(ys) / len(ys)}


def calculer_lot(terrains, reponses, aujourd_hui):
    idx = defaultdict(Index)
    for nom in ("bancs", "jeux", "wc_eau", "parking", "arrets"):
        for el in reponses[nom]:
            c = classer_point(el.get("tags", {}))
            if c:
                idx[c].ajouter(el)
    for el in reponses["grands_axes"] + reponses["petites_routes"]:
        tags = el.get("tags", {})
        if tags.get("tunnel") in ("yes", "building_passage", "culvert") or tags.get("covered") == "yes":
            continue
        idx["route_" + tags["highway"].replace("_link", "")].ajouter(el)
    for el in reponses["eau"]:
        t = classer_eau(el)
        if t:
            if t in SURFACES_EAU and est_surface(el) and aire_ha(el) < 0.5:
                t += "_petit"
            idx["eau"].ajouter(el, {"type": t})

    rels_de_way = defaultdict(list)
    for el in reponses["velo"]:
        if el["type"] == "relation":
            for m in el.get("members", []):
                if m["type"] == "way":
                    rels_de_way[m["ref"]].append(el.get("tags", {}))
    for el in reponses["velo"]:
        if el["type"] == "way":
            rels = rels_de_way.get(el["id"], [])
            noms = " ".join([el.get("tags", {}).get("name", "")] + [r.get("name", "") for r in rels])
            nationaux = [r for r in rels if r.get("network") in ("icn", "ncn")]
            if RE_VOIE_VERTE.search(noms) or any(
                    not RE_FIETSSNELWEG.search(r.get("name") or r.get("ref") or "") for r in nationaux):
                idx["voie_verte"].ajouter(el)
            elif nationaux:
                idx["fietssnelweg"].ajouter(el)

    zones = []
    for el in reponses["nature"]:
        t = type_nature(el.get("tags", {}))
        if t and est_surface(el):
            segs = segments_de(lignes_de(el))
            xs = [c for s in segs for c in (s[0], s[2])]
            ys = [c for s in segs for c in (s[1], s[3])]
            zones.append({"type": t, "ha": aire_ha(el), "segs": segs,
                          "bbox": (min(xs), min(ys), max(xs), max(ys))})

    resultats = {}
    for el in terrains["elements"]:
        t = preparer_terrain(el)
        if not t:
            continue
        r = {"calcule_le": aujourd_hui}
        for c in ("banc", "jeux", "wc", "eau_potable", "parking", "arret", "voie_verte", "fietssnelweg"):
            d = idx[c].plus_proche(t, RAYONS[c])
            if d is not None:
                r[c] = round(d)
        routes = {}
        for classe, rayon in RAYONS_ROUTES.items():
            d = idx["route_" + classe].plus_proche(t, rayon)
            if d is not None:
                routes[classe] = round(d)
        if routes:
            r["routes"] = routes
        eau = {}
        for i, d in idx["eau"].proches(t, RAYONS["eau"]).items():
            cle = idx["eau"].elements[i]["info"]["type"]
            eau[cle] = min(round(d), eau.get(cle, math.inf))
        if eau:
            r["eau"] = dict(sorted(eau.items()))
        nature = {}
        for z in zones:
            if (z["bbox"][0] <= t["cx"] <= z["bbox"][2] and z["bbox"][1] <= t["cy"] <= z["bbox"][3]
                    and point_dans(t["cx"], t["cy"], z["segs"])):
                nature[z["type"]] = max(round(z["ha"], 1), nature.get(z["type"], 0))
        if nature:
            r["nature"] = dict(sorted(nature.items()))
        resultats[t["id"]] = r
    return resultats


# ---------------------------------------------------------------------------------------
# Fichiers
# ---------------------------------------------------------------------------------------


def charger_json(chemin, defaut):
    if os.path.exists(chemin):
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    return defaut


def ecrire_environnement(env):
    # Une ligne par terrain : fichier compact, et différences lisibles d'une semaine à l'autre
    lignes = [json.dumps(k) + ":" + json.dumps(v, ensure_ascii=False, separators=(",", ":"))
              for k, v in sorted(env.items())]
    with open(CHEMIN_ENVIRONNEMENT, "w", encoding="utf-8") as f:
        f.write("{\n" + ",\n".join(lignes) + "\n}\n")


def recopier_dans_geojson(env):
    """Propriété « env » de chaque terrain du GeoJSON (même format d'écriture que update_terrains.py)."""
    geojson = charger_json(CHEMIN_GEOJSON, None)
    if not geojson:
        return
    for feature in geojson["features"]:
        proprietes = feature["properties"]
        proprietes.pop("env", None)
        if proprietes.get("osm_id") in env:
            proprietes["env"] = env[proprietes["osm_id"]]
    with open(CHEMIN_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Critères d'environnement des terrains (OSM)")
    parser.add_argument("--tous", action="store_true", help="recalculer tous les terrains")
    parser.add_argument("--limite", type=int, default=None, help="au plus N terrains")
    parser.add_argument("--minutes", type=float, default=None, help="ne plus commencer de lot après N minutes")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    debut = time.time()
    geojson = charger_json(CHEMIN_GEOJSON, {"features": []})
    ids = [f["properties"]["osm_id"] for f in geojson["features"] if f.get("properties", {}).get("osm_id")]
    env = charger_json(CHEMIN_ENVIRONNEMENT, {})
    cibles = ids if args.tous else [i for i in ids if i not in env]
    if args.limite is not None:
        cibles = cibles[:args.limite]
    print(f"{len(ids)} terrains, {len(env)} déjà calculés, {len(cibles)} à calculer", flush=True)

    aujourd_hui = date.today().isoformat()
    lots = [cibles[i:i + TAILLE_LOT] for i in range(0, len(cibles), TAILLE_LOT)]
    faits = 0
    try:
        for n, lot in enumerate(lots, start=1):
            if args.minutes is not None and time.time() - debut > args.minutes * 60:
                print(f"Temps écoulé : arrêt avant le lot {n}/{len(lots)}, la suite au prochain passage.")
                break
            terrains, reponses = interroger_lot(lot, f"lot {n}/{len(lots)}")
            if reponses:
                resultats = calculer_lot(terrains, reponses, aujourd_hui)
                env.update(resultats)
                faits += len(resultats)
                ecrire_environnement(env)
            absents = len(lot) - len(terrains["elements"])
            if absents:
                print(f"  ! {absents} terrain(s) introuvable(s) sur le serveur (supprimés d'OSM ?)")
    finally:
        # Même en cas d'échec d'un lot : ce qui est calculé est recopié dans le GeoJSON
        if faits:
            recopier_dans_geojson(env)
        print(f"{faits} terrains calculés, {len(env)} au total dans environnement.json", flush=True)


if __name__ == "__main__":
    main()
