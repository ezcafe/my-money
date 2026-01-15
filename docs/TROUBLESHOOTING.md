# Troubleshooting Guide

Common issues and solutions for the My Money application.

## Database Connection Issues

### Error: "Database connection failed"

**Symptoms:**
- Health check shows `database: "disconnected"`
- GraphQL queries fail with connection errors

**Solutions:**
1. Verify `DATABASE_URL` is correct:
   ```bash
   echo $DATABASE_URL
   ```

2. Test database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

3. Check database is running:
   ```bash
   # For Docker
   docker ps | grep postgres

   # For local PostgreSQL
   systemctl status postgresql
   ```

4. Verify connection pool settings in `DATABASE_URL`:
   ```
   ?connection_limit=100&pool_timeout=20&connect_timeout=10
   ```

5. Check firewall/network rules allow connections

### Error: "Connection timeout"

**Solutions:**
- Increase `connect_timeout` in `DATABASE_URL`
- Check network latency
- Verify database server resources (CPU, memory)

## Authentication Issues

### Error: "OIDC configuration missing"

**Symptoms:**
- Server fails to start
- Error message lists missing environment variables

**Solutions:**
1. Verify all OIDC variables are set:
   ```bash
   echo $OPENID_CLIENT_ID
   echo $OPENID_CLIENT_SECRET
   echo $OPENID_DISCOVERY_URL
   ```

2. Test OIDC discovery endpoint:
   ```bash
   curl $OPENID_DISCOVERY_URL
   ```

3. Verify OIDC provider is accessible from backend server

### Error: "Invalid or expired token"

**Solutions:**
- Clear browser localStorage and re-authenticate
- Check token expiration settings
- Verify OIDC provider token lifetime

## File Upload Issues

### Error: "File size exceeds maximum"

**Symptoms:**
- PDF upload fails with size error

**Solutions:**
- Maximum PDF size: 10MB
- Maximum CSV size: 5MB
- Compress or split large files

### Error: "Invalid file content"

**Symptoms:**
- Upload fails even with correct file extension

**Solutions:**
- File content validation uses magic numbers (file signatures)
- Ensure file is actually a PDF/CSV, not just renamed
- Re-save file in correct format

## Build Issues

### Error: "Module not found"

**Solutions:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Error: "TypeScript compilation errors"

**Solutions:**
```bash
# Check TypeScript version
npx tsc --version

# Verify tsconfig.json
npx tsc --noEmit
```

## Docker Issues

### Error: "Container fails to start"

**Solutions:**
1. Check logs:
   ```bash
   docker logs my-money-backend
   docker logs my-money-frontend
   ```

2. Verify environment variables:
   ```bash
   docker exec -it my-money-backend env | grep -E "(DATABASE|OPENID)"
   ```

3. Check resource limits:
   ```bash
   docker stats
   ```

### Error: "Migration fails"

**Solutions:**
1. Verify database is accessible:
   ```bash
   docker exec -it my-money-backend npm run prisma:studio
   ```

2. Check migration status:
   ```bash
   docker exec -it my-money-backend npx prisma migrate status
   ```

3. Manually run migrations:
   ```bash
   docker exec -it my-money-backend npx prisma migrate deploy
   ```

## Performance Issues

### Slow GraphQL queries

**Solutions:**
- Check database indexes (Prisma generates these automatically)
- Review query complexity
- Check connection pool usage
- Monitor database performance

### High memory usage

**Solutions:**
- Review file upload limits
- Check for memory leaks in logs
- Adjust Docker resource limits
- Review connection pool size

## Frontend Issues

### Error: "Failed to fetch"

**Symptoms:**
- GraphQL requests fail
- Network errors in browser console

**Solutions:**
1. Verify `REACT_APP_GRAPHQL_URL` is correct
2. Check CORS configuration
3. Verify backend is running
4. Check browser console for detailed errors

### Error: "Service worker registration failed"

**Solutions:**
- Clear browser cache
- Verify HTTPS is enabled (required for service workers)
- Check browser console for specific errors

## Health Check Failures

### Health check returns "degraded"

**Solutions:**
1. Check individual components:
   ```bash
   curl http://localhost:4000/health
   ```

2. Review logs for specific errors
3. Verify all dependencies are running

## Logging Issues

### No logs appearing

**Solutions:**
- Verify `NODE_ENV` is set correctly
- Check log level configuration
- Verify logging permissions
- Check Docker log driver configuration

## Common Error Codes

### Database Errors
- `P1001` - Connection error
- `P1008` - Operation timeout
- `P2024` - Connection timeout
- `P2025` - Record not found

### GraphQL Errors
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - CSRF validation failed
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Getting Help

1. Check application logs
2. Review health check endpoint
3. Verify environment variables
4. Check database connectivity
5. Review this troubleshooting guide
6. Check GitHub issues (if applicable)

## Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This provides more detailed error messages and stack traces.
