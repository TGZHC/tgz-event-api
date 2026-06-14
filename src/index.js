// Entry point. Starts the HTTP server FIRST so the platform healthcheck can
// succeed immediately, THEN connects to the database with retries in the
// background. On hosts like Railway the private network between the app and the
// database isn't ready the instant the app boots — so we must not crash if the
// first connection attempt fails; we keep retrying until it comes up.

import config from './config.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { close as closeDb, probe, target } from './db/pool.js';
import { startScheduler } from './stats/scheduler.js';

// Keep trying to reach the DB and apply the schema, backing off between tries.
// Never throws — the server stays up and serving /health the whole time.
async function connectWithRetry() {
  const t = target();
  logger.info(`Connecting to database at ${t.host}:${t.port} (db="${t.database}", user="${t.user}", from ${t.source})`);
  let attempt = 0;
  // ~2s, 4s, 6s ... capped at 15s. Retries effectively forever so a slow or
  // briefly-down database self-heals instead of taking the whole app down.
  for (;;) {
    attempt += 1;
    try {
      await probe();
      await migrate();
      logger.info('Database connected and schema applied.', { attempt });
      startScheduler(); // safe to start now that the DB + meta table exist
      return;
    } catch (err) {
      const waitMs = Math.min(attempt * 2000, 15_000);
      // Put the real reason in the message text so it's visible even where the
      // log viewer only shows the message and hides structured fields.
      logger.warn(`DB connect failed (attempt ${attempt}): ${err.code || ''} ${err.message} — retrying in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function main() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('TGZ Event API listening', { port: config.port, env: config.env });
  });

  // Fire-and-forget: connect to the DB in the background while we already serve.
  connectWithRetry();

  async function shutdown(signal) {
    logger.info('Shutting down', { signal });
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    // Don't hang forever if a connection won't close.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Crash guards — log and keep serving rather than dying silently.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});
