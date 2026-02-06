# Deployment Guide

This guide provides step-by-step instructions for deploying the My Money application to production.

## Prerequisites

- Node.js >= 25.2.1 (use `.nvmrc` for version management)
- npm >= 10.0.0
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 18 database
- OIDC provider (e.g., Pocket ID) configured and accessible
- Linux server with Docker installed
- Cloudflare account (for Cloudflare Tunnel deployment)
- SSL/TLS certificates for HTTPS (production) - or use Cloudflare Tunnel (recommended)

## Environment Setup

### 1. Environment Variables

Create `.env` files in **three locations**: project root, `backend/`, and `frontend/`. Each app reads its own `.env` when run directly; Docker Compose uses the root `.env` for container builds and runtime.

**Create .env files (all three):**

```bash
# Root .env — used by Docker Compose and as reference for URLs/ports
cp .env.example .env

# Backend .env — used when running backend directly (e.g. npm run dev in backend/)
cp backend/.env.example backend/.env

# Frontend .env — used when running frontend directly (e.g. npm run dev in frontend/)
cp frontend/.env.example frontend/.env
```

Then edit each `.env` with your values. Keep `DATABASE_URL`, `OPENID_*`, `CORS_ORIGIN`, and URL-related variables consistent across root and backend; keep `REACT_APP_*` consistent between root and frontend.

**When to use which:**

- **Docker / production deploy:** Root `.env` is required. Backend and frontend `.env` are optional for Docker (containers get env from root).
- **Local development (no Docker):** All three `.env` files are required so `backend` and `frontend` can be started separately with correct config.

**Required Backend Variables:**

- `DATABASE_URL` - PostgreSQL connection string with connection pooling parameters
- `PORT` - Server port (default: 4000) - internal container port
- `NODE_ENV` - Set to `production`
- `OPENID_CLIENT_ID` - OIDC client ID
- `OPENID_CLIENT_SECRET` - OIDC client secret
- `OPENID_DISCOVERY_URL` - OIDC discovery endpoint URL

**Required Frontend Variables:**

- `REACT_APP_GRAPHQL_URL` - GraphQL API endpoint URL (must match backend)
- `REACT_APP_OPENID_CLIENT_ID` - OIDC client ID (must match backend)
- `REACT_APP_OPENID_DISCOVERY_URL` - OIDC discovery endpoint URL

**Docker Port Configuration (Optional):**

- `BACKEND_PORT` - Host port for backend (default: 4000). Controls exposed port via docker-compose.
- `FRONTEND_PORT` - Host port for frontend (default: 3000). Controls exposed port via docker-compose.
- **Note:** These ports control Docker port mappings. If you change these, also update:
  - `BACKEND_URL` to match `BACKEND_PORT`
  - `FRONTEND_URL` to match `FRONTEND_PORT`
  - `REACT_APP_GRAPHQL_URL` to match `BACKEND_PORT`
  - `CORS_ORIGIN` to match `FRONTEND_PORT`

**Required URL Configuration (for OAuth callbacks):**

Two deployment styles are supported:

- **Split-domain:** Use separate hostnames for app and API (e.g. `https://app.example.com`, `https://api.example.com`). Set `BACKEND_URL` to the API URL and `FRONTEND_URL` to the app URL. Set `REACT_APP_GRAPHQL_URL` to `https://api.example.com/graphql` (and optionally `REACT_APP_WS_GRAPHQL_URL` to `wss://api.example.com/graphql-ws`).
- **Single-domain:** Use one hostname for both app and API (e.g. `https://app.example.com`). Set `BACKEND_URL` and `FRONTEND_URL` both to `https://app.example.com`. Set `REACT_APP_GRAPHQL_URL` to `https://app.example.com/graphql` (and optionally `REACT_APP_WS_GRAPHQL_URL` to `wss://app.example.com/graphql-ws`). Frontend nginx proxies `/graphql`, `/graphql-ws`, and `/auth/*` to the backend.

- **Important:** These URLs must match your actual production domain(s) for OAuth to work correctly.

**Optional Backend Variables:**

- `CORS_ORIGIN` - Comma-separated list of allowed origins for CORS
- `ALLOWED_ORIGINS` - Comma-separated origins for CSRF validation
- `RUN_MIGRATIONS` - Set to `true` to run migrations on startup (default: auto-detected in production)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `MAX_FILE_SIZE` - Maximum file upload size in bytes (default: 10485760 for 10MB)
- `SUBSCRIPTION_PATH` - WebSocket path for GraphQL subscriptions (default: `/graphql-ws`)

**Optional Auth Rate Limiting (per IP):**

