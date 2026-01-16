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
