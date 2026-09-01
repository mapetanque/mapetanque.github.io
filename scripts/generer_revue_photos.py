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
</style>
</head>
<body>

<header>
    <h1>Revue des photos Mapillary</h1>
    <div id="progression" class="stats-resume"></div>
    <input type="text" id="recherche" placeholder="Filtrer par commune ou terrain...">
    <select id="filtreDecision">
        <option value="tous">Tout afficher</option>
        <option value="a_decider">À décider seulement</option>
        <option value="acceptes">Acceptés seulement</option>
        <option value="rejetes">Rejetés seulement</option>
        <option value="avec_alternative">Avec alternative notée</option>
        <option value="avec_pano">Avec 360° repérée</option>
    </select>
    <button id="exporter">Exporter mes décisions (JSON)</button>
    <button id="importer">Importer des décisions (JSON)</button>
    <button id="telechargerPhotosMapillary">Télécharger photos_mapillary.json</button>
    <input type="file" id="fichierImport" accept=".json" style="display:none">
</header>

<div id="conteneur"></div>

<script>
const DONNEES = """ + donnees_js + """;
const CLE_STOCKAGE = "mapetanque_revue_photos_decisions";

function chargerDecisions() {
    try {
        return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || {};
    } catch (e) {
        return {};
    }
}

