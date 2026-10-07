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
| Organiser des tournois | Le plus lourd. v1 suggérée : un organisateur saisit tout, lien public en lecture seule. Deux formats sans élimination, championnat et système suisse (voir « Tournois ») : un tableau de classement et des appariements simples, pas besoin de bibliothèque de brackets |
| Retrouver / éditer ses contributions | Faisable pour les contributions faites connecté. Anciennes contributions anonymes : votes et avis rattachables depuis le même navigateur (jetons localStorage `mapetanque_vote_…` et `mapetanque_auteur_avis`) ; photos et signalements non rattachables (aucun identifiant de navigateur). Photo déjà sur Mapillary : publiée depuis le compte Mapillary du site, donc retrait possible directement par Rémy ; le crédit (pseudo) est géré côté site |
| Badges (photographe, joueur, critique, signalement) | Facile (seuils calculés sur les contributions) |
| Points pondérés (ex. photo sur terrain sans photo 10 pts, sinon 2, max 3 photos par terrain et par compte) | Facile, à condition d'attribuer les points à la VALIDATION dans l'admin, jamais à l'envoi |
| Badge joueur avec géolocalisation (score saisi à moins de ~200 m du terrain) | Faisable, falsifiable mais enjeu faible |
| Plus tard : forum | À ne pas coder (charge de modération) ; plutôt un Discord ou groupe externe ; les avis par terrain couvrent une partie du besoin |
| Plus tard : petits événements | Moyen (table événement), recoupe les tournois ; compte obligatoire + bouton de signalement |

Ordre retenu (détail dans « Mise en œuvre ») : 1. comptes + rattachement des contributions
envoyées connecté → 2. parties et stats, puis partie partagée en direct → 3. modification de ses contributions, badges et
points, tournois, en temps voulu (tournois une fois l'usage confirmé).

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

## Prochaine étape

Créer le compte Resend et ajouter les enregistrements DNS chez OVH (SPF, DKIM, DMARC ; prévoir le
temps de propagation).
