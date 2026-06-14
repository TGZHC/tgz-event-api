// Discord delivery. Two things the old setup lacked and this fixes:
//  1. A serial send queue that RESPECTS Discord's 429 Retry-After, so a burst of
//     kills can't get the webhook rate-limited and start dropping messages.
//  2. Category->webhook routing with a default fallback, so an unconfigured
//     category degrades gracefully instead of throwing.
//
// Uses the built-in global fetch (Node 20+) — no extra dependency.

import config from '../config.js';
import { logger } from '../logger.js';

const ROUTES = {
  kills: config.discord.kills || config.discord.default,
  joins: config.discord.joins || config.discord.default,
  objectives: config.discord.objectives || config.discord.default,
  admin: config.discord.admin || config.discord.default,
  server: config.discord.server || config.discord.default,
  // Leaderboard recaps prefer their own channel, else the objectives channel.
  leaderboard: config.discord.leaderboard || config.discord.objectives || config.discord.default,
  default: config.discord.default,
};

const queue = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue[0];
    try {
      const res = await fetch(job.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.body),
      });

      if (res.status === 429) {
        const retryMs = (Number(res.headers.get('retry-after')) || 1) * 1000;
        logger.warn('Discord rate-limited, backing off', { retryMs });
        await sleep(retryMs);
        continue; // retry same job
      }
      if (!res.ok) {
        logger.warn('Discord webhook rejected message', { status: res.status, category: job.category });
      }
      queue.shift();
    } catch (err) {
      logger.warn('Discord send failed, retrying once', { error: err.message, category: job.category });
      job.attempts = (job.attempts || 0) + 1;
      if (job.attempts >= 3) {
        logger.error('Dropping Discord message after 3 attempts', { category: job.category });
        queue.shift();
      } else {
        await sleep(1000);
      }
    }
  }
  draining = false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Queue an embed for delivery. Never throws — Discord being down must never
 * fail event ingestion. Returns true if it was queued, false if no webhook.
 */
export function sendEmbed(category, embed, { mention = false } = {}) {
  const url = ROUTES[category] || ROUTES.default;
  if (!url) {
    logger.debug('No webhook for category, skipping Discord send', { category });
    return false;
  }
  const body = { embeds: [embed] };
  if (mention && config.discord.alertMention) {
    body.content = config.discord.alertMention;
    body.allowed_mentions = { parse: ['roles'] };
  }
  queue.push({ url, body, category });
  drain();
  return true;
}

/** For /test/discord — sends and surfaces the real result instead of queueing. */
export async function sendNow(category, embed) {
  const url = ROUTES[category] || ROUTES.default;
  if (!url) return { ok: false, reason: 'no webhook configured for category' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  return { ok: res.ok, status: res.status };
}
