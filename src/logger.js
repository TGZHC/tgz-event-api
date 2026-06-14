// Minimal structured logger. JSON in production (greppable in Railway logs),
// human-friendly in dev. No dependency, so nothing to break a deploy.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
const pretty = process.env.NODE_ENV !== 'production';

function emit(level, msg, meta) {
  if (LEVELS[level] > threshold) return;
  const time = new Date().toISOString();
  if (pretty) {
    const tail = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`${time} ${level.toUpperCase().padEnd(5)} ${msg}${tail}`);
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify({ time, level, msg, ...meta }));
  }
}

export const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