// Chaque décision est un objet { statut: 'accepte'|'rejete'|undefined, alternative: '...' }
// plutôt qu'une simple chaîne, pour pouvoir noter une photo alternative indépendamment du
// statut accepté/rejeté (ex. rejeter la proposition ET indiquer ce qui serait mieux).
function mettreAJourDecision(cleTerrain, correctifs) {
    const decisions = chargerDecisions();
    const actuel = decisions[cleTerrain] || {};
    const nouveau = { ...actuel, ...correctifs };

    // Nettoie l'entrée entièrement si elle ne contient plus rien d'utile
    if (!nouveau.statut && !nouveau.alternative && !nouveau.pano) {
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

function mettreAJourProgression() {
    const decisions = chargerDecisions();

    let totalTerrains = 0, avecCandidat = 0, sansCandidat = 0;
    let acceptes = 0, rejetes = 0, avecAlternative = 0, avecPano = 0;

    DONNEES.forEach(groupe => groupe.terrains.forEach(t => {
        totalTerrains++;
        if (!t.candidat) {
            sansCandidat++;
            return;
        }
        avecCandidat++;
        const d = decisions[cleDe(t)] || {};
        if (d.statut === 'accepte') acceptes++;
        if (d.statut === 'rejete') rejetes++;
        if (d.alternative) avecAlternative++;
        if (d.pano) avecPano++;
    }));

    const aDecider = avecCandidat - acceptes - rejetes;

    document.getElementById('progression').innerHTML = `
        <span class="stat-chip">Terrains : <b>${totalTerrains}</b></span>
        <span class="stat-chip">Avec photo candidate : <b>${avecCandidat}</b></span>
        <span class="stat-chip">Sans photo à proximité : <b>${sansCandidat}</b></span>
        <span class="stat-chip">À décider : <b>${aDecider}</b></span>
        <span class="stat-chip accepte">Acceptés : <b>${acceptes}</b></span>
        <span class="stat-chip rejete">Rejetés : <b>${rejetes}</b></span>
        <span class="stat-chip">Avec alternative : <b>${avecAlternative}</b></span>
        <span class="stat-chip">Avec 360° repérée : <b>${avecPano}</b></span>
    `;
}

function construireCarte(terrain) {
    const decisions = chargerDecisions();
    const cle = cleDe(terrain);
    const decision = decisions[cle] || {};

    if (!terrain.candidat) {
        const div = document.createElement('div');
        div.className = 'sans-candidat';
        div.textContent = terrain.nom + " — aucun candidat trouvé";
        return div;
    }

    const c = terrain.candidat;
    const div = document.createElement('div');
    div.className = 'terrain-carte' + (decision.statut === 'accepte' ? ' decide-accepte' : decision.statut === 'rejete' ? ' decide-rejete' : '');
    div.dataset.cle = cle;
    div.dataset.recherche = (terrain.commune + ' ' + terrain.nom).toLowerCase();

    div.innerHTML = `
        <a href="${c.lien}" target="_blank"><img src="${c.thumbnail}" loading="lazy"></a>
        <div class="terrain-info">
            <b>${terrain.nom}</b>
            <div class="terrain-meta">${terrain.commune} — score ${c.score} — ${c.distance_m} m — écart angle ${c.ecart_angle_deg}° — ${formaterDate(c.captured_at)}</div>
            <div class="terrain-actions">
                <button class="btn-accepter">Accepter</button>
                <button class="btn-rejeter">Rejeter</button>
                <a href="${c.lien}" target="_blank"><button type="button">Voir sur Mapillary</button></a>
                <a href="https://www.openstreetmap.org/edit#map=20/${terrain.lat}/${terrain.lon}" target="_blank"><button type="button">Localiser sur OSM</button></a>
            </div>
            <div class="terrain-alternative">
                <input type="text" class="champ-alternative" autocomplete="off" placeholder="Meilleure photo trouvée sur Mapillary ? Colle son lien ou son ID ici" value="${decision.alternative || ''}">
            </div>
            <div class="terrain-pano">
                <input type="text" class="champ-pano" autocomplete="off" placeholder="Une 360° qui conviendrait bien ? Note-la ici pour plus tard (pas encore affichable sur le site)" value="${decision.pano || ''}">
            </div>
        </div>
    `;

    const btnAccepter = div.querySelector('.btn-accepter');
    const btnRejeter = div.querySelector('.btn-rejeter');
    const champAlternative = div.querySelector('.champ-alternative');
    const champPano = div.querySelector('.champ-pano');

    function rafraichirBoutons() {
        const d = chargerDecisions()[cle] || {};
        btnAccepter.className = 'btn-accepter' + (d.statut === 'accepte' ? ' actif-accepte' : '');
        btnRejeter.className = 'btn-rejeter' + (d.statut === 'rejete' ? ' actif-rejete' : '');
        div.className = 'terrain-carte' + (d.statut === 'accepte' ? ' decide-accepte' : d.statut === 'rejete' ? ' decide-rejete' : '');
    }

    btnAccepter.addEventListener('click', () => {
        const actuel = chargerDecisions()[cle] || {};
        mettreAJourDecision(cle, { statut: actuel.statut === 'accepte' ? undefined : 'accepte' });
        rafraichirBoutons();
        appliquerFiltres();
    });
    btnRejeter.addEventListener('click', () => {
        const actuel = chargerDecisions()[cle] || {};
        mettreAJourDecision(cle, { statut: actuel.statut === 'rejete' ? undefined : 'rejete' });
        rafraichirBoutons();
        appliquerFiltres();
    });
    // Noter une alternative vaut décision : pas besoin de cliquer Accepter en plus. Si le
    // terrain avait été explicitement rejeté, on ne force pas le passage à "accepté" (le rejet
    // explicite reste prioritaire) — mais taper une alternative sur un terrain pas encore décidé,
    // ou déjà accepté, le marque/maintient comme accepté.
    champAlternative.addEventListener('input', () => {
        const actuel = chargerDecisions()[cle] || {};
        const alternative = champAlternative.value.trim() || undefined;
        const correctifs = { alternative };
        if (alternative && actuel.statut !== 'rejete') {
            correctifs.statut = 'accepte';
        }
        mettreAJourDecision(cle, correctifs);
        rafraichirBoutons();
        appliquerFiltres();
    });
    // Simple pense-bête, sans incidence sur le statut accepté/rejeté ni sur l'export
    // photos_mapillary.json (pas encore affichable sur le site — voir CSS .terrain-pano) :
    // juste conservé pour retrouver facilement ces terrains le jour où les 360° seront gérées.
    champPano.addEventListener('input', () => {
        mettreAJourDecision(cle, { pano: champPano.value.trim() || undefined });
        appliquerFiltres();
    });

    rafraichirBoutons();
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
    const decisions = chargerDecisions();

    document.querySelectorAll('.terrain-carte').forEach(carte => {
        const correspondRecherche = !recherche || carte.dataset.recherche.includes(recherche);
        const decision = decisions[carte.dataset.cle] || {};
        let correspondDecision = true;
        if (filtreDecision === 'a_decider') correspondDecision = !decision.statut;
        if (filtreDecision === 'acceptes') correspondDecision = decision.statut === 'accepte';
        if (filtreDecision === 'rejetes') correspondDecision = decision.statut === 'rejete';
        if (filtreDecision === 'avec_alternative') correspondDecision = !!decision.alternative;
        if (filtreDecision === 'avec_pano') correspondDecision = !!decision.pano;

        carte.classList.toggle('cachee', !(correspondRecherche && correspondDecision));
    });
}

document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.getElementById('filtreDecision').addEventListener('change', appliquerFiltres);

document.getElementById('exporter').addEventListener('click', () => {
    const decisions = chargerDecisions();
    const blob = new Blob([JSON.stringify(decisions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decisions_photos_mapillary.json';
    a.click();
});

// Extrait un ID Mapillary (suite de chiffres) depuis un texte libre — accepte aussi bien un ID
// brut collé tel quel qu'un lien complet (mapillary.com/map/im/ID) copié depuis la barre d'adresse.
function extraireIdMapillary(texte) {
    const correspondance = texte.match(/(\\d{10,})/);
    return correspondance ? correspondance[1] : texte;
}

// Construit et télécharge data/photos_mapillary.json directement au format attendu par le site
// (voir scripts/update_terrains.py) : uniquement les terrains ACCEPTÉS, avec l'ID de l'alternative
// notée si elle existe, sinon celui du candidat proposé par défaut. Prêt à déposer tel quel dans
// data/ puis à committer — aucune étape OSM nécessaire dans ce flux.
document.getElementById('telechargerPhotosMapillary').addEventListener('click', () => {
    const decisions = chargerDecisions();
    const photosMapillary = {};

    DONNEES.forEach(groupe => groupe.terrains.forEach(terrain => {
        if (!terrain.candidat) return;
        const cle = cleDe(terrain);
        const decision = decisions[cle];
        if (!decision || decision.statut !== 'accepte') return;

        const idMapillary = decision.alternative
            ? extraireIdMapillary(decision.alternative)
            : terrain.candidat.id;

        // Liste (pas un objet unique) : ce fichier n'est aujourd'hui alimenté que par cet outil
        // (donc toujours 1 seule photo par terrain à ce stade), mais garde le même format que
        // celui utilisé par club/ajouter_photo_manuelle.py pour les ajouts ponctuels ultérieurs
        // (plusieurs photos possibles par terrain avec le temps, via le futur formulaire).
        photosMapillary[cle] = [{
            mapillary_id: idMapillary,
            credit_url: `https://www.mapillary.com/map/im/${idMapillary}`,
        }];
    }));

    const nombre = Object.keys(photosMapillary).length;
    if (nombre === 0) {
        alert("Aucun terrain accepté pour l'instant — accepte au moins une photo avant de télécharger.");
        return;
    }

    const blob = new Blob([JSON.stringify(photosMapillary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photos_mapillary.json';
    a.click();

    alert(nombre + " terrain(s) accepté(s) inclus dans le fichier téléchargé.");
});

// Import : fusionne le fichier choisi avec les décisions déjà présentes sur CETTE machine
// (les clés du fichier importé écrasent celles en commun, mais rien n'est perdu de ce qui
// n'est présent que localement) — utile pour rapporter les décisions prises sur une autre
// machine, vu que le stockage est propre à chaque navigateur (voir localStorage plus haut).
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

    // Réinitialise le champ pour pouvoir réimporter le même fichier plus tard si besoin
    evenement.target.value = '';
});

construirePage();
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