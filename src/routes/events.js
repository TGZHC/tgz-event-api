// POST /events — the SAT ingestion endpoint. Authenticated. Accepts a single
// event object or an array of events. Responds 202 as soon as events are stored;
// Discord/stats processing happens asynchronously so SAT never waits on it.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { handleEvent, toEventList } from '../events/router.js';
import { recentEvents } from '../stats/repository.js';

export const eventsRouter = Router();

// GET /events/recent?token=YOURTOKEN — see the last raw events SAT sent, so we
// can read their real type names and field names. Token via header OR ?token=
// query so it's easy to open in a browser.
eventsRouter.get('/recent', (req, res, next) => {
  // Allow the token as a query param for browser convenience.
  if (req.query.token && !req.get('authorization')) req.headers.authorization = `Bearer ${req.query.token}`;
  requireAuth(req, res, async () => {
    try {
      res.json({ events: await recentEvents(Number.parseInt(req.query.limit, 10) || 20) });
    } catch (err) {
      next(err);
    }
  });
});

eventsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body;
    // Unwrap the batch envelope { token, events: [...] } (what the mod sends), a bare array, or a
    // single event object. Previously this only handled arrays/single objects, so a batch envelope
    // was treated as ONE event with no name -> nothing got handled.
    const events = toEventList(body);
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
