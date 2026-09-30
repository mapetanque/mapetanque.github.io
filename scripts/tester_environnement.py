"""
Test des critères d'environnement des terrains, en lecture seule.

Interroge Overpass pour les éléments OSM proches de chaque terrain (bancs, jeux, routes,
eau, zones nature, voies vertes, WC, eau potable, parkings, arrêts), calcule les distances
depuis le contour du terrain et affiche, critère par critère, combien de terrains satisfont
le seuil, avec le seuil doublé et par région. Rien n'est écrit dans le site.

Les réponses brutes d'Overpass sont gardées dans un dossier temporaire (hors du dépôt) pour
pouvoir relancer les calculs sans réinterroger les serveurs. --sans-cache force une nouvelle
interrogation. Un CSV par terrain est écrit dans ce même dossier, pour vérifier des exemples.

Géométrie faite à la main (projection locale en mètres, distances point-segment), sans
dépendance à shapely.
"""

import csv
import json
import math
import os
import re
import sys
import tempfile
import time
from collections import Counter, defaultdict

import requests

DOSSIER_SCRIPT = os.path.dirname(os.path.abspath(__file__))
CHEMIN_GEOJSON = os.path.join(DOSSIER_SCRIPT, "..", "data", "terrains.geojson")
DOSSIER_CACHE = os.environ.get(
    "MAPETANQUE_CACHE_ENV", os.path.join(tempfile.gettempdir(), "mapetanque_environnement")
)

# Même liste de serveurs que update_terrains.py
OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Même filtre de terrains que update_terrains.py, rangé dans le set .t
ENTETE = """
[out:json][timeout:300];
area["ISO3166-1"="BE"]["admin_level"="2"]->.belgique;
(
  nwr["leisure"="pitch"]["sport"="boules"]["access"!="private"]["access"!="customers"]["access"!="no"](area.belgique);
  nwr["leisure"="pitch"]["sport"="petanque"]["access"!="private"]["access"!="customers"]["access"!="no"](area.belgique);
)->.t;
"""

REQUETE_TERRAINS = ENTETE + ".t out geom tags;"

