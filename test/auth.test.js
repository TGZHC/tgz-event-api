import './setup.js'; // must be first — sets env before config.js is evaluated
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractToken } from '../src/middleware/auth.js';

// Build a minimal req stub with a get(header) method.
function reqWith(headers) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (h) => lower[h.toLowerCase()] };
}

test('extracts a Bearer token (what SAT sends)', () => {
  assert.equal(extractToken(reqWith({ authorization: 'Bearer abc123' })), 'abc123');
});

test('extracts a bare token (the old breakage case)', () => {
  assert.equal(extractToken(reqWith({ authorization: 'abc123' })), 'abc123');
});

test('is case-insensitive on the Bearer scheme', () => {
  assert.equal(extractToken(reqWith({ authorization: 'bearer abc123' })), 'abc123');
});

test('falls back to X-Api-Token', () => {
  assert.equal(extractToken(reqWith({ 'x-api-token': 'xyz' })), 'xyz');
});

test('returns empty string when no token present', () => {
  assert.equal(extractToken(reqWith({})), '');
});
