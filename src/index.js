// Entry point. Boots in a safe order: validate config (already done on import),
// migrate the schema, start the HTTP server, and install graceful-shutdown and
// last-resort crash guards so an unhandled rejection logs instead of vanishing.

import config from './config.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { close as closeDb, ping } from './db/pool.js';

async function main() {
  // Fail fast if the DB is unreachable, but make the schema self-healing.
  await ping();
  await migrate();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('TGZ Event API listening', { port: config.port, env: config.env });
  });

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
