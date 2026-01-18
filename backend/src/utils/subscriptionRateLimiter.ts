/**
 * Subscription Rate Limiter
 * Limits subscription connections per user to prevent abuse
 */

import {logWarn} from './logger';

/**
 * Maximum subscriptions per user
 */
const MAX_SUBSCRIPTIONS_PER_USER = 10;

/**
 * Subscription rate limit tracking
 * In production, consider using Redis for distributed rate limiting
 */
const subscriptionCounts = new Map<string, number>();

/**
 * Check if user has exceeded subscription limit
 * @param userId - User ID
 * @returns True if user can create another subscription
 */
export function canCreateSubscription(userId: string): boolean {
  const count = subscriptionCounts.get(userId) ?? 0;
  return count < MAX_SUBSCRIPTIONS_PER_USER;
}

/**
 * Increment subscription count for user
 * @param userId - User ID
 */
export function incrementSubscriptionCount(userId: string): void {
  const count = subscriptionCounts.get(userId) ?? 0;
  subscriptionCounts.set(userId, count + 1);

  if (count + 1 >= MAX_SUBSCRIPTIONS_PER_USER) {
    logWarn('User approaching subscription limit', {
      event: 'subscription_limit_warning',
      userId,
      count: count + 1,
      max: MAX_SUBSCRIPTIONS_PER_USER,
    });
  }
}

/**
 * Decrement subscription count for user
 * @param userId - User ID
 */
export function decrementSubscriptionCount(userId: string): void {
  const count = subscriptionCounts.get(userId) ?? 0;
  if (count > 0) {
    subscriptionCounts.set(userId, count - 1);
  } else {
    subscriptionCounts.delete(userId);
  }
}

/**
 * Get subscription count for user
 * @param userId - User ID
 * @returns Current subscription count
 */
export function getSubscriptionCount(userId: string): number {
  return subscriptionCounts.get(userId) ?? 0;
}
