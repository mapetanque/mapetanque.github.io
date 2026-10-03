"""
Communes officielles : rattachement d'un point (terrain, club) à sa commune, sans réseau, et ce
que les pages commune et les listes des pages province en tirent ensemble (lieux, noms).

S'appuie sur data/communes_belgique.json (limites OSM des 565 communes, voir
telecharger_communes.py). Le champ « commune » des terrains, tiré de Nominatim, reste la
localité (village, ancienne commune) ; la commune officielle sert aux pages commune et aux
listes des pages province.

    from communes_officielles import Communes
    communes = Communes()
    commune = communes.du_point(lon, lat)   # dict de communes_belgique.json, ou None
"""

import collections
import json
import math
import os
import re
import unicodedata

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHEMIN_COMMUNES = os.path.join(RACINE, "data", "communes_belgique.json")

LANGUES = ("fr", "nl", "de", "en")

# Une commune a sa page à partir de ce nombre de lieux ; en dessous, elle renvoie vers la carte.
MIN_LIEUX = 2

# Noms affichés : le nom local, comme partout sur le site (et sur les panneaux), sauf pour ces
# villes dont le nom traduit est d'usage courant. OSM en donne bien d'autres (Calmpthout,
# Bonheyden, Bing…), trop vieillis pour que quiconque les cherche.
EXONYMES = {
    "Antwerpen": {"fr": "Anvers", "en": "Antwerp"},
    "Gent": {"fr": "Gand", "en": "Ghent"},
    "Brugge": {"fr": "Bruges", "de": "Brügge", "en": "Bruges"},
    "Leuven": {"fr": "Louvain", "de": "Löwen"},
    "Mechelen": {"fr": "Malines", "de": "Mecheln"},
    "Oostende": {"fr": "Ostende", "de": "Ostende", "en": "Ostend"},
    "Kortrijk": {"fr": "Courtrai"},
    "Ieper": {"fr": "Ypres", "de": "Ypern", "en": "Ypres"},
    "Liège": {"nl": "Luik", "de": "Lüttich"},
    "Namur": {"nl": "Namen"},
    "Mons": {"nl": "Bergen"},
    "Tournai": {"nl": "Doornik"},
    "Bruxelles - Brussel": {"de": "Brüssel", "en": "Brussels"},
}


def slug(texte):
    """« Écaussinnes » -> « ecaussinnes », « Sint-Pieters-Leeuw » -> « sint-pieters-leeuw »."""
    return re.sub(r"[^a-z0-9]+", "-", sans_accents(texte).lower()).strip("-")


def sans_accents(texte):
    return unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode()


def distance_m(lon1, lat1, lon2, lat2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def regrouper_lieux(terrains, groupes):
    """Un lieu par groupe de data/groupes_terrains.json (pistes voisines, comme sur la carte),
    un par terrain isolé. terrains : propriétés des terrains, avec osm_id."""
    groupe_de = {osm_id: i for i, groupe in enumerate(groupes) for osm_id in groupe}
    lieux = collections.defaultdict(list)
    for t in terrains:
        lieux[groupe_de.get(t["osm_id"], t["osm_id"])].append(t)
    return list(lieux.values())


def _dans_anneau(x, y, anneau):
    """Parité : le point coupe-t-il le contour un nombre impair de fois à sa droite ?"""
    dedans = False
    x1, y1 = anneau[-1]
    for x2, y2 in anneau:
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            dedans = not dedans
        x1, y1 = x2, y2
    return dedans


class Communes:
    def __init__(self, chemin=CHEMIN_COMMUNES):
        with open(chemin, encoding="utf-8") as f:
            self.liste = json.load(f)
        for c in self.liste:
            # Bruxelles : nom officiel bilingue (« Ixelles - Elsene ») ; l'adresse de la page part
            # du nom français (/commune/ixelles.html). Ailleurs, du nom local.
            c["slug"] = slug(c["noms"].get("fr", c["nom"]) if c["region"] == "bruxelles" else c["nom"])
        self.par_ins = {c["ins"]: c for c in self.liste}

    def du_point(self, lon, lat):
        for c in self.liste:
            xmin, ymin, xmax, ymax = c["emprise"]
            if not (xmin <= lon <= xmax and ymin <= lat <= ymax):
                continue
            # Trous et contours extérieurs ensemble : la parité totale tranche (un point dans un
            # trou est dans deux anneaux, donc dehors).
            if sum(_dans_anneau(lon, lat, a) for a in c["anneaux"]) % 2:
                return c
        return None

    def nom(self, commune, langue):
        """Nom affiché dans une langue : nom local, sauf EXONYMES ; à Bruxelles, la partie
        française du nom en FR et EN, néerlandaise en NL et DE (même règle que
        window.nomCommuneAffiche dans script.js)."""
        traduits = EXONYMES.get(commune["nom"], {})
        if langue in traduits:
            return traduits[langue]
        parties = commune["nom"].split(" - ")
        if len(parties) == 2:
            return parties[0] if langue in ("fr", "en") else parties[1]
        return commune["nom"]

    def noms_recherche(self, commune):
        """Tous les noms sous lesquels on peut chercher la commune, sans accents, en minuscules."""
        noms = {commune["nom"], *commune["nom"].split(" - ")}
        noms |= {self.nom(commune, langue) for langue in LANGUES}
        return " | ".join(sorted(sans_accents(n).lower() for n in noms))

    def centre(self, commune):
        """Centre du plus grand contour (formule du polygone), pour les distances."""
        anneau = max(commune["anneaux"], key=len)
        a = cx = cy = 0.0
        for (x1, y1), (x2, y2) in zip(anneau, anneau[1:]):
            f = x1 * y2 - x2 * y1
            a += f
            cx += (x1 + x2) * f
            cy += (y1 + y2) * f
        if a == 0:
            return tuple(anneau[0])
        return cx / (3 * a), cy / (3 * a)

    def rattacher_terrains(self, features):
        """{ins: [propriétés + lon/lat]} des terrains d'un terrains.geojson, et la liste des
        terrains tombés hors de toute commune (en mer, au ras d'une frontière)."""
        par_commune = collections.defaultdict(list)
        hors = []
        for f in features:
            lon, lat = f["geometry"]["coordinates"]
            p = dict(f["properties"], lon=lon, lat=lat)
            commune = self.du_point(lon, lat)
            if commune:
                par_commune[commune["ins"]].append(p)
            else:
                hors.append(p)
        return par_commune, hors

    def rattacher_clubs(self, clubs):
        par_commune = collections.defaultdict(list)
        for club in clubs:
            commune = self.du_point(club["lon"], club["lat"])
            if commune:
                par_commune[commune["ins"]].append(club)
        return par_commune
