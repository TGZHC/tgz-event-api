// GET /stats/leaderboard and /stats/player/:id — read-only stats API. Public by
// default (leaderboards are usually shown on a site/Discord); flip requireAuth
// on if you want them private. Also POST /stats/leaderboard/post to push the
// current leaderboard to Discord on demand (or from a cron).

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { leaderboard, getPlayer } from '../stats/repository.js';
import { leaderboardEmbed } from '../discord/embeds.js';
import { sendEmbed } from '../discord/webhooks.js';

export const statsRouter = Router();

statsRouter.get('/leaderboard', async (req, res, next) => {
  try {
    const period = ['all', 'week', 'month'].includes(req.query.period) ? req.query.period : 'all';
    const sort = req.query.sort || 'kills';
    const limit = Number.parseInt(req.query.limit, 10) || 10;
    const rows = await leaderboard({ period, sort, limit });
    res.json({ period, sort, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

statsRouter.get('/player/:id', async (req, res, next) => {
  try {
    const player = await getPlayer(req.params.id);
    if (!player) return res.status(404).json({ error: 'player not found' });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// Push the leaderboard to the objectives/default channel. Authenticated so only
// the server or a trusted cron can trigger a broadcast.
statsRouter.post('/leaderboard/post', requireAuth, async (req, res, next) => {
  try {
    const period = ['all', 'week', 'month'].includes(req.body?.period) ? req.body.period : 'week';
    const sort = req.body?.sort || 'kills';
    const rows = await leaderboard({ period, sort, limit: 10 });
    const queued = sendEmbed('objectives', leaderboardEmbed({ period, rows, sort }));
    res.json({ posted: queued, period, sort, count: rows.length });
  } catch (err) {
    next(err);
  }
});
