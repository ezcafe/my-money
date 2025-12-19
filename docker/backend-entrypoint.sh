#!/bin/sh
set -e

# Run database migrations
# Prisma migrate deploy will apply pending migrations
# Docker's depends_on with health checks ensures database is ready
echo "Running database migrations..."
npx prisma migrate deploy || {
  echo "Migration failed. Exiting..."
  exit 1
}

# Start the application
echo "Starting application..."
exec "$@"

