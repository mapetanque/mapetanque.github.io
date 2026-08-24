#!/usr/bin/env python3
"""
Retire du cache_candidats.json les entrées orphelines d'avant le passage à osm_id comme clé
(anciennes clés au format "latitude,longitude", d'un test précédent) — sans retoucher aux
entrées correctement identifiées par osm_id (format "node/12345", "way/12345", etc.), donc
aucune perte du travail déjà fait, ni besoin de réinterroger Mapillary.

Usage :
    python3 nettoyer_cache.py
"""

import json
import re

FICHIER_CACHE = "cache_candidats.json"

MOTIF_OSM_ID = re.compile(r"^(node|way|relation)/\d+$")

with open(FICHIER_CACHE, encoding="utf-8") as f:
    cache = json.load(f)

avant = len(cache)

cache_propre = {cle: valeur for cle, valeur in cache.items() if MOTIF_OSM_ID.match(cle)}

apres = len(cache_propre)
retirees = avant - apres

print(f"Entrées avant nettoyage : {avant}")
print(f"Entrées retirées (anciennes clés coordonnées) : {retirees}")
print(f"Entrées conservées (clé osm_id) : {apres}")

if retirees:
    with open(FICHIER_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache_propre, f, ensure_ascii=False, indent=2)
    print(f"\n{FICHIER_CACHE} mis à jour.")
    print("Relance generer_revue_photos.py pour régénérer revue_photos.html avec le cache propre.")
else:
    print("\nAucune entrée orpheline trouvée, rien à faire.")
