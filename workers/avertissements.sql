-- Mails d'avertissement aux contributeurs (signalements, photos des comptes) : tables à créer une
-- fois dans la console D1 de la base `mapetanque-notes`, avant de coller workers/admin-avertissements.js.

-- Une ligne par décision prise dans l'admin, au plus une par contribution (UNIQUE) : une nouvelle
-- décision remplace la précédente tant que le mail n'est pas parti. L'adresse et la langue ne sont
-- pas copiées ici : elles sont lues au moment de l'envoi (compte, ou signalement sans compte), si
-- bien qu'un compte supprimé entre-temps ne reçoit rien.
CREATE TABLE avertissements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sorte TEXT NOT NULL CHECK (sorte IN ('signalement', 'photo')),
  ref_id INTEGER NOT NULL,              -- signalements.id ou photos.id
  decision TEXT NOT NULL CHECK (decision IN ('accepte', 'refuse')),
  mode TEXT NOT NULL CHECK (mode IN ('auto', 'manuel', 'aucun')),  -- seul 'auto' part par mail
  motif TEXT,                           -- code du motif de refus (liste dans le Worker)
  mot TEXT,                             -- mot personnel ajouté au mail, 500 caractères au plus
  libelle TEXT,                         -- nom du terrain ou du club, tel qu'affiché dans l'admin
  lat REAL,                             -- position, pour le lien « Voir sur la carte »
  lon REAL,
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  envoye TEXT,                          -- date d'envoi ; NULL = en attente
  UNIQUE (sorte, ref_id)
);
CREATE INDEX avertissements_attente ON avertissements(envoye, mode);

-- Mails d'avertissement envoyés par jour (UTC). Ajoutés aux lignes du jour de liens_connexion,
-- ils donnent le total de la journée chez Resend (100 au plus).
CREATE TABLE mails_jour (
  jour TEXT PRIMARY KEY,                -- AAAA-MM-JJ
  nombre INTEGER NOT NULL DEFAULT 0
);
