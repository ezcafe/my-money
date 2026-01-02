-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "colorScheme" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "colorSchemeValue" TEXT;

