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
  Réglage Cloudflare (Settings → Builds → Branch control) : déploiements automatiques de `main`
  désactivés (GitHub Pages publie le site), aperçus limités aux branches `claude/*`. Un push
  fait alors que la branche n'était pas incluse est « sauté » et ne se relance pas : il faut un
  nouveau push.
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

  La fusion dans `main` se fait par une pull request, que Rémy valide après son test. Quand il le
  demande (« fusionne »), Claude ouvre la pull request et la fusionne lui-même (squash). Ensuite,
  sur son PC : `git checkout main` puis `git pull`.
- Réseau de la session cloud : `mapetanque.be` et `*.pages.dev` y sont bloqués par défaut. Claude
  ne peut pas ouvrir le site ni l'aperçu : c'est Rémy qui teste sur son téléphone.

**Dans les deux cas** : une seule session à la fois sur les mêmes fichiers. Une branche du cloud
pas encore fusionnée doit l'être (ou être abandonnée) avant de reprendre ces fichiers en local.

## Workers Cloudflare (dépôt privé `mapetanque/mapetanque-workers`)

- Le code des Workers (`admin`, `comptes`, `direct`, `notes`) n'est pas ici mais dans le dépôt privé
  `mapetanque/mapetanque-workers`, avec ses propres consignes (son `CLAUDE.md`).
- Dans le cloud, il n'est pas joint d'office : l'ajouter avec l'outil `add_repo` (propriétaire
  `mapetanque`, dépôt `mapetanque-workers`, accès `push`), le cloner, puis `register_repo_root`. Ne
  jamais répondre à Rémy qu'on n'a pas accès aux Workers sans avoir fait ça.
- **Notes de réflexion** (`NOTES_*.md` : comptes utilisateurs, badges, photos des visiteurs,
  terrains insolites) : elles sont dans ce dépôt privé, dossier `reflexions/`, et plus ici (ce dépôt
  est public, et le site aussi). Les commentaires du code les citent par leur nom de fichier : les
  lire là-bas (dans le cloud, joindre le dépôt comme ci-dessus). Toute nouvelle note privée va
  là-bas, jamais dans ce dépôt.
- Même façon de travailler que pour le site : branche `claude/…`, pull request, fusion sur demande.
- **Fusionner ne déploie rien.** Déployer seulement quand Rémy le demande, une fois la pull request
  fusionnée : lancer la tâche GitHub « Déployer un Worker » (`.github/workflows/deployer.yml` de ce
  dépôt-là, branche `main`, entrée `worker` = `admin`, `comptes`, `direct` ou `notes`) avec l'outil
  GitHub qui lance un workflow, puis suivre son résultat et le donner à Rémy.
- Les aperçus Pages appellent les Workers en ligne : une modification de Worker ne s'y voit qu'après
  son déploiement. Si le site et un Worker changent ensemble, dire à Rémy dans quel ordre déployer
  (en général le Worker d'abord, en restant compatible avec la version du site en ligne).
- Impossible depuis le cloud (pas de jeton Cloudflare) : requêtes et migrations D1, secrets des
  Workers, journaux en direct, `wrangler rollback`. Les signaler à Rémy, qui les fait sur le PC. Si
  un déploiement pose problème : annuler le commit (revert) par une pull request, fusionner,
  redéployer.

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
