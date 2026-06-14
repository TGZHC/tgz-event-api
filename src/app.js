// Express app assembly. Kept separate from index.js so tests can import the app
// without starting a server or opening real sockets.

import express from 'express';
import { logger } from './logger.js';
import { eventsRouter } from './routes/events.js';
import { healthRouter } from './routes/health.js';
import { statsRouter } from './routes/stats.js';
import { testRouter } from './routes/diagnostics.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // SAT posts JSON. Cap body size to shrug off malformed/huge payloads.
  app.use(express.json({ limit: '256kb' }));

  // One-line request log at debug level.
  app.use((req, _res, next) => {
    logger.debug('request', { method: req.method, path: req.path });
    next();
  });

  app.get('/', (_req, res) => res.json({ name: 'TGZ Event API', status: 'ok' }));
  app.use('/health', healthRouter);
  app.use('/events', eventsRouter);
  app.use('/stats', statsRouter);
  app.use('/test', testRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