- `AUTH_RATE_LIMIT_LOGIN` - Max login (GET /auth/callback) requests per window (default: 5 prod, 200 dev)
- `AUTH_RATE_LIMIT_REFRESH` - Max refresh and logout requests per window (default: 30 prod, 500 dev)
- `AUTH_RATE_LIMIT_WINDOW_MS` - Auth rate limit window in ms (default: 60000)
- `AUTH_FAILED_MAX` - Failed login attempts before lockout (default: 5)
- `AUTH_FAILED_WINDOW_MS` - Window for counting failed attempts in ms (default: 900000, 15 min)
- `AUTH_LOCKOUT_MS` - Lockout duration in ms after AUTH_FAILED_MAX failures (default: 900000, 15 min)

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

   Create `.env` at project root (required for Docker). Optionally create `backend/.env` and `frontend/.env` if you run those apps outside Docker.

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   # Edit each .env with production values
   ```

2. **Build and start services:**

   ```bash
   npm run docker:build
   npm run docker:up
   ```

   **For production deployment (recommended):**

   Use the production deployment script which handles building and starting with production overrides:

   ```bash
   npm run docker:prod:deploy
   ```

   Or run the script directly:

   ```bash
   ./scripts/docker-prod-deploy.sh
   ```

   The script will:
   - Check for required files (`.env`, docker-compose files)
   - Prepare Docker images
   - Build images with production overrides
   - Start services in detached mode
   - Show service status

   **Options:**
   - `--no-build`: Skip building, only start existing images
   - `--help`: Show usage information

   **Manual production deployment (alternative):**

   If you prefer to run commands manually:

   ```bash
   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env up -d
   ```

3. **Verify migrations:**
   Migrations run automatically on startup if `RUN_MIGRATIONS=true` or `NODE_ENV=production`.

   To manually run migrations:

   ```bash
   docker exec -it my-money-backend npm run prisma:deploy
   ```

4. **Verify deployment:**
   - Frontend: http://localhost:${FRONTEND_PORT:-3000} (or your configured domain)
   - Backend GraphQL: http://localhost:${BACKEND_PORT:-4000}/graphql
   - Health check: http://localhost:${BACKEND_PORT:-4000}/health
   - WebSocket: ws://localhost:${BACKEND_PORT:-4000}/graphql-ws (for subscriptions)

5. **Useful production commands:**

   ```bash
   # View logs
   npm run docker:prod:logs
   # Or: docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env logs -f

   # Check service status
   npm run docker:prod:ps
   # Or: docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps

   # Stop services
   npm run docker:prod:down
   # Or: docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env down

   # Restart services (without rebuilding)
   npm run docker:prod:deploy:no-build
   ```

   **Data persistence:** Production Compose uses a fixed project name (`my-money-prod`) and a fixed Postgres volume name (`mymoney_postgres_data`), so database data persists across `docker:prod:down` and `docker:prod:up`. The Postgres volume is mounted at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) so the image's anonymous volume does not shadow the named volume and cause data loss. Do not run `npm run docker:prune` (or `docker volume prune`) if you want to keep the database.

### Option 2: Manual Deployment

For manual deployment (no Docker), ensure `.env` exists in **root**, **backend/**, and **frontend/** (see [Environment Setup](#1-environment-variables) for creation examples). The backend and frontend processes read from their own directories.

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

### Option 3: Docker Compose with Cloudflare Tunnel (Recommended for Production)

Cloudflare Tunnel provides secure, zero-trust access to your application without exposing ports to the internet. This is ideal for production deployments.

#### Prerequisites

- Cloudflare account with a domain
- Access to Cloudflare Zero Trust dashboard
- Linux server with Docker installed

#### Step 1: Set Up Cloudflare Tunnel

1. **Install Cloudflared on your Linux server:**

   ```bash
   # For Ubuntu/Debian
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared

   # Or use Docker
   docker pull cloudflare/cloudflared:latest
   ```

2. **Authenticate Cloudflared:**

   ```bash
   cloudflared tunnel login
   # This will open a browser window for authentication
   ```

3. **Create a tunnel:**

   ```bash
   cloudflared tunnel create my-money-tunnel
   ```

4. **Create tunnel configuration file:**

   Create `/etc/cloudflared/config.yml`. Choose one of the following.

   **Option A: Single domain (app only)**

   One hostname for both app and API. Frontend nginx proxies `/graphql`, `/graphql-ws`, `/auth/callback`, `/auth/refresh`, and `/auth/logout` to the backend.

   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /etc/cloudflared/<tunnel-id>.json

   ingress:
     - hostname: app.example.com
       service: http://localhost:3000
     - service: http_status:404
   ```

   Use `FRONTEND_PORT` (e.g. 3000) for the service port if you changed it. In `.env`: set `BACKEND_URL` and `FRONTEND_URL` both to `https://app.example.com`; `REACT_APP_GRAPHQL_URL` to `https://app.example.com/graphql`; `CORS_ORIGIN` and `ALLOWED_ORIGINS` to `https://app.example.com`. OIDC redirect URI: **one** — `https://auth.example.com/auth/callback` (used for both browser redirect and token exchange).

   **Option B: Two hostnames (app + api)**

   Separate hostnames for frontend and backend.

   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /etc/cloudflared/<tunnel-id>.json

   ingress:
     - hostname: app.example.com
       service: http://localhost:3000
     - hostname: api.example.com
       service: http://localhost:4000
       originRequest:
         noHappyEyeballs: true
     - hostname: api.example.com
       service: ws://localhost:4000
       path: /graphql-ws
     - service: http_status:404
   ```

   **Note:** Replace `app.example.com` and `api.example.com` with your actual domains. Adjust ports if you've changed `FRONTEND_PORT` or `BACKEND_PORT`. For split-domain, OIDC redirect URI is `https://api.example.com/auth/callback` (backend handles the callback).

