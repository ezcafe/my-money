/**
 * Cron Job Utilities
 * Functions to track and manage cron job execution history
 */

import {prisma} from './prisma';
import {logWarn} from './logger';

/**
 * Get last run date for a cron job
 * @param jobName - Name of the cron job (e.g., 'recurringTransactions')
 * @returns Last run date or null if never run
 */
export async function getLastRunDate(jobName: string): Promise<Date | null> {
  const execution = await prisma.cronJobExecution.findUnique({
    where: {jobName},
    select: {lastRunDate: true},
  });

  if (!execution) {
    return null;
  }

  return execution.lastRunDate;
}

/**
 * Update last run date for a cron job
 * @param jobName - Name of the cron job
 * @param runDate - Date of the last successful run
 */
export async function updateLastRunDate(jobName: string, runDate: Date): Promise<void> {
  await prisma.cronJobExecution.upsert({
    where: {jobName},
    create: {
      jobName,
      lastRunDate: runDate,
    },
    update: {
      lastRunDate: runDate,
    },
  });
}

/**
 * Calculate missed daily run dates between last run and current date
 * @param lastRun - Last run date (exclusive)
 * @param currentDate - Current date (inclusive)
 * @param maxMissed - Maximum number of missed days to process (default: 365)
 * @returns Array of Date objects representing each missed day
 */
