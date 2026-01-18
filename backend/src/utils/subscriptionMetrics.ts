/**
 * Subscription Metrics
 * Tracks subscription usage and performance
 */

import {logInfo} from './logger';

/**
 * Subscription metrics
 */
interface SubscriptionMetrics {
  totalSubscriptions: number;
  subscriptionsByType: Record<string, number>;
  subscriptionsByUser: Record<string, number>;
  averageSubscriptionDuration: number;
  peakConcurrentSubscriptions: number;
}

/**
 * In-memory metrics store
 * In production, consider using Redis or a metrics service
 */
const metrics: SubscriptionMetrics = {
  totalSubscriptions: 0,
  subscriptionsByType: {},
  subscriptionsByUser: {},
  averageSubscriptionDuration: 0,
  peakConcurrentSubscriptions: 0,
};

const activeSubscriptions = new Map<string, {type: string; userId: string; startTime: number}>();

/**
 * Track subscription start
 * @param subscriptionId - Unique subscription ID
 * @param type - Subscription type (e.g., 'ACCOUNT_UPDATED')
 * @param userId - User ID
 */
export function trackSubscriptionStart(subscriptionId: string, type: string, userId: string): void {
  activeSubscriptions.set(subscriptionId, {type, userId, startTime: Date.now()});
  metrics.totalSubscriptions++;
  metrics.subscriptionsByType[type] = (metrics.subscriptionsByType[type] ?? 0) + 1;
  metrics.subscriptionsByUser[userId] = (metrics.subscriptionsByUser[userId] ?? 0) + 1;

  const currentActive = activeSubscriptions.size;
  if (currentActive > metrics.peakConcurrentSubscriptions) {
    metrics.peakConcurrentSubscriptions = currentActive;
  }
}

/**
 * Track subscription end
 * @param subscriptionId - Unique subscription ID
 */
export function trackSubscriptionEnd(subscriptionId: string): void {
  const subscription = activeSubscriptions.get(subscriptionId);
  if (subscription) {
    const duration = Date.now() - subscription.startTime;
    // Update average duration (simple moving average)
    const currentAvg = metrics.averageSubscriptionDuration;
    const totalEnded = metrics.totalSubscriptions - activeSubscriptions.size;
    metrics.averageSubscriptionDuration = totalEnded > 0
      ? (currentAvg * totalEnded + duration) / (totalEnded + 1)
      : duration;

    activeSubscriptions.delete(subscriptionId);
  }
}

/**
 * Get current subscription metrics
 * @returns Current metrics
 */
export function getSubscriptionMetrics(): SubscriptionMetrics {
  return {
    ...metrics,
    subscriptionsByType: {...metrics.subscriptionsByType},
    subscriptionsByUser: {...metrics.subscriptionsByUser},
  };
}

/**
 * Log subscription metrics periodically
 */
export function logSubscriptionMetrics(): void {
  const currentMetrics = getSubscriptionMetrics();
  logInfo('Subscription metrics', {
    event: 'subscription_metrics',
    activeSubscriptionsCount: activeSubscriptions.size,
    totalSubscriptions: currentMetrics.totalSubscriptions,
    averageSubscriptionDuration: currentMetrics.averageSubscriptionDuration,
    peakConcurrentSubscriptions: currentMetrics.peakConcurrentSubscriptions,
  });
}
