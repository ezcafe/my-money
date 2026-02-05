/**
 * Recurring Transaction Types
 * Maps preset recurring types to cron expressions
 */

/**
 * Recurring type options
 */
export type RecurringType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'minutely' | 'hourly';

/**
 * Recurring type display labels
 */
export const RECURRING_TYPE_LABELS: Record<RecurringType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  minutely: 'Minutely',
  hourly: 'Hourly',
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
    case 'minutely':
      return '* * * * *'; // Every minute
    case 'hourly':
      return '0 * * * *'; // Every hour at minute 0
    default: {
      // This should never happen due to TypeScript's exhaustive checking
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown recurring type: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Get all recurring type options
 * Filters out 'minutely' and 'hourly' options unless enabled via environment variable
 * @returns Array of recurring type options
 */
export function getRecurringTypeOptions(): Array<{ value: RecurringType; label: string }> {
  const enableHourlyMinutely = process.env.REACT_APP_ENABLE_HOURLY_MINUTELY_SCHEDULES === 'true';
  return Object.entries(RECURRING_TYPE_LABELS)
    .filter(([value]) => {
      // Only include 'minutely' and 'hourly' if enabled via environment variable
      if (value === 'minutely' || value === 'hourly') {
        return enableHourlyMinutely;
      }
      return true;
    })
    .map(([value, label]) => ({
      value: value as RecurringType,
      label,
    }));
}
