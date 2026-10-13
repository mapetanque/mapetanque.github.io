# Comptes utilisateurs sur mapetanque.be — synthèse de la réflexion (7 octobre 2026)

Statut : réflexion de faisabilité, rien n'est codé. Contrainte : rester dans les offres gratuites.
Version corrigée après vérification contre le dépôt et les offres en vigueur en octobre 2026.

## Principe : le compte est facultatif

Tout ce qui existe aujourd'hui reste possible sans compte : note, avis, photo, signalement. Le
compte ajoute des choses (suivi de ses contributions, parties, badges), il n'en retire aucune.

- Mêmes routes du Worker, même formulaire, même file de validation dans l'admin. Seule
  différence : si le navigateur envoie un jeton de session valide (en-tête `Authorization`), le
  Worker range l'identifiant du compte avec la contribution. Sinon, il la traite comme
  aujourd'hui.
- Les protections actuelles s'appliquent dans les deux cas (empreinte IP du jour, empreinte
  IP + terrain + mois pour les notes).
- Une seule note et un seul avis par terrain, avec ou sans compte : connecté, on remplace la
  contribution du compte ; anonyme, celle du navigateur (jetons actuels).
- À la première connexion, proposer de rattacher au compte ce que ce navigateur a déjà envoyé :
  votes (jeton `mapetanque_vote_…`) et avis (identifiant `mapetanque_auteur_avis`). Si un même
  terrain a déjà une note du compte et une note anonyme, garder la plus récente.
- Les points et les badges ne comptent que les contributions faites connecté et validées.
- Réservé aux comptes : parties et stats, tournois, événements, badges, modification de ses
  contributions. Il faut une identité pour y revenir.
- Dans l'admin, une petite marque « compte » sur les contributions concernées. Le travail de
  modération reste le même.

## Fonctionnalités envisagées et faisabilité

| Fonctionnalité | Verdict |
|---|---|
| Historique de ses parties (date, terrain, durée, scores) + stats | Facile (table `parties`, stats en SQL) — meilleur rapport valeur/effort |
| Indiquer son équipe dans une partie | Facile (simple champ) |
| Noms des joueurs de chaque équipe | Facile en texte libre visible du seul propriétaire (RGPD : noms de tiers). Lier à de vrais comptes avec confirmation = nettement plus de travail |
| Partie partagée en direct (les autres joueurs suivent et saisissent le score sur leur téléphone) | Moyen. Gratuit avec un Durable Object par partie (WebSocket) ; on rejoint en scannant un QR code, sans annuaire de comptes (voir « Partie partagée en direct ») |
| Parties en cours sur un terrain (« partie en cours signalée », jamais « libre » ni « occupé ») | Facile techniquement (table D1 + une requête de la carte), mais peu utile tant qu'il y a peu d'utilisateurs. Variante plus prometteuse : « Partie ouverte, on cherche des joueurs » (voir « Parties en cours sur les terrains ») |
| Organiser des tournois | Le plus lourd. v1 suggérée : un organisateur saisit tout, lien public en lecture seule. Deux formats sans élimination, championnat et système suisse (voir « Tournois ») : un tableau de classement et des appariements simples, pas besoin de bibliothèque de brackets |
| Retrouver / éditer ses contributions | Faisable pour les contributions faites connecté. Anciennes contributions anonymes : votes et avis rattachables depuis le même navigateur (jetons localStorage `mapetanque_vote_…` et `mapetanque_auteur_avis`) ; photos et signalements non rattachables (aucun identifiant de navigateur). Photo déjà sur Mapillary : publiée depuis le compte Mapillary du site, donc retrait possible directement par Rémy ; le crédit (pseudo) est géré côté site |
| Badges (photographe, joueur, critique, signalement) | Facile (seuils calculés sur les contributions) |
| Points pondérés (ex. photo sur terrain sans photo 10 pts, sinon 2, max 3 photos par terrain et par compte) | Facile, à condition d'attribuer les points à la VALIDATION dans l'admin, jamais à l'envoi |
| Badge joueur avec géolocalisation (score saisi à moins de ~200 m du terrain) | Faisable, falsifiable mais enjeu faible |
| Plus tard : forum | À ne pas coder (charge de modération) ; plutôt un Discord ou groupe externe ; les avis par terrain couvrent une partie du besoin |
| Plus tard : petits événements | Moyen (table événement), recoupe les tournois ; compte obligatoire + bouton de signalement |

