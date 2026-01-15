# Prisma Migration Guide

## Migration Strategy

This guide documents the migration process, rollback procedures, and best practices for database schema changes.

## Initial Migration

Since this is a new application, you need to create the initial migration after setting up your database.

### Steps:

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
   npx prisma migrate dev --name init
   ```

4. **Generate Prisma Client** (if not already done):
   ```bash
   npx prisma generate
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

## Migration Process

### Development Workflow

1. **Make schema changes** in `schema.prisma`
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name <descriptive_migration_name>
   ```
3. **Review the generated migration SQL** in `prisma/migrations/`
4. **Test the migration** on local/staging environment
5. **Generate Prisma Client** (automatic with `migrate dev`):
   ```bash
   npx prisma generate
   ```

### Production Deployment

1. **Backup database** before applying migrations:
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply migrations**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Verify migration** by checking:
   - Migration status: `npx prisma migrate status`
   - Database connectivity
   - Application health checks

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

## Troubleshooting

### Migration Fails

1. Check error message for specific issue
2. Verify database connection
3. Check for conflicting migrations
4. Review migration SQL for syntax errors
5. Check database permissions

### Data Loss Prevention

- Always backup before migrations
- Test data migration scripts separately
- Use transactions for data migrations
- Verify data integrity after migration

## Future Migrations

For future schema changes:

1. Make changes to `schema.prisma`
2. Create migration: `npx prisma migrate dev --name <migration_name>`
3. Review the generated migration SQL
4. Test on staging environment
5. Apply to production: `npx prisma migrate deploy`