# Requêtes par critère, découpées en petits morceaux : des serveurs saturés refusent les grosses
# requêtes, et la connexion est coupée au-delà de quelques minutes d'attente. Chaque morceau
# est envoyé pour un lot de terrains (set .t). Rayon d'interrogation = au moins le double du seuil.
REQUETES = {
    "points": {
        "bancs": """(
  nwr(around.t:30)["amenity"="bench"];
  nwr(around.t:30)["leisure"="picnic_table"];
  node(around.t:30)["highway"="street_lamp"];
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
    },
    # Routes : rayon selon le type (au moins le double de la distance minimale)
    "routes": {
        "grands_axes": """(
  way(around.t:400)["highway"~"^(motorway|trunk)(_link)?$"];
  way(around.t:200)["highway"~"^primary(_link)?$"];
  way(around.t:150)["highway"~"^secondary(_link)?$"];
);
out geom tags;""",
        "petites": """(
  way(around.t:100)["highway"~"^tertiary(_link)?$"];
  way(around.t:40)["highway"~"^(residential|unclassified)$"];
);
out geom tags;""",
    },
    "eau": {
        "eau": """(
  nwr(around.t:200)["natural"="water"];
  way(around.t:200)["waterway"~"^(river|canal|stream|riverbank)$"];
  way(around.t:200)["natural"="coastline"];
  nwr(around.t:200)["natural"="beach"];
);
out geom;""",
    },
    # Zones nature : is_in sur les sommets des terrains, puis retour aux objets des zones.
    # Overpass ne dit pas quel terrain est dans quelle zone : le test est refait localement.
    "nature": {
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
    },
    # Voies vertes : chemins sans voitures proches, avec les itinéraires vélo qui les contiennent
    "velo": {
        "velo": """(
  way(around.t:400)["highway"="cycleway"];
  way(around.t:400)["highway"~"^(path|track)$"]["bicycle"~"^(designated|yes)$"];
)->.w;
.w out geom tags;
rel(bw.w)["route"="bicycle"];
out body;""",
    },
}

TAILLE_LOT = 250

# ---------------------------------------------------------------------------------------
# Interrogation d'Overpass (avec cache)
# ---------------------------------------------------------------------------------------


def envoyer(requete, etiquette):
    """Envoie une requête, en essayant chaque serveur sur plusieurs tours (serveurs saturés)."""
    for tour in range(5):
        if tour:
            print(f"    … nouvel essai dans {30 * tour} s", flush=True)
            time.sleep(30 * tour)
        for server in OVERPASS_SERVERS:
            debut = time.time()
            try:
                r = requests.post(
                    server, data={"data": requete}, headers={"User-Agent": "Mapetanque/1.0"}, timeout=280
                )
                r.raise_for_status()
                donnees = r.json()
                if donnees.get("remark"):
                    raise RuntimeError(donnees["remark"])
                print(f"  ✓ {etiquette} : {len(donnees['elements'])} objets, "
                      f"{time.time() - debut:.0f} s ({server.split('/')[2]})", flush=True)
                return donnees
            except Exception as e:
                print(f"  ✗ {etiquette} ({server.split('/')[2]}) : {type(e).__name__} "
                      f"{str(e)[:120]} ({time.time() - debut:.0f} s)", flush=True)
    raise RuntimeError(f"Tous les serveurs Overpass ont échoué pour « {etiquette} »")


def lire_cache(chemin):
    if os.path.exists(chemin):
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    return None


def ecrire_cache(chemin, donnees):
    os.makedirs(DOSSIER_CACHE, exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(donnees, f)


def interroger_terrains(sans_cache):
    chemin = os.path.join(DOSSIER_CACHE, "terrains.json")
    donnees = None if sans_cache else lire_cache(chemin)
    if donnees is None:
        donnees = envoyer(REQUETE_TERRAINS, "terrains")
        if not donnees["elements"]:
            raise RuntimeError("aucun terrain reçu")
        ecrire_cache(chemin, donnees)
    return donnees


def interroger_groupe(nom, terrains, sans_cache):
    """Toutes les sous-requêtes d'un groupe, lot de terrains par lot, fusionnées sans doublons."""
    ids = [(el["type"], el["id"]) for el in terrains["elements"]]
    lots = [ids[i:i + TAILLE_LOT] for i in range(0, len(ids), TAILLE_LOT)]
    vus = {}
    for sous, corps in REQUETES[nom].items():
        for n, lot in enumerate(lots):
            chemin = os.path.join(DOSSIER_CACHE, f"{nom}_{sous}_{n}.json")
            donnees = None if sans_cache else lire_cache(chemin)
            if donnees is None:
                par_type = defaultdict(list)
                for t, i in lot:
                    par_type[t].append(str(i))
                selection = "".join(f"{t}(id:{','.join(v)});" for t, v in par_type.items())
                # « .t out count » en fin de requête : prouve que le lot a bien été trouvé, et
                # distingue une vraie réponse vide d'un serveur qui n'a rien compris
                requete = f"[out:json][timeout:180];\n({selection})->.t;\n{corps}\n.t out count;"
                donnees = envoyer(requete, f"{sous} {n + 1}/{len(lots)}")
                compte = [e for e in donnees["elements"] if e["type"] == "count"]
                # Un serveur en retard (données de quelques mois) ignore les terrains récents :
                # acceptable pour un test, mais au-delà de 10 % de manquants on arrête.
                trouves = int(compte[0]["tags"]["total"]) if compte else 0
                date_osm = donnees.get("osm3s", {}).get("timestamp_osm_base", "?")[:10]
                if trouves < 0.9 * len(lot):
                    raise RuntimeError(f"{sous} {n + 1} : {trouves}/{len(lot)} terrains trouvés côté serveur")
                if trouves < len(lot):
                    print(f"    ! {len(lot) - trouves} terrains inconnus du serveur (données du {date_osm})")
                ecrire_cache(chemin, donnees)
                time.sleep(2)  # ménager le serveur
            for el in donnees["elements"]:
                if el["type"] != "count":
                    vus[(el["type"], el["id"])] = el
    print(f"  = {nom} : {len(vus)} objets", flush=True)
    return {"elements": list(vus.values())}


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
    """Liste de polylignes projetées d'un élément `out geom` (nœud = polyligne d'un point)."""
    if el["type"] == "node":
        return [[proj(el["lat"], el["lon"])]]
    if el["type"] == "way":
        return [[proj(p["lat"], p["lon"]) for p in el.get("geometry", []) if p]]
    lignes = []
    for m in el.get("members", []):
        if m["type"] == "way" and m.get("geometry") and m.get("role") != "inner":
            lignes.append([proj(p["lat"], p["lon"]) for p in m["geometry"] if p])
        elif m["type"] == "way" and m.get("geometry"):
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


def aire_m2(el):
    """Surface (extérieurs moins intérieurs) d'un polygone ou multipolygone."""
    def shoelace(r):
        return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:]))) / 2

    if el["type"] == "way":
        return shoelace(lignes_de(el)[0])
    ext = [[proj(p["lat"], p["lon"]) for p in m["geometry"] if p]
           for m in el.get("members", []) if m["type"] == "way" and m.get("geometry") and m.get("role") != "inner"]
    inn = [[proj(p["lat"], p["lon"]) for p in m["geometry"] if p]
           for m in el.get("members", []) if m["type"] == "way" and m.get("geometry") and m.get("role") == "inner"]
    return sum(shoelace(r) for r in assembler_anneaux(ext)) - sum(shoelace(r) for r in assembler_anneaux(inn))