Ordre retenu (détail dans « Mise en œuvre ») : 1. comptes + rattachement des contributions
envoyées connecté → 2. parties et stats, puis partie partagée en direct et parties en cours
sur la carte → 3. modification de ses contributions, badges et points,
tournois, en temps voulu (tournois une fois l'usage confirmé).

## Authentification — décisions

- PAS de mot de passe pour les visiteurs. Un hachage lent (bcrypt/Argon2/PBKDF2) ne tient pas
  dans les 10 ms de CPU du Worker gratuit, et PBKDF2 est plafonné à 100 000 itérations dans les
  Workers, en dessous des 600 000 recommandées par l'OWASP. Il faudrait de toute façon des mails
  pour « mot de passe oublié », et ce serait une responsabilité en cas de fuite. (Le mot de passe
  admin actuel, unique et long, haché en SHA-256 salé, n'est pas concerné.)
- RETENU : lien magique par mail. Le mail contient le lien ET un code à 6 chiffres : sur mobile,
  le lien s'ouvre souvent dans le navigateur intégré de l'appli mail, pas dans celui où la
  personne a commencé. Inscription et connexion sont un seul et même formulaire (« recevoir un
  lien »).
- Envoi des mails : RETENU Resend. Offre gratuite sans abonnement de base : 3 000 mails/mois,
  mais aussi 100 mails/jour au maximum et 1 seul domaine vérifié. L'envoi s'arrête une fois la
  limite atteinte. Il faut ajouter SPF, DKIM et DMARC chez OVH (le DNS est chez OVH).
- Écarté : Cloudflare Email Service (en bêta publique depuis avril 2026). L'envoi à des adresses
  quelconques est réservé au plan Workers payant (5 $/mois), et le domaine d'envoi doit avoir son
  DNS chez Cloudflare.
- Écarté : boîte mail OVH via SMTP (possible, mais quotas, délivrabilité moindre, pas de suivi)
- RETENU le 10 octobre 2026 : « Continuer avec Google » en plus du lien magique (gratuit ;
  bouton Google Identity Services sur la page Connexion, jeton signé vérifié par le Worker avec
  les clés publiques de Google, vérification RSA légère qui tient dans la limite CPU ; Google
  ajouté dans « Vos données »). Côté site : `GOOGLE_CLIENT_ID` dans connexion.js (vide = pas de
  bouton, la page ne contacte pas Google). Côté Worker : route `POST /compte/google`, brouillon
  dans maquettes/worker-comptes-google.js (non suivi).
- Écarté : connexion Apple (adhésion Apple Developer obligatoire, 99 $/an)
- Une adresse mail = un compte, quelle que soit la méthode de connexion

## Points techniques à respecter

- Worker : le site en utilise déjà deux, `mapetanque-notes` (lecture) et `mapetanque-admin`
  (envois et admin). Décider lequel porte les comptes, ou s'il en faut un troisième. Les routes
  d'envoi existantes doivent de toute façon savoir lire le jeton de session.
- Session : jeton stocké côté navigateur + en-tête Authorization, PAS de cookie. Le Worker est sur
  `workers.dev` et le site sur `mapetanque.be` : ce seraient des cookies tiers, bloqués par
  Safari et isolés par site par Firefox. Une adresse du type `api.mapetanque.be` demanderait le
  DNS chez Cloudflare. En base, ne garder que l'empreinte (SHA-256) du jeton, avec une date
  d'expiration. Le jeton étant lisible par le JavaScript de la page, continuer à échapper tout
  texte saisi par les visiteurs (comme `echapperAvis`).
- Lien magique :
  - Le lien ouvre une page avec un bouton « Me connecter » ; c'est le clic sur ce bouton (une
    requête POST) qui consomme le jeton, pas l'ouverture du lien. Sinon, les messageries qui
    ouvrent les liens automatiquement (Outlook, antivirus d'entreprise) l'utilisent avant la
    personne.
  - Lien et code valables 10 à 15 minutes, utilisables une seule fois ; 5 essais de code au
    maximum, puis il faut redemander un mail.
  - En base, uniquement l'empreinte (SHA-256) du jeton et du code, jamais leur valeur.
- Quotas D1 gratuits largement suffisants (5 M lignes lues / 100 000 écrites par jour, 5 Go). Les
  lignes LUES comptent toutes les lignes parcourues, pas seulement celles renvoyées : mettre des
  index, et calculer classements et stats lourdes la nuit plutôt qu'à chaque affichage. Aucun
  Cron Cloudflare n'est visible dans le dépôt (le code des Workers n'y est pas) ; les Crons
  existants sont ceux de GitHub Actions (`publier-photos.yml` chaque jour à 5 h UTC,
  `update-osm.yml`). À vérifier : ajouter un Cron au Worker, ou faire le calcul nocturne depuis
  GitHub Actions.
- Isoler l'envoi de mails dans une seule fonction du Worker (changement de fournisseur facile)
- Anti-abus : Turnstile sur le formulaire « recevoir un lien » (déjà eu des soucis en le testant,
  à réessayer). Limiter aussi les envois de lien par adresse et par IP : avec 100 mails/jour, un
  formulaire rempli en boucle bloquerait toutes les connexions de la journée.
- RGPD :
  - suppression de compte avec effacement réel. Décidé le 8 octobre 2026 : les contributions
    restent mais deviennent vraiment anonymes, comme le promet confidentialite.html. Pas
    seulement `compte_id` à NULL : on retire aussi le pseudo affiché avec les avis (`avis.pseudo`
    à NULL, `auteur` `compte:<id>` remplacé par une valeur qui ne mène plus au compte) et le
    crédit des photos (`photos.credit_nom` à NULL), pour qu'on ne voie plus que « Anonyme ».
    Les photos déjà sur Mapillary restent sous CC BY-SA, sauf demande de retrait. Penser au
    crédit déjà écrit dans data/photos_mapillary.json (exporterPhotosMapillary garde un
    `credit_nom` existant) : le retirer aussi à l'export suivant.
  - réécrire la section « Vos données » en FR/NL/DE/EN. Elle dit aujourd'hui « pas de compte, et
    rien n'est transmis à qui que ce soit ». Ajouter : ce que contient un compte, Resend comme
    sous-traitant des mails (choisir sa région Europe si elle est proposée), Google si la
    connexion Google est retenue.
- Vigilance : chaque mécanisme de points augmente la charge de modération (Rémy modère seul)

## Tournois (étape ultérieure) — formats envisagés

Deux formats adaptés aux tournois amicaux, présentés comme des alternatives simples et conviviales
à l'élimination directe : tout le monde joue plusieurs parties.

Accroche envisagée (à traduire en NL/DE/EN) : « Vous êtes trop nombreux pour une triplette ?
Pensez à faire un tournoi ! », puis « Pour un tournoi amical, deux formats simples s'offrent à
vous : le championnat et le système suisse. »

### 1. Championnat

Chaque équipe rencontre toutes les autres une fois. Le format le plus simple et le plus équitable
pour un petit nombre d'équipes.

- Idéal jusqu'à environ 6 doublettes ; tout le monde joue le même nombre de parties.
- Exemple : 6 doublettes → 5 parties par équipe, 15 parties en tout, 5 rondes de 3 parties
  simultanées (3 terrains).
- Nombre impair d'équipes : à chaque ronde, une équipe est exemptée (ronde de repos). Le nombre
  de parties par équipe ne change pas ; il y a une ronde de plus.
- Classement : nombre de victoires, puis différentiel de points (points marqués − encaissés),
  puis éventuellement la confrontation directe.
- Durée : une partie en 13 points dure souvent 45 min à 1 h ; 5 rondes occupent donc une bonne
  partie de la journée. Proposer des parties en 11, ou limitées dans le temps, pour les groupes
  plus nombreux.
- Calendrier calculé automatiquement (méthode classique de rotation, dite « méthode de Berger »).

### 2. Système suisse

Chaque équipe joue un nombre fixé de parties, sans rencontrer forcément toutes les autres. À chaque
ronde, les équipes sont appariées selon leurs résultats précédents : on fait progressivement jouer
ensemble des équipes de niveau proche.

- Intéressant à partir d'environ 8 doublettes ; pas d'élimination, tout le monde profite de la
  journée.
- Exemple : 8 doublettes → 4 rondes, donc 4 parties par équipe (4 terrains). Avec 3 rondes, un
  seul vainqueur aurait déjà gagné toutes ses parties ; la 4e affine le classement.
- Appariement simple : ranger les équipes par victoires puis différentiel, apparier dans l'ordre
  en évitant qu'une équipe rejoue contre la même. Variante encore plus simple, courante en
  pétanque (souvent appelée « système Aurard » ou concours en 4 parties) : tirage au sort entre
  équipes ayant le même nombre de victoires.
- Nombre impair : une équipe exemptée par ronde, jamais deux fois la même ; l'exemption compte
  comme une victoire avec un score conventionnel, à fixer et à afficher (13-7 par exemple).
- Classement final : victoires, puis différentiel de points.
- La ronde suivante ne peut être tirée qu'une fois tous les scores de la ronde saisis :
  l'organisateur doit pouvoir saisir vite, et corriger un score.

### Points d'organisation

- Organisateur : compte obligatoire (créer, saisir les scores, corriger). Joueurs : aucun compte,
  un lien public en lecture seule (calendrier, scores, classement), à partager par message.
- Équipes en texte libre (noms des joueurs visibles seulement de l'organisateur, ou publics avec
  leur accord : à décider, RGPD).
- Données légères : une table `tournois` et une table `rencontres` (ronde, équipes, scores) ; le
  classement se recalcule à chaque affichage, il n'y a que quelques dizaines de lignes.
- Choix du format proposé selon le nombre d'équipes saisi : jusqu'à 6, championnat ; à partir de
  8, système suisse ; 7, les deux possibles.

## Partie partagée en direct (étape ultérieure)

Besoin : quatre joueurs sur un terrain, l'un crée la partie dans le compteur, et les trois autres
la voient sur leur téléphone en temps réel (et peuvent saisir les mènes).

### Rejoindre : un QR code, pas d'annuaire

Le plus délicat n'est pas le temps réel, c'est « ajouter les autres ». Les chercher par pseudo
demanderait un annuaire de comptes consultable, une demande de confirmation et des questions de
RGPD (voir « Noms des joueurs » dans le tableau). Les joueurs sont sur le même terrain, donc :

- Le créateur touche « Partager la partie » : le compteur affiche un QR code et un code court
  (par exemple `K7P2`, pour qui n'arrive pas à scanner).
- Les autres le scannent avec l'appareil photo : le lien ouvre le compteur sur cette partie.
  Scanner vaut accord : rien à confirmer, aucun annuaire.
- Aucun compte pour suivre ou saisir. Le compte ne sert qu'à la fin, pour garder la partie dans
  son historique (étape 2) : chaque joueur connecté l'enregistre dans le sien, rattachée au même
  identifiant de partie partagée.
- Code court : 4 caractères sans ambiguïté (sans O/0, I/1), valable le temps de la partie, puis
  libéré. Il ne donne accès qu'au score, pas à un compte.
- QR code : à générer dans le navigateur avec une petite bibliothèque copiée dans `lib/`, comme
  Leaflet (aucune n'y est aujourd'hui).

### Le QR code comme invitation (piste, 10 octobre 2026)

- Ni application ni installation : l'appareil photo du téléphone lit le QR code et ouvre le site
  dans le navigateur, sur le compteur de cette partie.
- Aucun compte pour suivre ou saisir. Le compte est proposé à la fin, sur l'écran de victoire :
  « Garder cette partie dans votre historique » → Connexion (Google en un toucher, ou adresse)
  → pseudo → retour au compteur → partie enregistrée. Le QR code sert donc aussi à faire
  connaître le site et à créer des comptes, sans rien demander pendant la partie.
- En rejoignant, on choisit sa place parmi les joueurs saisis par le créateur (« Qui êtes-vous ? ») :
  ce choix donne son équipe et relie ce nom de son carnet à son compte. Scanner vaut accord,
  comme pour l'étape B.
- Variante bien plus légère, sans temps réel ni Durable Object : un QR code (ou un lien) montré
  seulement en fin de partie, pour que les autres joueurs la gardent dans leur historique. C'est
  l'un des moyens envisagés pour l'étape B.

### Technique : un Durable Object par partie

- Cloudflare Durable Objects, inclus dans l'offre Workers gratuite (version stockée en SQLite).
  Chaque partie partagée a son objet ; les téléphones y restent connectés par WebSocket, et une
  mène saisie est renvoyée aussitôt aux autres.
- Quotas gratuits : 100 000 requêtes par jour, messages WebSocket reçus comptés à 20 pour 1.
  Une partie, c'est environ 4 connexions et 20 à 30 mènes : quelques requêtes. Avec l'API
  d'hibernation, une connexion qui attend la mène suivante ne coûte pas de durée. Relayer une
  mène tient largement dans les 10 ms de CPU.
- Écarté : interroger le Worker toutes les 5 s depuis chaque téléphone. Plus simple, mais environ
  2 900 requêtes par heure de partie pour 4 téléphones, prises sur le même quota de 100 000
  requêtes par jour que le reste du site : une dizaine de parties de 2–3 h suffirait à
  l'atteindre.
- Écarté : Supabase Realtime, Firebase. Un fournisseur et un sous-traitant RGPD de plus.
- La partie en cours vit dans l'objet ; D1 ne reçoit que la partie terminée, pour l'historique.
  Prévoir une alarme de l'objet pour effacer une partie abandonnée (par exemple après 24 h sans
  mène).
- Le navigateur ne peut pas ajouter d'en-tête `Authorization` à une WebSocket : le jeton de
  session, s'il y en a un, part dans le premier message. L'adresse `workers.dev` convient.
- À vérifier : comment les Workers sont déployés aujourd'hui (tableau de bord ou `wrangler`).
  Un Durable Object se déclare dans la configuration du Worker avec une « migration », ce qui est
  plus simple avec `wrangler`. Choisir aussi le Worker qui le porte (voir « Points techniques »).

### Saisie à plusieurs et réseau

- Deux joueurs saisissent la même mène en même temps : chaque envoi porte le numéro de mène
  attendu (« mène 7 »). L'objet traite les messages un par un, accepte le premier et refuse le
  second ; ce téléphone reçoit la mène déjà saisie. Même principe pour « annuler la dernière
  mène ». Le compteur range déjà une entrée par mène (`state.menes` dans `compteur.js`), c'est la
  bonne forme à synchroniser.
- Variante plus simple pour une première version : seul le créateur saisit, les autres
  regardent.
- Réseau faible sur le terrain : le compteur continue de fonctionner hors ligne (la partie est
  déjà gardée dans le navigateur). Les mènes en attente partent au retour du réseau ; en cas de
  conflit, la version de l'objet l'emporte, avec un court message.
- Rien ne change pour qui ne partage pas : le compteur reste tel qu'aujourd'hui.

## Parties en cours sur les terrains (étape ultérieure)

Idée : indiquer sur la carte et les fiches qu'une partie est en cours sur un terrain, signalée par
un joueur de la plateforme. Plus simple que la partie partagée : pas de temps réel, il suffit de
savoir quels terrains ont une partie en cours.

### Ce qu'on peut afficher honnêtement

- On ne voit que les joueurs de la plateforme : un terrain sans signal n'est pas forcément libre
  (des habitués y jouent sans l'appli). Au début, la carte serait presque toujours vide.
- On ne connaît pas le nombre de pistes : OSM ne le donne pas, et plusieurs terrains proches
  sont déjà regroupés (`groupes_terrains.json`). Une partie sur un boulodrome de 10 pistes ne
  l'occupe pas.
- Donc jamais « libre » ni « occupé » : seulement « 1 partie en cours, depuis environ 30 min »
  (ou « 2 parties en cours »).

### Comment le terrain est connu

- Dans le compteur, au début de la partie : question facultative « Où jouez-vous ? », avec le
  terrain le plus proche proposé d'après la position (modifiable). Le même choix pré-remplit
  l'enregistrement de fin de partie (étape 2) et la partie partagée en direct.
- Ou un bouton « Je joue ici » sur la fiche du terrain, pour qui n'utilise pas le compteur, avec
  un bouton « J'ai fini » pour arrêter le signal.
- Le signal s'arrête tout seul : à la fin de la partie, ou après environ 2 h sans mène saisie
  (ou 2 h après « Je joue ici »).
- Écarté : détecter la partie automatiquement par la géolocalisation. Envoyer sa position sans
  action explicite pose un vrai problème de vie privée.

### Vie privée

On publie qu'une personne est à tel endroit en ce moment ; c'est le point sensible.

- Anonyme : aucun pseudo, aucune heure précise (« depuis environ 30 min »).
- Demandé à chaque partie, pas de réglage « toujours partager ».
- Rien n'est gardé après expiration : la ligne est effacée (seule reste la partie que le joueur
  enregistre lui-même dans son historique).
- Risque faible mais pas nul : un joueur seul, sur un terrain isolé, aux mêmes heures. D'où
  l'absence de nom et d'heure précise.
- À ajouter à « Vos données », dans les 4 langues.

### Technique

- Pas besoin de compte. Une petite table D1 `parties_en_cours` : terrain, début, expiration,
  empreinte IP du jour (anti-abus, comme pour les envois actuels).
- La carte et les fiches font une seule requête au Worker, qui renvoie la liste des terrains
  actifs. Réponse mise en cache environ 1 min (API Cache du Worker) pour ménager les quotas :
  la requête ne lit que les lignes non expirées, avec un index sur l'expiration.
- Effacement des lignes expirées : à chaque écriture (`DELETE … WHERE expiration < maintenant`),
  pas besoin de Cron.
- Faux signalements : mêmes limites par IP qu'aujourd'hui (quelques signaux par jour et par IP) ;
  l'enjeu est faible puisque tout expire seul.

### Variante : « Partie ouverte, on cherche des joueurs »

Au lieu de « ce terrain est pris », le joueur indique lui-même que d'autres peuvent le rejoindre
(par exemple « on cherche un 4e »).

- Il l'active lui-même, ce qui règle la question de l'accord.
- Répond à un vrai besoin (trouver des partenaires) et reste intéressant même avec peu
  d'utilisateurs, contrairement au simple signal « partie en cours ».
- Toujours anonyme ; tout au plus un court message choisi dans une liste (« on cherche un
  joueur », « débutants bienvenus »), pas de texte libre : rien à modérer.
- Bouton de signalement, comme pour les événements.

### Place dans les étapes

Après l'étape 2 : une fois que le compteur demande « Où jouez-vous ? », publier le signal ne
demande qu'une table et deux routes. Commencer par la variante « partie ouverte » si l'on ne
devait en garder qu'une.

## Mise en œuvre — réflexion (7 octobre 2026, rien n'est codé)

### Une page par fonction, jamais de doublon

Le site est statique (GitHub Pages) : le même fichier HTML est servi à tout le monde, et seul le
navigateur sait si la personne est connectée. Dupliquer des pages « avec compte » n'apporterait
rien (et ferait ×4 avec les langues).

- Une page = une fonction, identique pour tous ; le JavaScript ajoute ce qu'il faut quand une
  session existe (comme `compteur.js` restaure déjà la partie en cours depuis localStorage).
- Un fichier commun `compte.js`, autonome comme `compteur.js` (pas dépendant de `script.js`) :
  savoir si l'on est connecté et sous quel pseudo, prévenir la page quand ça change, ajouter
  le jeton aux envois vers le Worker, afficher « Se connecter / Mon compte » dans l'en-tête.
- La vraie protection est dans le Worker : une route réservée refuse toute requête sans jeton
  valide. Masquer un bouton n'est qu'un confort.
- Seules pages nouvelles, générées en 4 langues comme `a-propos`, en `noindex` et hors sitemap :
  - Connexion : adresse, puis code ; c'est aussi la page d'arrivée du lien (bouton « Me
    connecter »).
  - Mon compte : pseudo, contributions et leur statut, parties et stats, suppression du compte.
- Plus tard, un tournoi = une seule page `tournoi.html?id=…` remplie par le JavaScript.
- Pages existantes : seulement une balise script et l'emplacement du bouton dans l'en-tête, puis
  relancer les générateurs.

### Ce qui change quand on est connecté

Deux cas bien distincts :

- Envois déjà possibles sans compte (photo, terrain manquant, erreur, note, avis) : être
  connecté n'est qu'un confort. Le Worker range le compte avec l'envoi, et le formulaire
  pré-remplit le pseudo. Aucune mention ni publicité dans ces formulaires : l'envoi anonyme
  reste exactement tel qu'aujourd'hui, sans rien de plus à lire.
- Fonctions qui n'existent qu'avec un compte (historique des parties, plus tard badges,
  tournois) : là, le compte EST la fonction, il faut donc le proposer à l'endroit où elle sert
  (par exemple l'écran de victoire du compteur), avec la même phrase partout : « Gratuit, sans
  mot de passe : juste votre adresse mail. »

Pour que les avantages restent trouvables : le bouton « Se connecter / Mon compte » dans
l'en-tête, et une section « Pourquoi un compte ? » sur la page Connexion (ce qu'on y gagne, dont
le suivi de ses envois ; ce qui est enregistré ; lien vers « Vos données »).

Pas de mail de suivi (« votre photo est publiée ») : le quota Resend (100/jour) est réservé aux
connexions. Le suivi se consulte dans « Mon compte ».

Comportements à prévoir dès l'étape 1, pour que le compte soit cohérent sur tout le site :

| Interaction | Connecté | Pas connecté |
|---|---|---|
| Ajout d'une photo | Envoi rattaché au compte, crédit pré-rempli avec le pseudo | Inchangé |
| Signalement d'un terrain manquant | Envoi rattaché au compte | Inchangé |
| Signalement d'une erreur | Envoi rattaché au compte | Inchangé |
| Note et avis (panneau « Noter ») | Rattachés au compte, pseudo pré-rempli, une note et un avis par compte et par terrain | Inchangé (jetons du navigateur) |
| En-tête de toutes les pages | « Mon compte » | « Se connecter » |
| Compteur (étape 2) | Panneau « Enregistrer la partie » sur l'écran de victoire | Bouton « Garder cette partie dans votre historique » sur l'écran de victoire |

### Le compteur (étape 2)

Remplacé le 10 octobre 2026 par « Étape 2 — enregistrement des parties » (fin du fichier) :
enregistrement automatique, pastille « Vous » et panneau « Équipes ». Gardé pour l'historique.

Rien ne change pendant la partie (on l'utilise debout sur le terrain). Tout se passe sur l'écran
de victoire :

- Pas connecté : bouton « Garder cette partie dans votre historique » (avec le pictogramme) →
  connexion → retour au compteur → partie enregistrée. La partie survit au détour parce qu'elle
  est déjà gardée dans le navigateur (`mapetanque_compteur_partie`). C'est aussi pour ce cas
  qu'il faut le code à 6 chiffres : si le lien s'ouvre dans le navigateur de l'appli mail, la
  partie n'y est pas.
- Connecté : panneau « Enregistrer la partie » : terrain (proposé d'après la position, le plus
  proche, modifiable), « Mon équipe : A / B », joueurs de chaque équipe en texte libre ; score,
  objectif et mènes sont déjà connus. Un bouton, et la partie apparaît dans « Mon compte ».
- Variante pour plus tard : garder aussi les 10 dernières parties sur l'appareil sans compte,
  importées à la création du compte (« vos parties ne sont que sur ce téléphone »).

### Étapes

1. Comptes, cohérents sur tout le site :
   - connexion (lien + code), pages Connexion et Mon compte, bouton dans l'en-tête ;
   - les routes d'envoi existantes (photo, signalement de terrain manquant, d'erreur, note, avis)
     acceptent un jeton facultatif et rangent le compte avec l'envoi ;
   - « Mon compte » liste ces contributions avec leur statut (en attente, publiée, refusée) ;
   - comportements « connecté » du tableau ci-dessus (sans mention dans les formulaires) ;
   - « Vos données » réécrite en 4 langues ;
   - facultatif : rattacher les votes et avis déjà envoyés depuis ce navigateur.
2. Enregistrement des parties depuis le compteur, historique et stats dans « Mon compte ».
   Ensuite, partie partagée en direct (QR code, Durable Object) : elle ne demande pas de compte,
   mais prend tout son intérêt quand chacun peut garder la partie dans son historique.
   Puis, avec la question « Où jouez-vous ? » du compteur, les parties en cours sur la carte
   (de préférence la variante « partie ouverte »).
3. En temps voulu : modification de ses contributions, badges et points, tournois, événements.

### Avant de coder

1. Décrire les parcours écran par écran : créer un compte depuis une fin de partie ou depuis
   l'envoi d'une photo, se connecter sur un nouveau téléphone, envoyer un avis connecté,
   supprimer son compte.
2. Esquisser les tables :
   - `comptes` : adresse, pseudo, date de création ;
   - `sessions` : empreinte du jeton, compte, expiration ;
   - `liens_connexion` : empreintes du lien et du code, expiration, essais ;
   - `parties` : compte, terrain, date, objectif, scores, mon équipe, joueurs, mènes ;
   - colonne facultative `compte_id` dans les tables actuelles (notes, avis, photos,
     signalements).
3. Lister les routes du Worker : nouvelles (demander un lien, vérifier, « moi », mes
   contributions, parties) et existantes (jeton facultatif).
4. Préparer les textes en 4 langues dans `translations.js` (clés `compte_*`).

## Étape 1 — spécification (8 octobre 2026)

Décidé : un troisième Worker, `mapetanque-comptes`, créé dans le tableau de bord Cloudflare
comme les deux autres. Il porte la connexion et « Mon compte ». Les Workers existants ne font que
lire le jeton de session (petite fonction copiée, voir « Lire le jeton dans les Workers
existants »).

### Configuration du Worker `mapetanque-comptes`

- Liaison D1 `DB` : la base existante `mapetanque-notes` (la même que les deux autres Workers).
- Secrets : `RESEND_API_KEY`, `TURNSTILE_SECRET`, `SEL_IP` (sel des empreintes IP, le même
  principe que dans les Workers existants).
- Variables : `EXPEDITEUR` (`mapetanque.be <connexion@mapetanque.be>`), `URL_SITE`
  (`https://mapetanque.be`).
- CORS : n'accepter que l'origine `https://mapetanque.be` (et `http://127.0.0.1:5500` pour Live
  Server), répondre aux requêtes `OPTIONS` avec `Access-Control-Allow-Headers: Content-Type,
  Authorization`.

### Tables

Dates au format de `datetime('now')` (`AAAA-MM-JJ HH:MM:SS`, UTC) et colonnes `cree` / `maj`,
comme dans les tables existantes : les comparaisons d'échéance se font en texte.

```sql
-- Un compte = une adresse. L'identifiant est aléatoire : jamais l'adresse dans les autres tables.
CREATE TABLE comptes (
  id TEXT PRIMARY KEY,                 -- crypto.randomUUID()
  email TEXT NOT NULL UNIQUE,          -- en minuscules, espaces retirés
  pseudo TEXT,                         -- obligatoire depuis le 10 octobre 2026, 20 caractères au plus
  langue TEXT NOT NULL DEFAULT 'fr',   -- fr, nl, de, en : langue des mails
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  derniere_connexion TEXT
);

-- Seule l'empreinte du jeton est gardée : une fuite de la base ne donne accès à aucun compte.
CREATE TABLE sessions (
  empreinte TEXT PRIMARY KEY,          -- SHA-256 du jeton, en hexadécimal
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  expire TEXT NOT NULL                 -- cree + 1 an
);
CREATE INDEX sessions_compte ON sessions(compte_id);
CREATE INDEX sessions_expire ON sessions(expire);

-- Une ligne par mail envoyé. Le compte n'est créé qu'à la vérification, jamais à la demande.
CREATE TABLE liens_connexion (
  id TEXT PRIMARY KEY,                 -- identifiant de la demande, renvoyé au navigateur
  email TEXT NOT NULL,
  langue TEXT NOT NULL DEFAULT 'fr',   -- reprise par le compte s'il est créé
  empreinte_lien TEXT NOT NULL UNIQUE, -- SHA-256 du jeton du lien
  empreinte_code TEXT NOT NULL,        -- SHA-256 de (id + code) : le même code n'a pas la même empreinte d'une demande à l'autre
  essais INTEGER NOT NULL DEFAULT 0,   -- essais de code ; 5 au plus
  utilise INTEGER NOT NULL DEFAULT 0,
  empreinte_ip TEXT NOT NULL,          -- empreinte IP du jour (limites anti-abus)
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  expire TEXT NOT NULL                 -- cree + 15 min
);
CREATE INDEX liens_email ON liens_connexion(email, cree);
CREATE INDEX liens_ip ON liens_connexion(empreinte_ip, cree);
CREATE INDEX liens_cree ON liens_connexion(cree);
```

Pas de rattachement par `envois_visiteurs` (compteur journalier par IP des photos, avis et
signalements) : y compter les demandes de lien prendrait sur le quota d'envois des visiteurs.

Tables existantes, à l'étape 3 seulement (en même temps que la modification de leurs Workers,
pour vérifier d'abord qu'aucun `INSERT` n'y est écrit sans liste de colonnes) :

```sql
-- Rattachement facultatif au compte (NULL = envoi anonyme, comme aujourd'hui).
ALTER TABLE votes ADD COLUMN compte_id TEXT;
ALTER TABLE avis ADD COLUMN compte_id TEXT;
ALTER TABLE photos ADD COLUMN compte_id TEXT;
ALTER TABLE signalements ADD COLUMN compte_id TEXT;
CREATE INDEX votes_compte ON votes(compte_id);
CREATE INDEX avis_compte ON avis(compte_id);
CREATE INDEX photos_compte ON photos(compte_id);
CREATE INDEX signalements_compte ON signalements(compte_id);
```

- `confirmations` n'a pas besoin de `compte_id` : les critères suivent le jeton du vote.
- Vote connecté : le Worker cherche le jeton du vote du compte sur ce terrain
  (`WHERE compte_id = ? AND osm_id = ?`) et le traite comme si le navigateur l'avait envoyé ;
  `notes_agregees` reste mise à jour par le chemin actuel.
- Avis connecté : `auteur` = `compte:<compte_id>`, si bien que le remplacement actuel (« un
  nouvel avis remplace le précédent du même auteur ») vaut aussi pour le compte.
- Statuts à afficher dans « Mon compte » : photos `en_attente` / `a_generer` = en attente,
  `validee` / `envoyee` / `rattachee` = acceptée, `refusee` = refusée ; signalements `nouveau`,
  `traite`, `refuse` ; avis : valeurs à relire dans le code du Worker admin. Les votes n'ont
  pas de statut.

Pas de clé étrangère sur les `compte_id` ajoutés : la suppression de compte les traite
explicitement (voir la route `/compte/supprimer`).

Nettoyage sans Cron : chaque `POST /compte/lien` efface les liens de plus de 24 h et les sessions
expirées (`DELETE … WHERE expire < datetime('now')`, sur les index).

### Routes de `mapetanque-comptes`

Toutes en JSON. « Jeton » = en-tête `Authorization: Bearer <jeton de session>`.

| Route | Entrée | Réponse | Remarques |
|---|---|---|---|
| `POST /compte/lien` | `email`, `langue`, `turnstile` | `{ demande }` | Même réponse que l'adresse ait un compte ou non. Envoie le mail (lien + code). |
| `POST /compte/connexion` | `lien` (jeton du lien) | `{ jeton, compte }` | Appelée par le bouton « Me connecter » de la page d'arrivée, jamais à l'ouverture du lien. Crée le compte s'il n'existe pas. |
| `POST /compte/google` | `credential` (jeton Google), `langue` | `{ jeton, compte }` | Jeton vérifié (signature, `iss`, `aud` = `GOOGLE_CLIENT_ID`, `exp`), `email_verified` exigé. Crée le compte s'il n'existe pas. Erreurs `google_invalide`, `google_non_verifie`. |
| `POST /compte/code` | `demande`, `code` | `{ jeton, compte }` | 5 essais par demande, puis il faut redemander un mail. |
| `GET /compte/moi` | jeton | `{ email, pseudo, langue, cree }` | 401 si le jeton est absent, inconnu ou expiré : la page oublie alors la session. |
| `POST /compte/pseudo` | jeton, `pseudo` | `{ pseudo }` | 20 caractères au plus (30 jusqu'au 10 octobre 2026). Obligatoire et unique depuis le 10 octobre 2026 (voir « Pseudo obligatoire et unique ») : erreurs `pseudo_vide`, `pseudo_pris` (409), `pseudo_invalide`. |
| `POST /compte/deconnexion` | jeton | `{ ok }` | Efface la session de cet appareil seulement. |
| `GET /compte/contributions` | jeton | listes `votes`, `avis`, `photos`, `signalements` avec terrain, date et statut | Une requête par table, sur l'index `compte_id`. |
| `POST /compte/supprimer` | jeton, `confirmation: true` | `{ ok }` | Efface le compte et ses sessions ; met `compte_id` à NULL dans les contributions et les rend anonymes (pseudo des avis, crédit des photos : voir RGPD). |

`compte` dans les réponses = `{ email, pseudo, langue }`, sans identifiant interne.

### Limites anti-abus de `/compte/lien`

- Turnstile vérifié côté Worker (`siteverify`) avant tout le reste.
- 3 demandes par adresse et par heure ; 10 par empreinte IP et par jour.
- Plafond global : refuser au-delà de 90 mails dans la journée (marge sous les 100 de Resend),
  avec un message « réessayez demain » plutôt qu'un échec silencieux.
- Toutes ces limites se comptent dans `liens_connexion` (index ci-dessus), sans table de plus.

### Jetons et mail

- Jeton de session et jeton du lien : 32 octets aléatoires (`crypto.getRandomValues`) en
  base64url. Code : 6 chiffres aléatoires.
- Lien du mail : `https://mapetanque.be/connexion.html#lien=<jeton>` (version NL/DE/EN selon la
  langue de la demande). Le jeton est après `#` : il n'est jamais envoyé au serveur (GitHub
  Pages) ni dans l'en-tête Referer.
- La page d'arrivée retire aussitôt `#lien=…` de l'adresse (`history.replaceState`).
- Mail en texte simple + HTML minimal, dans la langue de la demande ; une seule fonction
  `envoyerMail(env, a, sujet, texte, html)` parle à Resend.
- Côté navigateur, le jeton de session est rangé dans `localStorage` (`mapetanque_session`),
  avec l'adresse et le pseudo pour afficher l'en-tête sans requête.

### Lire le jeton dans les Workers existants

Routes concernées : `POST /vote` et `POST /confirmation` (`mapetanque-notes`), `POST /avis/envoi`,
`/photos/envoi`, `/signalements/envoi` (`mapetanque-admin`).

- Une fonction `compteDepuisRequete(request, env)` copiée dans les deux Workers : lit l'en-tête,
  calcule l'empreinte, cherche une session non expirée, renvoie `compte_id` ou `null`. Jeton
  absent ou invalide = envoi anonyme, jamais une erreur.
- Ces routes reçoivent aujourd'hui des requêtes sans en-tête particulier (`/avis/envoi` part en
  FormData). Avec `Authorization`, le navigateur envoie d'abord une requête `OPTIONS` : les deux
  Workers doivent y répondre avec `Authorization` dans `Access-Control-Allow-Headers`, sinon
  l'envoi échoue pour les personnes connectées.
