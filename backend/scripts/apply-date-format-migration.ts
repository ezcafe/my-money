/**
 * Script to apply the dateFormat migration
 * This can be run directly to add the dateFormat column to the database
 */

import {prisma} from '../src/utils/prisma';

async function applyMigration(): Promise<void> {
  try {
    console.log('Applying dateFormat migration...');

    // Apply the migration SQL directly
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UserPreferences"
      ADD COLUMN IF NOT EXISTS "dateFormat" TEXT;
    `);

    console.log('✓ Migration applied successfully!');
    console.log('The dateFormat column has been added to UserPreferences table.');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void applyMigration();
