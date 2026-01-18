# Deployment Guide

This guide provides step-by-step instructions for deploying the My Money application to production.

## Prerequisites

- Node.js >= 25.2.1 (use `.nvmrc` for version management)
- npm >= 10.0.0
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 18 database
- OIDC provider (e.g., Pocket ID) configured and accessible
- SSL/TLS certificates for HTTPS (production)

## Environment Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure all required variables:

```bash
cp .env.example .env
```

**Required Backend Variables:**
- `DATABASE_URL` - PostgreSQL connection string with connection pooling parameters
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Set to `production`
- `OPENID_CLIENT_ID` - OIDC client ID
- `OPENID_CLIENT_SECRET` - OIDC client secret
- `OPENID_DISCOVERY_URL` - OIDC discovery endpoint URL

**Required Frontend Variables:**
- `REACT_APP_GRAPHQL_URL` - GraphQL API endpoint URL (must match backend)
- `REACT_APP_OPENID_CLIENT_ID` - OIDC client ID (must match backend)
- `REACT_APP_OPENID_DISCOVERY_URL` - OIDC discovery endpoint URL

**Optional Backend Variables:**
- `CORS_ORIGIN` - Comma-separated list of allowed origins for CORS
- `ALLOWED_ORIGINS` - Comma-separated origins for CSRF validation
- `RUN_MIGRATIONS` - Set to `true` to run migrations on startup (default: auto-detected in production)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `MAX_FILE_SIZE` - Maximum file upload size in bytes (default: 10485760 for 10MB)
- `SUBSCRIPTION_PATH` - WebSocket path for GraphQL subscriptions (default: `/graphql-ws`)

**Optional Frontend Variables:**
- `REACT_APP_ENABLE_SERVICE_WORKER` - Enable PWA service worker (default: true)
- `REACT_APP_ENABLE_OFFLINE_SYNC` - Enable offline sync (default: true)

### 2. Database Configuration

Ensure your `DATABASE_URL` includes connection pooling parameters:

```
postgresql://user:password@host:5432/dbname?connection_limit=100&pool_timeout=20&connect_timeout=10&command_timeout=30000
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Build and start services:**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

3. **Verify migrations:**
   Migrations run automatically on startup if `RUN_MIGRATIONS=true` or `NODE_ENV=production`.

   To manually run migrations:
   ```bash
   docker exec -it my-money-backend npm run prisma:deploy
   ```

4. **Verify deployment:**
   - Frontend: http://localhost:3000 (or your configured domain)
   - Backend GraphQL: http://localhost:4000/graphql
   - Health check: http://localhost:4000/health
   - WebSocket: ws://localhost:4000/graphql-ws (for subscriptions)

5. **Check logs:**
   ```bash
   npm run docker:logs
   ```

### Option 2: Manual Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build applications:**
   ```bash
   npm run build
   ```

3. **Set up database:**
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:deploy  # Use deploy for production, not migrate
   ```

4. **Start backend:**
   ```bash
   cd backend
   NODE_ENV=production npm start
   ```

5. **Serve frontend:**
   - Use a web server (nginx, Apache, Caddy) to serve the `frontend/dist` directory
   - Configure reverse proxy:
     - Forward `/graphql` requests to backend
     - Forward `/graphql-ws` WebSocket connections to backend
     - Forward `/health` to backend for health checks
     - Serve static files from `frontend/dist`
   - Ensure HTTPS is enabled for PWA features (service worker requires HTTPS)

6. **Process Management:**
   - Use PM2, systemd, or similar for process management
   - Configure auto-restart on failure
   - Set up log rotation

## Production Checklist

### Environment & Configuration
- [ ] All environment variables configured and validated
- [ ] Database connection string includes pooling parameters
- [ ] OIDC provider configured and tested
- [ ] CORS origins configured for production domain(s)
- [ ] ALLOWED_ORIGINS configured for CSRF protection
- [ ] SSL/TLS certificates configured (HTTPS required for PWA)
- [ ] Rate limiting configured appropriately

### Database
- [ ] Database migrations applied (`prisma:deploy`)
- [ ] Database backups configured and tested
- [ ] Connection pooling parameters optimized
- [ ] Database indexes verified (Prisma generates automatically)

### Application
- [ ] Health checks passing (`/health` endpoint)
- [ ] GraphQL endpoint accessible (`/graphql`)
- [ ] WebSocket subscriptions working (`/graphql-ws`)
- [ ] Frontend builds successfully
- [ ] Service worker registered (check browser console)
- [ ] PWA manifest configured correctly

### Security
- [ ] HTTPS enabled (required for service workers)
- [ ] Security headers configured (Helmet)
- [ ] CSRF protection enabled
- [ ] Rate limiting active
- [ ] Input validation and sanitization working
- [ ] SQL injection prevention verified
- [ ] OIDC token validation working