- Vote ou avis connecté : le Worker remplace la contribution du compte sur ce terrain (au lieu
  de celle du jeton du navigateur).

### Ordre de réalisation

1. Créer les tables (console D1), puis le Worker `mapetanque-comptes` avec `/compte/lien`,
   `/compte/connexion`, `/compte/code`, `/compte/moi`, `/compte/deconnexion`. Tester depuis
   PowerShell (`Invoke-RestMethod`) avant toute page.
2. `compte.js`, page Connexion (4 langues, `noindex`, hors sitemap), bouton « Se connecter /
   Mon compte » dans l'en-tête, clés `compte_*` dans `translations.js`.
3. `compteDepuisRequete` et CORS dans les deux Workers existants ; `compte.js` ajoute le jeton
   aux envois.
4. Page Mon compte : pseudo, contributions et statut, déconnexion, suppression.
5. « Vos données » réécrite en 4 langues, avant la mise en ligne du bouton dans l'en-tête.


## Pseudo obligatoire et unique (décidé le 10 octobre 2026)

Pourquoi : pour les parties et leurs statistiques, il faut savoir qui joue avec qui ; plusieurs
« Anonyme » rendraient l'historique illisible. Le pseudo du compte n'est pas imposé aux
contributions publiques : le formulaire d'avis garde son propre champ pseudo, facultatif.

