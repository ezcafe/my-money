# Prisma Migration Guide

## Quick Decision Guide

| Scenario                          | Use This         | Command                                                   |
| --------------------------------- | ---------------- | --------------------------------------------------------- |
| First-time setup (development)    | Automatic sync   | Set `RUN_MIGRATIONS=true`, start app                      |
| First-time setup (production)     | Manual migration | `npm run prisma:migrate`                                  |
| Schema changes (development)      | Automatic sync   | `npx prisma db push` or auto on startup                   |
| Schema changes (production)       | Manual migration | `npx prisma migrate dev --name <name>`                    |
| Data migrations (any environment) | Manual migration | `npx prisma migrate dev --name <name> --create-only`      |
| Production deployment             | Manual migration | `npm run prisma:deploy`                                   |
| Migration drift error             | Resolve drift    | See [Handling Migration Drift](#handling-migration-drift) |

## Migration Strategy

This application uses a **hybrid migration approach**:

1. **Automatic Schema Sync** (`prisma db push`): Used for development and automatic schema updates on startup
2. **Manual Migrations** (`prisma migrate`): Used for data migrations, production deployments, and version-controlled schema changes

## Understanding the Hybrid Approach

### Automatic Schema Sync (Development)

- Runs automatically on application startup when `RUN_MIGRATIONS=true` or `NODE_ENV=production`
- Uses `prisma db push` to sync schema directly without migration history
- Best for: Rapid development, local testing, Docker environments
- **Note:** Does not create migration files or track migration history

### Manual Migrations (Production)

- Uses `prisma migrate dev` or `prisma migrate deploy` for version-controlled changes
- Creates migration files in `prisma/migrations/`
- Tracks migration history in database
- Best for: Production deployments, data migrations, team collaboration

## Initial Setup

### Option 1: Automatic Schema Sync (Recommended for Development)

1. **Set up your database** (PostgreSQL)
   - Make sure PostgreSQL is running
   - Create a database (e.g., `mymoney`)

2. **Configure DATABASE_URL** in your `.env` file:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/mymoney?connection_limit=100&pool_timeout=20&connect_timeout=10"
   ```

3. **Generate Prisma Client**:

   ```bash
   cd backend
   npm run prisma:generate
   ```

4. **Start the application** (schema will sync automatically):
   ```bash
   # Set RUN_MIGRATIONS=true in .env, or it will run automatically in production
   npm run dev
   ```

### Option 2: Manual Migrations (Recommended for Production)

1. **Set up your database** (PostgreSQL)
   - Make sure PostgreSQL is running
   - Create a database (e.g., `mymoney`)

2. **Configure DATABASE_URL** in your `.env` file:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/mymoney?connection_limit=100&pool_timeout=20&connect_timeout=10"
   ```

3. **Create the initial migration**:
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   # Or: npx prisma migrate dev --name init
   ```

## Connection Pool Configuration

The connection pool is configured via the `DATABASE_URL` query parameters or environment variables:

- `DB_POOL_MAX` or `connection_limit=100` - Maximum number of connections in the pool
- `DB_POOL_TIMEOUT_MS` or `pool_timeout=20` - Maximum time (seconds) to wait for a connection
- `DB_CONNECTION_TIMEOUT_MS` or `connect_timeout=10` - Maximum time (seconds) to establish a connection

## Schema Changes

The current schema includes:

- ✅ Unique constraints on `(userId, name)` for Account, Category, and Payee
- ✅ Composite indexes for optimized queries
- ✅ Proper foreign key relationships with cascade deletes
- ✅ Decimal types for financial data

## Migration Workflows

### Development Workflow (Schema Changes)

**For schema-only changes (tables, columns, indexes):**

1. **Make schema changes** in `schema.prisma`
2. **Option A: Automatic sync** (development)
   - Schema will sync automatically on next startup if `RUN_MIGRATIONS=true`
   - Or run manually: `npx prisma db push`
   - No migration files created

3. **Option B: Create migration** (production-ready)

   ```bash
   npx prisma migrate dev --name <descriptive_migration_name>
   ```

   - Review the generated migration SQL in `prisma/migrations/`
   - Prisma Client is generated automatically

### Data Migration Workflow

**For data changes (updating existing records, seeding data):**

1. **Create a data migration**:

   ```bash
   npx prisma migrate dev --name <descriptive_migration_name> --create-only
   ```

2. **Edit the migration SQL** in `prisma/migrations/<timestamp>_<name>/migration.sql`
   - Add your data update SQL
   - Use conditional checks if tables might not exist:

   ```sql
   DO $$
   BEGIN
     IF EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = 'TableName'
     ) THEN
       -- Your UPDATE/INSERT/DELETE statements here
     END IF;
   END $$;
   ```

3. **Apply the migration**:

   ```bash
   npx prisma migrate dev
   ```

4. **Test the migration** on local/staging environment before production

### Production Deployment

**Important:** Always use `prisma migrate deploy` in production, never `prisma db push`.

1. **Backup database** before applying migrations:

   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply migrations**:

   ```bash
   cd backend
   npm run prisma:deploy
   # Or: npx prisma migrate deploy
   ```

3. **Verify migration** by checking:
   - Migration status: `npx prisma migrate status`
   - Database connectivity
   - Application health checks

**Note:** In production, set `RUN_MIGRATIONS=false` to prevent automatic `db push` and rely on `migrate deploy` instead.

### Staging Testing

**Always test migrations on staging before production:**

1. Apply migration to staging database
2. Run application tests
3. Verify data integrity
4. Check performance impact
5. Monitor for errors

## Rollback Procedures

### Manual Rollback

If a migration needs to be rolled back:

1. **Identify the migration** to rollback
2. **Create a new migration** that reverses the changes:
   ```bash
   npx prisma migrate dev --name rollback_<migration_name>
   ```
3. **Manually edit** the migration SQL to reverse changes
4. **Test rollback** on staging first
5. **Apply rollback** to production

### Database Backup Restore

For critical issues, restore from backup:

1. **Stop the application**
2. **Restore database** from backup:
   ```bash
   psql -h <host> -U <user> -d <database> < backup_file.sql
   ```
3. **Update Prisma migration history** if needed
4. **Restart application**

## Migration Best Practices

1. **Always backup** before production migrations
2. **Test on staging** first
3. **Use descriptive migration names** (e.g., `add_user_email_index`, `add_budget_notifications`)
4. **Review generated SQL** before applying
5. **Keep migrations small** and focused
6. **Document breaking changes** in migration comments
7. **Monitor application** after migration deployment
8. **Have rollback plan** ready

## Migration Naming Convention

Use descriptive names that indicate the change:

- `add_<feature>` - Adding new tables/columns
- `modify_<feature>` - Modifying existing schema
- `remove_<feature>` - Removing tables/columns
- `add_index_<table>_<columns>` - Adding indexes
- `add_constraint_<table>_<name>` - Adding constraints

Examples:

- `add_budget_notifications`
- `add_index_transaction_user_date`
- `modify_account_balance_precision`

## Handling Migration Drift

### What is Migration Drift?

Migration drift occurs when:

- Database was created with `prisma db push` (no migration history)
- Migration files exist but database doesn't have migration history
- Database schema doesn't match expected migration state

### Resolving Migration Drift

**Scenario 1: Database created with `db push`, but migrations exist**

If you see errors like "Drift detected" or "Migration failed to apply cleanly":

1. **Check migration status**:

   ```bash
   npx prisma migrate status
   ```

2. **Option A: Mark migrations as applied** (if schema already matches):

   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

3. **Option B: Reset and apply migrations** (⚠️ deletes all data):

   ```bash
   npx prisma migrate reset
   npx prisma migrate deploy
   ```

4. **Option C: Create baseline migration** (recommended for existing databases):
   ```bash
   # Create a migration that matches current database state
   npx prisma migrate dev --name baseline --create-only
   # Edit the migration to be empty or mark it as applied
   npx prisma migrate resolve --applied baseline
   ```

**Scenario 2: Empty migration directory (P3015 error)**

If you see "Could not find the migration file at migration.sql":

1. **Check for empty migration directories**:

   ```bash
   ls -la prisma/migrations/
   ```

2. **Remove empty directories**:

   ```bash
   rm -rf prisma/migrations/<empty_directory_name>
   ```

3. **Re-run migration**:
   ```bash
   npx prisma migrate dev
   ```

**Scenario 3: Migration fails because tables don't exist**

For data migrations that update existing data:

1. **Make migration conditional** (see Data Migration Workflow above)
2. **Use table existence checks** in migration SQL
3. **Test migration on empty database** to ensure it handles missing tables

## Troubleshooting

### Migration Fails

1. Check error message for specific issue
2. Verify database connection
3. Check for conflicting migrations
4. Review migration SQL for syntax errors
5. Check database permissions
6. Check for migration drift (see above)

### Data Loss Prevention

- Always backup before migrations
- Test data migration scripts separately
- Use transactions for data migrations
- Verify data integrity after migration
- Use conditional checks in data migrations for safety

## Migration Decision Guide

### When to Use `prisma db push` (Automatic Sync)

✅ Use for:

- Local development and rapid iteration
- Docker development environments
- When you don't need migration history
- Prototyping and testing

❌ Don't use for:

- Production deployments
- Data migrations
- Team collaboration (no version control)
- When you need rollback capability

### When to Use `prisma migrate` (Manual Migrations)

✅ Use for:

- Production deployments
- Data migrations (updating existing records)
- Team collaboration (version-controlled changes)
- When you need migration history
- When you need rollback capability

❌ Don't use for:

- Rapid prototyping (slower workflow)

## Quick Reference

### Common Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migration (development)
npm run prisma:migrate
# Or: npx prisma migrate dev --name <name>

# Create migration without applying
npx prisma migrate dev --name <name> --create-only

# Apply migrations (production)
npm run prisma:deploy
# Or: npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Mark migration as applied (resolve drift)
npx prisma migrate resolve --applied <migration_name>

# Reset database and apply all migrations (⚠️ deletes data)
npx prisma migrate reset

# Sync schema without migrations (development only)
npx prisma db push
```

## Future Migrations

### Schema Changes

1. Make changes to `schema.prisma`
2. **Development:** Use `prisma db push` or create migration with `prisma migrate dev`
3. **Production:** Always create migration: `npx prisma migrate dev --name <migration_name>`
4. Review the generated migration SQL
5. Test on staging environment
6. Apply to production: `npx prisma migrate deploy`

### Data Changes

1. Create data migration: `npx prisma migrate dev --name <name> --create-only`
2. Edit migration SQL with conditional checks
3. Test on staging with real data
4. Apply to production: `npx prisma migrate deploy`
