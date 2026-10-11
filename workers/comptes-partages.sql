-- Tables des parties partagées (étapes B et C fusionnées, étape 1 ; routes dans la section
-- « Parties partagées » de workers/comptes-parties.js). À coller tel quel dans la console D1 de
-- la base mapetanque-notes, après workers/comptes-parties.sql.
--
-- Ce que contiennent les colonnes (expliqué ici, en tête : la console D1 refuse un texte qui
-- se termine par des commentaires après le dernier « ; », « Requests without any query ») :
--   partages.code            4 caractères sans ambiguïté (K7P2), dans le QR code et le lien
--   partages.partie_id       identifiant de la partie tiré par le compteur du marqueur (parties.id)
--   partages.compte_id       compte du marqueur
--   partages.etat            JSON : format, objectif, équipe du marqueur, noms, mènes (score recalculé)
--   partages.maj             dernière mène reçue ; le code ne sert plus 7 jours après
--   partage_joueurs.equipe   'a' ou 'b'
--   partage_joueurs.nom      nom choisi parmi ceux saisis par le marqueur, NULL = place libre
--   partage_joueurs.copie    id de la copie de la partie dans ses parties, une fois créée ; si
--                            la copie a disparu, le joueur l'a retirée : elle ne revient pas
--   parties.origine          sur une copie : id de la partie du marqueur

CREATE TABLE partages (
  code TEXT PRIMARY KEY,
  partie_id TEXT NOT NULL UNIQUE,
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  etat TEXT NOT NULL,
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  maj TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX partages_compte ON partages(compte_id, cree);
CREATE INDEX partages_maj ON partages(maj);

CREATE TABLE partage_joueurs (
  partie_id TEXT NOT NULL,
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  equipe TEXT NOT NULL,
  nom TEXT,
  copie TEXT,
  rejoint TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (partie_id, compte_id)
);
CREATE INDEX partage_joueurs_compte ON partage_joueurs(compte_id);

ALTER TABLE parties ADD COLUMN origine TEXT;
CREATE INDEX parties_origine ON parties(origine);