- Demandé juste après la première connexion, sur la page Connexion, avant tout le reste (pas de
  bouton « Continuer » sans pseudo). Un compte créé avant cette règle est arrêté au même endroit,
  et « Mon compte » ouvre directement le champ.
- Unique sans tenir compte des majuscules, des accents ni des espaces en trop : « Rémy » et
  « remy » sont le même pseudo. Le Worker garde une clé normalisée dans une colonne à index
  unique (`pseudo_cle`) ; l'index protège aussi de deux inscriptions simultanées.
- Mots réservés refusés (`pseudo_invalide`) : anonyme, mapetanque, admin, administrateur,
  moderateur (comparés sur la clé normalisée). 2 caractères au moins.
- Suppression du compte : la ligne `comptes` disparaît, le pseudo redevient libre.

```sql
-- Vérifier d'abord qu'aucun doublon n'existe déjà (sinon l'index unique échoue) :
SELECT lower(pseudo), COUNT(*) FROM comptes WHERE pseudo IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
ALTER TABLE comptes ADD COLUMN pseudo_cle TEXT;
CREATE UNIQUE INDEX comptes_pseudo_cle ON comptes(pseudo_cle);
```

Fait le 10 octobre 2026 : colonne `pseudo_cle` et index unique créés dans D1 (aucun doublon).