class Index:
    """Grille de segments pour trouver vite les éléments proches d'un terrain."""

    TAILLE = 100.0

    def __init__(self):
        self.cases = defaultdict(list)
        self.elements = []

    def ajouter(self, el, info):
        i = len(self.elements)
        lignes = lignes_de(el)
        segs = segments_de(lignes)
        self.elements.append({"el": el, "info": info, "segs": segs, "surface": est_surface(el)})
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
                    if (i, s) in vus:
                        continue
                    vus.add((i, s))
                    if res.get(i) == 0:
                        continue
                    d = min(dist_segments(s, t) for t in terrain["segs"])
                    # Élément ponctuel posé dans le terrain : distance nulle
                    if s[0] == s[2] and s[1] == s[3] and terrain["surface"] and point_dans(s[0], s[1], terrain["segs"]):
                        d = 0.0
                    if d <= rayon and d < res.get(i, math.inf):
                        res[i] = d
        # Terrain posé dans une surface (plaine de jeux, parking, plan d'eau…) : distance nulle
        for i in list(res):
            e = self.elements[i]
            if e["surface"] and res[i] > 0 and point_dans(terrain["cx"], terrain["cy"], e["segs"]):
                res[i] = 0.0
        return res


# ---------------------------------------------------------------------------------------
# Critères
# ---------------------------------------------------------------------------------------

SEUILS_ROUTES = {"motorway": 200, "trunk": 200, "primary": 100, "secondary": 75, "tertiary": 50,
                 "residential": 20, "unclassified": 20}
ORDRE_ROUTES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified"]

RE_VOIE_VERTE = re.compile(r"ravel|halage|jaagpad|towpath|eurovelo|spoorweg|trage", re.I)


def acces_ok(tags):
    return tags.get("access") not in ("private", "customers", "no", "permit")


def classer_point(tags):
    """Critère d'un élément de la requête « points »."""
    if tags.get("amenity") == "bench" or tags.get("leisure") == "picnic_table":
        return "banc"
    if tags.get("highway") == "street_lamp":
        return "lampadaire"
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
    """Type d'eau, ou None si exclu. Pour natural=water sans sous-type : « sans_type »."""
    tags = el.get("tags", {})
    if tags.get("natural") == "water":
        w = tags.get("water")
        if w in ("basin", "wastewater", "reservoir_covered", "fountain", "reflecting_pool", "pool"):
            return None
        if w in (None, ""):
            return "plan_eau_sans_type"
        return {"lake": "lac", "pond": "etang", "river": "riviere", "canal": "canal", "oxbow": "etang",
                "reservoir": "reservoir", "lock": "canal", "stream": "ruisseau", "ditch": None,
                "moat": "douves"}.get(w, "autre_" + w)
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


