#!/usr/bin/env python3
"""
Page carte : carte.html (FR) et nl/, de/, en/carte.html, à partir de templates/carte_template.html.

La carte plein écran du site, avec la liste des terrains de la zone affichée (carte.js). Toutes
les recherches y mènent. Le gabarit n'a que des jetons simples :
  {{LANG_CODE}}, {{PREFIXE}} (« / » ou « /nl/ »…), {{TITRE}}, {{DESCRIPTION}},
  {{CANONICAL_URL}}, {{URL_FR}}…{{URL_EN}}, et {{T:clé}} pour un libellé de translations.js
  (texte affiché avant que script.js ne traduise la page, et lu par les moteurs de recherche).

À relancer après une modification du gabarit ou des libellés de la page :
    python scripts/generer_carte.py
Lance ensuite generer_referencement.py (sitemap.xml, données structurées).
"""

import html
import os
import re
from pathlib import Path

import generate_provinces as gp
import generer_referencement

RACINE = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GABARIT = RACINE / "templates" / "carte_template.html"
BASE = "https://mapetanque.be"

LANGUES = [("fr", ""), ("nl", "nl/"), ("de", "de/"), ("en", "en/")]


def main():
    traductions = gp.charger_traductions_js(RACINE / "translations.js")
    gabarit = GABARIT.read_text(encoding="utf-8")
    urls = {langue: f"{BASE}/{prefixe}carte.html" for langue, prefixe in LANGUES}

    for langue, prefixe in LANGUES:
        tr = traductions[langue]
        page = gabarit
        for jeton, valeur in {
            "LANG_CODE": langue,
            "PREFIXE": "/" + prefixe,
            "TITRE": html.escape(tr["carte_titre_page"]),
            "DESCRIPTION": html.escape(tr["carte_meta_description"], quote=True),
            "CANONICAL_URL": urls[langue],
            "URL_FR": urls["fr"], "URL_NL": urls["nl"], "URL_DE": urls["de"], "URL_EN": urls["en"],
        }.items():
            page = page.replace("{{" + jeton + "}}", valeur)
        page = re.sub(r"\{\{T:(\w+)\}\}", lambda m: html.escape(tr[m.group(1)], quote=True), page)
        reste = re.findall(r"\{\{[^}]*\}\}", page)
        if reste:
            raise ValueError(f"{langue} : jetons non remplacés {sorted(set(reste))}")

        chemin = RACINE / prefixe / "carte.html"
        with open(chemin, "w", encoding="utf-8", newline="\n") as f:
            f.write(page)
        print(f"  écrite : {prefixe}carte.html")

    generer_referencement.main()


if __name__ == "__main__":
    main()
