// Automated leaderboard recaps. Every few minutes it checks whether a day/week/
// month has rolled over (in UTC) since the last post it recorded. When one has,
// it posts that just-completed period's leaderboard (and optionally the deadliest
// weapons) to the leaderboard channel, then remembers it so it never double-posts.
//
// On the very first run it SEEDS the "last posted" markers without posting, so a
// fresh deploy doesn't dump stale/empty boards into Discord.

import config from '../config.js';
import { logger } from '../logger.js';
import { previousKey } from './periods.js';
import { leaderboard, weaponLeaderboard, getMeta, setMeta } from './repository.js';
import { leaderboardEmbed, weaponLeaderboardEmbed } from '../discord/embeds.js';
import { sendEmbed } from '../discord/webhooks.js';

const TYPES = [
  { type: 'day', enabled: () => config.schedule.daily, metaKey: 'posted_day' },
  { type: 'week', enabled: () => config.schedule.weekly, metaKey: 'posted_week' },
  { type: 'month', enabled: () => config.schedule.monthly, metaKey: 'posted_month' },
];

async function postRecap(type, key) {
  const sort = config.schedule.sort;
  const rows = await leaderboard({ period: type, sort, limit: 10, key });
  sendEmbed('leaderboard', leaderboardEmbed({ period: type, rows, sort }));
  if (config.schedule.includeWeapons) {
    const weapons = await weaponLeaderboard({ period: type, limit: 5, key });
    sendEmbed('leaderboard', weaponLeaderboardEmbed({ period: type, rows: weapons }));
  }
  logger.info('Posted scheduled leaderboard recap', { type, key, players: rows.length });
}

let running = false;

export async function tick() {
  if (running) return;
  running = true;
  try {
    for (const t of TYPES) {
      if (!t.enabled()) continue;
      const completed = previousKey(t.type); // key of the period that just ended
      const last = await getMeta(t.metaKey);
      if (last === null) {
        await setMeta(t.metaKey, completed); // seed silently, no post
      } else if (last !== completed) {
        await postRecap(t.type, completed);
        await setMeta(t.metaKey, completed);
      }
    }
  } catch (err) {
    logger.warn('Scheduler tick failed (will retry next interval)', { error: err.message });
  } finally {
    running = false;
  }
}

export function startScheduler(intervalMs = 10 * 60_000) {
  logger.info('Leaderboard scheduler started', {
    daily: config.schedule.daily, weekly: config.schedule.weekly, monthly: config.schedule.monthly,
  });
  tick(); // run once now (seeds markers)
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return timer;
}