def charger_terrains(donnees):
    props = {}
    with open(CHEMIN_GEOJSON, encoding="utf-8") as f:
        for ft in json.load(f)["features"]:
            props[ft["properties"]["osm_id"]] = ft["properties"]
    terrains = []
    for el in donnees["elements"]:
        osm_id = f"{el['type']}/{el['id']}"
        segs = segments_de(lignes_de(el))
        if not segs:
            continue
        xs = [c for s in segs for c in (s[0], s[2])]
        ys = [c for s in segs for c in (s[1], s[3])]
        surface = el["type"] != "node"
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        terrains.append({
            "id": osm_id, "tags": el.get("tags", {}), "segs": segs, "surface": surface,
            "bbox": (min(xs), min(ys), max(xs), max(ys)), "cx": cx, "cy": cy,
            "region": props.get(osm_id, {}).get("region") or "?",
        })
    return terrains


def main():
    sans_cache = "--sans-cache" in sys.argv
    print(f"Cache : {DOSSIER_CACHE}")
    donnees = {"terrains": interroger_terrains(sans_cache)}
    for nom in REQUETES:
        donnees[nom] = interroger_groupe(nom, donnees["terrains"], sans_cache)

    terrains = charger_terrains(donnees["terrains"])
    print(f"\n{len(terrains)} terrains ({sum(not t['surface'] for t in terrains)} simples points)\n")

    # Index par critère
    idx = defaultdict(Index)
    for el in donnees["points"]["elements"]:
        c = classer_point(el.get("tags", {}))
        if c:
            idx[c].ajouter(el, {})
    for el in donnees["routes"]["elements"]:
        tags = el.get("tags", {})
        if tags.get("tunnel") in ("yes", "building_passage", "culvert") or tags.get("covered") == "yes":
            continue
        classe = tags["highway"].replace("_link", "")
        idx["route_" + classe].ajouter(el, {})
    for el in donnees["eau"]["elements"]:
        t = classer_eau(el)
        if t:
            info = {"type": t}
            if t == "plan_eau_sans_type" or t in ("etang", "lac"):
                info["ha"] = aire_m2(el) / 1e4 if est_surface(el) else 0
            idx["eau"].ajouter(el, info)

    # Voies vertes : appartenance des chemins aux itinéraires vélo
    rels_de_way = defaultdict(list)
    for el in donnees["velo"]["elements"]:
        if el["type"] == "relation":
            for m in el.get("members", []):
                if m["type"] == "way":
                    rels_de_way[m["ref"]].append(el.get("tags", {}))
    for el in donnees["velo"]["elements"]:
        if el["type"] != "way":
            continue
        tags = el.get("tags", {})
        rels = rels_de_way.get(el["id"], [])
        info = {
            "cycleway": tags.get("highway") == "cycleway",
            "itineraire": bool(rels),
            "national": any(r.get("network") in ("icn", "ncn") for r in rels),
            "nom": bool(RE_VOIE_VERTE.search(" ".join([tags.get("name", "")] + [r.get("name", "") for r in rels]))),
        }
        idx["velo"].ajouter(el, info)

    # Zones nature (test local : centre du terrain dans la zone)
    zones = []
    for el in donnees["nature"]["elements"]:
        t = type_nature(el.get("tags", {}))
        if t and est_surface(el):
            segs = segments_de(lignes_de(el))
            xs = [c for s in segs for c in (s[0], s[2])]
            ys = [c for s in segs for c in (s[1], s[3])]
            zones.append({"type": t, "ha": aire_m2(el) / 1e4, "segs": segs,
                          "bbox": (min(xs), min(ys), max(xs), max(ys))})

    # Mesures par terrain
    lignes_csv = []
    res = {}
    for t in terrains:
        r = {}
        for c, rayon in (("banc", 30), ("lampadaire", 30), ("jeux", 300), ("wc", 400), ("eau_potable", 400),
                         ("parking", 600), ("arret", 600)):
            d = idx[c].proches(t, rayon)
            r[c] = min(d.values()) if d else None
        # Routes : distance minimale par classe
        routes = {}
        for classe in ORDRE_ROUTES:
            d = idx["route_" + classe].proches(t, 2 * SEUILS_ROUTES[classe])
            if d:
                routes[classe] = min(d.values())
        r["routes"] = routes
        # Eau : distance et type de l'élément le plus proche, par type
        eau = {}
        for i, d in idx["eau"].proches(t, 200).items():
            info = idx["eau"].elements[i]["info"]
            cle = info["type"]
            if cle in ("plan_eau_sans_type", "etang", "lac"):
                ha = info.get("ha", 0)
                cle += "_grand" if ha >= 0.5 else "_petit"
            if d < eau.get(cle, math.inf):
                eau[cle] = d
        r["eau"] = eau
        # Vélo : distance par variante
        velo = {}
        for i, d in idx["velo"].proches(t, 400).items():
            info = idx["velo"].elements[i]["info"]
            variantes = []
            if info["cycleway"]:
                variantes.append("V1_piste_cyclable")
            if info["itineraire"]:
                variantes.append("V2_chemin_sur_itineraire")
            if info["national"] or info["nom"]:
                variantes.append("V3_national_ou_ravel")
            for v in variantes:
                velo[v] = min(d, velo.get(v, math.inf))
        r["velo"] = velo
        # Nature
        nat = [z for z in zones
               if z["bbox"][0] <= t["cx"] <= z["bbox"][2] and z["bbox"][1] <= t["cy"] <= z["bbox"][3]
               and point_dans(t["cx"], t["cy"], z["segs"])]
        r["nature"] = nat
        # Tags du terrain
        tg = t["tags"]
        r["lit"] = tg.get("lit")
        r["abrite"] = (tg.get("covered") in ("yes", "partial") or tg.get("indoor") == "yes"
                       or tg.get("building") in ("yes", "roof", "public", "sports_hall", "sports_centre"))
        res[t["id"]] = r

        lignes_csv.append({
            "osm_id": t["id"], "region": t["region"], "point": int(not t["surface"]),
            "banc": fmt(r["banc"]), "lampadaire": fmt(r["lampadaire"]), "jeux": fmt(r["jeux"]),
            "wc": fmt(r["wc"]), "eau_potable": fmt(r["eau_potable"]), "parking": fmt(r["parking"]),
            "arret": fmt(r["arret"]),
            "routes": " ".join(f"{k}:{v:.0f}" for k, v in routes.items()),
            "eau": " ".join(f"{k}:{v:.0f}" for k, v in eau.items()),
            "velo": " ".join(f"{k}:{v:.0f}" for k, v in velo.items()),
            "nature": " ".join(f"{z['type']}:{z['ha']:.1f}ha" for z in nat),
            "lit": r["lit"] or "", "abrite": int(r["abrite"]),
            "osm": f"https://www.openstreetmap.org/{t['id']}",
        })

    chemin_csv = os.path.join(DOSSIER_CACHE, "resultats_par_terrain.csv")
    with open(chemin_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(lignes_csv[0]))
        w.writeheader()
        w.writerows(lignes_csv)

    afficher(terrains, res)
    print(f"\nDétail par terrain : {chemin_csv}")


