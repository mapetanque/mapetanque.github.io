import requests
import json
import time
import sys
import os
import unicodedata
import urllib.parse

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
]

QUERY = """
[out:json][timeout:300];

area["ISO3166-1"="BE"]["admin_level"="2"]->.belgique;

(
  nwr["leisure"="pitch"]["sport"="boules"](area.belgique);
  nwr["leisure"="pitch"]["sport"="petanque"](area.belgique);
);

out center tags;
"""

# En-tête obligatoire pour Nominatim : doit identifier clairement l'application
NOMINATIM_HEADERS = {
    "User-Agent": "Mapetanque/1.0 (contact: mapetanque@outlook.be)"
}


# Seuil d'alerte : si le nombre de terrains chute de plus de X% par rapport à la
# version précédente, on considère que les données sont probablement incomplètes
# (ex. mirror Overpass en retard de réplication) et on refuse d'écraser le fichier.
SEUIL_BAISSE_MAX = 0.05  # 5%

CHEMIN_GEOJSON = "data/terrains.geojson"
CHEMIN_STATS_GEO = "data/stats_geo.json"


# Régions et provinces belges : on identifie chaque terrain par une clé canonique STABLE
# (ex. "wallonie", "hainaut"), indépendante de la langue retournée par Nominatim (qui varie
# selon la zone : français en Wallonie, néerlandais en Flandre, les deux à Bruxelles).
# Ces clés sont ensuite traduites côté site via translations.js (voir geo_region_*/geo_province_*).
#
# Source privilégiée : les codes ISO 3166-2 renvoyés par Nominatim quand ils sont disponibles
# (fiables, non ambigus). Repli sur la reconnaissance du nom textuel (FR ou NL) si absents pour
# ce point précis.
REGIONS_BE = {
    "BE-WAL": "wallonie",
    "BE-VLG": "flandre",
    "BE-BRU": "bruxelles",
}

PROVINCES_BE = {
    "BE-WBR": "brabant_wallon",
    "BE-WHT": "hainaut",
    "BE-WLG": "liege",
    "BE-WLX": "luxembourg",
    "BE-WNA": "namur",
    "BE-VAN": "anvers",
    "BE-VBR": "brabant_flamand",
    "BE-VLI": "limbourg",
    "BE-VOV": "flandre_orientale",
    "BE-VWV": "flandre_occidentale",
}

NOMS_REGIONS_REPLI = {
    "region wallonne": "wallonie",
    "wallonie": "wallonie",
    "vlaams gewest": "flandre",
    "vlaanderen": "flandre",
    "region de bruxelles-capitale": "bruxelles",
    "brussels hoofdstedelijk gewest": "bruxelles",
    "bruxelles": "bruxelles",
    "brussel": "bruxelles",
}

NOMS_PROVINCES_REPLI = {
    "brabant wallon": "brabant_wallon",
    "hainaut": "hainaut",
    "liege": "liege",
    "luxembourg": "luxembourg",
    "namur": "namur",
    "anvers": "anvers",
    "antwerpen": "anvers",
    "vlaams-brabant": "brabant_flamand",
    "brabant flamand": "brabant_flamand",
    "limbourg": "limbourg",
    "limburg": "limbourg",
    "flandre-orientale": "flandre_orientale",
    "oost-vlaanderen": "flandre_orientale",
    "flandre-occidentale": "flandre_occidentale",
    "west-vlaanderen": "flandre_occidentale",
}


def normaliser(texte):
    """Minuscules + accents retirés, pour matcher les noms de repli quels que soient la casse/les accents."""
    if not texte:
        return ""
    sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode("ascii")
    return sans_accents.lower().strip()




def recuperer_infos_adresse(lat, lon):
    """
    Interroge Nominatim (géocodage inversé) et retourne un dictionnaire avec :
    - rue : nom de rue/lieu le plus proche (comme avant)
    - commune : nom de la commune tel que retourné par Nominatim
    - province : clé canonique de la province (ex. "hainaut"), ou None (cas de Bruxelles,
      qui n'a pas de province)
    - region : clé canonique de la région (ex. "wallonie")
    Chaque champ vaut None en cas d'échec ou d'absence de donnée exploitable.
    """
    resultat = {"rue": None, "commune": None, "province": None, "region": None}

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "format": "jsonv2",
                "lat": lat,
                "lon": lon,
                "zoom": 17,
                "addressdetails": 1
            },
            headers=NOMINATIM_HEADERS,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        adresse = data.get("address", {})

        resultat["rue"] = (
            adresse.get("road")
            or adresse.get("pedestrian")
            or adresse.get("footway")
            or adresse.get("path")
            or adresse.get("square")
            or adresse.get("residential")
            or adresse.get("neighbourhood")
            or adresse.get("suburb")
            or adresse.get("hamlet")
        )

        resultat["commune"] = (
            adresse.get("city")
            or adresse.get("town")
            or adresse.get("village")
            or adresse.get("municipality")
        )

        # Région et province : priorité au code ISO 3166-2 (fiable, indépendant de la langue),
        # repli sur le nom textuel (FR ou NL) si Nominatim ne fournit pas ce code pour ce point.
        code_region = adresse.get("ISO3166-2-lvl4")
        resultat["region"] = (
            REGIONS_BE.get(code_region)
            or NOMS_REGIONS_REPLI.get(normaliser(adresse.get("state")))
        )

        code_province = adresse.get("ISO3166-2-lvl6")
        resultat["province"] = (
            PROVINCES_BE.get(code_province)
            or NOMS_PROVINCES_REPLI.get(normaliser(adresse.get("state_district")))
        )

    except Exception as e:
        print(f"    ⚠ Erreur géocodage ({lat:.5f}, {lon:.5f}) : {e}")

    return resultat


