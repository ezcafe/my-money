# Monitoring and Alerting Guide

This guide describes how to monitor the My Money application in production.

## Health Checks

### Backend Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "database": "connected",
  "oidc": "configured"
}
```

**Status Values:**
- `ok` - All systems operational
- `degraded` - Some systems unavailable (e.g., database disconnected)

**Monitoring Recommendations:**
- Check every 30 seconds
- Alert if status is not "ok" for > 2 minutes
- Alert if database is "disconnected"
- Alert if OIDC is "unconfigured"

### Frontend Health Check

**Endpoint:** `GET /health`

Returns basic status for load balancer health checks.

## Logging

### Log Format

All logs are structured JSON format:

```json
{
  "timestamp": "2025-01-27T12:00:00.000Z",
  "level": "error",
  "message": "Database operation failed",
  "context": {
    "event": "database_operation_failed",
    "operation": "createTransaction",
    "userId": "user-123",
    "requestId": "req-456"
  },
  "error": {
    "name": "PrismaClientKnownRequestError",
    "message": "Connection timeout",
    "stack": "..."
  }
}
```

### Log Levels

- `error` - Errors requiring attention
- `warn` - Warnings (e.g., authentication failures)
- `info` - Informational messages
- `debug` - Debug messages (development only)

### Key Events to Monitor

1. **Authentication Failures:**
   - Event: `auth_failure`
   - Monitor for brute force attempts
   - Alert on spike in failures

2. **Database Errors:**
   - Event: `database_operation_failed`
   - Monitor for connection issues
   - Alert on circuit breaker opening

3. **Security Events:**
   - Event: `security_error`
   - Monitor for suspicious activity
   - Alert on security violations

4. **Rate Limit Exceeded:**
   - Event: `rate_limit_exceeded`
   - Monitor for potential attacks
   - Alert on sustained rate limit hits

## Metrics to Track

### Application Metrics

1. **Request Rate:**
   - Total requests per minute
   - GraphQL operations per minute
   - File uploads per minute

2. **Error Rate:**
   - Errors per minute
   - Error rate by type
   - 5xx errors vs 4xx errors

3. **Response Times:**
   - P50, P95, P99 response times
   - GraphQL query execution time
   - Database query time

4. **Database Metrics:**
   - Connection pool usage
   - Active connections
   - Query execution time
   - Circuit breaker state

5. **Authentication Metrics:**
   - Successful logins
   - Failed login attempts
   - Token refresh rate

### Infrastructure Metrics

1. **CPU Usage:**
   - Backend container CPU
   - Database CPU

2. **Memory Usage:**
   - Backend container memory
   - Database memory
   - Connection pool memory

3. **Disk Usage:**
   - Database disk space
   - Log file size

4. **Network:**
   - Incoming/outgoing traffic
   - Connection count

## Alerting Rules

### Critical Alerts (Immediate Action Required)

1. **Database Down:**
   - Condition: Health check shows `database: "disconnected"` for > 1 minute
   - Action: Check database service, verify connectivity

2. **Circuit Breaker Open:**
   - Condition: Database circuit breaker is open
   - Action: Check database health, review recent errors

3. **High Error Rate:**
   - Condition: Error rate > 10% for 5 minutes
   - Action: Review error logs, check system health

4. **Authentication Service Down:**
   - Condition: OIDC health check fails for > 2 minutes
   - Action: Check OIDC provider status

### Warning Alerts (Investigate)

1. **High Response Time:**
   - Condition: P95 response time > 2 seconds for 10 minutes
   - Action: Review slow queries, check database performance

2. **High Memory Usage:**
   - Condition: Memory usage > 80% for 10 minutes
   - Action: Review memory leaks, consider scaling

3. **Rate Limit Approaching:**
   - Condition: Rate limit usage > 80% for 5 minutes
   - Action: Review traffic patterns, consider adjusting limits

4. **Database Connection Pool Exhausted:**
   - Condition: Connection pool usage > 90% for 5 minutes
   - Action: Review connection usage, consider increasing pool size

## Monitoring Tools

### Recommended Tools

1. **Application Performance Monitoring (APM):**
   - New Relic
   - Datadog
   - Sentry

2. **Log Aggregation:**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Splunk
   - CloudWatch Logs

3. **Metrics Collection:**
   - Prometheus + Grafana
   - Datadog
   - CloudWatch Metrics

4. **Error Tracking:**
   - Sentry
   - Rollbar
   - Bugsnag

## Dashboard Recommendations

### Key Dashboards

1. **System Health:**
   - Health check status
   - Database connectivity
   - OIDC status
   - Error rate

2. **Performance:**
   - Response times (P50, P95, P99)
   - Request rate
   - Database query performance
   - Connection pool usage

3. **Security:**
   - Authentication failures
   - Rate limit hits
   - Security events
   - Suspicious activity

4. **Infrastructure:**
   - CPU/Memory usage
   - Disk usage
   - Network traffic
   - Container health

## Log Retention

- **Production Logs:** Retain for 30 days minimum
- **Security Logs:** Retain for 90 days minimum
- **Error Logs:** Retain for 90 days minimum
- **Access Logs:** Retain for 7 days (or as required by compliance)

## Best Practices

1. **Centralized Logging:**
   - Aggregate logs from all instances
   - Use correlation IDs for request tracing

2. **Structured Logging:**
   - Use JSON format for easy parsing
   - Include context in all log entries

3. **Alert Fatigue:**
   - Set appropriate thresholds
   - Use alert grouping
   - Review and adjust alerts regularly

4. **Performance Monitoring:**
   - Track key business metrics
   - Monitor user-facing metrics
   - Set up SLAs and SLOs

5. **Security Monitoring:**
   - Monitor authentication events
   - Track security violations
   - Review access patterns

## Integration Examples

### Prometheus Metrics Endpoint (Future Enhancement)

```typescript
// Example: Add metrics endpoint
fastify.get('/metrics', async () => {
  return prometheusMetrics;
});
```

### Sentry Integration (Future Enhancement)

```typescript
// Example: Error reporting
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Troubleshooting with Logs

1. **Find errors for a specific user:**
   ```bash
   grep "userId:user-123" logs/*.log | grep error
   ```

2. **Track a request:**
   ```bash
   grep "requestId:req-456" logs/*.log
   ```

3. **Find database errors:**
   ```bash
   grep "database_operation_failed" logs/*.log
   ```

4. **Monitor authentication:**
   ```bash
   grep "auth_failure" logs/*.log
   ```