5. **Create DNS records in Cloudflare:**
   - Go to Cloudflare Dashboard → DNS → Records
   - **Option A:** Add one CNAME record for `app.example.com` pointing to `<your-tunnel-id>.cfargotunnel.com`
   - **Option B:** Add CNAME records for `app.example.com` and `api.example.com` pointing to `<your-tunnel-id>.cfargotunnel.com`

6. **Start Cloudflare Tunnel:**

   ```bash
   # As a systemd service
   sudo cloudflared service install
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

   Or run manually:

   ```bash
   cloudflared tunnel --config /etc/cloudflared/config.yml run
   ```

#### Step 2: Configure Application Environment Variables

Update your `.env` file with production URLs.

**Option A (single domain):**

```bash
BACKEND_URL=https://app.example.com
FRONTEND_URL=https://app.example.com
CORS_ORIGIN=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com
REACT_APP_GRAPHQL_URL=https://app.example.com/graphql
# Optional: REACT_APP_WS_GRAPHQL_URL=wss://app.example.com/graphql-ws

# OIDC: register one redirect URI in your provider (e.g., Pocket ID):
# https://auth.example.com/auth/callback
```

**Option B (split domain):**

```bash
BACKEND_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
CORS_ORIGIN=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com
REACT_APP_GRAPHQL_URL=https://api.example.com/graphql

# OIDC: register redirect URI in your provider:
# https://api.example.com/auth/callback
```

#### Step 3: Deploy Application with Docker Compose

1. **Build and start services:**

   **Recommended: Use the production deployment script:**

   From the project root directory:

   ```bash
   npm run docker:prod:deploy
   ```

   Or run the script directly:

   ```bash
   ./scripts/docker-prod-deploy.sh
   ```

   **Alternative: Manual deployment:**

   If you prefer to run commands manually:

   ```bash
   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env build
   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env up -d
   ```

   **Note:** For Docker, the root `.env` is required; Docker Compose reads it via `env_file: - ../.env`. For local development (running backend/frontend without Docker), create `.env` in `backend/` and `frontend/` as well (see [Environment Setup](#1-environment-variables) for examples).

2. **Verify Cloudflare Tunnel is running:**

   ```bash
   sudo systemctl status cloudflared
   # Or check logs
   sudo journalctl -u cloudflared -f
   ```

3. **Verify application is accessible:**
   - **Option A:** Frontend and API: https://app.example.com (GraphQL: https://app.example.com/graphql, health: https://app.example.com/health)
   - **Option B:** Frontend: https://app.example.com; Backend GraphQL: https://api.example.com/graphql; Health: https://api.example.com/health

#### Step 4: Configure Cloudflare Security Settings

1. **Enable SSL/TLS:**
   - Go to Cloudflare Dashboard → SSL/TLS
   - Set encryption mode to "Full (strict)"

2. **Configure Security Headers:**
   - Go to Cloudflare Dashboard → Rules → Transform Rules
   - Add rules to set security headers (or use Page Rules)

3. **Enable Bot Fight Mode (optional):**
   - Go to Cloudflare Dashboard → Security → Bots
   - Enable Bot Fight Mode for additional protection

#### Troubleshooting Cloudflare Tunnel

- **Check tunnel status:**

  ```bash
  cloudflared tunnel info <tunnel-name>
  ```

- **View tunnel logs:**

  ```bash
  sudo journalctl -u cloudflared -f
  ```

- **Test tunnel connectivity:**

  ```bash
  curl -H "Host: app.example.com" http://localhost:3000
  ```

- **Verify DNS records:**

  ```bash
  dig app.example.com CNAME
  ```

- **Common issues:**
  - Ensure ports in `config.yml` match `FRONTEND_PORT` and `BACKEND_PORT` from `.env`
  - Verify OIDC redirect URIs match your Cloudflare domain URLs
  - Check that CORS_ORIGIN matches your frontend domain exactly

## Production Checklist

### Environment & Configuration

- [ ] `.env` created at root (required for Docker); for manual/local runs, also create `backend/.env` and `frontend/.env` from their `.env.example` files
- [ ] All environment variables configured and validated
- [ ] Database connection string includes pooling parameters
- [ ] OIDC provider configured and tested
- [ ] CORS origins configured for production domain(s)
- [ ] ALLOWED_ORIGINS configured for CSRF protection
- [ ] BACKEND_URL and FRONTEND_URL match production domains
- [ ] REACT_APP_GRAPHQL_URL matches backend domain
- [ ] If using single-domain, only one hostname is needed; OIDC redirect URI is `https://<your-app-domain>/auth/callback`
- [ ] BACKEND_PORT and FRONTEND_PORT configured (if using Docker)
- [ ] SSL/TLS certificates configured (HTTPS required for PWA) or Cloudflare Tunnel enabled
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
- [ ] Cloudflare Tunnel configured (if using)

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
- Use Cloudflare Tunnel for zero-trust access (recommended)

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
