-- Tables de l'enregistrement des parties (Worker mapetanque-comptes, routes dans
-- workers/comptes-parties.js). À coller tel quel dans la console D1 de la base mapetanque-notes.

CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  debut TEXT NOT NULL,
  fin TEXT NOT NULL,
  objectif INTEGER NOT NULL,
  format INTEGER NOT NULL,
  mon_equipe TEXT NOT NULL,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  victoire INTEGER NOT NULL,
  nom_a TEXT,
  nom_b TEXT,
  joueurs TEXT NOT NULL,
  menes TEXT NOT NULL,
  terrain TEXT,
  cree TEXT NOT NULL DEFAULT (datetime('now')),
  maj TEXT
);
CREATE INDEX parties_compte ON parties(compte_id, fin);
CREATE INDEX parties_cree ON parties(compte_id, cree);

CREATE TABLE joueurs (
  id TEXT PRIMARY KEY,
  compte_id TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  cle TEXT NOT NULL,
  compte_lie TEXT,
  utilise TEXT NOT NULL DEFAULT (datetime('now')),
  cree TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX joueurs_compte_cle ON joueurs(compte_id, cle);

-- Ce que contiennent les colonnes :
--   parties.id          tiré par le téléphone : renvoyer la même partie la remplace
--   parties.debut, fin  premier point et point gagnant, AAAA-MM-JJ HH:MM:SS (UTC)
--   parties.objectif    11 ou 13
--   parties.format      1, 2 ou 3 joueurs par équipe
--   parties.mon_equipe  'a' ou 'b' : équipe du titulaire du compte
--   parties.victoire    1 si l'équipe du titulaire a gagné
--   parties.nom_a, nom_b  noms d'équipe saisis, sinon NULL
--   parties.joueurs     JSON {"a":[id joueur…],"b":[…]}, sans le titulaire
--   parties.menes       JSON [{"e":"a","p":3,"t":95},…] : équipe, points, secondes depuis le début
--   parties.terrain     identifiant OSM du terrain (way/123…), facultatif
--   joueurs.cle         nom sans accents ni majuscules : « Julie » et « julie » sont le même joueur
--   joueurs.compte_lie  étape B : compte de l'ami, après son accord
--   joueurs.utilise     dernière partie : ordre des « joueurs récents »
