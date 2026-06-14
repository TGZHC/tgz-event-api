// Read-only stats API + on-demand Discord posting.
//   GET  /stats/leaderboard?period=day|week|month|all&sort=kills&limit=10
//   GET  /stats/weapons?period=...&limit=10
//   GET  /stats/player/:id
//   POST /stats/leaderboard/post   (auth) — push a leaderboard to Discord now
// Leaderboards are public by default; flip requireAuth on if you want them private.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { leaderboard, weaponLeaderboard, getPlayerProfile, listPlayers } from '../stats/repository.js';
import { leaderboardEmbed, weaponLeaderboardEmbed } from '../discord/embeds.js';
import { sendEmbed } from '../discord/webhooks.js';
import { PERIOD_TYPES } from '../stats/periods.js';

export const statsRouter = Router();

function cleanPeriod(p, fallback = 'all') {
  return PERIOD_TYPES.includes(p) ? p : fallback;
}

statsRouter.get('/leaderboard', async (req, res, next) => {
  try {
    const period = cleanPeriod(req.query.period);
    const sort = req.query.sort || 'kills';
    const limit = Number.parseInt(req.query.limit, 10) || 10;
    const rows = await leaderboard({ period, sort, limit });
    res.json({ period, sort, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

statsRouter.get('/weapons', async (req, res, next) => {
  try {
    const period = cleanPeriod(req.query.period);
    const limit = Number.parseInt(req.query.limit, 10) || 10;
    const rows = await weaponLeaderboard({ period, limit });
    res.json({ period, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

// Directory of players for the website (search/browse).
statsRouter.get('/players', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 1000;
    res.json({ players: await listPlayers({ limit }) });
  } catch (err) {
    next(err);
  }
});

// Full player profile: identity, all-time totals, and day-by-day history.
statsRouter.get('/player/:id', async (req, res, next) => {
  try {
    const player = await getPlayerProfile(req.params.id);
    if (!player) return res.status(404).json({ error: 'player not found' });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// Push a leaderboard (and optionally weapons) to Discord now. Authenticated so
// only the server or a trusted cron can trigger a broadcast.
statsRouter.post('/leaderboard/post', requireAuth, async (req, res, next) => {
  try {
    const period = cleanPeriod(req.body?.period, 'week');
    const sort = req.body?.sort || 'kills';
    const rows = await leaderboard({ period, sort, limit: 10 });
    const posted = sendEmbed('leaderboard', leaderboardEmbed({ period, rows, sort }));
    if (req.body?.weapons) {
      const weapons = await weaponLeaderboard({ period, limit: 5 });
      sendEmbed('leaderboard', weaponLeaderboardEmbed({ period, rows: weapons }));
    }
    res.json({ posted, period, sort, count: rows.length });
  } catch (err) {
    next(err);
  }
});