Avis d'une personne connectée (décidé le 10 octobre 2026, Rémy) : signé du pseudo du compte,
sans champ pseudo dans le formulaire (« Publié sous votre pseudo … », `script.js`). Côté Workers :
`/avis/envoi` prend le pseudo du compte, jamais celui envoyé ; `/compte/pseudo` met aussi à jour
`avis.pseudo` des avis du compte, pour que tous ses avis suivent un changement de pseudo.

Les pseudos déjà enregistrés reçoivent leur clé au prochain passage par `/compte/pseudo`, ou
par un UPDATE unique fait depuis le Worker (la normalisation des accents se fait en JavaScript,
pas en SQL).

## Prochaine étape

Fait le 8 octobre 2026 : compte Resend créé, domaine `mapetanque.be` vérifié (région Ireland
eu-west-1, suivi des clics et des ouvertures désactivé). DNS chez OVH : TXT
`resend._domainkey` (DKIM), CNAME `rsend` et `send` (Resend ne demande plus de MX ni de SPF),
TXT `_dmarc` en `p=none`. La clé API n'est pas encore créée : la faire au moment de créer le
Worker, avec la permission « Sending access » limitée à `mapetanque.be`, et la coller
directement dans ses secrets.

Fait le 8 octobre 2026 : tables `comptes`, `sessions`, `liens_connexion` créées ; Worker
`mapetanque-comptes` déployé avec `/compte/lien`, `/compte/connexion`, `/compte/code`,
`/compte/moi`, `/compte/deconnexion`, testé depuis PowerShell (mail reçu, lien direct sans
redirection Resend, mauvais code refusé, connexion par code, `/compte/moi`). Turnstile encore
désactivé (`TURNSTILE_ACTIF` = `non`) : à passer à `oui` avant de mettre le bouton
« Se connecter » en ligne.