# Token optionnel pour résoudre les tags mapillary=<id> en URL de vignette via l'API Mapillary.
# Si absent (secret non configuré côté GitHub Actions), ces tags sont simplement ignorés plutôt
# que de faire échouer tout le script — image= et wikimedia_commons= continuent de fonctionner
# sans aucune clé, dans tous les cas.
MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")


def resoudre_wikimedia_commons(valeur):
    """
    Convertit un tag wikimedia_commons=File:XXX.jpg en URL d'image directement affichable,
    via le mécanisme Special:FilePath de Wikimedia Commons (ne nécessite aucune clé d'API).
    Retourne aussi l'URL de la page du fichier sur Commons (auteur/licence exacte), pour créditer
    correctement la source plutôt que d'afficher juste l'image sans attribution.
    """
    nom_fichier = valeur.split(":", 1)[-1]  # retire un éventuel préfixe "File:"/"Fichier:"
    url_image = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(nom_fichier)}?width=800"
    url_credit = f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(valeur)}"
    return url_image, url_credit


def resoudre_mapillary(image_id):
    """
    Résout un tag mapillary=<id> (photo choisie manuellement par un mappeur, pas une recherche
    de proximité) en URL de vignette, via l'API Mapillary. Le lien de crédit pointe vers la page
    d'accueil Mapillary : leurs conditions d'utilisation exigent d'attribuer visiblement la source
    dès que leurs données/images sont affichées.
    """
    if not MAPILLARY_TOKEN:
        return None
    try:
        response = requests.get(
            f"https://graph.mapillary.com/{image_id}",
            params={"access_token": MAPILLARY_TOKEN, "fields": "thumb_1024_url"},
            timeout=10
        )
        response.raise_for_status()
        return response.json().get("thumb_1024_url")
    except Exception as e:
        print(f"    ⚠ Erreur résolution photo Mapillary (id {image_id}) : {e}")
        return None


def resoudre_photo(tags):
    """
    Détermine la photo à afficher pour un terrain, par ordre de priorité :
    1. image=<url>                    — déjà une URL directe, utilisable telle quelle
    2. wikimedia_commons=File:XXX.jpg — convertie via Special:FilePath
    3. mapillary=<id>                 — résolue via l'API Mapillary (nécessite MAPILLARY_TOKEN)
    Retourne (url, source, url_credit) où source vaut "image"/"wikimedia_commons"/"mapillary",
    et url_credit est le lien vers la source à créditer (None pour "image", aucune page de
    référence connue dans ce cas). Retourne (None, None, None) si aucune photo n'est disponible.
    """
    if tags.get("image"):
        return tags["image"], "image", None

    if tags.get("wikimedia_commons"):
        url_image, url_credit = resoudre_wikimedia_commons(tags["wikimedia_commons"])
        return url_image, "wikimedia_commons", url_credit

    if tags.get("mapillary"):
        url = resoudre_mapillary(tags["mapillary"])
        if url:
            return url, "mapillary", "https://www.mapillary.com/"

    return None, None, None


print("Interrogation d'OpenStreetMap en cours...")

osm_data = None

for server in OVERPASS_SERVERS:
    try:
        print(f"→ Tentative avec {server}")

        response = requests.get(
            server,
            params={"data": QUERY},
            headers={
                "User-Agent": "Mapetanque/1.0"
            },
            timeout=300
        )

        response.raise_for_status()

        osm_data = response.json()

        print(f"✓ Réponse reçue depuis {server}")
        break

    except Exception as e:
        print(f"✗ Échec avec {server} : {type(e).__name__} - {e}")
        if 'response' in locals():
            print(response.text[:500])

else:
    raise Exception("Tous les serveurs Overpass ont échoué")

print(f"{len(osm_data['elements'])} objets reçus depuis OSM")

features = []
total = len(osm_data["elements"])

