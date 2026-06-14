// Central error handler. Turns any thrown/forwarded error into a clean JSON
// response and a logged line, instead of leaking a stack trace to the caller or
// crashing the process. Registered last in app.js.

import { logger } from '../logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // express.json() throws a SyntaxError with .status 400 on malformed bodies.
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error('Unhandled request error', { path: req.path, error: err.message, stack: err.stack });
  } else {
    logger.warn('Request error', { path: req.path, status, error: err.message });
  }
  res.status(status).json({ error: status >= 500 ? 'internal_error' : err.message });
}

export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', path: req.path });
}
