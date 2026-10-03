"""
Limites des communes officielles de Belgique -> data/communes_belgique.json

Le champ « commune » des terrains vient de Nominatim, qui donne d'abord le village ou l'ancienne
commune (Retinne, Vaux-sous-Chèvremont…) avant la commune officielle. Pour les pages commune, on
rattache plutôt chaque terrain à l'une des 565 communes officielles (fusions de 2025 comprises),
d'après leurs limites dans OpenStreetMap (relations boundary=administrative, admin_level=8).

Les limites changent rarement : ce script se lance à la main, une fois, puis après une fusion de
communes. Le rattachement lui-même (sans réseau) est dans communes_officielles.py.

Sortie : liste de communes, chacune avec son code INS, ses noms, sa province, sa région, son
emprise et ses anneaux (contours extérieurs et trous mélangés : le test d'appartenance par parité
n'a pas besoin de les distinguer). Les contours sont simplifiés à une dizaine de mètres près.

Usage :
    python scripts/telecharger_communes.py
"""

import json
import os
import time
import urllib.parse
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHEMIN_SORTIE = os.path.join(RACINE, "data", "communes_belgique.json")

SERVEURS_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

REQUETE = """
[out:json][timeout:600];
area["ISO3166-1"="BE"][admin_level=2]->.be;
rel(area.be)["boundary"="administrative"]["admin_level"="8"];
out geom;
"""

# Tolérance de simplification, en degrés (~ 7 à 11 m en Belgique) : bien en deçà de la
# précision utile pour savoir dans quelle commune tombe un terrain.
TOLERANCE = 0.0001

# Province d'après le début du code INS (mêmes clés que les terrains). Bruxelles n'a pas de
# province : None, comme dans terrains.geojson.
PREFIXES_INS = [
    ("21", None, "bruxelles"),
    ("23", "brabant_flamand", "flandre"),
    ("24", "brabant_flamand", "flandre"),
    ("25", "brabant_wallon", "wallonie"),
    ("1", "anvers", "flandre"),
    ("3", "flandre_occidentale", "flandre"),
    ("4", "flandre_orientale", "flandre"),
    ("5", "hainaut", "wallonie"),
    ("6", "liege", "wallonie"),
    ("7", "limbourg", "flandre"),
    ("8", "luxembourg", "wallonie"),
    ("9", "namur", "wallonie"),
]


def interroger_overpass():
    donnees = urllib.parse.urlencode({"data": REQUETE}).encode()
    for serveur in SERVEURS_OVERPASS:
        try:
            print(f"Overpass : {serveur} …")
            requete = urllib.request.Request(serveur, data=donnees, headers={"User-Agent": "mapetanque.be"})
            with urllib.request.urlopen(requete, timeout=700) as reponse:
                return json.load(reponse)["elements"]
        except Exception as erreur:
            print(f"  échec ({erreur}), serveur suivant")
            time.sleep(5)
    raise SystemExit("Aucun serveur Overpass n'a répondu.")


def assembler_anneaux(membres):
    """Relie bout à bout les chemins d'une relation en anneaux fermés."""
    morceaux = [
        [(p["lon"], p["lat"]) for p in m["geometry"]]
        for m in membres
        if m.get("type") == "way" and m.get("geometry") and m.get("role") in ("outer", "inner", "")
    ]
    anneaux = []
    while morceaux:
        anneau = morceaux.pop(0)
        while anneau[0] != anneau[-1]:
            for i, morceau in enumerate(morceaux):
                if morceau[0] == anneau[-1]:
                    anneau += morceau[1:]
                elif morceau[-1] == anneau[-1]:
                    anneau += morceau[::-1][1:]
                elif morceau[-1] == anneau[0]:
                    anneau = morceau[:-1] + anneau
                elif morceau[0] == anneau[0]:
                    anneau = morceau[::-1][:-1] + anneau
                else:
                    continue
                morceaux.pop(i)
                break
            else:
                break  # anneau ouvert (relation incomplète) : on le garde tel quel, fermé d'office
        if len(anneau) >= 4:
            anneaux.append(anneau)
    return anneaux


def simplifier(points, tolerance):
    """Douglas-Peucker, en itératif (pas de récursion profonde sur les longs contours)."""
    if len(points) < 3:
        return points
    garder = [False] * len(points)
    garder[0] = garder[-1] = True
    pile = [(0, len(points) - 1)]
    while pile:
        debut, fin = pile.pop()
        (x1, y1), (x2, y2) = points[debut], points[fin]
        dx, dy = x2 - x1, y2 - y1
        longueur2 = dx * dx + dy * dy
        pire, indice = 0.0, None
        for i in range(debut + 1, fin):
            x, y = points[i]
            if longueur2 == 0:
                d2 = (x - x1) ** 2 + (y - y1) ** 2
            else:
                t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / longueur2))
                d2 = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2
            if d2 > pire:
                pire, indice = d2, i
        if indice is not None and pire > tolerance * tolerance:
            garder[indice] = True
            pile += [(debut, indice), (indice, fin)]
    return [p for p, g in zip(points, garder) if g]


def province_et_region(ins):
    for prefixe, province, region in PREFIXES_INS:
        if ins.startswith(prefixe):
            return province, region
    return None, None


def main():
    elements = interroger_overpass()
    communes = []
    for rel in elements:
        tags = rel.get("tags", {})
        ins = tags.get("ref:INS", "")
        province, region = province_et_region(ins)
        if not region:
            print(f"  ignorée (code INS inconnu) : {tags.get('name')} {ins!r}")
            continue

        anneaux = []
        for anneau in assembler_anneaux(rel.get("members", [])):
            anneau = simplifier(anneau, TOLERANCE)
            if anneau[0] != anneau[-1]:
                anneau.append(anneau[0])
            anneaux.append([[round(x, 5), round(y, 5)] for x, y in anneau])
        if not anneaux:
            print(f"  ignorée (pas de contour) : {tags.get('name')}")
            continue

        tous = [p for a in anneaux for p in a]
        communes.append({
            "ins": ins,
            "nom": tags.get("name"),
            "noms": {l: tags[f"name:{l}"] for l in ("fr", "nl", "de", "en") if f"name:{l}" in tags},
            "province": province,
            "region": region,
            "emprise": [
                min(p[0] for p in tous), min(p[1] for p in tous),
                max(p[0] for p in tous), max(p[1] for p in tous),
            ],
            "anneaux": anneaux,
        })

    communes.sort(key=lambda c: c["ins"])
    with open(CHEMIN_SORTIE, "w", encoding="utf-8") as f:
        json.dump(communes, f, ensure_ascii=False, separators=(",", ":"))
    taille = os.path.getsize(CHEMIN_SORTIE) / 1e6
    print(f"{len(communes)} communes écrites dans {CHEMIN_SORTIE} ({taille:.1f} Mo)")


if __name__ == "__main__":
    main()
