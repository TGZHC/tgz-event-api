// Express app assembly. Kept separate from index.js so tests can import the app
// without starting a server or opening real sockets.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from './logger.js';
import { eventsRouter } from './routes/events.js';
import { healthRouter } from './routes/health.js';
import { statsRouter } from './routes/stats.js';
import { testRouter } from './routes/diagnostics.js';
import { requireAuth, isAuthorized } from './middleware/auth.js';
import { handleEvent, toEventList } from './events/router.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Live diagnostics (in-memory, reset on redeploy). Lets us SEE whether SAT is
// reaching the server at all, regardless of path or auth — exposed via /api/status.
const diag = {
  posts_received: 0,
  posts_unauthorized: 0,
  last_post_path: null,
  last_post_at: null,
  last_post_header_names: null,
  last_post_query: null,
  last_post_body: null, // raw body of the last POST, capped — reveals SAT's format
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // SAT posts JSON. Accept it even if the client sends an odd/missing
  // Content-Type, and never crash on a malformed body.
  app.use(express.json({ limit: '256kb', type: () => true }));

  // Count every POST (any path, any auth) so we can confirm SAT is talking to us.
  app.use((req, _res, next) => {
    if (req.method === 'POST') {
      diag.posts_received += 1;
      diag.last_post_path = req.path;
      diag.last_post_at = new Date().toISOString();
      diag.last_post_header_names = Object.keys(req.headers);
      diag.last_post_query = req.query;
      try {
        diag.last_post_body = JSON.stringify(req.body).slice(0, 2000);
      } catch {
        diag.last_post_body = String(req.body).slice(0, 2000);
      }
      if (!isAuthorized(req)) diag.posts_unauthorized += 1;
    }
    logger.debug('request', { method: req.method, path: req.path });
    next();
  });

  // JSON status — confirm in a browser whether SAT events are arriving.
  app.get('/api/status', async (_req, res) => {
    const body = { name: 'TGZ Event API', status: 'ok', ...diag };
    try {
      const { eventCounts } = await import('./stats/repository.js');
      Object.assign(body, await eventCounts());
    } catch (err) {
      body.events_error = err.message;
    }
    res.json(body);
  });

  app.use('/health', healthRouter);
  app.use('/events', eventsRouter);
  app.use('/stats', statsRouter);
  app.use('/test', testRouter);

  // Catch-all for SAT events. `eventsApiAddress` has no path, so SAT may POST to
  // "/" or to "/<event_name>". This accepts a POST to ANY path, using the path
  // as the event type when the body doesn't carry one.
  app.post('*', requireAuth, async (req, res, next) => {
    try {
      const events = toEventList(req.body);
      const pathType = req.path.replace(/^\/+/, '');
      const results = [];
      for (const event of events) {
        const e = event && typeof event === 'object' && !Array.isArray(event) ? { ...event } : { value: event };
        // If a SAT-style path carried the type and the body didn't, use it.
        if (!e.type && !e.name && pathType && pathType !== 'events') e.type = pathType;
        results.push(await handleEvent(e));
      }
      res.status(202).json({ accepted: results.length, results });
    } catch (err) {
      next(err);
    }
  });

  // The public stats website, served from /public at the site root.
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  app.use(express.static(publicDir));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
