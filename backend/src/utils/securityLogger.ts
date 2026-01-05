/**
 * Security Event Logger
 * Logs security-related events for monitoring and auditing
 */

import {logWarn, logError} from './logger';

/**
 * Log authentication failure
 * @param reason - Reason for authentication failure
 * @param metadata - Additional metadata (e.g., IP address, user agent)
 */
export function logAuthFailure(reason: string, metadata?: Record<string, unknown>): void {
  logWarn('Authentication failure', {
    event: 'auth_failure',
    reason,
    ...metadata,
  });
}

/**
 * Log authorization failure (unauthorized access attempt)
 * @param userId - User ID attempting access (if known)
 * @param resource - Resource being accessed
 * @param action - Action attempted
 * @param metadata - Additional metadata
 */
export function logAuthorizationFailure(
  userId: string | undefined,
  resource: string,
  action: string,
  metadata?: Record<string, unknown>,
): void {
  logWarn('Authorization failure', {
    event: 'authorization_failure',
    userId,
    resource,
    action,
    ...metadata,
  });
}

/**
 * Log suspicious activity
 * @param activity - Description of suspicious activity
 * @param metadata - Additional metadata
 */
export function logSuspiciousActivity(activity: string, metadata?: Record<string, unknown>): void {
  logWarn('Suspicious activity detected', {
    event: 'suspicious_activity',
    activity,
    ...metadata,
  });
}

/**
 * Log security error
 * @param message - Error message
 * @param error - Error object
 * @param metadata - Additional metadata
 */
export function logSecurityError(
  message: string,
  error: Error,
  metadata?: Record<string, unknown>,
): void {
  logError('Security error', {
    event: 'security_error',
    message,
    errorType: error.name,
    ...metadata,
  }, error);
}

