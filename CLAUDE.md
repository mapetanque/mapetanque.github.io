# Consignes pour Claude Code (mapetanque.be)

## Branches et tests

Le site est publié depuis `main` : tout changement poussé sur `main` est en ligne quelques minutes après.

**En local (VS Code, sur le PC de Rémy)**

- Commencer par `git pull` sur `main`, pour partir de la dernière version (un travail fait dans le
  cloud a pu être fusionné entre-temps).
- Modifier les fichiers directement ; Rémy teste avec Live Server.
- Commiter et pousser seulement quand Rémy le demande, après son test.

**Dans le cloud (claude.ai, téléphone ou tablette)**

- Ne jamais pousser sur `main` : travailler sur la branche indiquée (`claude/…`). La pousser est
  sans risque pour le site, et nécessaire pour que Rémy puisse tester.
- Aperçu sur téléphone : Cloudflare Pages (projet `mapetanque`) publie automatiquement chaque
  branche `claude/*` poussée, à l'adresse `https://<branche>.mapetanque.pages.dev` (nom de branche
  en minuscules, `/` remplacé par `-`, coupé à 28 caractères ; l'adresse exacte figure dans le
  statut « Cloudflare Pages » du commit sur GitHub). Après chaque push, donner ce lien à Rémy.
  L'aperçu utilise les vraies données (Workers, D1) : ce qu'on y enregistre arrive sur le site.
  Les Workers n'acceptent l'aperçu que si `*.mapetanque.pages.dev` est dans leurs origines
  autorisées ; connexion par code à 6 chiffres seulement (pas Google).
- Pour tester sur le PC, donner à Rémy les commandes pour récupérer la branche et la tester en
  local (VS Code, Live Server) :

  ```
  git fetch origin
  git checkout <branche>
  git pull
  ```

  La fusion dans `main` se fait par une pull request, que Rémy valide après son test. Ensuite, sur
  son PC : `git checkout main` puis `git pull`.

**Dans les deux cas** : une seule session à la fois sur les mêmes fichiers. Une branche du cloud
pas encore fusionnée doit l'être (ou être abandonnée) avant de reprendre ces fichiers en local.

## Conventions du projet

- Commentaires, messages et textes en français.
- Chemins relatifs au script (`os.path.dirname(os.path.abspath(__file__))`), jamais au répertoire
  courant : ça a déjà écrit des fichiers au mauvais endroit.
- Environnement de Rémy : Windows, VS Code, PowerShell, Python dans `.venv`.
- Privilégier des solutions légères et faciles à maintenir.
- Relancer `scripts/generate_provinces.py` après toute modification de gabarit ou de traduction.
- Libellés du site en quatre langues (FR, NL, DE, EN) dans `translations.js`.
- Charte graphique dans `CHARTE.md` (logo, polices, couleurs, pictos) : s'y tenir pour tout nouveau
  développement.
