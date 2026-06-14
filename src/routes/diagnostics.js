// POST /test/discord — fires a sample embed to a chosen category and returns the
// REAL Discord result, so you can validate webhook config independently of the
// game server (the workflow you already relied on, now first-class). Authed.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendNow } from '../discord/webhooks.js';
import { serverEmbed } from '../discord/embeds.js';

export const testRouter = Router();

testRouter.post('/discord', requireAuth, async (req, res, next) => {
  try {
    const category = req.body?.category || 'server';
    const result = await sendNow(category, serverEmbed({
      title: 'Test Message',
      message: req.body?.message || 'TGZ Event API → Discord connectivity check ✅',
    }));
    res.status(result.ok ? 200 : 502).json({ category, ...result });
  } catch (err) {
    next(err);
  }
});
