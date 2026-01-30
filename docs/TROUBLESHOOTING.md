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

1. Verify `REACT_APP_GRAPHQL_URL` is correct and accessible
2. Check CORS configuration matches frontend origin
3. Verify backend is running and healthy
4. Check browser console for detailed errors
5. Verify authentication token is valid
6. Check network tab for HTTP status codes

### Error: "Service worker registration failed"

**Solutions:**

- Clear browser cache and service worker
- Verify HTTPS is enabled (required for service workers)
- Check browser console for specific errors
- Verify service worker file exists: `/sw.js`
- Test in incognito mode (no extensions)
- Check browser supports service workers

### Error: "Subscription connection failed"

**Solutions:**

1. Verify WebSocket URL is correct
2. Check browser supports WebSocket
3. Verify backend subscription server is running
4. Check firewall/proxy settings
5. Ensure HTTPS is used (WSS for secure WebSocket)

### Error: "Workspace selector not showing"

**Solutions:**

1. Verify user has workspaces:
   ```graphql
   query {
     workspaces {
       id
       name
     }
   }
   ```
2. Check workspace context is initialized
3. Verify authentication is complete
4. Check browser console for errors

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

## Workspace Issues

### Error: "Workspace not found" or "Access denied"

**Symptoms:**

- Cannot access workspace data
- 403 Forbidden errors
- Missing accounts/categories/payees

**Solutions:**

1. Verify user is a member of the workspace:

   ```graphql
   query {
     workspaces {
       id
       name
       members {
         user {
           email
         }
       }
     }
   }
   ```

2. Check workspace ID in context (should be set automatically)

3. Verify workspace invitation was accepted

4. Check user role has required permissions

### Error: "Conflict detected" when editing

**Symptoms:**

- Cannot save changes
- Conflict resolution dialog appears
- Version mismatch errors

**Solutions:**

1. This is expected behavior for concurrent edits
2. Use conflict resolution dialog to choose version or merge
3. Open the entity's detail page and scroll to the **Version History** section to see what changed (see [User Guide - Version History](USAGE.md#version-history))
4. Coordinate with team members to avoid simultaneous edits

### Error: "Invitation expired" or "Invalid invitation token"

**Solutions:**

1. Invitations expire after 7 days (default)
2. Request a new invitation from workspace owner
3. Verify invitation token is correct
4. Check invitation hasn't already been accepted
5. If you're already logged in, go to **Workspaces** and check the **"Pending invitations for you"** section; you can accept pending invitations from there without using the email link

## Budget Issues

### Error: "Budget not found" or "Budget access denied"

**Solutions:**

1. Verify budget belongs to current workspace
2. Check user has access to workspace
3. Verify budget ID is correct

### Budget notifications not appearing

**Solutions:**

1. Check budget threshold is configured correctly
2. Verify budget reset cron job is running
3. Check notification service is working
4. Review budget notification query:
   ```graphql
   query {
     budgetNotifications {
       id
       message
       read
     }
   }
   ```

## Subscription Issues

### WebSocket connection fails

**Symptoms:**

- Real-time updates not working
- Subscription errors in console
- Connection drops frequently

**Solutions:**

1. Verify WebSocket endpoint is accessible: `ws://your-domain/graphql-ws`
2. Check firewall/proxy allows WebSocket connections
3. Verify backend subscription server is running
4. Check browser console for WebSocket errors
5. Ensure HTTPS is used (required for secure WebSocket in production)

### Subscriptions not receiving updates

**Solutions:**

1. Verify subscription is properly subscribed
2. Check workspace ID matches current workspace
3. Verify entity belongs to subscribed workspace
4. Check backend logs for subscription errors
5. Test with GraphQL Playground subscriptions

## Common Error Codes

### Database Errors

- `P1001` - Connection error
- `P1008` - Operation timeout
- `P2024` - Connection timeout
- `P2025` - Record not found
- `P2002` - Unique constraint violation
- `P2003` - Foreign key constraint violation

### GraphQL Errors

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - CSRF validation failed or insufficient permissions
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `CONFLICT_DETECTED` - Version conflict (optimistic locking)
- `NOT_FOUND` - Entity not found
- `WORKSPACE_ACCESS_DENIED` - User doesn't have access to workspace

## Import/Export Issues

### PDF Import fails

**Solutions:**

1. Verify PDF file is valid and not corrupted
2. Check file size (max 10MB)
3. Verify PDF contains text (not scanned image)
4. Check date format matches expected format
5. Review import logs for parsing errors

### CSV Import fails

**Solutions:**

1. Verify CSV format matches expected schema
2. Check file encoding (should be UTF-8)
3. Verify required columns are present
4. Check for invalid data types
5. Review import result errors array

### Export data incomplete

**Solutions:**

1. Verify workspace filter is correct
2. Check date range filters
3. Verify user has access to all data
4. Check export query includes all desired fields
5. Review export result for errors

## Batch Operation Issues

### Batch operation partially fails

**Solutions:**

1. Review errors array in response
2. Check individual item validation
3. Verify all required fields are provided
4. Check for duplicate constraints
5. Review transaction rollback behavior

## Getting Help

1. **Check Application Logs**
   - Backend: `docker logs my-money-backend` or check log files
   - Frontend: Browser console and network tab

2. **Review Health Check**
   - `GET /health` endpoint status
   - Component health (database, OIDC, memory)

3. **Verify Configuration**
   - Environment variables are set correctly
   - Database connection string is valid
   - OIDC configuration is correct

4. **Check Database**
   - Database is running and accessible
   - Migrations are applied
   - Connection pool is not exhausted

5. **Review This Guide**
   - Check relevant troubleshooting section
   - Review common error codes

6. **Additional Resources**
   - Check application logs for detailed error messages
   - Review GraphQL errors in response
   - Check browser console for frontend errors
   - Verify network connectivity

## Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

This provides more detailed error messages and stack traces.
