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
| Organiser des tournois (équipes, brackets) | Le plus lourd. v1 suggérée : un organisateur saisit tout, 1-2 formats, lien public en lecture seule. Des bibliothèques JS de brackets existent |
| Retrouver / éditer ses contributions | Faisable pour les contributions faites connecté. Anciennes contributions anonymes : votes et avis rattachables depuis le même navigateur (jetons localStorage `mapetanque_vote_…` et `mapetanque_auteur_avis`) ; photos et signalements non rattachables (aucun identifiant de navigateur). Photo déjà sur Mapillary : publiée depuis le compte Mapillary du site, donc retrait possible directement par Rémy ; le crédit (pseudo) est géré côté site |
| Badges (photographe, joueur, critique, signalement) | Facile (seuils calculés sur les contributions) |
| Points pondérés (ex. photo sur terrain sans photo 10 pts, sinon 2, max 3 photos par terrain et par compte) | Facile, à condition d'attribuer les points à la VALIDATION dans l'admin, jamais à l'envoi |
| Badge joueur avec géolocalisation (score saisi à moins de ~200 m du terrain) | Faisable, falsifiable mais enjeu faible |
| Plus tard : forum | À ne pas coder (charge de modération) ; plutôt un Discord ou groupe externe ; les avis par terrain couvrent une partie du besoin |
| Plus tard : petits événements | Moyen (table événement), recoupe les tournois ; compte obligatoire + bouton de signalement |

Ordre logique proposé : comptes (avec rattachement facultatif aux routes d'envoi existantes) →
parties et stats → contributions → badges et points → tournois (une fois l'usage confirmé).

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

## Prochaine étape

Créer le compte Resend et ajouter les enregistrements DNS chez OVH (SPF, DKIM, DMARC ; prévoir le
temps de propagation).
