-- Rename Necessities payee to Default Payee
-- This updates existing default payee records in the database

UPDATE "Payee"
SET "name" = 'Default Payee'
WHERE "name" = 'Necessities'
  AND "isDefault" = true
  AND "userId" IS NULL;

