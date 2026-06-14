// GET /health — unauthenticated liveness+readiness probe for Railway. Reports
// DB connectivity so a failed deploy is visible without tailing logs.

import { Router } from 'express';
import { ping } from '../db/pool.js';

export const healthRouter = Router();

const startedAt = Date.now();

healthRouter.get('/', async (_req, res) => {
  let db = 'ok';
  try {
    await ping();
  } catch {
    db = 'down';
  }
  const ok = db === 'ok';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db,
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    version: process.env.npm_package_version || '1.0.0',
  });
});