export function getMissedDailyRuns(
  lastRun: Date,
  currentDate: Date,
  maxMissed: number = 365,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize dates to midnight for consistent comparison
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    0,
    0,
    0,
    0,
  );
  const currentDateNormalized = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  );

  // If last run is today or in the future, no missed runs
  if (lastRunNormalized >= currentDateNormalized) {
    return missedRuns;
  }

  // Start from the day after last run
  const nextDay = new Date(lastRunNormalized);
  nextDay.setDate(nextDay.getDate() + 1);

  // Generate all missed days up to current date
  let count = 0;
  const currentDay = new Date(nextDay);

  while (currentDay <= currentDateNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
    count++;
  }

  // Log warning if we hit the max limit
  if (count >= maxMissed && currentDay <= currentDateNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentDate: currentDateNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Calculate missed minutely run dates between last run and current time
 * @param lastRun - Last run date (exclusive)
 * @param currentTime - Current time (inclusive)
 * @param maxMissed - Maximum number of missed minutes to process (default: 60)
 * @returns Array of Date objects representing each missed minute
 */
export function getMissedMinutelyRuns(
  lastRun: Date,
  currentTime: Date,
  maxMissed: number = 60,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize to minute precision (remove seconds and milliseconds)
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    lastRun.getHours(),
    lastRun.getMinutes(),
    0,
    0,
  );
  const currentTimeNormalized = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate(),
    currentTime.getHours(),
    currentTime.getMinutes(),
    0,
    0,
  );

  // If last run is current minute or in the future, no missed runs
  if (lastRunNormalized >= currentTimeNormalized) {
    return missedRuns;
  }

  // Start from the minute after last run
  const nextMinute = new Date(lastRunNormalized);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);

  // Generate all missed minutes up to current time
  let count = 0;
  const currentMinute = new Date(nextMinute);

  while (currentMinute <= currentTimeNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentMinute));
    currentMinute.setMinutes(currentMinute.getMinutes() + 1);
    count++;
  }

  // Log warning if we hit the max limit
  if (count >= maxMissed && currentMinute <= currentTimeNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentTime: currentTimeNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Calculate missed hourly run dates between last run and current time
 * @param lastRun - Last run date (exclusive)
 * @param currentTime - Current time (inclusive)
 * @param maxMissed - Maximum number of missed hours to process (default: 24)
 * @returns Array of Date objects representing each missed hour at minute 0
 */
export function getMissedHourlyRuns(
  lastRun: Date,
  currentTime: Date,
  maxMissed: number = 24,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize to hour precision (remove minutes, seconds, and milliseconds)
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    lastRun.getHours(),
    0,
    0,
    0,
  );
  const currentTimeNormalized = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate(),
    currentTime.getHours(),
    0,
    0,
    0,
  );

  // If last run is current hour or in the future, no missed runs
  if (lastRunNormalized >= currentTimeNormalized) {
    return missedRuns;
  }

  // Start from the hour after last run
  const nextHour = new Date(lastRunNormalized);
  nextHour.setHours(nextHour.getHours() + 1);

  // Generate all missed hours up to current time
  let count = 0;
  const currentHour = new Date(nextHour);

  while (currentHour <= currentTimeNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentHour));
    currentHour.setHours(currentHour.getHours() + 1);
    count++;
  }

  // Log warning if we hit the max limit
  if (count >= maxMissed && currentHour <= currentTimeNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentTime: currentTimeNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Recurring transaction interval types
 */
export type RecurringInterval = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Parse cron expression to determine interval type
 * @param cronExpression - Cron expression string
 * @returns Interval type or null if unrecognized
 */
export function getIntervalFromCron(cronExpression: string): RecurringInterval | null {
  // Known cron expressions from frontend
  if (cronExpression === '* * * * *') {
    return 'minutely';
  }
  if (cronExpression === '0 * * * *') {
    return 'hourly';
  }
  if (cronExpression === '0 0 * * *') {
    return 'daily';
  }
  if (cronExpression === '0 0 * * 0') {
    return 'weekly';
  }
  if (cronExpression === '0 0 1 * *') {
    return 'monthly';
  }
  if (cronExpression === '0 0 1 1 *') {
    return 'yearly';
  }
  return null;
}

/**
 * Calculate next run date based on cron expression and current time
 * @param cronExpression - Cron expression string
 * @param currentTime - Current time
 * @returns Next run date
 */
export function calculateNextRunDate(cronExpression: string, currentTime: Date): Date {
  const interval = getIntervalFromCron(cronExpression);
  const nextRunDate = new Date(currentTime);

  switch (interval) {
    case 'minutely':
      nextRunDate.setMinutes(nextRunDate.getMinutes() + 1);
      break;
    case 'hourly':
      nextRunDate.setHours(nextRunDate.getHours() + 1);
      nextRunDate.setMinutes(0, 0, 0);
      break;
    case 'daily':
      nextRunDate.setDate(nextRunDate.getDate() + 1);
      nextRunDate.setHours(0, 0, 0, 0);
      break;
    case 'weekly': {
      // Move to next Sunday at midnight
      const daysUntilSunday = (7 - nextRunDate.getDay()) % 7 || 7;
      nextRunDate.setDate(nextRunDate.getDate() + daysUntilSunday);
      nextRunDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'monthly':
      // Move to first day of next month at midnight
      nextRunDate.setMonth(nextRunDate.getMonth() + 1, 1);
      nextRunDate.setHours(0, 0, 0, 0);
      break;
    case 'yearly':
      // Move to January 1st of next year at midnight
      nextRunDate.setFullYear(nextRunDate.getFullYear() + 1, 0, 1);
      nextRunDate.setHours(0, 0, 0, 0);
      break;
    default:
      // Fallback: assume daily
      nextRunDate.setDate(nextRunDate.getDate() + 1);
      nextRunDate.setHours(0, 0, 0, 0);
  }

  return nextRunDate;
}

/**
 * Calculate missed weekly run dates between last run and current date
 * @param lastRun - Last run date (exclusive)
 * @param currentDate - Current date (inclusive)
 * @param maxMissed - Maximum number of missed weeks to process (default: 52)
 * @returns Array of Date objects representing each missed Sunday at midnight
 */
export function getMissedWeeklyRuns(
  lastRun: Date,
  currentDate: Date,
  maxMissed: number = 52,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize to midnight
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    0,
    0,
    0,
    0,
  );
  const currentDateNormalized = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  );

  // Find the next Sunday after last run
  const nextSunday = new Date(lastRunNormalized);
  const daysUntilSunday = (7 - nextSunday.getDay()) % 7 || 7;
  nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);

  // Generate all missed Sundays up to current date
  let count = 0;
  const currentSunday = new Date(nextSunday);

  while (currentSunday <= currentDateNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentSunday));
    currentSunday.setDate(currentSunday.getDate() + 7);
    count++;
  }

  if (count >= maxMissed && currentSunday <= currentDateNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentDate: currentDateNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Calculate missed monthly run dates between last run and current date
 * @param lastRun - Last run date (exclusive)
 * @param currentDate - Current date (inclusive)
 * @param maxMissed - Maximum number of missed months to process (default: 12)
 * @returns Array of Date objects representing each missed first day of month at midnight
 */
export function getMissedMonthlyRuns(
  lastRun: Date,
  currentDate: Date,
  maxMissed: number = 12,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize to midnight
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    0,
    0,
    0,
    0,
  );
  const currentDateNormalized = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  );

  // Find the first day of next month after last run
  const nextMonth = new Date(lastRunNormalized);
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);

  // Generate all missed first-of-month dates up to current date
  let count = 0;
  const currentMonth = new Date(nextMonth);

  while (currentMonth <= currentDateNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentMonth));
    currentMonth.setMonth(currentMonth.getMonth() + 1, 1);
    count++;
  }

  if (count >= maxMissed && currentMonth <= currentDateNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentDate: currentDateNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Calculate missed yearly run dates between last run and current date
 * @param lastRun - Last run date (exclusive)
 * @param currentDate - Current date (inclusive)
 * @param maxMissed - Maximum number of missed years to process (default: 10)
 * @returns Array of Date objects representing each missed January 1st at midnight
 */
export function getMissedYearlyRuns(
  lastRun: Date,
  currentDate: Date,
  maxMissed: number = 10,
): Date[] {
  const missedRuns: Date[] = [];

  // Normalize to midnight
  const lastRunNormalized = new Date(
    lastRun.getFullYear(),
    lastRun.getMonth(),
    lastRun.getDate(),
    0,
    0,
    0,
    0,
  );
  const currentDateNormalized = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  );

  // Find January 1st of next year after last run
  const nextYear = new Date(lastRunNormalized);
  nextYear.setFullYear(nextYear.getFullYear() + 1, 0, 1);
  nextYear.setHours(0, 0, 0, 0);

  // Generate all missed January 1st dates up to current date
  let count = 0;
  const currentYear = new Date(nextYear);

  while (currentYear <= currentDateNormalized && count < maxMissed) {
    missedRuns.push(new Date(currentYear));
    currentYear.setFullYear(currentYear.getFullYear() + 1, 0, 1);
    count++;
  }

  if (count >= maxMissed && currentYear <= currentDateNormalized) {
    logWarn('Maximum missed runs limit reached', {
      jobName: 'recurringTransactions',
      maxMissed,
      lastRun: lastRunNormalized.toISOString(),
      currentDate: currentDateNormalized.toISOString(),
    });
  }

  return missedRuns;
}

