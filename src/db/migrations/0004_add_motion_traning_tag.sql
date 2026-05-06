-- Lägger till "Motion & Träning" som intressetagg. Idempotent via
-- ON CONFLICT så migrationen kan köras igen utan att fela om taggen
-- redan finns.

INSERT INTO "interest_tags" ("name", "slug") VALUES
  ('Motion & Träning', 'motion-traning')
ON CONFLICT (slug) DO NOTHING;
