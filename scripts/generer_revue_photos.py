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
import time
from datetime import datetime, timezone

import requests

# ===================== Configuration =====================

MAPILLARY_TOKEN = "MLY|28430029179916530|430abb722289aec39e460c5f2753d6d0"
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
    lon, lat = feature["geometry"]["coordinates"]
    return f"{lat:.6f},{lon:.6f}"


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

    for i, feature in enumerate(terrains, start=1):
        cle = cle_terrain(feature)
        if cle in cache:
            deja_fait += 1
            continue

        lon, lat = feature["geometry"]["coordinates"]
        commune = feature["properties"].get("commune") or "Commune inconnue"
        nom = feature["properties"].get("nearest_street") or f"Terrain ({lat:.5f}, {lon:.5f})"

        try:
            images = images_a_proximite(lat, lon)
            candidat = meilleur_candidat(lat, lon, images)
        except Exception as e:
            candidat = None
            print(f"  [{i}/{len(terrains)}] {commune} — {nom} → erreur : {e}")

        cache[cle] = {
            "nom": nom,
            "commune": commune,
            "lat": lat,
            "lon": lon,
            "candidat": candidat,
        }
        sauvegarder_cache(cache)
        a_faire += 1

        if a_faire % 20 == 0 or i == len(terrains):
            print(f"  [{i}/{len(terrains)}] traités ({a_faire} nouveaux, {deja_fait} déjà en cache)")

        time.sleep(DELAI_ENTRE_REQUETES)

    print(f"\nTerminé : {len(cache)} terrain(s) dans le cache ({a_faire} nouveaux cette session).")
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
    #progression { font-size: 13px; color: #ccc; }
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
    <span id="progression"></span>
    <input type="text" id="recherche" placeholder="Filtrer par commune ou terrain...">
    <select id="filtreDecision">
        <option value="tous">Tout afficher</option>
        <option value="a_decider">À décider seulement</option>
        <option value="acceptes">Acceptés seulement</option>
        <option value="rejetes">Rejetés seulement</option>
    </select>
    <button id="exporter">Exporter mes décisions (JSON)</button>
    <button id="importer">Importer des décisions (JSON)</button>
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
    if (!nouveau.statut && !nouveau.alternative) {
        delete decisions[cleTerrain];
    } else {
        decisions[cleTerrain] = nouveau;
    }

    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(decisions));
    mettreAJourProgression();
}

function cleDe(terrain) {
    return terrain.lat.toFixed(6) + "," + terrain.lon.toFixed(6);
}

function mettreAJourProgression() {
    const decisions = chargerDecisions();
    let total = 0, decides = 0;
    DONNEES.forEach(groupe => groupe.terrains.forEach(t => {
        if (t.candidat) {
            total++;
            if (decisions[cleDe(t)]?.statut) decides++;
        }
    }));
    document.getElementById('progression').textContent = decides + " / " + total + " décidé(s)";
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
            <div class="terrain-meta">${terrain.commune} — score ${c.score} — ${c.distance_m} m — écart angle ${c.ecart_angle_deg}°</div>
            <div class="terrain-actions">
                <button class="btn-accepter">Accepter</button>
                <button class="btn-rejeter">Rejeter</button>
                <a href="${c.lien}" target="_blank"><button type="button">Voir sur Mapillary</button></a>
                <a href="https://www.openstreetmap.org/edit#map=20/${terrain.lat}/${terrain.lon}" target="_blank"><button type="button">Ouvrir dans OSM</button></a>
                <button type="button" class="btn-copier-id">Copier l'ID Mapillary</button>
            </div>
            <div class="terrain-alternative">
                <input type="text" class="champ-alternative" placeholder="Meilleure photo trouvée sur Mapillary ? Colle son lien ou son ID ici" value="${decision.alternative || ''}">
            </div>
        </div>
    `;

    const btnAccepter = div.querySelector('.btn-accepter');
    const btnRejeter = div.querySelector('.btn-rejeter');
    const champAlternative = div.querySelector('.champ-alternative');
    const btnCopierId = div.querySelector('.btn-copier-id');

    btnCopierId.addEventListener('click', () => {
        // Si une alternative a été notée, on copie son ID plutôt que celui proposé par défaut
        // (accepte soit un ID brut, soit un lien mapillary.com/map/im/ID collé tel quel)
        const valeurAlt = champAlternative.value.trim();
        let idACopier = c.id;
        if (valeurAlt) {
            const correspondance = valeurAlt.match(/(\\d{10,})/);
            idACopier = correspondance ? correspondance[1] : valeurAlt;
        }

        navigator.clipboard.writeText(idACopier).then(() => {
            const texteOriginal = btnCopierId.textContent;
            btnCopierId.textContent = 'Copié !';
            setTimeout(() => { btnCopierId.textContent = texteOriginal; }, 1500);
        });
    });

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
    // Sauvegarde au fil de la frappe (léger, pas besoin de bouton "Enregistrer" séparé)
    champAlternative.addEventListener('input', () => {
        mettreAJourDecision(cle, { alternative: champAlternative.value.trim() || undefined });
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
        const statut = decisions[carte.dataset.cle]?.statut;
        let correspondDecision = true;
        if (filtreDecision === 'a_decider') correspondDecision = !statut;
        if (filtreDecision === 'acceptes') correspondDecision = statut === 'accepte';
        if (filtreDecision === 'rejetes') correspondDecision = statut === 'rejete';

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