def fmt(d):
    return "" if d is None else f"{d:.0f}"


# ---------------------------------------------------------------------------------------
# Affichage
# ---------------------------------------------------------------------------------------

REGIONS = ["flandre", "wallonie", "bruxelles"]


def ligne(titre, terrains, test):
    total = len(terrains)
    n = sum(1 for t in terrains if test(t))
    par_region = []
    for reg in REGIONS:
        tr = [t for t in terrains if t["region"] == reg]
        m = sum(1 for t in tr if test(t))
        par_region.append(f"{m / len(tr) * 100:5.1f} %")
    print(f"  {titre:<42} {n:5d}  {n / total * 100:5.1f} %   " + "  ".join(par_region))


def entete(titre):
    print(f"\n{titre}")
    print(f"  {'':<42} {'nb':>5}  {'total':>7}   " + "  ".join(f"{r[:7]:>7}" for r in REGIONS))


def afficher(terrains, res):
    def dist(c, s):
        return lambda t: res[t["id"]][c] is not None and res[t["id"]][c] <= s

    entete("SUR PLACE")
    for s in (10, 15, 20):
        ligne(f"Bancs à {s} m", terrains, dist("banc", s))
    ligne("  dont terrains-points (bancs à 10 m)", [t for t in terrains if not t["surface"]], dist("banc", 10))
    ligne("Éclairé (lit=yes)", terrains, lambda t: res[t["id"]]["lit"] == "yes")
    ligne("  lit=no explicite", terrains, lambda t: res[t["id"]]["lit"] == "no")
    ligne("  lit=yes ou lampadaire à 15 m", terrains,
          lambda t: res[t["id"]]["lit"] == "yes" or (res[t["id"]]["lampadaire"] or 99) <= 15)
    ligne("Abrité (covered, indoor, building)", terrains, lambda t: res[t["id"]]["abrite"])

    for nom, test in (
        ("Nature : dans une zone (tous types)", lambda z: True),
        ("  parc (tous)", lambda z: z["type"] == "parc"),
        ("  parc ≥ 1 ha", lambda z: z["type"] == "parc" and z["ha"] >= 1),
        ("  bois / forêt", lambda z: z["type"] == "bois"),
        ("  réserve naturelle", lambda z: z["type"] == "reserve"),
        ("  zone de loisirs (recreation_ground)", lambda z: z["type"] == "loisirs"),
        ("  proposition : parc ≥ 1 ha, bois ou réserve",
         lambda z: z["type"] in ("bois", "reserve") or (z["type"] == "parc" and z["ha"] >= 1)),
    ):
        ligne(nom, terrains, lambda t, test=test: any(test(z) for z in res[t["id"]]["nature"]))

    def calme(facteur):
        def test(t):
            rt = res[t["id"]]["routes"]
            return all(rt.get(c, math.inf) >= SEUILS_ROUTES[c] * facteur for c in SEUILS_ROUTES)
        return test

    ligne("Au calme (seuils du mémo)", terrains, calme(1))
    ligne("Au calme (seuils × 1,5)", terrains, calme(1.5))
    ligne("Au calme (seuils × 0,5)", terrains, calme(0.5))

    def eau(types, s):
        return lambda t: any(d <= s for k, d in res[t["id"]]["eau"].items() if k in types)

    base = {"riviere", "canal", "lac_grand", "lac_petit", "etang_grand", "mer", "plage", "reservoir",
            "plan_eau_sans_type_grand"}
    for s in (50, 100):
        ligne(f"Au bord de l'eau à {s} m (proposition)", terrains, eau(base, s))
    ligne("  + petits étangs / plans d'eau < 0,5 ha", terrains,
          eau(base | {"etang_petit", "plan_eau_sans_type_petit"}, 100))
    ligne("  + ruisseaux (pour mémoire)", terrains, eau(base | {"ruisseau"}, 100))
    for k in ("riviere", "canal", "etang_grand", "lac_grand", "plan_eau_sans_type_grand", "mer"):
        ligne(f"    {k} à 100 m", terrains, eau({k}, 100))

    entete("À PROXIMITÉ")
    for c, seuils in (("jeux", (50, 100, 200)), ("wc", (200, 400)), ("eau_potable", (200, 400)),
                      ("parking", (100, 300, 600)), ("arret", (150, 300, 600))):
        for s in seuils:
            ligne(f"{c} à {s} m", terrains, dist(c, s))

    for v in ("V1_piste_cyclable", "V2_chemin_sur_itineraire", "V3_national_ou_ravel"):
        for s in (200, 400):
            ligne(f"Voie verte {v} à {s} m", terrains,
                  lambda t, v=v, s=s: res[t["id"]]["velo"].get(v, math.inf) <= s)

    # Au calme : type de route le plus contraignant
    print("\nAU CALME : route qui fait échouer le critère (la plus importante en cause)")
    compte = Counter()
    for t in terrains:
        rt = res[t["id"]]["routes"]
        cause = next((c for c in ORDRE_ROUTES if rt.get(c, math.inf) < SEUILS_ROUTES[c]), "aucune (au calme)")
        compte[cause] += 1
    for c, n in compte.most_common():
        print(f"  {c:<22} {n:5d}  {n / len(terrains) * 100:5.1f} %")

    # Répartition des distances pour les critères avec distance
    print("\nDISTANCES (terrains où l'élément est trouvé) : médiane et quartiles, en m")
    for c in ("banc", "jeux", "wc", "eau_potable", "parking", "arret"):
        ds = sorted(res[t["id"]][c] for t in terrains if res[t["id"]][c] is not None)
        if ds:
            q = lambda p: ds[int(p * (len(ds) - 1))]
            print(f"  {c:<12} {len(ds):5d} trouvés   q1 {q(.25):4.0f}   médiane {q(.5):4.0f}   q3 {q(.75):4.0f}")


if __name__ == "__main__":
    main()
