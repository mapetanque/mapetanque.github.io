#!/usr/bin/env python3
"""
Génère une page HTML locale de revue des candidats photo Mapillary pour TOUS les terrains de
Belgique (pas de filtre commune), triés par commune décroissante (grandes villes en premier).

Reprenable : les résultats Mapillary sont mis en cache au fur et à mesure dans un fichier JSON
(cache_candidats.json) — si le script est interrompu puis relancé, il ne réinterroge pas les
terrains déjà traités.

Usage :
    pip install requests
    python3 generer_revue_photos.py

Pour ~1800 terrains à 1 requête chacun, prévoir un bon moment (le script affiche sa progression).
Peut être relancé plus tard pour rafraîchir la page HTML sans tout refaire si le cache existe déjà.
"""

import json
import math
import os
import socket
import time
from datetime import datetime, timezone

import requests
import urllib3.util.connection as urllib3_cn
from urllib3.util.connection import create_connection

# ===================== Forçage IPv4 =====================
# Certaines connexions (souvent une configuration IPv6 mal résolue chez le fournisseur d'accès ou
# la box) font que chaque requête tente d'abord IPv6, échoue silencieusement après ~15-20s, puis
# retombe sur IPv4 qui fonctionne — d'où un délai fixe et systématique à chaque appel, sans lien
# avec la vitesse réelle de la connexion ni avec Mapillary. On force IPv4 directement en patchant
# la fonction de résolution de connexion d'urllib3 (utilisée par toutes les requêtes du script,
# qu'elles passent par une Session ou par requests.get() directement).

def _creer_connexion_ipv4(address, *args, **kwargs):
    host, port = address
    infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    adresse_ipv4 = (infos[0][4][0], port)
    return create_connection(adresse_ipv4, *args, **kwargs)


urllib3_cn.create_connection = _creer_connexion_ipv4


# ===================== Configuration =====================

import os

MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN")
if not MAPILLARY_TOKEN:
    print("Erreur : variable d'environnement MAPILLARY_TOKEN manquante.")
    print('Définis-la avant de relancer : $env:MAPILLARY_TOKEN="ton_token_ici" (PowerShell)')
    exit(1)
RAYON_METRES = 50
LIMITE_PAR_TERRAIN = 100
DELAI_ENTRE_REQUETES = 0.3  # secondes, pour rester raisonnable vis-à-vis de l'API

# Pour un premier test rapide sur un petit échantillon avant de lancer les ~1800 terrains :
# mets un nombre ici (ex. 10). Remets None pour traiter tous les terrains.
LIMITE_TERRAINS = None

FICHIER_CACHE = "cache_candidats.json"
FICHIER_HTML = "revue_photos.html"

POIDS_DISTANCE = 0.4
POIDS_ANGLE = 0.4
POIDS_RECENCE = 0.2

# ===================== Géométrie (identique à proposer_photos_mapillary.py) =====================

