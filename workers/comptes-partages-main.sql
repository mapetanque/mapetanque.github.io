-- Passer la main (12/10/2026) : qui marque une partie partagée. À coller tel quel dans la console
-- D1 de la base mapetanque-notes, après workers/comptes-partages.sql.
--   partages.main   compte du joueur qui a la main ; NULL = le créateur de la partie
-- Routes dans la section « Parties partagées » de workers/comptes-parties.js.

ALTER TABLE partages ADD COLUMN main TEXT;
