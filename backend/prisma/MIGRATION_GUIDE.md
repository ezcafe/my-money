# Prisma Migration Guide

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

The connection pool is configured via the `DATABASE_URL` query parameters:

- `connection_limit=100` - Maximum number of connections in the pool
- `pool_timeout=20` - Maximum time (seconds) to wait for a connection
- `connect_timeout=10` - Maximum time (seconds) to establish a connection

## Schema Changes

The current schema includes:

- ✅ Unique constraints on `(userId, name)` for Account, Category, and Payee
- ✅ Composite indexes for optimized queries
- ✅ Proper foreign key relationships with cascade deletes
- ✅ Decimal types for financial data

## Future Migrations

For future schema changes:

1. Make changes to `schema.prisma`
2. Create migration: `npx prisma migrate dev --name <migration_name>`
3. Review the generated migration SQL
4. Apply to production: `npx prisma migrate deploy`

