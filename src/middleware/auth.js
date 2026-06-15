// Token auth that accepts BOTH "Authorization: Bearer <token>" (what SAT sends)
// and a bare "Authorization: <token>" — the exact mismatch that broke the old
// setup. Also accepts an X-Api-Token header as a fallback. Comparison is
// constant-time to avoid leaking the token via timing.

import { timingSafeEqual } from 'node:crypto';
import config from '../config.js';

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false; // length leak is acceptable here
  return timingSafeEqual(ba, bb);
}

export function extractToken(req) {
  const auth = req.get('authorization');
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    return (m ? m[1] : auth).trim();
  }
  const headerToken = req.get('x-api-token');
  return headerToken ? headerToken.trim() : '';
}

/** True if the request carries a valid token. */
export function isAuthorized(req) {
  const token = extractToken(req);
  return Boolean(token && safeEqual(token, config.apiToken));
}

export function requireAuth(req, res, next) {
  if (isAuthorized(req)) return next();
  return res.status(401).json({ error: 'unauthorized' });
}
