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
- Optionnel, pas encore décidé : « Se connecter avec Google » (gratuit ; jeton signé vérifié par
  le Worker avec les clés publiques de Google, vérification RSA légère qui tient dans la limite
  CPU ; à mentionner dans « Vos données »)
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
  - suppression de compte avec effacement réel. Les avis publiés sont supprimés ou détachés du
    compte (à décider) ; les photos déjà sur Mapillary restent sous CC BY-SA, sauf demande de
    retrait.
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
  pseudo TEXT,                         -- facultatif, 30 caractères au plus
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
| `POST /compte/code` | `demande`, `code` | `{ jeton, compte }` | 5 essais par demande, puis il faut redemander un mail. |
| `GET /compte/moi` | jeton | `{ email, pseudo, langue, cree }` | 401 si le jeton est absent, inconnu ou expiré : la page oublie alors la session. |
| `POST /compte/pseudo` | jeton, `pseudo` | `{ pseudo }` | 30 caractères au plus, vide = anonyme. |
| `POST /compte/deconnexion` | jeton | `{ ok }` | Efface la session de cet appareil seulement. |
| `GET /compte/contributions` | jeton | listes `votes`, `avis`, `photos`, `signalements` avec terrain, date et statut | Une requête par table, sur l'index `compte_id`. |
| `POST /compte/supprimer` | jeton, `confirmation: true` | `{ ok }` | Efface le compte et ses sessions ; met `compte_id` à NULL dans les contributions (ou les efface : à décider, voir RGPD). |

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
après la connexion), `boule-crayon.js` (boule crayonnée qui tourne pendant l'attente du code).
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
