// Central, validated configuration. Reads the environment ONCE, fails fast with
// a clear message if something required is missing, and freezes the result so
// nothing mutates config at runtime. This is what stops a typo'd env var from
// becoming a 3am Railway crash loop.

import { logger } from './logger.js';

function required(name) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be an integer, got "${v}"`);
  return n;
}

// Database config supports two styles:
//  1. A single connection URL (Railway's ${{ MySQL.MYSQL_URL }} / DATABASE_URL).
//     Easiest — one variable holds host, port, user, password and database.
//  2. The five individual DB_* variables (fallback if no URL is set).
// The URL wins when present. pool.js parses the URL into connection options.
function buildDbConfig() {
  const url = optional('DATABASE_URL') || optional('MYSQL_URL');
  if (url) {
    return { url, connectionLimit: int('DB_CONNECTION_LIMIT', 5) };
  }
  return {
    host: required('DB_HOST'),
    port: int('DB_PORT', 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 5),
  };
}

let config;
try {
  config = Object.freeze({
    env: optional('NODE_ENV', 'development'),
    port: int('PORT', 3000),
    // Trim stray whitespace/newlines that often sneak into pasted env vars —
    // otherwise a trailing space makes every token comparison silently fail.
    apiToken: required('API_TOKEN').trim(),

    db: Object.freeze(buildDbConfig()),

    discord: Object.freeze({
      default: optional('DISCORD_WEBHOOK_DEFAULT'),
      kills: optional('DISCORD_WEBHOOK_KILLS'),
      joins: optional('DISCORD_WEBHOOK_JOINS'),
      objectives: optional('DISCORD_WEBHOOK_OBJECTIVES'),
      admin: optional('DISCORD_WEBHOOK_ADMIN'),
      server: optional('DISCORD_WEBHOOK_SERVER'),
      leaderboard: optional('DISCORD_WEBHOOK_LEADERBOARD'),
      alertMention: optional('DISCORD_ALERT_MENTION'),
    }),

    // Automated leaderboard recaps. Each can be toggled; they post the
    // just-completed period when it rolls over (UTC).
    schedule: Object.freeze({
      daily: optional('SCHEDULE_DAILY', 'true') !== 'false',
      weekly: optional('SCHEDULE_WEEKLY', 'true') !== 'false',
      monthly: optional('SCHEDULE_MONTHLY', 'true') !== 'false',
      sort: optional('SCHEDULE_SORT', 'kills'),
      includeWeapons: optional('SCHEDULE_WEAPONS', 'true') !== 'false',
    }),
  });
} catch (err) {
  logger.error('Configuration error — refusing to start', { error: err.message });
  process.exit(1);
}

// Soft warnings (don't crash, just flag) for things that are merely degraded.
if (!config.discord.default && !config.discord.kills && !config.discord.joins) {
  logger.warn('No Discord webhooks configured — events will be stored but not posted to Discord.');
}
if (config.apiToken.length < 16) {
  logger.warn('API_TOKEN is short; use at least 32 random chars in production.');
}

export default config;
