#!/bin/bash
# Script to apply the dateFormat migration
# This adds the dateFormat column to UserPreferences table

echo "Applying dateFormat migration..."
echo "Make sure your DATABASE_URL is set in .env file"

# Option 1: Use Prisma migrate deploy (for production/development)
# npx prisma migrate deploy

# Option 2: Use Prisma migrate dev (creates migration and applies it)
# npx prisma migrate dev

# Option 3: Apply the SQL directly using psql (if you have direct DB access)
# psql $DATABASE_URL -c "ALTER TABLE \"UserPreferences\" ADD COLUMN IF NOT EXISTS \"dateFormat\" TEXT;"

echo ""
echo "To apply the migration, run one of these commands:"
echo "1. npx prisma migrate deploy  (recommended for production)"
echo "2. npx prisma migrate dev      (for development, will mark migration as applied)"
echo ""
echo "Or apply the SQL directly:"
echo "ALTER TABLE \"UserPreferences\" ADD COLUMN IF NOT EXISTS \"dateFormat\" TEXT;"