/**
 * Calculate missed runs based on cron expression interval
 * @param cronExpression - Cron expression string
 * @param lastRun - Last run date (exclusive)
 * @param currentTime - Current time (inclusive)
 * @param maxMissed - Maximum number of missed runs to process
 * @returns Array of Date objects representing missed run times
 */
export function getMissedRunsByInterval(
  cronExpression: string,
  lastRun: Date,
  currentTime: Date,
  maxMissed: number = 365,
): Date[] {
  const interval = getIntervalFromCron(cronExpression);

  switch (interval) {
    case 'minutely':
      return getMissedMinutelyRuns(lastRun, currentTime, Math.min(maxMissed, 60));
    case 'hourly':
      return getMissedHourlyRuns(lastRun, currentTime, Math.min(maxMissed, 24));
    case 'daily':
      return getMissedDailyRuns(lastRun, currentTime, maxMissed);
    case 'weekly':
      return getMissedWeeklyRuns(lastRun, currentTime, Math.min(maxMissed, 52));
    case 'monthly':
      return getMissedMonthlyRuns(lastRun, currentTime, Math.min(maxMissed, 12));
    case 'yearly':
      return getMissedYearlyRuns(lastRun, currentTime, Math.min(maxMissed, 10));
    default:
      // Unknown interval, use daily as fallback
      return getMissedDailyRuns(lastRun, currentTime, maxMissed);
  }
}