Fait le 8 octobre 2026 : page Connexion en 4 langues (`connexion.html`, générée par
`scripts/generer_connexion.py`), d'après la maquette validée (`maquettes/connexion/`, gardée en
local) : `compte.js` (session), `connexion.js` (quatre états : adresse, code en 6 cases avec
validation au 6e chiffre, arrivée par le lien, connecté avec pastille et pseudo proposé juste
après la connexion), `boule-tournante.js` (boule pleine qui tourne pendant l'attente du code).
Route `POST /compte/pseudo` ajoutée au Worker. Turnstile activé (`TURNSTILE_ACTIF` = `oui`).
Testé avec Live Server (127.0.0.1:5501) : connexion par code, par lien, code faux, pseudo.
La page est en ligne mais aucun lien n'y mène encore (et `noindex`).

Page Confidentialité en ligne depuis le 8 octobre 2026 (point 5 fait) ; « Vos données » d'À
propos n'en est plus qu'un résumé.

Fait le 8 octobre 2026 (point 3) : colonnes `compte_id` (+ index) dans `votes`, `avis`,
`photos`, `signalements`. `mapetanque-notes` : CORS avec `Authorization`,
`compteDepuisRequete` ; note connectée = la note du compte sur ce terrain est remplacée (même
depuis un autre appareil), sinon celle du navigateur est rattachée au compte, sinon une nouvelle
note est créée avec le compte. `mapetanque-admin` : `compteDepuisRequete` et
`rattacherAuCompte` (UPDATE après l'INSERT, un échec laisse l'envoi anonyme) pour photos et
signalements ; avis connecté : `auteur` = `compte:<id>` (le remplacement d'un avis par le
suivant vaut donc pour le compte) et `compte_id` rempli. `script.js` : `entetesCompte()` joint
le jeton aux cinq envois. Testé : note et avis connectés rangés avec le compte.
Pas encore fait : rattacher à la première connexion les envois anonymes déjà faits depuis ce
navigateur (votes `mapetanque_vote_…`, avis `mapetanque_auteur_avis`), et pré-remplir le pseudo
dans les formulaires d'avis et de photo.

Suite : point 4 (page Mon compte, avec « Mes envois », `/compte/contributions` et la
suppression du compte). Le bouton « Se connecter /
Mon compte » de l'en-tête ne sera mis en ligne qu'ensuite : l'écran 1 promet « Suivez vos
envois ». Les raccourcis « Mes envois » et « Mes parties » de l'écran 4 de la maquette
viendront avec la page Mon compte.

Fait le 10 octobre 2026 (côté site, pas encore poussé) : page Mon compte en 4 langues
(`mon-compte.html`, générée par `scripts/generer_mon_compte.py` ; `mon-compte.js`,
`style-mon-compte.css`, clés `moncompte_*`), d'après la maquette validée. Sans session, renvoi
vers Connexion avec `?retour=`. Nom et lieu des terrains tirés de `data/recherche.json` (et de
`data/groupes_terrains.json` pour les terrains regroupés). Après suppression : un mot de fin dans
la page plutôt qu'un message sur l'accueil (pas de mécanisme de message sur l'accueil à créer).
Pseudo obligatoire et unique côté Connexion et Mon compte. Testé avec un Worker simulé.
Reste : routes `/compte/contributions` et `/compte/supprimer`, règles du pseudo dans
`/compte/pseudo` (code du Worker à reprendre du tableau de bord), puis la ligne compte du menu.

Forme attendue de `/compte/contributions`, chaque liste du plus récent au plus ancien, `date` =
`cree` de la ligne : `votes` `[{ osm_id, note, date }]`, `avis` `[{ osm_id, texte, statut,
date }]` avec `statut` ramené à `en_attente` / `publie` / `refuse` / `retire` (avis remplacés
exclus), `photos` `[{ osm_id, statut, date }]` (statut brut ; refusées de plus de 30 jours
exclues), `signalements` `[{ type, osm_id, titre, lat, lon, statut, date }]`.

Fait le 10 octobre 2026 : Workers mis à jour et testés par Rémy. `mapetanque-comptes` :
`/compte/contributions`, `/compte/supprimer`, pseudo obligatoire et unique (`pseudo_cle`, mots
réservés, pas d'allure de lien), les avis du compte suivent son pseudo. `mapetanque-admin` :
avis connecté signé du pseudo du compte, crédit retiré de l'export quand `credit_nom` est vidé,
et correction de l'envoi des signalements (variable `email` jamais déclarée depuis le
9 octobre : tous les signalements échouaient).
Suite : ligne compte en haut du menu mobile et lien dans la barre de l'ordinateur ; puis
modification de ses notes et avis depuis « Mon compte ».

Proposé le 10 octobre 2026 (à confirmer par Rémy) : « Mes parties » reste un résumé court dans
« Mon compte » (trois chiffres : parties jouées, part de victoires, dernière partie) avec un lien
« Voir mes statistiques » vers une page à part (`mes-parties.html`) : historique filtrable,
statistiques (nombre, scores, durée, victoires et défaites, par catégorie et par date) et
graphiques. Tant que l'enregistrement des parties n'existe pas, la carte « bientôt » reste telle
quelle.

Modification des notes et avis (10 octobre 2026, site prêt, pas encore poussé) : dans « Mes
envois », une note ou un avis mène à la fiche ouverte sur « Noter » (`carte.html?…&noter=1`).
Connecté, le panneau reprend la note et le dernier avis du compte (`/compte/contributions`,
chargé à la première ouverture de « Noter »), même donnés depuis un autre appareil ; un nouvel
avis part sur la même piste que l'ancien pour le remplacer, et repasse par la modération.
« Retirer mon avis » (deux appuis) : route `POST /compte/avis/retirer` du Worker des comptes,
immédiate et sans modération (accepté par Rémy) ; l'avis disparaît du site au renouvellement du
paquet public (5 minutes). `mapetanque-admin` joint à un avis connecté la note du compte.

Abandonné le 10 octobre 2026 : rattacher au compte les notes, avis et photos envoyés sans compte
depuis le navigateur. Risque d'attraper les envois d'un autre sur un appareil partagé, et Rémy
préfère la règle simple : pour qu'un avis soit dans son compte, on se connecte avant de le
laisser. (La route `/compte/rattacher` n'a pas été mise en ligne.)

Après la connexion (10 octobre 2026, demandé par Rémy) : on quitte la page Connexion, comme sur
la plupart des sites : retour à la page d'où l'on venait (`?retour=`), sinon l'accueil. Le pseudo
est d'abord demandé si le compte n'en a pas. Arriver sur la page Connexion en étant déjà connecté
mène à « Mon compte ».

## Étape 2 — enregistrement des parties (décidé le 10 octobre 2026)

Maquette cliquable validée par Rémy le 10 octobre 2026 (artefact « Compteur connecté » sur
claude.ai). Deux phases : d'abord le compteur qui enregistre, ensuite la page « Mes parties »
(liste et statistiques), avec sa propre maquette.

### Pendant la partie : rien de plus à faire

- Le compteur démarre pareil, connecté ou non : on marque tout de suite.
- Connecté : une pastille « Vous » sur une moitié. Elle dit « vous êtes connecté » et « vous jouez
  dans cette équipe ». Posée d'office sur l'équipe A, ensuite sur l'équipe de la partie
  précédente. Aucune question au départ. La toucher (ou le nom d'équipe) ouvre « Équipes ».
- Le bouton « Renommer » devient « Équipes », pour tout le monde :
  - format : 1 contre 1 (tête-à-tête), 2 contre 2 (doublette), 3 contre 3 (triplette) ; par
    défaut celui de la partie précédente, doublette la première fois ;
  - places de chaque équipe selon le format, pouvant rester vides ; « Changer d'équipe » sur sa
    propre ligne ; nom d'équipe facultatif ;
  - connecté : « Ajouter un partenaire / un adversaire » propose les joueurs récents du carnet
    (un toucher) ou un prénom à taper ; case « Garder cette partie dans Mes parties » (cochée ;
    à décocher quand on compte pour d'autres) ;
  - pas connecté : noms seulement, gardés sur le téléphone.
- En tête-à-tête, pastilles +2 et +3 seulement (3 boules par joueur). Jeu à 4 boules : pas prévu.
- Équipes inégales (2 contre 3) : pas prévues. Chacun pour soi à trois : hors sujet.
- Nom affiché sur le compteur : le nom d'équipe s'il est saisi, sinon les prénoms
  (« Vous & Julie », « Marc · Paul »), sinon « Équipe A / B ».
- « Nouvelle partie » garde les joueurs (revanche sans rien régler).

### À la fin : enregistrement automatique

- Une partie gagnée est enregistrée seule si elle a duré au moins 3 mènes et 5 minutes (temps
  entre le premier et le dernier point). En dessous, c'est un essai du compteur : pas
  d'enregistrement, et pas de bouton pour forcer.
  L'écran de fin dit seulement « Partie trop courte : pas enregistrée ».
- Partie interrompue (pluie, départ, « Nouvelle partie » en cours de jeu) : ignorée.
- Écran de victoire, connecté : « Vous gagnez ! » (Caveat) ou « {équipe} gagne », puis un résumé
  « Enregistrée dans Mes parties » : victoire ou défaite et score vu de son côté, fanny
  (13 – 0) signalée, nombre de mènes et durée, « Avec Julie, contre Marc et Paul » (ou
  « Doublette, joueurs non précisés »), « Ajouter le terrain » (le plus proche d'après la
  position, modifiable, facultatif). Boutons « Modifier les équipes » et « Retirer ».
- « Annuler le dernier point » après la victoire, puis nouvelle victoire : la même partie est
  remplacée (identifiant tiré par le téléphone, voir plus bas).
- Pas connecté : « Garder cette partie dans votre historique » (« Gratuit, sans mot de passe :
  juste votre adresse mail. ») → Connexion → retour au compteur → « Dans quelle équipe
  jouiez-vous ? » (et « Lequel de ces joueurs êtes-vous ? » si l'équipe est pleine, ou « Je
  n'ai pas joué ») → partie enregistrée.
- Pas de réseau : la partie attend sur le téléphone (localStorage) et part au retour du réseau ;
  l'écran de fin dit « Sera enregistrée dès que possible ».

### Ajouter un ami : trois étapes

- A, avec l'enregistrement : carnet de noms privé (« Julie »), visible du seul titulaire du
  compte. Suffit pour les stats par partenaire et par adversaire.
- B, après « Mes parties » : relier un nom du carnet à un compte. L'autre reçoit la partie avec
  Garder ou Refuser ; rien n'est partagé avant son acceptation. Après un premier « Garder », les
  parties suivantes avec la même personne peuvent arriver directement (toujours retirables).
  Moyen d'inviter à choisir : pseudo exact (unique, sans annuaire ni recherche), QR code montré
  en fin de partie, ou lien envoyé par message.
- C, ensuite : partie partagée en direct (voir « Partie partagée en direct »).
- Décidé le 11 octobre 2026 : B et C ne font plus qu'une étape, avec un seul QR code (voir
  « Étapes B et C fusionnées : la partie partagée », en fin de fichier). L'invitation par pseudo
  est remise à plus tard.

### Données

```sql
-- Brouillon, à relire avant création dans la console D1.
CREATE TABLE parties (
  id TEXT PRIMARY KEY,               -- tiré par le téléphone (crypto.randomUUID) : renvoyer la même partie la remplace
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  debut TEXT NOT NULL,               -- premier point (UTC, format datetime('now'))
  fin TEXT NOT NULL,                 -- point gagnant
  objectif INTEGER NOT NULL,         -- 11 ou 13
  format INTEGER NOT NULL,           -- 1, 2 ou 3 joueurs par équipe
  mon_equipe TEXT NOT NULL,          -- 'a' ou 'b'
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  victoire INTEGER NOT NULL,         -- 1 si mon équipe a gagné
  nom_a TEXT, nom_b TEXT,            -- noms d'équipe saisis, sinon NULL
  joueurs TEXT NOT NULL,             -- JSON { a: [joueur_id…], b: [joueur_id…] }, sans le titulaire
  menes TEXT NOT NULL,               -- JSON, la forme de state.menes dans compteur.js
  terrain_osm_id TEXT,               -- facultatif
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  maj TEXT
);
CREATE INDEX parties_compte ON parties(compte_id, fin);

-- Carnet de joueurs, privé à chaque compte. compte_lie servira à l'étape B.
CREATE TABLE joueurs (
  id TEXT PRIMARY KEY,
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,                 -- 20 caractères au plus
  compte_lie TEXT,
  cree TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX joueurs_compte ON joueurs(compte_id);
```

- Routes, dans `mapetanque-comptes` (il porte déjà la session) : enregistrer ou remplacer une
  partie, la retirer, lister mes parties, lister et corriger mon carnet. Le Worker vérifie à
  nouveau le seuil (3 mènes, 5 minutes) et la cohérence du score.
- La suppression du compte efface ses parties et son carnet (`ON DELETE CASCADE` ; à vérifier
  que `PRAGMA foreign_keys` est actif dans D1, sinon effacer explicitement dans
  `/compte/supprimer`).
- `compteur.js` garde en plus dans sa sauvegarde : identifiant de partie, heure du premier point
  et heure de chaque mène, format, joueurs, place du titulaire, case « Garder ».
- « Vos données » (4 langues) : ajouter les parties et le carnet de noms.

### Phase 1 codée (10 octobre 2026, branche `claude/parties-compteur`)

Côté site, prêt à tester :
- `compteur.js` : panneau « Équipes » (remplace « Renommer » ; format, joueurs, nom d'équipe,
  « Changer d'équipe », case « Garder »), pastille « Vous », « Ajouter un joueur » avec les noms
  récents (gardés sur le téléphone, `mapetanque_compteur_joueurs`, et carnet du compte par
  `/compte/joueurs`), pastilles +1 à +3 en tête-à-tête, heure de chaque mène (`t`), carte de
  l'écran de fin (tous les cas de « À la fin »), terrain proposé ou « Ajouter le terrain »
  (terrains à moins de 5 km tirés de `data/recherche.json`, proposé d'office à moins de 500 m),
  annonce du vainqueur en Caveat.
- File d'envoi `mapetanque_parties_a_envoyer` : la dernière action sur une partie (enregistrer
  ou retirer) part au Worker, au retour du réseau si besoin (événement `online`, retour sur la
  page). Chaque entrée garde l'adresse du compte qui a joué : elle n'est envoyée qu'avec la
  session de ce compte. « Annuler le dernier point » après une victoire retire la partie ;
  modifier les équipes ou le terrain la renvoie (même identifiant, remplacée).
- `compte.js` chargé sur les quatre pages du compteur ; `translations.js?v=3`,
  `compteur.js?v=2`, `style-compteur.css?v=2` ; clés `compteur_*` en 4 langues (celles de
  « Renommer » retirées).
- Confidentialité (4 langues) : parties et noms des joueurs, leur durée de conservation, la
  position lue seulement à la demande et jamais envoyée, effacement avec le compte.

Côté Worker, à faire par Rémy (code dans `workers/comptes-parties.js`, tables dans
`workers/comptes-parties.sql`) :
1. Console D1 : coller `workers/comptes-parties.sql` (tables `parties` et `joueurs`).
2. Remplacer tout le code de `mapetanque-comptes` par le fichier complet préparé le 10 octobre
   2026 à partir du code en ligne (routes des parties branchées dans le `fetch`, une par ligne ;
   `supprimerCompte` efface aussi `parties` et `joueurs`). La section ajoutée est copiée dans
   `workers/comptes-parties.js` ; elle utilise `json`, `lireJson` et `compteDepuisRequete` du
   Worker.
3. Déployer, puis tester avec Live Server (port 5500 ou 5501, tous deux acceptés).

Essayé dans le cloud : les routes sur une base SQLite qui imite D1 (21 essais : enregistrer,
remplacer, refus des parties trop courtes, pas finies, d'un autre compte…), puis le compteur
dans Chromium avec ce faux Worker (37 essais : équipes, partie trop courte, enregistrée,
annulée, retirée, changement d'équipe après coup, terrain, tête-à-tête, hors ligne puis retour
du réseau, partie jouée sans compte puis connexion, version néerlandaise).

## Étape 2, phase 2 — page « Mes parties » (décidé le 10 octobre 2026)

Maquette validée par Rémy le 10 octobre 2026 (artefact « Mes parties Mapetanque » sur claude.ai).

- Page à part `mes-parties.html`, en 4 langues, `noindex` et hors sitemap comme Mon compte.
  Accès : bloc « Mes parties » de Mon compte devenu un résumé (« 46 parties · 65 % de
  victoires · dernière le 9 oct. » + lien), lien « Enregistrée dans Mes parties » de l'écran de
  fin du compteur, menu du compte.
- Filtres en haut, appliqués à toute la page : période (30 jours, cette année, tout ; « Tout »
  par défaut) et format (toutes, tête-à-tête, doublette, triplette, avec leur nombre). Toucher
  un partenaire ou un adversaire ajoute le filtre « Avec ou contre {nom} ».
- Ordre des blocs :
  1. chiffres clés : victoires (anneau, « 30 sur 46 »), série en cours, écart moyen de
     points, fannys données / prises, durée moyenne (la forme des 10 dernières, V/D, retirée par
     Rémy le 11 octobre 2026) ;
  2. « Avec qui » : partenaires / adversaires, comptés par joueur (pas par équipe), victoires
     sur parties et pourcentage avec une jauge ;
  3. parties, de la plus récente à la plus ancienne, groupées par mois (« Octobre 2026 ·
     3 parties · 0 victoire ») ; 5 d'abord, puis « Afficher 10 de plus » et « Réduire ». Sous
     la liste, « Voir l'activité par mois » déroule un graphique (victoires et défaites
     empilées) : souvent creux, il ne prend pas de place par défaut ;
  4. records : plus belle remontée (« de 4 – 11 à 13 – 12 »), plus longue série, partie la
     plus longue (plus grosse mène retirée par Rémy le 11 octobre 2026) ;
  5. terrains les plus joués (3), avec le nombre de parties sans terrain indiqué ;
  6. « Carnet de joueurs » (sans compteur à droite) : renommer un nom ; donner le nom d'un autre
     joueur du carnet fusionne les deux.
- Fiche d'une partie (panneau) : victoire ou défaite et score, date et heure, équipes, format et
  objectif, durée et mènes, terrain (ou « Ajouter le terrain » par la recherche du site, sans
  position), graphique mène par mène (nos mènes vers le haut, les leurs vers le bas), boutons
  « Modifier les équipes », « Changer le terrain », « Retirer » (confirmation dans le panneau).
- Page vide : « Pas encore de partie » (Caveat), « Vos parties s'enregistrent automatiquement
  quand vous utilisez le compteur en étant identifié. », bouton « Ouvrir le compteur ».
- Calculs dans le navigateur à partir de la liste complète (une requête par visite, pas de
  calcul de nuit).
- Carnet et comptes : le carnet garde les noms tapés par le titulaire. Renommer ne relie pas à
  un compte. À l'étape B, une entrée est reliée au compte d'un ami quand il accepte
  l'invitation : elle garde son nom (« Julie ») avec « compte Mapetanque : Jolie » en dessous,
  et les parties passées avec lui peuvent lui être proposées en une fois (il garde celles qu'il
  veut). Une entrée reliée garde son lien quand on la renomme.
- Terrain d'une partie : « Ajouter le terrain » sur l'écran de fin du compteur (le plus proche
  d'après la position, demandée seulement à ce moment), ou plus tard dans la fiche par la
  recherche.
- Décidé le 10 octobre 2026 : si la position est déjà autorisée pour mapetanque.be (par exemple
  avec « Me localiser » de la carte ; `navigator.permissions.query({ name: 'geolocation' })`),
  l'écran de fin propose d'office le terrain le plus proche (« Parc d'Avroy · changer ·
  retirer »). Sinon, bouton « Ajouter le terrain », et la demande du navigateur n'apparaît que si
  on le touche. Une revanche le même jour reprend le terrain de la partie précédente. Un site ne
  lit jamais la position en arrière-plan : seulement page ouverte, au moment du calcul.
- Étape B, en haut de la page : « Julie vous propose une partie », avec Garder ou Refuser.
- Plus tard : partager une partie ou ses stats en image, comparer avec ses amis (après l'étape B).

### Phase 2 codée (11 octobre 2026)

Côté site, prêt à tester :
- `mes-parties.html` en 4 langues (`scripts/generer_mes_parties.py`, `noindex`, hors sitemap),
  `mes-parties.js`, `style-mes-parties.css` ; fil d'Ariane Accueil › Mon compte › Mes parties.
  Tout ce qui est décidé plus haut, sauf ce qui attend l'étape B (invitations, « Proposer à »,
  « compte Mapetanque : … » dans le carnet).
- Fiche d'une partie : « Modifier les équipes » (format, partenaires, adversaires, « Changer
  d'équipe » ; la victoire suit), terrain ajouté, changé ou retiré par une recherche parmi les
  terrains du site (rue, localité, commune), « Retirer » avec confirmation.
- Carnet : « Renommer » ; le nom d'un autre joueur du carnet fusionne les deux (une partie où
  ils étaient adversaires garde le joueur à sa place). Le carnet n'affiche que les noms présents
  dans au moins une partie.
- Mon compte : le bloc « Mes parties » n'est plus « bientôt » : résumé (« 46 parties · 54 % de
  victoires · dernière le 8 oct. ») et lien. Compteur : « Enregistrée dans Mes parties » est un
  lien (`compteur.js?v=3`, `style-compteur.css?v=3`, `translations.js?v=4`).
- Pas encore fait : l'entrée « Mes parties » dans le menu du compte (il n'y a pour l'instant
  qu'une ligne vers Mon compte, menu à dessiner).

Côté Worker, à faire par Rémy : la section « Parties, phase 2 » de `workers/comptes-parties.js`
(routes `/compte/parties/modifier` et `/compte/joueurs/renommer`) se colle à la suite de celle de
la phase 1, avec ses deux lignes de branchement dans le `fetch`. Pas de nouvelle table.

Essayé le 11 octobre 2026 : le vrai code de `workers/comptes-parties.js` sur une base SQLite qui
imite D1 (node:sqlite), avec 46 parties d'exemple, puis la page dans le navigateur (téléphone et
ordinateur) : filtres, « Avec qui » et filtre d'un joueur, liste et « Afficher 10 de plus »,
activité par mois, records, terrains, fiche, modification des équipes (places refusées, changement
d'équipe), terrain, retrait, renommage, fusion (aussi entre adversaires), nom refusé, page vide,
version néerlandaise, résumé de Mon compte, partie du compteur envoyée puis lien vers la page.

## Étapes B et C fusionnées : la partie partagée (décidé le 11 octobre 2026)

Rémy : inviter un ami a plus d'intérêt au début de la partie qu'à la fin, pour qu'il suive aussi
le score ; et si le même geste le relie à la partie dans ses statistiques, l'étape B n'a plus
besoin d'exister à part.

### Un seul QR code : « Rejoindre cette partie »

Le même QR code (ou le même lien envoyé par message, avec un code court pour qui ne scanne pas)
fait selon le moment :

| Scanné… | L'ami voit | Ce qui est enregistré |
|---|---|---|
| pendant la partie | le score en direct sur son téléphone | à la fin, la partie arrive aussi dans ses parties |
| après la partie | le résumé de la partie | la partie arrive dans ses parties |
| sans compte | le score ou le résumé, sans rien créer | rien ; « Connectez-vous pour garder cette partie » |

- En rejoignant, l'ami choisit sa place : son équipe, puis « Lequel de ces joueurs êtes-vous ? »
  parmi les noms saisis par le marqueur, ou une place libre. Ce choix relie l'entrée du carnet du
  marqueur (« Julie ») à son compte (`joueurs.compte_lie`) : c'est l'ancienne étape B.
- Scanner vaut accord : pas de « Garder / Refuser » à part. Chacun peut retirer la partie de ses
  parties, comme aujourd'hui.
- Code valable pendant la partie, puis quelques jours pour « ajouter à mes stats » ; ensuite il
  ne sert plus. Une place prise ne peut pas l'être une deuxième fois.
- Pas de réseau sur le terrain : le compteur continue seul ; le QR code de fin de partie (ou le
  lien) sert plus tard.

### Ce qui change

- La partie existe sur le serveur dès que le QR code est montré, pas seulement à la fin ; chaque
  mène part ensuite au serveur. C'est le plus gros changement du compteur.
- Un seul marqueur pour commencer (celui qui a lancé la partie), les autres regardent. Saisie à
  plusieurs plus tard (voir « Saisie à plusieurs et réseau »).
- Score en direct : le Durable Object prévu plus haut (« Technique : un Durable Object par
  partie »). La relecture toutes les 5 s reste écartée pour le quota de requêtes du site
  (proposée par erreur dans la conversation du 11 octobre, puis corrigée). Reste à vérifier
  qu'un Durable Object se déploie depuis le tableau de bord, sans `wrangler`.
- À la fin, la partie est enregistrée dans les parties de chaque joueur connecté qui a rejoint,
  rattachée au même identifiant de partie. Les statistiques par partenaire et adversaire de
  chacun restent tirées de son propre carnet.

### Quota et mise en ligne (précisé le 11 octobre 2026)

- Ordre de grandeur pour 200 joueurs un même jour (150 parties partagées de 45 min, 3 téléphones
  qui suivent) : relecture toutes les 5 s ≈ 250 000 requêtes, toutes les 15 s ≈ 80 000, pour un
  quota gratuit de 100 000 par jour commun à tous les Workers du compte (au-delà, connexion,
  notes, avis et photos tombent aussi jusqu'à minuit UTC). Durable Object : une dizaine à une
  trentaine de requêtes par partie, ≈ 4 500 par jour. Tarifs à revérifier avant de coder.
- Le Durable Object ne pèse rien de plus pour le téléphone (WebSocket intégré au navigateur, pas
  de bibliothèque). Ce qui est plus délicat : reconnexions (veille, réseau faible), alarme pour
  effacer une partie abandonnée, jeton envoyé dans le premier message.
- Mise en ligne : Worker à part `mapetanque-direct`, code et `wrangler.toml` dans
  `workers/direct/`, déployé par Rémy avec `npx wrangler deploy` (une fois avant :
  `npx wrangler login`). Ce Worker n'est jamais modifié dans le tableau de bord ; les autres
  restent collés dans le tableau de bord comme aujourd'hui.
- L'étape 1 n'a pas besoin du Durable Object : routes D1 classiques ; l'ami qui a rejoint peut
  voir le score avec un bouton « Actualiser » (une requête par toucher).

### Ordre de réalisation

1. Code de partie (QR code, lien, code court) : rejoindre, choisir sa place, partie enregistrée
   chez chacun à la fin.
2. Score en direct pour ceux qui ont rejoint.
3. Plus tard : un deuxième marqueur, l'invitation par pseudo exact.

Maquette du 11 octobre 2026 : artefact « Partie partagée Mapetanque » sur claude.ai (copie locale
`maquettes/partie-partagee/index.html`, non suivie par git). Deux téléphones côte à côte (Rémy qui
marque, Julie qui scanne), pendant ou après la partie, avec ou sans compte.

Décidé par Rémy le 11 octobre 2026 :
- « Partager » : 4ᵉ bouton de la barre du bas du compteur, à côté de « Équipes ».
- Suivre sans compte : oui (score affiché, connexion proposée pour garder la partie).
- « Je regarde seulement » : oui, pour un spectateur ; rien n'est enregistré chez lui.
- Code court sous le QR code, à taper sur la page du compteur : oui.
- Un seul marqueur pour commencer : oui.
- Écran « Qui êtes-vous ? » pendant la partie : pas de phrase d'explication sous les choix (« Vous
  verrez le score en direct… » retirée).
- Écran de fin : « Partager la partie » (même nom que le bouton de la barre, même QR code), pour un
  joueur qui n'a pas scanné pendant le jeu. Affiché tant qu'au moins un joueur n'a pas rejoint,
  retiré quand tous l'ont fait. Les noms tapés dans « Équipes » ne comptent pas : seul un joueur
  qui a scanné a rejoint.

### Étape 1 codée (11 octobre 2026)

Côté site, prêt à tester :
- Compteur : 4ᵉ bouton « Partager » (feuille : QR code, code court, « Envoyer le lien » par le
  partage du téléphone ou copie, places avec « a rejoint » / « pas encore » / « Place libre »,
  « Actualiser »). Demande d'être connecté. Une fois partagée, chaque mène part au Worker
  (`/compte/partage/etat`), qui répond qui a rejoint. Un joueur venu sur une place libre entre
  dans l'équipe du compteur sous son pseudo (« Vous & Jolie »). Écran de fin : « Aussi chez
  Jolie et Marc », et « Partager la partie » tant qu'une place n'a pas été prise.
- QR code dessiné par `lib/qrcode-generator-1.4.4/qrcode.js` (Kazuhiko Arase, licence MIT, copié
  depuis npm), chargé seulement au premier « Partager ».
- Page `partie.html` en 4 langues (`scripts/generer_partie.py`, `partie.js`, `style-partie.css`,
  `noindex`) : code à taper, « Qui êtes-vous ? » (noms saisis par le marqueur, « Autre joueur »
  pour une place libre, « Je regarde seulement »), sans compte le score suivi d'office et la
  connexion (retour sur la partie), score relu avec « Actualiser », fin « Enregistrée dans vos
  parties ». Le bouton « Suivre le score » des visiteurs sans compte a été retiré le 12/10/2026
  (6d03a340) : le direct était déjà ouvert avant le clic, qui ne changeait rien au score.
- Sous le compteur, lien « Un ami partage sa partie ? Rejoindre avec son code ».
- `translations.js?v=5` sur le compteur, Mon compte, Mes parties et la partie partagée : le
  service worker sert d'abord sa copie en cache, qui pouvait dater d'avant les nouvelles clés.
- Confidentialité (4 langues) : ce que voit qui a le code, copie chez les joueurs, carnets
  reliés, code valable 7 jours après la dernière mène.

Côté Worker (`mapetanque-comptes`), à faire par Rémy :
1. Console D1 : coller `workers/comptes-partages.sql` (tables `partages`, `partage_joueurs`,
   colonne `parties.origine`). Les phases 1 et 2 doivent être en place.
2. Code : la section « Parties partagées » à la fin de `workers/comptes-parties.js`, avec ses
   quatre lignes de branchement et deux lignes dans `supprimerCompte`. Trois fonctions des
   sections précédentes ont changé : `enregistrerPartie` et `modifierPartie` (appel à
   `synchroniserCopies`), `retirerPartie` (retire aussi les copies).

Copies : une par joueur qui a rejoint (`parties.origine` = partie du marqueur), vue de son côté ;
recréées à chaque enregistrement ou correction par le marqueur ; une copie retirée par son joueur
ne revient pas (`partage_joueurs.copie` reste renseignée) ; « Annuler le dernier point » après la
victoire retire les copies avec la partie. Limite connue : si le marqueur décoche « Garder cette
partie » (il compte pour d'autres) ou dit « Je n'ai pas joué », rien n'est enregistré, ni chez
lui ni chez les autres.

Essayé le 11 octobre 2026 : 41 essais des routes (vrai code du Worker sur node:sqlite, quatre
comptes) ; puis dans le navigateur, deux sessions sur deux ports : partage, QR code, Julie sur une
place libre, Marc sur son nom, score relu, fin de partie enregistrée chez les trois, places prises,
code inconnu, sans compte (retour après connexion), « Partager » sans compte, barre du bas en
néerlandais et en allemand à 360 px.

### Étape 2 en ligne : score en direct (11 octobre 2026)

- Worker `mapetanque-direct` (`workers/direct/index.js`, `wrangler.toml`), mis en ligne par Rémy
  avec `npx wrangler deploy` depuis `workers/direct` (après `npx wrangler login`). Ne jamais le
  modifier dans le tableau de bord. Un Durable Object `PartieDirect` par code de partie (SQLite,
  migration `v1`) : WebSocket des pages qui suivent (origines du site et de Live Server
  seulement), dernier état gardé pour qui arrive en cours de route, effacé 24 h après la
  dernière mène (alarme), « ping » servi sans réveil (auto-réponse), 40 connexions au plus.
- `mapetanque-comptes` relaie par une liaison de service `DIRECT` (Settings → Bindings → Service
  binding, ajoutée par Rémy) et un appel de méthode (`env.DIRECT.relayer(code, donnees)`) :
  chaque mène (`/compte/partage/etat`), le partage retrouvé, chaque place prise, et
  « enregistrée » après les copies. Chaque état porte son heure (`maj`, ms). Sans liaison ou en
  panne, rien n'échoue (`relayerDirect` attrape l'erreur) : la page garde « Actualiser ».
- `partie.js` : « En direct · mène N » (point qui pulse), « +N » sur la ligne de l'équipe,
  connexion fermée quand la page passe en arrière-plan et rouverte au retour avec relecture
  complète ; coupure : « Actualiser », nouvel essai après 2, 4, 8… s (30 au plus), relecture à la
  reconnexion, état plus ancien que celui affiché ignoré ; fin de partie : relecture à
  « enregistrée », puis connexion fermée. `translations.js?v=6`.
- Essais : vrai Durable Object sous `wrangler dev` (11 essais), routes des comptes (41), puis
  navigateur à deux sessions (mène reçue en moins d'une demi-seconde, fin de partie, coupure et
  reconnexion avec le bon score) ; testé en ligne par Rémy le 11 octobre 2026.
- Piège local sous Windows : `wrangler dev` lancé depuis un dossier au chemin très long ne crée
  aucun Durable Object (fichier SQLite au-delà de 260 caractères, « internal error ») ; utiliser
  `--persist-to` vers un chemin court (`workers/direct/.wrangler/state`, ignoré par git).
- Plus tard, si besoin : la vue de l'ami en compteur sombre de la maquette, un deuxième marqueur.


## Passer la main (décidé et codé le 12 octobre 2026)

Rémy voulait que les autres joueurs puissent marquer. Plusieurs marqueurs en même temps
(mènes numérotées, question « C'est une autre mène ? ») a paru trop complexe : on garde **un seul
joueur à la fois**, mais la main peut passer. Maquette : artefact « Passer la main Mapetanque »
(`maquettes/passer-la-main/`).

- Deux rôles : le **créateur** (la partie est dans son compte, il règle les équipes, son compteur
  l'enregistre à la fin et crée les copies, comme avant) et **la main** (celui qui marque les mènes
  et peut annuler la dernière, même marquée par un autre).
- Qui peut avoir la main : les joueurs connectés qui ont rejoint la partie. Pas les spectateurs
  (« Je regarde seulement »), ni les visiteurs sans compte.
- Rémy la donne (« Lui passer la main » à côté de chaque joueur qui a rejoint, dans la feuille
  Partager) ; un joueur la prend sur `partie.html` (« Marquer à la place de Rémy »), **sans
  confirmation ni demande** (décidé par Rémy) ; Rémy la reprend (« Reprendre la main », qui
  remplace « Annuler » dans la barre du bas) ; le joueur la rend (« Rendre la main à Rémy »).
- Celui qui a la main marque sur `partie.html` : score tactile (+1 en touchant une équipe,
  pastilles +2 à +6, +3 au plus en tête-à-tête), « Annuler la dernière mène », étiquette
  « Vous marquez ». Les autres voient « Julie marque ».
- Compteur de Rémy pendant ce temps : bandeau « Julie marque », moitiés inertes, ni « Équipes »,
  ni « Nouvelle partie », ni 11/13 (sauf partie finie : la revanche reste possible). Il suit le
  score par le direct (même WebSocket que `partie.js`, branché tant que la partie est partagée et
  pas finie). Dernière mène marquée par Julie : victoire et enregistrement chez Rémy comme s'il
  l'avait marquée ; dernière mène annulée : la partie sort de « Mes parties » (comme Annuler).
- Rémy hors ligne pendant que Julie prend la main : ses mènes tapées entre-temps sont refusées
  (409 `main`), son compteur reprend le score du serveur et dit « Julie a pris la main : votre
  compteur suit son score ».
- Worker : colonne `partages.main` (`workers/comptes-partages-main.sql`, NULL = le créateur ;
  un compte qui a quitté la partie n'a plus la main). Routes `POST /partage/mene` (mène ou
  annulation, avec le nombre de mènes vues : une seule écriture gagne, sinon 409 `decale`) et
  `POST /partage/main`. `/compte/partage/etat` refuse le créateur quand un autre a la main ;
  `/compte/partage` ne remplace plus l'état dans ce cas. `GET /partage` rend `main` et `main_moi` ;
  chaque message du direct porte `main` (nom dans la partie, ou null). Le Worker du direct ne
  change pas.
- Textes : `compteur_marqueur` remplacé par `compteur_a_la_main` ; aide du compteur, explication
  de la feuille Partager, aide d'un code introuvable et Confidentialité revues dans les quatre
  langues. `translations.js?v=9`, `compteur.js` et `style-compteur.css` en `?v=6`.
- Page de la partie en sombre (demandé par Rémy le même jour : batterie, cohérence avec le
  compteur) : palette du compteur, logo en version principale négative, `theme-color` foncé,
  classe `page-sombre` sur le `<body>`, posés par `scripts/generer_partie.py` ;
  `style-partie.css` et `partie.js` en `?v=2`. Les listes déroulantes du menu gardent leur
  panneau clair.
- Revenir à la partie suivie (décidé par Rémy le même jour) : le téléphone retient la dernière
  partie ouverte sur `partie.html` (`mapetanque_partie_suivie`, pas pour le créateur), tant
  qu'elle n'est pas finie et 12 heures après la dernière visite. « Jouer › Rejoindre une partie »
  (`partie.html` sans code) y ramène directement, son code passant dans l'adresse ; code disparu :
  l'écran du code, sans message. « Entrer un autre code » (`?autre=1`) en bas de la page mène
  toujours à l'écran du code. Boutons OK retirés des feuilles Équipes et Partager (la croix
  suffit).
- Worker complet à coller : `maquettes/worker-comptes-main.js` (code du tableau de bord collé
  par Rémy le 12 octobre 2026, plus les deux routes et la section des parties partagées à jour).
- Essais : banc local (vrai code du Worker sur `node:sqlite`, relais WebSocket fait main) : 30
  vérifications des routes, puis navigateur à deux sessions (prendre, marquer en direct, reprendre,
  donner depuis la feuille, fin de partie marquée par Julie et enregistrée chez les deux, dernière
  mène annulée, conflit hors ligne).