for index, element in enumerate(osm_data["elements"], start=1):

    # Coordonnées des points
    if element["type"] == "node":
        lat = element["lat"]
        lon = element["lon"]

    # Coordonnées des polygones convertis en centre
    elif "center" in element:
        lat = element["center"]["lat"]
        lon = element["center"]["lon"]

    else:
        continue

    print(f"[{index}/{total}] Recherche des informations d'adresse...")

    infos_adresse = recuperer_infos_adresse(lat, lon)

    # Respect de la limite Nominatim : max. 1 requête par seconde
    time.sleep(1)

    proprietes = dict(element.get("tags", {}))
    proprietes["nearest_street"] = infos_adresse["rue"]
    proprietes["commune"] = infos_adresse["commune"]
    proprietes["province"] = infos_adresse["province"]
    proprietes["region"] = infos_adresse["region"]

    photo_url, photo_source, photo_credit_url = resoudre_photo(element.get("tags", {}))
    if photo_url:
        proprietes["photo_url"] = photo_url
        proprietes["photo_source"] = photo_source
        if photo_credit_url:
            proprietes["photo_credit_url"] = photo_credit_url

    features.append({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]
        },
        "properties": proprietes
    })


def calculer_statistiques_geo(features):
    """
    Agrège le nombre de terrains par région > province > commune, à partir des propriétés
    déjà résolues pour chaque terrain (voir recuperer_infos_adresse). Structure imbriquée,
    directement exploitable par le front-end pour construire l'entonnoir région → province
    → commune de la page statistiques.

    Cas particulier de Bruxelles : pas de province, les communes apparaissent directement
    sous la région (clé "communes" de la région elle-même).
    """
    regions = {}

    for feature in features:
        proprietes = feature["properties"]
        cle_region = proprietes.get("region")
        cle_province = proprietes.get("province")
        nom_commune = proprietes.get("commune")

        if cle_region is None:
            continue

        region = regions.setdefault(cle_region, {"total": 0, "provinces": {}, "communes": {}})
        region["total"] += 1

        if cle_province is not None:
            province = region["provinces"].setdefault(cle_province, {"total": 0, "communes": {}})
            province["total"] += 1
            if nom_commune:
                province["communes"][nom_commune] = province["communes"].get(nom_commune, 0) + 1
        elif nom_commune:
            region["communes"][nom_commune] = region["communes"].get(nom_commune, 0) + 1

    return regions


def compter_terrains_precedents(chemin):
    """
    Lit le nombre de terrains présents dans la version actuelle du fichier,
    pour pouvoir comparer avec la nouvelle collecte. Retourne None si le
    fichier n'existe pas encore (premier lancement).
    """
    if not os.path.exists(chemin):
        return None

    try:
        with open(chemin, "r", encoding="utf-8") as f:
            ancien_geojson = json.load(f)
        return len(ancien_geojson.get("features", []))
    except Exception as e:
        print(f"⚠ Impossible de lire l'ancien fichier ({e}), vérification ignorée.")
        return None


geojson = {
    "type": "FeatureCollection",
    "features": features
}

nombre_precedent = compter_terrains_precedents(CHEMIN_GEOJSON)
nombre_actuel = len(features)

if nombre_precedent is not None:

    difference = nombre_actuel - nombre_precedent
    variation_pct = (difference / nombre_precedent * 100) if nombre_precedent > 0 else 0

    print(f"Comparaison : {nombre_precedent} terrains précédemment → {nombre_actuel} terrains cette fois "
          f"({variation_pct:+.1f} %)")

    baisse = -difference / nombre_precedent if nombre_precedent > 0 else 0

    if baisse > SEUIL_BAISSE_MAX:
        print(
            f"🛑 ALERTE : baisse de {baisse * 100:.1f}% par rapport à la version précédente "
            f"(seuil autorisé : {SEUIL_BAISSE_MAX * 100:.0f}%)."
        )
        print(
            "Cette baisse anormale suggère des données incomplètes "
            "(ex. mirror Overpass en retard de réplication) plutôt qu'une vraie disparition de terrains."
        )
        print("→ Le fichier n'a PAS été mis à jour, pour éviter de publier des données incomplètes.")
        sys.exit(1)


with open(CHEMIN_GEOJSON, "w", encoding="utf-8") as f:
    json.dump(
        geojson,
        f,
        ensure_ascii=False,
        indent=2
    )

statistiques_geo = calculer_statistiques_geo(features)

with open(CHEMIN_STATS_GEO, "w", encoding="utf-8") as f:
    json.dump(
        statistiques_geo,
        f,
        ensure_ascii=False,
        indent=2
    )

# Diagnostic : signale si une proportion anormale de terrains n'a pas pu être rattachée à une
# région (repli name-matching manquant, ou réponse Nominatim incomplète pour ce point). Ne bloque
# pas la mise à jour (contrairement au garde-fou sur le nombre total de terrains), car c'est un
# problème d'attribution géographique, pas de disparition de données.
sans_region = sum(1 for f in features if f["properties"].get("region") is None)
if sans_region > 0:
    part_sans_region = sans_region / len(features) * 100
    print(
        f"⚠ {sans_region} terrain(s) sur {len(features)} n'ont pas pu être rattachés à une région "
        f"({part_sans_region:.1f}%). Vérifier NOMS_REGIONS_REPLI/NOMS_PROVINCES_REPLI si ce nombre "
        f"est élevé : Nominatim a peut-être renvoyé un nom inattendu."
    )


print(f"✓ {len(features)} terrains mis à jour")