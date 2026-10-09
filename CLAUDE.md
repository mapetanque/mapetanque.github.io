# Consignes pour Claude Code (mapetanque.be)

## Branches et tests

Le site est publié depuis `main` : tout changement poussé sur `main` est en ligne quelques minutes après.

**En local (VS Code, sur le PC de Rémy)**

- Commencer par `git pull` sur `main`, pour partir de la dernière version (un travail fait dans le
  cloud a pu être fusionné entre-temps).
- Modifier les fichiers directement ; Rémy teste avec Live Server.
- Commiter et pousser seulement quand Rémy le demande, après son test.

**Dans le cloud (claude.ai, téléphone ou tablette)**

- Ne jamais pousser sur `main` : travailler sur la branche indiquée.
- Pour tout changement visible sur le site, donner à Rémy les commandes pour récupérer la branche et
  la tester en local (VS Code, Live Server) avant toute fusion :

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