def distance_metres(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def cap_vers(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def difference_angulaire(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def images_a_proximite(lat, lon):
    reponse = requests.get(
        "https://graph.mapillary.com/images",
        params={
            "access_token": MAPILLARY_TOKEN,
            "fields": "id,is_pano,captured_at,compass_angle,geometry,thumb_1024_url",
            "lat": lat,
            "lng": lon,
            "radius": RAYON_METRES,
            "limit": LIMITE_PAR_TERRAIN,
        },
        timeout=15,
    )
    reponse.raise_for_status()
    return reponse.json().get("data", [])


def meilleur_candidat(terrain_lat, terrain_lon, images):
    candidats_notes = []
    for img in images:
        if img.get("is_pano"):
            continue
        img_lon, img_lat = img["geometry"]["coordinates"]
        dist = distance_metres(terrain_lat, terrain_lon, img_lat, img_lon)
        cap_cible = cap_vers(img_lat, img_lon, terrain_lat, terrain_lon)
        angle_cam = img.get("compass_angle")
        ecart_angle = difference_angulaire(angle_cam, cap_cible) if angle_cam is not None else 180

        score_distance = min(dist / RAYON_METRES, 1)
        score_angle = ecart_angle / 180

        capture_ms = img.get("captured_at")
        if capture_ms:
            date_capture = datetime.fromtimestamp(capture_ms / 1000, tz=timezone.utc)
            age_annees = (datetime.now(timezone.utc) - date_capture).days / 365
            score_recence = min(max(age_annees / 5, 0), 1)
        else:
            score_recence = 1

        score = (
            POIDS_DISTANCE * score_distance
            + POIDS_ANGLE * score_angle
            + POIDS_RECENCE * score_recence
        )

        candidats_notes.append({
            "id": img["id"],
            "score": round(score, 3),
            "distance_m": round(dist, 1),
            "ecart_angle_deg": round(ecart_angle, 1),
            "captured_at": capture_ms,
            "thumbnail": img.get("thumb_1024_url"),
            "lien": f"https://www.mapillary.com/map/im/{img['id']}",
        })

    if not candidats_notes:
        return None
    return min(candidats_notes, key=lambda c: c["score"])


# ===================== Récupération + mise en cache =====================

def cle_terrain(feature):
    # osm_id (ex. "node/123456789") plutôt que les coordonnées : stable même si le terrain est
    # légèrement déplacé sur OSM par la suite (remesure, correction...) — contrairement aux
    # coordonnées, qui casseraient silencieusement la correspondance dans ce cas. Nécessite une
    # version de terrains.geojson générée avec le osm_id ajouté dans scripts/update_terrains.py.
    return feature["properties"].get("osm_id")


def charger_cache():
    if os.path.exists(FICHIER_CACHE):
        with open(FICHIER_CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def sauvegarder_cache(cache):
    with open(FICHIER_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def recuperer_tous_les_candidats():
    print("Récupération des terrains depuis mapetanque.be...")
    reponse = requests.get("https://mapetanque.be/data/terrains.geojson", timeout=30)
    reponse.raise_for_status()
    geojson = reponse.json()
    terrains = geojson["features"]
    print(f"{len(terrains)} terrain(s) au total.\n")

    # Comptage par commune, pour trier les grandes villes en premier
    comptage_commune = {}
    for f in terrains:
        commune = f["properties"].get("commune") or "Commune inconnue"
        comptage_commune[commune] = comptage_commune.get(commune, 0) + 1

    terrains.sort(key=lambda f: (
        -comptage_commune.get(f["properties"].get("commune") or "Commune inconnue", 0),
        f["properties"].get("commune") or "",
        f["properties"].get("nearest_street") or "",
    ))

    if LIMITE_TERRAINS:
        terrains = terrains[:LIMITE_TERRAINS]
        print(f"Mode test : limité aux {LIMITE_TERRAINS} premiers terrains (plus grandes communes).\n")

    cache = charger_cache()
    deja_fait = 0
    a_faire = 0
    sans_osm_id = 0

    for i, feature in enumerate(terrains, start=1):
        cle = cle_terrain(feature)

        if not cle:
            # terrains.geojson pas encore régénéré avec osm_id pour ce terrain (ou une version
            # trop ancienne) — on ne peut pas l'identifier de façon stable, donc on le saute
            # plutôt que d'improviser une clé fragile. Se corrige tout seul dès que le site aura
            # regénéré terrains.geojson avec la version à jour de update_terrains.py.
            sans_osm_id += 1
            continue

        if cle in cache:
            deja_fait += 1
            continue

        lon, lat = feature["geometry"]["coordinates"]
        commune = feature["properties"].get("commune") or "Commune inconnue"
        nom = feature["properties"].get("nearest_street") or f"Terrain ({lat:.5f}, {lon:.5f})"

        debut = time.time()
        try:
            images = images_a_proximite(lat, lon)
            candidat = meilleur_candidat(lat, lon, images)
        except Exception as e:
            candidat = None
            print(f"  [{i}/{len(terrains)}] {commune} — {nom} → erreur : {e}")
        duree = time.time() - debut

        cache[cle] = {
            "osm_id": cle,
            "nom": nom,
            "commune": commune,
            "lat": lat,
            "lon": lon,
            "candidat": candidat,
        }
        sauvegarder_cache(cache)
        a_faire += 1

        # Affiche le temps de CHAQUE requête (pas juste tous les 20) tant que ça reste lent, pour
        # repérer si c'est généralisé ou seulement certains terrains qui traînent — repasse à un
        # affichage groupé (tous les 20) automatiquement une fois que ça redevient rapide.
        if duree > 2:
            print(f"  [{i}/{len(terrains)}] {nom} → {duree:.1f}s (lent)")
        elif a_faire % 20 == 0 or i == len(terrains):
            print(f"  [{i}/{len(terrains)}] traités ({a_faire} nouveaux, {deja_fait} déjà en cache) — dernière requête : {duree:.1f}s")

        time.sleep(DELAI_ENTRE_REQUETES)

    print(f"\nTerminé : {len(cache)} terrain(s) dans le cache ({a_faire} nouveaux cette session).")
    if sans_osm_id:
        print(f"\n⚠ {sans_osm_id} terrain(s) ignoré(s) car sans osm_id : terrains.geojson n'est")
        print("  probablement pas encore régénéré avec la version à jour de update_terrains.py.")
        print("  Relance ce script une fois la régénération terminée sur mapetanque.be.")
    return cache


# ===================== Génération de la page HTML =====================

def generer_html(cache):
    # Regroupe par commune, dans l'ordre de nombre de terrains décroissant
    par_commune = {}
    for entree in cache.values():
        par_commune.setdefault(entree["commune"], []).append(entree)

    communes_triees = sorted(par_commune.items(), key=lambda kv: -len(kv[1]))

    donnees_js = json.dumps(
        [{"commune": c, "terrains": terrains} for c, terrains in communes_triees],
        ensure_ascii=False,
    )

    html = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Revue des photos Mapillary — Mapetanque.be</title>
<style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f4f5f0; color: #222; }
    header {
        position: sticky; top: 0; background: #1e1e1e; color: white;
        padding: 14px 20px; z-index: 10; display: flex; gap: 16px; align-items: center;
        flex-wrap: wrap;
    }
    header h1 { font-size: 16px; margin: 0; flex: 1 1 auto; }
    header input, header select, header button {
        padding: 6px 10px; border-radius: 6px; border: none; font-size: 14px;
    }
    .stats-resume { display: flex; gap: 6px; flex-wrap: wrap; }
    .stat-chip {
        font-size: 12px; padding: 3px 9px; border-radius: 999px;
        background: #3a3a3a; color: #ddd; white-space: nowrap;
    }
    .stat-chip b { color: white; }
    .stat-chip.accepte { background: rgba(116, 193, 90, 0.25); }
    .stat-chip.accepte b { color: #a6e08a; }
    .stat-chip.rejete { background: rgba(217, 83, 79, 0.25); }
    .stat-chip.rejete b { color: #ef9d9a; }
    .commune-groupe { margin: 16px; background: white; border-radius: 10px; overflow: hidden; }
    .commune-titre {
        padding: 12px 16px; background: #eee; cursor: pointer; font-weight: bold;
        display: flex; justify-content: space-between;
    }
    .commune-contenu { display: none; padding: 8px; }
    .commune-contenu.ouvert { display: block; }
    .terrain-carte {
        display: flex; gap: 12px; padding: 10px; border-bottom: 1px solid #eee; align-items: center;
    }
    .terrain-carte.decide-accepte { background: #eaffea; }
    .terrain-carte.decide-rejete { background: #fff0f0; opacity: 0.6; }
    .terrain-carte img { width: 160px; height: 120px; object-fit: cover; border-radius: 6px; background: #ddd; }
    .terrain-info { flex: 1; font-size: 14px; }
    .terrain-info b { display: block; margin-bottom: 4px; }
    .terrain-meta { color: #777; font-size: 12px; }
    .terrain-actions button {
        padding: 6px 12px; margin-right: 6px; border-radius: 6px; border: 1px solid #ccc;
        background: white; cursor: pointer; font-size: 13px;
    }
    .terrain-actions button.actif-accepte { background: #74C15A; color: white; border-color: #74C15A; }
    .terrain-actions button.actif-rejete { background: #d9534f; color: white; border-color: #d9534f; }
    .terrain-alternative { margin-top: 6px; }
    .terrain-pano { margin-top: 4px; }
    .champ-pano {
        width: 100%; max-width: 420px; box-sizing: border-box;
        padding: 5px 8px; border-radius: 6px; border: 1px dashed #b48ead; font-size: 12px;
        background: #faf5fc;
    }
    .champ-alternative {
        width: 100%; max-width: 420px; box-sizing: border-box;
        padding: 5px 8px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px;
    }
    .sans-candidat { color: #999; font-style: italic; padding: 10px 16px; font-size: 13px; }
    .cachee { display: none !important; }
    .terrain-carte.decide-aucune { background: #f0f0f0; opacity: 0.6; }
    .sans-candidat-info { flex: 1; font-size: 14px; }
    .sans-candidat-info b { display: block; margin-bottom: 4px; }
    .terrain-extra { flex: 1; margin-top: 6px; }
    .terrain-deja-en-ligne {
        font-size: 12px; color: #2e7d32; font-weight: bold; margin-bottom: 4px;
    }
    .terrain-alternatives, .terrain-panos { margin-top: 6px; }
    .liste-alternatives, .liste-panos { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
    .chip {
        display: inline-flex; align-items: center; gap: 4px;
        background: #eef; border-radius: 999px; padding: 2px 4px 2px 10px; font-size: 11px;
    }
    .chip.chip-pano { background: #faf5fc; }
    .chip-remove {
        border: none; background: #ccc; color: white; border-radius: 50%;
        width: 16px; height: 16px; line-height: 16px; text-align: center; padding: 0;
        cursor: pointer; font-size: 11px;
    }
    .chip-remove:hover { background: #999; }
</style>
</head>
<body>

<header>
    <h1>Revue des photos Mapillary</h1>
    <div id="progression" class="stats-resume"></div>
    <input type="text" id="recherche" placeholder="Filtrer par commune ou terrain...">
    <select id="filtreCandidat">
        <option value="tous">Avec + sans candidat</option>
        <option value="avec_candidat">Avec candidat seulement</option>
        <option value="sans_candidat">Sans candidat seulement</option>
    </select>
    <select id="filtreDecision">
        <option value="tous">Tout afficher</option>
        <option value="a_decider">À décider seulement</option>
        <option value="acceptes">Acceptés seulement</option>
        <option value="rejetes">Rejetés seulement</option>
        <option value="aucune">Marqués "rien trouvé"</option>
        <option value="avec_alternative">Avec plusieurs photos</option>
        <option value="avec_pano">Avec 360° repérée</option>
    </select>
    <button id="exporter">Exporter mes décisions (JSON)</button>
    <button id="importer">Importer des décisions (JSON)</button>
    <button id="importerBaseline">Importer photos_mapillary.json actuel</button>
    <button id="telechargerPhotosMapillary">Télécharger photos_mapillary.json</button>
    <button id="telechargerPanos">Télécharger la liste des 360° à traiter</button>
    <input type="file" id="fichierImport" accept=".json" style="display:none">
    <input type="file" id="fichierImportBaseline" accept=".json" style="display:none">
</header>


<div id="conteneur"></div>

<script>
const DONNEES = """ + donnees_js + """;
const CLE_STOCKAGE = "mapetanque_revue_photos_decisions";
const CLE_STOCKAGE_BASELINE = "mapetanque_revue_photos_baseline";

// Fichiers récupérés automatiquement au chargement (voir chargerFichiersDistants tout en bas),
// pour ne plus avoir à cliquer "Importer…" à chaque session. Les boutons d'import manuel restent
// disponibles (autre machine, fichier local expérimental, hors ligne…).
//  - DECISIONS : mes décisions déjà exportées/publiées. Fusionnées SOUS le localStorage (le local
//    reste prioritaire : une revue en cours n'est jamais écrasée par le distant).
//  - PHOTOS_EN_LIGNE : le data/photos_mapillary.json réellement en ligne. Rafraîchit le baseline
//    à CHAQUE chargement (le site fait foi), exactement comme le bouton "Importer
//    photos_mapillary.json actuel" — même clé de stockage, même format.
const URL_DECISIONS_DISTANTES = "https://mapetanque.be/scripts/decisions_photos_mapillary.json";
const URL_PHOTOS_EN_LIGNE = "https://mapetanque.be/data/photos_mapillary.json";

function chargerDecisions() {
    let decisions;
    try {
        decisions = JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || {};
    } catch (e) {
        return {};
    }

    // Migration depuis l'ancien format (une ancienne version de l'outil stockait UNE alternative
    // et UN pano comme simples chaînes de caractères, sans compter la 360° comme une liste). Sans
    // ça, ces anciennes décisions restaient dans le fichier mais devenaient invisibles dans le
    // nouvel outil (rien à afficher dans les listes à puces, qui ne lisent que les tableaux) —
    // c'est ce qui donnait l'impression que la décision et l'URL de la photo avaient disparu.
    let migrationEffectuee = false;
    Object.keys(decisions).forEach(cle => {
        const d = decisions[cle];
        if (d.alternative) {
            // extraireIdMapillary() nettoie ici pour la même raison qu'à la saisie normale
            // (champAlternative plus bas) : l'ancien outil stockait parfois l'URL complète
            // collée telle quelle dans ce champ, sans en extraire l'identifiant numérique —
            // sans ce nettoyage à la migration, ces URLs brutes se retrouvaient telles quelles
            // dans data/photos_mapillary.json au téléchargement (miniatures noires, liens 404).
            const idPropre = extraireIdMapillary(d.alternative);
            if (!d.alternatives || !d.alternatives.includes(idPropre)) {
                d.alternatives = [...(d.alternatives || []), idPropre];
            }
            delete d.alternative;
            migrationEffectuee = true;
        }
        if (d.alternatives && d.alternatives.length) {
            // Même nettoyage pour les tableaux déjà migrés lors d'une session précédente (avant
            // ce correctif) — sinon une fois migrées, ces valeurs brutes n'étaient plus jamais
            // repassées par extraireIdMapillary lors des chargements suivants.
            const nettoyees = d.alternatives.map(extraireIdMapillary);
            if (JSON.stringify(nettoyees) !== JSON.stringify(d.alternatives)) {
                d.alternatives = [...new Set(nettoyees)];
                migrationEffectuee = true;
            }
        }
        if (d.pano && typeof d.pano === 'string') {
            const parse = analyserUrl360(d.pano);
            if (parse) {
                if (!d.panos || !d.panos.some(p => p.mapillary_id === parse.mapillary_id)) {
                    d.panos = [...(d.panos || []), parse];
                }
                delete d.pano;
                migrationEffectuee = true;
            }
            // Si le texte n'a pas pu être compris comme une URL/ID Mapillary (c'était un simple
            // pense-bête texte libre dans l'ancien outil), on NE LE SUPPRIME PAS — il reste tel
            // quel dans les données (juste ignoré à l'affichage) plutôt que d'être perdu.
        }

        // Correction rétroactive pour les décisions prises AVANT la règle "ajouter une photo
        // manuelle rejette automatiquement le candidat" (voir champAlternative plus bas) — sans
        // ça, un terrain comme Plaats (candidat accepté + alternative ajoutée sous l'ancien
        // comportement) restait affiché avec les deux actifs à la fois.
        if (d.statut === 'accepte' && d.alternatives && d.alternatives.length > 0) {
            d.statut = 'rejete';
            migrationEffectuee = true;
        }
    });

    if (migrationEffectuee) {
        localStorage.setItem(CLE_STOCKAGE, JSON.stringify(decisions));
    }

    return decisions;
}

// Le "baseline" est une copie de data/photos_mapillary.json tel qu'il est actuellement en ligne
// (importée à la main via le bouton "Importer photos_mapillary.json actuel" — voir plus bas), pas
// régénérée automatiquement. Sert de point de départ pour la fusion au téléchargement final, afin
// de ne jamais écraser une entrée déjà en ligne (photo ajoutée par un usager comprise) et pour
// afficher "déjà en ligne" sur les terrains concernés pendant la revue.
function chargerBaseline() {
    try {
        return JSON.parse(localStorage.getItem(CLE_STOCKAGE_BASELINE)) || null;
    } catch (e) {
        return null;
    }
}

// Chaque décision est un objet :
//   statut: 'accepte' | 'rejete' | 'aucune' | undefined
//     — porte sur le CANDIDAT PAR DÉFAUT proposé automatiquement (accepté/rejeté), ou 'aucune'
//       pour un terrain SANS candidat qu'on a vérifié à la main et où on n'a rien trouvé (sert
//       juste au suivi de progression, pas de conséquence sur le fichier téléchargé).
//   alternatives: ['id_ou_lien', ...]
//     — photos plates (non-360°) trouvées à la main, en PLUS du candidat par défaut. Un terrain
//       sans candidat automatique peut aussi avoir des alternatives (c'est même le seul moyen de
//       lui donner une photo).
//   panos: [{ mapillary_id, x, y, zoom, app_url }, ...]
//     — candidats 360° repérés (URL app.mapillary.com collée), à traiter plus tard via
//       generer_miniature_360.py — jamais inclus dans photos_mapillary.json directement.
function mettreAJourDecision(cleTerrain, correctifs) {
    const decisions = chargerDecisions();
    const actuel = decisions[cleTerrain] || {};
    const nouveau = { ...actuel, ...correctifs };

    const vide = !nouveau.statut &&
        (!nouveau.alternatives || nouveau.alternatives.length === 0) &&
        (!nouveau.panos || nouveau.panos.length === 0);

    if (vide) {
        delete decisions[cleTerrain];
    } else {
        decisions[cleTerrain] = nouveau;
    }

    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(decisions));
    mettreAJourProgression();
}

function formaterDate(captureMs) {
    if (!captureMs) return "date inconnue";
    const d = new Date(captureMs);
    return "photo du " + d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function cleDe(terrain) {
    return terrain.osm_id;
}

// Nombre total de photos qui seront effectivement associées à ce terrain une fois téléchargées
// (candidat par défaut, s'il est encore accepté, + toutes les alternatives). Sert de définition
// unique à "Acceptés"/"Rejetés"/"Avec plusieurs photos" ci-dessous, pour que compteurs, filtres et
// téléchargement final soient toujours d'accord entre eux.
function compterPhotos(decision) {
    const candidatCompte = decision.statut === 'accepte' ? 1 : 0;
    return candidatCompte + (decision.alternatives ? decision.alternatives.length : 0);
}

function mettreAJourProgression() {
    const decisions = chargerDecisions();
    const baseline = chargerBaseline();

    // Le compteur ne porte que sur le sous-ensemble actuellement sélectionné via le filtre
    // "Avec/sans candidat" — sinon "à décider" reste toujours calculé sur TOUS les terrains,
    // même quand on a volontairement isolé "avec candidat" pour s'y concentrer.
    const selectFiltreCandidat = document.getElementById('filtreCandidat');
    const filtreCandidat = selectFiltreCandidat ? selectFiltreCandidat.value : 'tous';

    let totalTerrains = 0, avecCandidat = 0, sansCandidat = 0;
    let acceptes = 0, rejetes = 0, aucune = 0, avecAlternative = 0, avecPano = 0, dejaEnLigne = 0;

    DONNEES.forEach(groupe => groupe.terrains.forEach(t => {
        const aUnCandidat = !!t.candidat;
        if (filtreCandidat === 'avec_candidat' && !aUnCandidat) return;
        if (filtreCandidat === 'sans_candidat' && aUnCandidat) return;

        totalTerrains++;
        if (aUnCandidat) avecCandidat++; else sansCandidat++;

        const d = decisions[cleDe(t)] || {};
        const nbPhotos = compterPhotos(d);
        if (nbPhotos >= 1) acceptes++;
        if (d.statut === 'rejete' && nbPhotos === 0) rejetes++;
        if (d.statut === 'aucune') aucune++;
        if (nbPhotos >= 2) avecAlternative++;
        if (d.panos && d.panos.length) avecPano++;
        if (baseline && baseline[cleDe(t)] && baseline[cleDe(t)].length) dejaEnLigne++;
    }));

    const aDecider = totalTerrains - acceptes - rejetes - aucune;

    document.getElementById('progression').innerHTML = `
        <span class="stat-chip">Terrains : <b>${totalTerrains}</b></span>
        <span class="stat-chip">Avec candidat : <b>${avecCandidat}</b></span>
        <span class="stat-chip">Sans candidat : <b>${sansCandidat}</b></span>
        <span class="stat-chip">À décider : <b>${aDecider}</b></span>
        <span class="stat-chip accepte">Acceptés (≥1 photo) : <b>${acceptes}</b></span>
        <span class="stat-chip rejete">Rejetés (0 photo) : <b>${rejetes}</b></span>
        <span class="stat-chip">Rien trouvé : <b>${aucune}</b></span>
        <span class="stat-chip">Avec plusieurs photos : <b>${avecAlternative}</b></span>
        <span class="stat-chip">Avec 360° repérée : <b>${avecPano}</b></span>
        ${baseline
            ? `<span class="stat-chip accepte">Déjà en ligne : <b>${dejaEnLigne}</b></span>`
            : `<span class="stat-chip rejete">photos_mapillary.json actuel non importé</span>`}
    `;
}

// Extrait un ID Mapillary (suite de chiffres) depuis un texte libre — accepte aussi bien un ID
// brut collé tel quel qu'un lien complet (mapillary.com/map/im/ID) copié depuis la barre d'adresse.
function extraireIdMapillary(texte) {
    const correspondance = texte.match(/(\d{10,})/);
    return correspondance ? correspondance[1] : texte.trim();
}

// Extrait mapillary_id + x/y/zoom depuis une URL app.mapillary.com collée (voir
// generer_miniature_360.py pour la suite du traitement de ces candidats 360°).
function analyserUrl360(texte) {
    const idMatch = texte.match(/pKey=(\d+)/) || texte.match(/(\d{10,})/);
    if (!idMatch) return null;
    const xMatch = texte.match(/[?&]x=([0-9.]+)/);
    const yMatch = texte.match(/[?&]y=([0-9.]+)/);
    const zoomMatch = texte.match(/[?&]zoom=([0-9.]+)/);
    return {
        mapillary_id: idMatch[1],
        x: xMatch ? parseFloat(xMatch[1]) : null,
        y: yMatch ? parseFloat(yMatch[1]) : null,
        zoom: zoomMatch ? parseFloat(zoomMatch[1]) : null,
        app_url: texte.trim(),
    };
}

function rendreChip(texte, onRemove, classeSupp) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (classeSupp ? ' ' + classeSupp : '');
    const span = document.createElement('span');
    span.textContent = texte;
    chip.appendChild(span);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-remove';
    btn.textContent = '×';
    btn.title = 'Retirer';
    btn.addEventListener('click', onRemove);
    chip.appendChild(btn);
    return chip;
}

function construireCarte(terrain) {
    const baseline = chargerBaseline();
    const cle = cleDe(terrain);
    const c = terrain.candidat;

    const div = document.createElement('div');
    div.dataset.cle = cle;
    div.dataset.recherche = (terrain.commune + ' ' + terrain.nom).toLowerCase();
    div.dataset.avecCandidat = c ? '1' : '0';

    const blocCandidat = c ? `
        <a href="${c.lien}" target="_blank"><img src="${c.thumbnail}" loading="lazy"></a>
        <div class="terrain-info">
            <b>${terrain.nom}</b>
            <div class="terrain-meta">${terrain.commune} — score ${c.score} — ${c.distance_m} m — écart angle ${c.ecart_angle_deg}° — ${formaterDate(c.captured_at)}</div>
            <div class="terrain-actions">
                <button class="btn-accepter">Accepter le candidat</button>
                <button class="btn-rejeter">Rejeter le candidat</button>
                <a href="${c.lien}" target="_blank"><button type="button">Voir sur Mapillary</button></a>
                <a href="https://www.openstreetmap.org/edit#map=20/${terrain.lat}/${terrain.lon}" target="_blank"><button type="button">Localiser sur OSM</button></a>
            </div>
            <div class="terrain-extra"></div>
        </div>
    ` : `
        <div class="sans-candidat-info">
            <b>${terrain.nom}</b>
            <div class="terrain-meta">${terrain.commune} — aucun candidat automatique trouvé à proximité</div>
            <div class="terrain-actions">
                <button class="btn-aucune">Marquer "rien trouvé"</button>
                <a href="https://www.mapillary.com/app/?lat=${terrain.lat}&lng=${terrain.lon}&z=19" target="_blank"><button type="button">Explorer sur Mapillary</button></a>
                <a href="https://www.openstreetmap.org/edit#map=20/${terrain.lat}/${terrain.lon}" target="_blank"><button type="button">Localiser sur OSM</button></a>
            </div>
            <div class="terrain-extra"></div>
        </div>
    `;

    div.innerHTML = blocCandidat;

    const zoneExtra = div.querySelector('.terrain-extra');
    zoneExtra.innerHTML = `
        <div class="terrain-deja-en-ligne" style="display:none"></div>
        <div class="terrain-alternatives">
            <div class="liste-alternatives"></div>
            <input type="text" class="champ-alternative" autocomplete="off"
                   placeholder="+ Photo trouvée à la main (lien ou ID Mapillary), Entrée pour valider">
        </div>
        <div class="terrain-panos">
            <div class="liste-panos"></div>
            <input type="text" class="champ-pano" autocomplete="off"
                   placeholder="+ 360° repérée (colle l'URL complète de l'app Mapillary), Entrée pour valider">
        </div>
    `;

    const zoneDejaEnLigne = zoneExtra.querySelector('.terrain-deja-en-ligne');
    if (baseline && baseline[cle] && baseline[cle].length) {
        zoneDejaEnLigne.style.display = '';
        zoneDejaEnLigne.textContent = '✓ ' + baseline[cle].length + ' photo(s) déjà en ligne pour ce terrain';
    }

    const listeAlternatives = zoneExtra.querySelector('.liste-alternatives');
    const champAlternative = zoneExtra.querySelector('.champ-alternative');
    const listePanos = zoneExtra.querySelector('.liste-panos');
    const champPano = zoneExtra.querySelector('.champ-pano');

    let btnAccepter = null, btnRejeter = null, btnAucune = null;
    if (c) {
        btnAccepter = div.querySelector('.btn-accepter');
        btnRejeter = div.querySelector('.btn-rejeter');
    } else {
        btnAucune = div.querySelector('.btn-aucune');
    }

    function rafraichir() {
        const d = chargerDecisions()[cle] || {};

        if (btnAccepter) {
            btnAccepter.className = 'btn-accepter' + (d.statut === 'accepte' ? ' actif-accepte' : '');
            btnRejeter.className = 'btn-rejeter' + (d.statut === 'rejete' ? ' actif-rejete' : '');
        }
        if (btnAucune) {
            btnAucune.className = 'btn-aucune' + (d.statut === 'aucune' ? ' actif-rejete' : '');
        }
        div.className = 'terrain-carte' +
            (d.statut === 'accepte' ? ' decide-accepte' :
             d.statut === 'rejete' ? ' decide-rejete' :
             d.statut === 'aucune' ? ' decide-aucune' : '');

        listeAlternatives.innerHTML = '';
        (d.alternatives || []).forEach((alt, index) => {
            listeAlternatives.appendChild(rendreChip(alt, () => {
                const actuel = chargerDecisions()[cle] || {};
                const alternatives = (actuel.alternatives || []).filter((_, i) => i !== index);
                mettreAJourDecision(cle, { alternatives });
                rafraichir();
                appliquerFiltres();
            }));
        });

        listePanos.innerHTML = '';
        (d.panos || []).forEach((pano, index) => {
            listePanos.appendChild(rendreChip('360° : ' + pano.mapillary_id, () => {
                const actuel = chargerDecisions()[cle] || {};
                const panos = (actuel.panos || []).filter((_, i) => i !== index);
                mettreAJourDecision(cle, { panos });
                rafraichir();
                appliquerFiltres();
            }, 'chip-pano'));
        });
    }

    if (btnAccepter) {
        btnAccepter.addEventListener('click', () => {
            const actuel = chargerDecisions()[cle] || {};
            mettreAJourDecision(cle, { statut: actuel.statut === 'accepte' ? undefined : 'accepte' });
            rafraichir();
            appliquerFiltres();
        });
        btnRejeter.addEventListener('click', () => {
            const actuel = chargerDecisions()[cle] || {};
            mettreAJourDecision(cle, { statut: actuel.statut === 'rejete' ? undefined : 'rejete' });
            rafraichir();
            appliquerFiltres();
        });
    }
    if (btnAucune) {
        btnAucune.addEventListener('click', () => {
            const actuel = chargerDecisions()[cle] || {};
            mettreAJourDecision(cle, { statut: actuel.statut === 'aucune' ? undefined : 'aucune' });
            rafraichir();
            appliquerFiltres();
        });
    }

    champAlternative.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const valeur = champAlternative.value.trim();
        if (!valeur) return;
        const id = extraireIdMapillary(valeur);
        const actuel = chargerDecisions()[cle] || {};
        const alternatives = [...(actuel.alternatives || []), id];
        // Réflexe "je propose autre chose à la place" : ajouter une photo manuelle rejette
        // systématiquement le candidat par défaut (peu importe s'il était déjà accepté, encore
        // à décider, ou déjà rejeté) — sinon le bouton restait dans un état ambigu (ni vert ni
        // rouge) sur les terrains jamais explicitement traités avant. Si tu veux vraiment garder
        // les deux, reclique sur "Accepter le candidat" après coup — ça n'affecte pas les
        // alternatives déjà ajoutées.
        const correctifs = { alternatives, statut: 'rejete' };
        mettreAJourDecision(cle, correctifs);
        champAlternative.value = '';
        rafraichir();
        appliquerFiltres();
    });

    champPano.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const valeur = champPano.value.trim();
        if (!valeur) return;
        const parse = analyserUrl360(valeur);
        if (!parse) {
            alert("Impossible d'y trouver un identifiant Mapillary (ID à 10 chiffres ou plus, ou paramètre pKey= dans l'URL).");
            return;
        }
        const actuel = chargerDecisions()[cle] || {};
        const panos = [...(actuel.panos || []), parse];
        mettreAJourDecision(cle, { panos });
        champPano.value = '';
        rafraichir();
        appliquerFiltres();
    });

    rafraichir();
    return div;
}

function construirePage() {
    const conteneur = document.getElementById('conteneur');
    DONNEES.forEach((groupe, index) => {
        const div = document.createElement('div');
        div.className = 'commune-groupe';

        const nbCandidats = groupe.terrains.filter(t => t.candidat).length;

        const titre = document.createElement('div');
        titre.className = 'commune-titre';
        titre.innerHTML = `<span>${groupe.commune} (${groupe.terrains.length} terrain(s), ${nbCandidats} candidat(s))</span><span>&#9660;</span>`;

        const contenu = document.createElement('div');
        contenu.className = 'commune-contenu' + (index === 0 ? ' ouvert' : '');

        groupe.terrains.forEach(t => contenu.appendChild(construireCarte(t)));

        titre.addEventListener('click', () => contenu.classList.toggle('ouvert'));

        div.appendChild(titre);
        div.appendChild(contenu);
        conteneur.appendChild(div);
    });

    mettreAJourProgression();
}

function appliquerFiltres() {
    const recherche = document.getElementById('recherche').value.toLowerCase();
    const filtreDecision = document.getElementById('filtreDecision').value;
    const filtreCandidat = document.getElementById('filtreCandidat').value;
    const decisions = chargerDecisions();

    document.querySelectorAll('.terrain-carte').forEach(carte => {
        const correspondRecherche = !recherche || carte.dataset.recherche.includes(recherche);
        const decision = decisions[carte.dataset.cle] || {};

        let correspondDecision = true;
        const nbPhotos = compterPhotos(decision);
        if (filtreDecision === 'a_decider') correspondDecision = !decision.statut && nbPhotos === 0;
        if (filtreDecision === 'acceptes') correspondDecision = nbPhotos >= 1;
        if (filtreDecision === 'rejetes') correspondDecision = decision.statut === 'rejete' && nbPhotos === 0;
        if (filtreDecision === 'aucune') correspondDecision = decision.statut === 'aucune';
        if (filtreDecision === 'avec_alternative') correspondDecision = nbPhotos >= 2;
        if (filtreDecision === 'avec_pano') correspondDecision = !!(decision.panos && decision.panos.length);

        let correspondCandidat = true;
        if (filtreCandidat === 'avec_candidat') correspondCandidat = carte.dataset.avecCandidat === '1';
        if (filtreCandidat === 'sans_candidat') correspondCandidat = carte.dataset.avecCandidat === '0';

        carte.classList.toggle('cachee', !(correspondRecherche && correspondDecision && correspondCandidat));
    });
}

document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.getElementById('filtreDecision').addEventListener('change', appliquerFiltres);
document.getElementById('filtreCandidat').addEventListener('change', () => {
    appliquerFiltres();
    mettreAJourProgression();
});

document.getElementById('exporter').addEventListener('click', () => {
    const decisions = chargerDecisions();
    const blob = new Blob([JSON.stringify(decisions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decisions_photos_mapillary.json';
    a.click();
});

// Construit et télécharge data/photos_mapillary.json prêt à déposer tel quel dans data/ puis à
// committer. Fusionne (n'écrase JAMAIS) avec le baseline importé (voir "Importer
// photos_mapillary.json actuel" plus bas) : toute entrée déjà présente dans le baseline — photo
// usager ajoutée à la main comprise — reste intacte, on ne fait qu'AJOUTER les candidats/
// alternatives acceptés dans cette session, sans doublon (dédoublonnage par mapillary_id). Les
// 360° repérées (panos) ne sont jamais incluses ici — voir le bouton séparé
// "Télécharger la liste des 360° à traiter".
document.getElementById('telechargerPhotosMapillary').addEventListener('click', () => {
    const baseline = chargerBaseline();
    if (!baseline) {
        const continuer = confirm(
            "Aucun photos_mapillary.json actuel n'a été importé — le fichier téléchargé ne " +
            "contiendra QUE les décisions prises dans cette session, sans fusion avec ce qui est " +
            "déjà en ligne (risque d'écraser des photos existantes en le déposant tel quel). " +
            "Continuer quand même ?"
        );
        if (!continuer) return;
    }

    const decisions = chargerDecisions();
    const photosMapillary = baseline ? JSON.parse(JSON.stringify(baseline)) : {};

    function ajouterPhoto(cle, id) {
        if (!photosMapillary[cle]) photosMapillary[cle] = [];
        const dejaPresent = photosMapillary[cle].some(p => p.mapillary_id === id);
        if (!dejaPresent) {
            photosMapillary[cle].push({
                mapillary_id: id,
                credit_url: `https://www.mapillary.com/map/im/${id}`,
            });
        }
    }

    let nombreAjoutees = 0;

    DONNEES.forEach(groupe => groupe.terrains.forEach(terrain => {
        const cle = cleDe(terrain);
        const decision = decisions[cle];
        if (!decision) return;

        const avantLongueur = (photosMapillary[cle] || []).length;

        if (decision.statut === 'accepte' && terrain.candidat) {
            ajouterPhoto(cle, terrain.candidat.id);
        }
        (decision.alternatives || []).forEach(id => ajouterPhoto(cle, id));

        nombreAjoutees += (photosMapillary[cle] || []).length - avantLongueur;
    }));

    if (nombreAjoutees === 0 && !baseline) {
        alert("Aucun terrain accepté ni aucune photo supplémentaire pour l'instant — rien à télécharger.");
        return;
    }

    const blob = new Blob([JSON.stringify(photosMapillary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photos_mapillary.json';
    a.click();

    alert(nombreAjoutees + " nouvelle(s) photo(s) ajoutée(s)" +
        (baseline ? " par-dessus le photos_mapillary.json actuel." : "."));
});

// Liste séparée des candidats 360° repérés (jamais mélangés à photos_mapillary.json) — à traiter
// ensuite un par un avec generer_miniature_360.py.
document.getElementById('telechargerPanos').addEventListener('click', () => {
    const decisions = chargerDecisions();
    const liste = [];

    DONNEES.forEach(groupe => groupe.terrains.forEach(terrain => {
        const decision = decisions[cleDe(terrain)];
        if (!decision || !decision.panos || !decision.panos.length) return;
        decision.panos.forEach(pano => {
            liste.push({
                osm_id: cleDe(terrain),
                nom: terrain.nom,
                commune: terrain.commune,
                ...pano,
            });
        });
    }));

    if (liste.length === 0) {
        alert("Aucune 360° repérée pour l'instant.");
        return;
    }

    const blob = new Blob([JSON.stringify(liste, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidats_360.json';
    a.click();

    alert(liste.length + " candidat(s) 360° dans le fichier téléchargé.");
});

// Import des décisions : fusionne le fichier choisi avec les décisions déjà présentes sur CETTE
// machine (les clés du fichier importé écrasent celles en commun, mais rien n'est perdu de ce qui
// n'est présent que localement) — utile pour rapporter les décisions prises sur une autre machine,
// vu que le stockage est propre à chaque navigateur (voir localStorage plus haut).
document.getElementById('importer').addEventListener('click', () => {
    document.getElementById('fichierImport').click();
});

document.getElementById('fichierImport').addEventListener('change', (evenement) => {
    const fichier = evenement.target.files[0];
    if (!fichier) return;

    const lecteur = new FileReader();
    lecteur.onload = () => {
        let importees;
        try {
            importees = JSON.parse(lecteur.result);
        } catch (e) {
            alert("Fichier invalide : ce n'est pas un JSON lisible.");
            return;
        }

        const actuelles = chargerDecisions();
        const fusionnees = { ...actuelles, ...importees };
        localStorage.setItem(CLE_STOCKAGE, JSON.stringify(fusionnees));

        alert(Object.keys(importees).length + " décision(s) importée(s) et fusionnée(s).");
        location.reload();
    };
    lecteur.readAsText(fichier);
    evenement.target.value = '';
});

// Import du photos_mapillary.json actuellement en ligne — remplace le baseline stocké localement
// (pas une fusion : ce fichier doit refléter fidèlement l'état réel du site à un instant donné,
// donc on part de zéro à chaque import plutôt que d'accumuler d'anciennes versions).
document.getElementById('importerBaseline').addEventListener('click', () => {
    document.getElementById('fichierImportBaseline').click();
});

document.getElementById('fichierImportBaseline').addEventListener('change', (evenement) => {
    const fichier = evenement.target.files[0];
    if (!fichier) return;

    const lecteur = new FileReader();
    lecteur.onload = () => {
        let importe;
        try {
            importe = JSON.parse(lecteur.result);
        } catch (e) {
            alert("Fichier invalide : ce n'est pas un JSON lisible.");
            return;
        }

        localStorage.setItem(CLE_STOCKAGE_BASELINE, JSON.stringify(importe));
        alert(Object.keys(importe).length + " terrain(s) avec photo dans le photos_mapillary.json importé.");
        location.reload();
    };
    lecteur.readAsText(fichier);
    evenement.target.value = '';
});

// Récupère les deux fichiers du site avant de construire la page. Tolérant à l'échec : si une URL
// est injoignable (hors ligne, ouverture en local file://, fichier pas encore publié…), l'outil se
// rabat sur le localStorage existant et reste pleinement utilisable — les boutons Importer manuels
// continuent de fonctionner comme avant.
async function recupererJson(url) {
    try {
        const reponse = await fetch(url, { cache: "no-store" });
        if (!reponse.ok) return null;
        return await reponse.json();
    } catch (e) {
        return null;
    }
}

async function chargerFichiersDistants() {
    const [decisionsDistantes, photosEnLigne] = await Promise.all([
        recupererJson(URL_DECISIONS_DISTANTES),
        recupererJson(URL_PHOTOS_EN_LIGNE),
    ]);

    // Baseline : rafraîchi systématiquement depuis le site (remplacement, pas fusion — comme le
    // bouton d'import manuel). Reflète toujours l'état réel en ligne à ce chargement.
    if (photosEnLigne && typeof photosEnLigne === "object") {
        localStorage.setItem(CLE_STOCKAGE_BASELINE, JSON.stringify(photosEnLigne));
    }

    // Décisions distantes : fusionnées SOUS le localStorage (le local, donc une revue en cours,
    // reste prioritaire — le distant ne comble que les terrains sans décision locale). Même
    // logique que l'import manuel, mais dans l'ordre inverse pour ne jamais écraser le local.
    if (decisionsDistantes && typeof decisionsDistantes === "object") {
        const locales = chargerDecisions();
        const fusionnees = { ...decisionsDistantes, ...locales };
        localStorage.setItem(CLE_STOCKAGE, JSON.stringify(fusionnees));
    }
}

// Point d'entrée : on tente le chargement distant, puis on construit la page dans tous les cas.
chargerFichiersDistants().finally(construirePage);
</script>

</body>
</html>
"""

    with open(FICHIER_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Page générée : {FICHIER_HTML}")


# ===================== Script principal =====================

def main():
    cache = recuperer_tous_les_candidats()
    generer_html(cache)
    print(f"\nOuvre {FICHIER_HTML} dans ton navigateur pour commencer la revue.")


if __name__ == "__main__":
    main()