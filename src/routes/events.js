// POST /events — the SAT ingestion endpoint. Authenticated. Accepts a single
// event object or an array of events. Responds 202 as soon as events are stored;
// Discord/stats processing happens asynchronously so SAT never waits on it.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { handleEvent } from '../events/router.js';

export const eventsRouter = Router();

eventsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body;
    const events = Array.isArray(body) ? body : [body];
    if (events.length === 0 || typeof events[0] !== 'object') {
      return res.status(400).json({ error: 'expected an event object or array of events' });
    }

    const results = [];
    for (const event of events) {
      results.push(await handleEvent(event));
    }
    res.status(202).json({ accepted: results.length, results });
  } catch (err) {
    next(err);
  }
});
