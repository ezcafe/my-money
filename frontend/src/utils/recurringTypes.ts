/**
 * Recurring Transaction Types
 * Maps preset recurring types to cron expressions
 */

/**
 * Recurring type options
 */
export type RecurringType = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Recurring type display labels
 */
export const RECURRING_TYPE_LABELS: Record<RecurringType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/**
 * Map recurring type to cron expression
 * @param type - Recurring type
 * @returns Cron expression string
 */
export function getCronExpression(type: RecurringType): string {
  switch (type) {
    case 'daily':
      return '0 0 * * *'; // Every day at midnight
    case 'weekly':
      return '0 0 * * 0'; // Every Sunday at midnight
    case 'monthly':
      return '0 0 1 * *'; // First day of month at midnight
    case 'yearly':
      return '0 0 1 1 *'; // January 1st at midnight
    default: {
      // This should never happen due to TypeScript's exhaustive checking
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown recurring type: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Get all recurring type options
 * @returns Array of recurring type options
 */
export function getRecurringTypeOptions(): Array<{value: RecurringType; label: string}> {
  return Object.entries(RECURRING_TYPE_LABELS).map(([value, label]) => ({
    value: value as RecurringType,
    label,
  }));
}