### Monitoring & Operations
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Logging configured and centralized
- [ ] Health check monitoring set up
- [ ] Database monitoring configured
- [ ] Backup strategy in place and tested
- [ ] Restore procedure documented and tested
- [ ] Alerting configured for critical issues

### Performance
- [ ] Database connection pool sized appropriately
- [ ] Query caching enabled
- [ ] Frontend bundle optimized
- [ ] CDN configured (if applicable)
- [ ] Load balancer configured (if scaling)

## Health Checks

The application provides comprehensive health check endpoints:

### Backend Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "database": {
    "status": "connected",
    "queryTimeMs": 5
  },
  "oidc": {
    "status": "configured",
    "reachable": true
  },
  "memory": {
    "usedMB": 256,
    "totalMB": 512,
    "percentage": 50
  },
  "pool": {
    "maxConnections": 100,
    "currentConnections": 5,
    "utilizationPercent": 5
  }
}
```

**Status Values:**
- `ok` - All systems operational
- `degraded` - Some systems unavailable (e.g., database disconnected)

**Monitoring Recommendations:**
- Check every 30-60 seconds
- Alert if status is not "ok" for > 2 minutes
- Alert if database status is "disconnected"
- Alert if OIDC is "unconfigured" or unreachable
- Monitor connection pool utilization

### Frontend Health Check

The frontend serves a basic health check at `/health` for load balancer health checks.

## Database Migrations

### Automatic Migrations

Migrations run automatically on startup when:
- `RUN_MIGRATIONS=true` is set, OR
- `NODE_ENV=production` is set

This is handled by the backend startup script.

### Manual Migrations

**For Development:**
```bash
cd backend
npm run prisma:migrate  # Creates and applies migrations
```

**For Production:**
```bash
cd backend
npm run prisma:deploy  # Applies existing migrations only
```

**Important Notes:**
- Always backup database before running migrations in production
- Test migrations in staging environment first
- Use `prisma:deploy` in production (not `prisma:migrate`)
- Monitor migration logs for errors
- Verify schema after migration: `npx prisma migrate status`

## Monitoring

See [MONITORING.md](./MONITORING.md) for comprehensive monitoring setup.

### Key Metrics to Monitor

1. **Application Health**
   - Health check endpoint status
   - Database connectivity
   - OIDC provider availability
   - Memory usage
   - Connection pool utilization

2. **Performance**
   - GraphQL query execution time
   - Database query performance
   - Response times (P50, P95, P99)
   - Request rate

3. **Errors**
   - Error rate by type
   - GraphQL errors
   - Database errors
   - Authentication failures

4. **Business Metrics**
   - Active users
   - Workspace count
   - Transaction volume
   - Budget notifications sent

### Logging

- Backend logs are structured JSON format
- Logs include correlation IDs for request tracing
- Security events are logged separately
- Log levels: error, warn, info, debug

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Security Considerations

- Ensure HTTPS is enabled in production
- Configure CORS origins to match your frontend domain
- Set `ALLOWED_ORIGINS` for CSRF protection
- Review security headers (configured via Helmet)
- Regularly update dependencies (`npm audit`)

## Backup and Recovery

1. **Database Backups:**
   - Set up regular PostgreSQL backups
   - Test restore procedures

2. **Application State:**
   - User data is stored in PostgreSQL
   - No file storage required (files are processed and deleted)

## Scaling

### Horizontal Scaling

- **Backend**: Stateless design allows horizontal scaling
- **Load Balancer**: Use a load balancer (nginx, HAProxy, AWS ALB) for multiple backend instances
- **Session Management**: No server-side sessions (uses JWT tokens), so no shared session store needed
- **WebSocket Subscriptions**: Each backend instance handles its own subscriptions
  - Consider using Redis pub/sub for cross-instance subscription notifications
  - Or use sticky sessions for WebSocket connections

### Database Scaling

- **Connection Pooling**: Configured with 100 max connections per instance
- **Read Replicas**: Consider read replicas for read-heavy workloads
- **Connection Pool Sizing**: Adjust `connection_limit` in `DATABASE_URL` based on instance count
  - Formula: `(max_connections / instance_count) - 10` (reserve 10 for admin connections)

### Frontend Scaling

- **CDN**: Serve static assets via CDN
- **Caching**: Configure appropriate cache headers
- **Service Worker**: Offline-first design reduces server load

### Performance Optimization

- **Query Caching**: GraphQL queries are cached for 5 minutes
- **Database Indexes**: Prisma generates indexes automatically
- **Connection Pooling**: Configured via `DATABASE_URL` parameters
- **Rate Limiting**: Prevents abuse and ensures fair resource usage

## Rollback Procedure

1. Stop current deployment
2. Restore database from backup if needed
3. Deploy previous version
4. Verify health checks
5. Monitor for issues
