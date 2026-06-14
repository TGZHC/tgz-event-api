// Period key helpers. A single event increments four rows: all-time plus the
// current day, ISO-week and calendar-month buckets. Leaderboards for any period
// are then a single indexed lookup, and day/week/month "reset" automatically
// when the key rolls over — no cron job wiping tables.

export const PERIOD_TYPES = ['all', 'day', 'week', 'month'];

/** ISO-8601 week number, e.g. 24. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7) };
}

function dayKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function weekKey(date) {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The four (period_type, period_key) buckets an event at `date` contributes to. */
export function bucketsFor(date = new Date()) {
  return [
    { type: 'all', key: 'all' },
    { type: 'day', key: dayKey(date) },
    { type: 'week', key: weekKey(date) },
    { type: 'month', key: monthKey(date) },
  ];
}

/** Resolve a period type to its key for a given date (default: now). */
export function currentKey(periodType, date = new Date()) {
  const bucket = bucketsFor(date).find((b) => b.type === periodType);
  if (!bucket) throw new Error(`Unknown period type: ${periodType}`);
  return bucket.key;
}

/**
 * The key for the period that just COMPLETED before `date`. Used by the
 * scheduler to post "yesterday's" / "last week's" / "last month's" recap.
 * 'all' has no previous period and returns null.
 */
export function previousKey(periodType, date = new Date()) {
  const d = new Date(date.getTime());
  switch (periodType) {
    case 'day':
      d.setUTCDate(d.getUTCDate() - 1);
      return dayKey(d);
    case 'week':
      d.setUTCDate(d.getUTCDate() - 7);
      return weekKey(d);
    case 'month':
      d.setUTCDate(1); // first of this month
      d.setUTCDate(0); // last day of previous month
      return monthKey(d);
    default:
      return null;
  }
}
