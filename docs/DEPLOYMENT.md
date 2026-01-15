# Deployment Guide

This guide provides step-by-step instructions for deploying the My Money application to production.

## Prerequisites

- Node.js >= 25.2.1
- npm >= 10.0.0
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 18 database
- OIDC provider (e.g., Pocket ID) configured

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
- `REACT_APP_GRAPHQL_URL` - GraphQL API endpoint URL
- `REACT_APP_OPENID_CLIENT_ID` - OIDC client ID
- `REACT_APP_OPENID_DISCOVERY_URL` - OIDC discovery endpoint URL

**Optional Variables:**
- `CORS_ORIGIN` - Comma-separated list of allowed origins
- `ALLOWED_ORIGINS` - Comma-separated origins for CSRF validation

### 2. Database Configuration

Ensure your `DATABASE_URL` includes connection pooling parameters:

```
postgresql://user:password@host:5432/dbname?connection_limit=100&pool_timeout=20&connect_timeout=10&command_timeout=30000
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Build and start services:**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

2. **Run database migrations:**
   ```bash
   docker exec -it my-money-backend npm run prisma:migrate
   ```

3. **Verify deployment:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000/graphql
   - Health check: http://localhost:4000/health

### Option 2: Manual Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build applications:**
   ```bash
   npm run build
   ```

3. **Run database migrations:**
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. **Start backend:**
   ```bash
   cd backend
   npm start
   ```

5. **Serve frontend:**
   - Use a web server (nginx, Apache) to serve the `frontend/dist` directory
   - Configure reverse proxy to forward `/graphql` requests to backend

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] OIDC provider configured and tested
- [ ] CORS origins configured for production domain
- [ ] SSL/TLS certificates configured (HTTPS)
- [ ] Health checks passing
- [ ] Error monitoring configured (optional but recommended)
- [ ] Backup strategy in place
- [ ] Logging configured and monitored

## Health Checks

The application provides health check endpoints:

- **Backend:** `GET /health` - Returns database and OIDC status
- **Frontend:** `GET /health` - Returns basic status

Monitor these endpoints to ensure application health.

## Database Migrations

Migrations are automatically applied when using Docker Compose (via `backend-entrypoint.sh`).

For manual deployment, run:
```bash
cd backend
npm run prisma:migrate
```

## Monitoring

### Health Check Endpoint

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "database": "connected",
  "oidc": "configured"
}
```

### Logging

- Backend logs are structured JSON format
- Logs include correlation IDs for request tracing
- Security events are logged separately

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

- Backend can be scaled horizontally (stateless)
- Use a load balancer for multiple backend instances
- Database connection pooling is configured (100 max connections)
- Consider Redis for session storage if scaling beyond single instance

## Rollback Procedure

1. Stop current deployment
2. Restore database from backup if needed
3. Deploy previous version
4. Verify health checks
5. Monitor for issues
