// Period key helpers. A single event increments three rows: the all-time bucket
// plus the current ISO-week and calendar-month buckets. That makes weekly and
// monthly leaderboards a trivial lookup and they "reset" automatically when the
// key rolls over — no cron job wiping tables.

/** ISO-8601 week number, e.g. 24. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7) };
}

/** The three (period_type, period_key) buckets an event at `date` contributes to. */
export function bucketsFor(date = new Date()) {
  const { year, week } = isoWeek(date);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return [
    { type: 'all', key: 'all' },
    { type: 'week', key: `${year}-W${String(week).padStart(2, '0')}` },
    { type: 'month', key: `${date.getUTCFullYear()}-${month}` },
  ];
}

/** Resolve a requested period ('all' | 'week' | 'month') to its current key. */
export function currentKey(periodType, date = new Date()) {
  const bucket = bucketsFor(date).find((b) => b.type === periodType);
  if (!bucket) throw new Error(`Unknown period type: ${periodType}`);
  return bucket.key;
}
