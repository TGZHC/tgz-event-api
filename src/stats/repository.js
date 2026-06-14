// All stat reads/writes live here. Handlers call recordStat(); routes call the
// leaderboard/getPlayer helpers. Writes are upserts across the three period
// buckets in one transaction, so a kill never lands in 'all' but miss 'week'.

import { query, transaction } from '../db/pool.js';
import { bucketsFor, currentKey } from './periods.js';

const STAT_COLUMNS = new Set(['kills', 'deaths', 'teamkills', 'captures', 'playtime_seconds']);

/** Ensure a player row exists and reflects their latest known name. */
export async function upsertPlayer(conn, playerId, name) {
  await conn.query(
    `INSERT INTO players (player_id, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [playerId, name || 'Unknown'],
  );
}

/**
 * Increment one or more stat columns for a player across all period buckets.
 * @param {{playerId:string, name?:string, increments:Object, date?:Date}} args
 */
export async function recordStat({ playerId, name, increments, date = new Date() }) {
  const cols = Object.keys(increments).filter((c) => STAT_COLUMNS.has(c));
  if (!playerId || cols.length === 0) return;

  await transaction(async (conn) => {
    await upsertPlayer(conn, playerId, name);
    const setClause = cols.map((c) => `${c} = ${c} + VALUES(${c})`).join(', ');
    const colList = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    for (const bucket of bucketsFor(date)) {
      await conn.query(
        `INSERT INTO player_stats (player_id, period_type, period_key, ${colList})
         VALUES (?, ?, ?, ${placeholders})
         ON DUPLICATE KEY UPDATE ${setClause}`,
        [playerId, bucket.type, bucket.key, ...cols.map((c) => increments[c])],
      );
    }
  });
}

/**
 * Top players for a period, ordered by a chosen stat.
 * @param {{period?:string, sort?:string, limit?:number}} opts
 */
export async function leaderboard({ period = 'all', sort = 'kills', limit = 10 } = {}) {
  const sortCol = STAT_COLUMNS.has(sort) ? sort : 'kills';
  const key = currentKey(period);
  const rows = await query(
    `SELECT p.name, s.player_id, s.kills, s.deaths, s.teamkills, s.captures, s.playtime_seconds
       FROM player_stats s
       JOIN players p ON p.player_id = s.player_id
      WHERE s.period_type = ? AND s.period_key = ?
      ORDER BY s.${sortCol} DESC, s.kills DESC
      LIMIT ?`,
    [period, key, Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map((r) => ({ ...r, kd: r.deaths ? +(r.kills / r.deaths).toFixed(2) : r.kills }));
}

/** All-period stats for a single player. */
export async function getPlayer(playerId) {
  const rows = await query(
    `SELECT s.period_type, s.period_key, s.kills, s.deaths, s.teamkills, s.captures, s.playtime_seconds, p.name
       FROM player_stats s JOIN players p ON p.player_id = s.player_id
      WHERE s.player_id = ?`,
    [playerId],
  );
  if (rows.length === 0) return null;
  const out = { player_id: playerId, name: rows[0].name, periods: {} };
  for (const r of rows) {
    out.periods[r.period_type === 'all' ? 'all' : `${r.period_type}:${r.period_key}`] = {
      kills: r.kills, deaths: r.deaths, teamkills: r.teamkills,
      captures: r.captures, playtime_seconds: r.playtime_seconds,
      kd: r.deaths ? +(r.kills / r.deaths).toFixed(2) : r.kills,
    };
  }
  return out;
}
