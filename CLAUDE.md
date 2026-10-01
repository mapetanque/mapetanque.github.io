# Consignes pour Claude Code (mapetanque.be)

## Branches et tests

- Ne jamais pousser sur `main` : le site est publié depuis `main`. Travailler sur la branche indiquée.
- Pour tout changement visible sur le site, donner à Rémy les commandes pour récupérer la branche et
  la tester en local (VS Code, Live Server) avant toute fusion :

  ```
  git fetch origin
  git checkout <branche>
  git pull
  ```

  La fusion dans `main` se fait par une pull request, que Rémy valide après son test.

## Conventions du projet

- Commentaires, messages et textes en français.
- Chemins relatifs au script (`os.path.dirname(os.path.abspath(__file__))`), jamais au répertoire
  courant : ça a déjà écrit des fichiers au mauvais endroit.
- Environnement de Rémy : Windows, VS Code, PowerShell, Python dans `.venv`.
- Privilégier des solutions légères et faciles à maintenir.
- Relancer `scripts/generate_provinces.py` après toute modification de gabarit ou de traduction.
- Libellés du site en quatre langues (FR, NL, DE, EN) dans `translations.js`.
