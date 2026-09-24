"""
Test d'accès aux statistiques de Cloudflare Web Analytics, avant d'écrire la
collecte quotidienne dans le Worker.

Répond à trois questions :
  1. la clé donne-t-elle accès aux données de visites (offre gratuite) ?
  2. jusqu'à quand remontent les données disponibles ?
  3. sous quel nom de domaine les visites sont-elles enregistrées ?

Rien n'est écrit nulle part : le script ne fait que lire et afficher.

Usage (PowerShell, depuis la racine du dépôt) :
    $env:CF_TOKEN="la clé API"            (ne jamais la coller dans le chat)
    $env:CF_COMPTE="l'identifiant du compte, 32 caractères"
    python scripts/tester_cloudflare.py
"""

import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, timedelta

URL_API = "https://api.cloudflare.com/client/v4/graphql"

# La documentation annonce six mois de conservation pour ces données. On
# remonte donc par tranches de 30 jours sur un peu plus de six mois : une
# tranche courte évite de buter sur une éventuelle limite de fenêtre.
TRANCHE_JOURS = 30
NOMBRE_TRANCHES = 7

REQUETE = """
query ($compte: string!, $debut: Date!, $fin: Date!) {
  viewer {
    accounts(filter: {accountTag: $compte}) {
      rumPageloadEventsAdaptiveGroups(
        filter: {date_geq: $debut, date_leq: $fin}
        limit: 5000
        orderBy: [date_ASC]
      ) {
        count
        sum { visits }
        dimensions { date requestHost }
      }
    }
  }
}
"""


def interroger(token, compte, debut, fin):
    corps = json.dumps({
        "query": REQUETE,
        "variables": {"compte": compte, "debut": debut.isoformat(), "fin": fin.isoformat()},
    }).encode("utf-8")

    requete = urllib.request.Request(
        URL_API,
        data=corps,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "Mapetanque-test/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"Refus HTTP {e.code} : {e.read()[:500].decode('utf-8', 'replace')}")


def main():
    token = os.environ.get("CF_TOKEN")
    compte = os.environ.get("CF_COMPTE")
    if not token or not compte:
        sys.exit('Il manque CF_TOKEN ou CF_COMPTE. PowerShell :  $env:CF_TOKEN="..."  puis  $env:CF_COMPTE="..."')

    par_jour = defaultdict(lambda: [0, 0])   # date -> [visites, pages vues]
    par_hote = defaultdict(int)

    aujourd_hui = date.today()
    for n in range(NOMBRE_TRANCHES):
        fin = aujourd_hui - timedelta(days=n * TRANCHE_JOURS)
        debut = fin - timedelta(days=TRANCHE_JOURS - 1)
        resultat = interroger(token, compte, debut, fin)

        if resultat.get("errors"):
            print(f"\nTranche {debut} → {fin} : refusée par Cloudflare.")
            for erreur in resultat["errors"]:
                print("  ", erreur.get("message"))
            if n == 0:
                sys.exit("\nLa tranche la plus récente est refusée : l'accès ne fonctionne pas "
                         "avec cette clé. Colle ce message dans le chat (il ne contient pas la clé).")
            print("   (on s'arrête là : les tranches plus anciennes le seraient aussi)")
            break

        comptes = resultat["data"]["viewer"]["accounts"]
        if not comptes:
            sys.exit("Aucun compte renvoyé : vérifie l'identifiant de compte (CF_COMPTE).")

        for ligne in comptes[0]["rumPageloadEventsAdaptiveGroups"]:
            jour = ligne["dimensions"]["date"]
            hote = ligne["dimensions"]["requestHost"]
            par_jour[jour][0] += ligne["sum"]["visits"]
            par_jour[jour][1] += ligne["count"]
            par_hote[hote] += ligne["sum"]["visits"]

    if not par_jour:
        sys.exit("\nAccès accepté, mais aucune visite trouvée. Le site est-il bien suivi par "
                 "Web Analytics sur ce compte ?")

    jours = sorted(par_jour)
    print("\nAccès OK.")
    print(f"Données disponibles du {jours[0]} au {jours[-1]} ({len(jours)} jours avec des visites).")

    print("\nVisites par nom de domaine :")
    for hote, total in sorted(par_hote.items(), key=lambda h: -h[1]):
        print(f"  {hote:<35} {total}")

    print("\nDix derniers jours (visites / pages vues) :")
    for jour in jours[-10:]:
        visites, pages = par_jour[jour]
        print(f"  {jour}   {visites:>6}   {pages:>6}")

    total_visites = sum(v for v, _ in par_jour.values())
    print(f"\nTotal sur toute la période disponible : {total_visites} visites.")


if __name__ == "__main__":
    main()
