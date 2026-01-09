import cronstrue from "cronstrue";
import { parseExpression } from "cron-parser";

/**
 * Validates a cron expression
 * @param expression - The cron expression to validate
 * @returns true if the expression is valid, false otherwise
 */
export function isValidCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a human-readable description of a cron expression
 * @param expression - The cron expression
 * @returns A human-readable string describing the schedule, or null if invalid
 */
export function getCronDescription(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { use24HourTimeFormat: false });
  } catch {
    return null;
  }
}

/**
 * Gets the next N scheduled run times for a cron expression
 * @param expression - The cron expression
 * @param count - Number of future runs to calculate (default: 5)
 * @returns Array of Date objects representing next scheduled runs
 */
export function getNextCronRuns(expression: string, count: number = 5): Date[] {
  try {
    const interval = parseExpression(expression, { utc: true });
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(interval.next().toDate());
    }
    return runs;
  } catch {
    return [];
  }
}

/**
 * Gets the previous N run times for a cron expression
 * @param expression - The cron expression
 * @param count - Number of past runs to calculate (default: 5)
 * @returns Array of Date objects representing previous scheduled runs
 */
export function getPreviousCronRuns(expression: string, count: number = 5): Date[] {
  try {
    const interval = parseExpression(expression, { utc: true });
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(interval.prev().toDate());
    }
    return runs;
  } catch {
    return [];
  }
}

/**
 * Checks if the cron expression would run within the next specified minutes
 * @param expression - The cron expression
 * @param withinMinutes - Number of minutes to check ahead (default: 60)
 * @returns true if a run is scheduled within the specified timeframe
 */
export function hasUpcomingRun(expression: string, withinMinutes: number = 60): boolean {
  try {
    const interval = parseExpression(expression, { utc: true });
    const nextRun = interval.next().toDate();
    const threshold = new Date(Date.now() + withinMinutes * 60 * 1000);
    return nextRun <= threshold;
  } catch {
    return false;
  }
}

/**
 * Common cron presets for use in API responses or validation
 */
export const CRON_PRESETS = {
  HOURLY: "0 * * * *",
  DAILY_9AM: "0 9 * * *",
  DAILY_6PM: "0 18 * * *",
  WEEKDAYS_9AM: "0 9 * * 1-5",
  WEEKLY_MONDAY_9AM: "0 9 * * 1",
  WEEKLY_FRIDAY_5PM: "0 17 * * 5",
  MONTHLY_1ST_9AM: "0 9 1 * *",
} as const;

/**
 * Validates that a cron expression doesn't run too frequently
 * (prevents expressions that would run every minute or second)
 * @param expression - The cron expression
 * @param minIntervalMinutes - Minimum allowed interval between runs (default: 5)
 * @returns true if the interval is acceptable, false if too frequent
 */
export function isReasonableFrequency(
  expression: string,
  minIntervalMinutes: number = 5
): boolean {
  try {
    const interval = parseExpression(expression, { utc: true });
    const firstRun = interval.next().toDate();
    const secondRun = interval.next().toDate();
    const diffMs = secondRun.getTime() - firstRun.getTime();
    const diffMinutes = diffMs / (60 * 1000);
    return diffMinutes >= minIntervalMinutes;
  } catch {
    return false;
  }
}
