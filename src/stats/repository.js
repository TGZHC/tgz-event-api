// All stat reads/writes. Handlers call the record* functions; routes and the
// scheduler call the leaderboard/getPlayer helpers. Writes upsert across all
// period buckets (all/day/week/month) inside one transaction so a stat never
// lands in one period but misses another.

import { query, transaction } from '../db/pool.js';
import { bucketsFor, currentKey } from './periods.js';

// Columns that ACCUMULATE (a += b).
const SUM_COLUMNS = new Set(['kills', 'deaths', 'teamkills', 'captures', 'headshots', 'sessions', 'playtime_seconds']);
// Columns that keep a RECORD (max seen): a = GREATEST(a, b).
const MAX_COLUMNS = new Set(['longest_kill_m', 'kill_streak_best']);
// Everything sortable on a leaderboard.
export const SORTABLE = new Set([...SUM_COLUMNS, ...MAX_COLUMNS]);

export async function upsertPlayer(conn, playerId, name) {
  await conn.query(
    `INSERT INTO players (player_id, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [playerId, name || 'Unknown'],
  );
}

// Build + run an upsert into player_stats for every period bucket.
async function bumpBuckets(conn, playerId, date, sums = {}, maxes = {}) {
  const sumCols = Object.keys(sums).filter((c) => SUM_COLUMNS.has(c));
  const maxCols = Object.keys(maxes).filter((c) => MAX_COLUMNS.has(c));
  if (sumCols.length === 0 && maxCols.length === 0) return;

  const cols = [...sumCols, ...maxCols];
  const setClause = [
    ...sumCols.map((c) => `${c} = ${c} + VALUES(${c})`),
    ...maxCols.map((c) => `${c} = GREATEST(${c}, VALUES(${c}))`),
  ].join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const values = [...sumCols.map((c) => sums[c]), ...maxCols.map((c) => maxes[c])];

  for (const bucket of bucketsFor(date)) {
    await conn.query(
      `INSERT INTO player_stats (player_id, period_type, period_key, ${cols.join(', ')})
       VALUES (?, ?, ?, ${placeholders})
       ON DUPLICATE KEY UPDATE ${setClause}`,
      [playerId, bucket.type, bucket.key, ...values],
    );
  }
}

async function bumpWeapon(conn, weapon, date) {
  for (const bucket of bucketsFor(date)) {
    await conn.query(
      `INSERT INTO weapon_stats (weapon, period_type, period_key, kills)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE kills = kills + 1`,
      [weapon.slice(0, 96), bucket.type, bucket.key],
    );
  }
}

/** Generic single-stat increment (used for joins/sessions, captures, playtime). */
export async function recordStat({ playerId, name, increments, date = new Date() }) {
  if (!playerId || !increments) return;
  await transaction(async (conn) => {
    await upsertPlayer(conn, playerId, name);
    await bumpBuckets(conn, playerId, date, increments, {});
  });
}

/**
 * Process a kill atomically: victim's death + streak reset, killer's kill /
 * headshot / weapon / streak / longest-kill record. Team kills count separately
 * and don't build a streak.
 */
export async function processKill({ killer, victim, weapon, distance, headshot, teamkill, date = new Date() }) {
  await transaction(async (conn) => {
    // Victim: a death, and their kill streak resets.
    if (victim?.id) {
      await upsertPlayer(conn, victim.id, victim.name);
      await conn.query('UPDATE players SET current_streak = 0 WHERE player_id = ?', [victim.id]);
      await bumpBuckets(conn, victim.id, date, { deaths: 1 }, {});
    }

    // Killer (ignore self-kills for offensive credit).
    if (killer?.id && killer.id !== victim?.id) {
      await upsertPlayer(conn, killer.id, killer.name);
      if (teamkill) {
        await bumpBuckets(conn, killer.id, date, { teamkills: 1 }, {});
      } else {
        await conn.query('UPDATE players SET current_streak = current_streak + 1 WHERE player_id = ?', [killer.id]);
        const rows = await conn.query('SELECT current_streak AS s FROM players WHERE player_id = ?', [killer.id]);
        const streak = rows[0]?.s ?? 1;

        const sums = { kills: 1 };
        if (headshot) sums.headshots = 1;
        const maxes = { kill_streak_best: streak };
        const dist = Number(distance);
        if (Number.isFinite(dist) && dist > 0) maxes.longest_kill_m = Math.round(dist);

        await bumpBuckets(conn, killer.id, date, sums, maxes);
        if (weapon) await bumpWeapon(conn, weapon, date);
      }
    }
  });
}

/** Top players for a period, ordered by a chosen stat. */
export async function leaderboard({ period = 'all', sort = 'kills', limit = 10, key } = {}) {
  const sortCol = SORTABLE.has(sort) ? sort : 'kills';
  const periodKey = key || currentKey(period);
  const rows = await query(
    `SELECT p.name, s.player_id, s.kills, s.deaths, s.teamkills, s.captures, s.headshots,
            s.longest_kill_m, s.kill_streak_best, s.playtime_seconds
       FROM player_stats s
       JOIN players p ON p.player_id = s.player_id
      WHERE s.period_type = ? AND s.period_key = ?
      ORDER BY s.${sortCol} DESC, s.kills DESC
      LIMIT ?`,
    [period, periodKey, Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map((r) => ({ ...r, kd: r.deaths ? +(r.kills / r.deaths).toFixed(2) : r.kills }));
}

/** Deadliest weapons for a period. */
export async function weaponLeaderboard({ period = 'all', limit = 10, key } = {}) {
  const periodKey = key || currentKey(period);
  return query(
    `SELECT weapon, kills FROM weapon_stats
      WHERE period_type = ? AND period_key = ?
      ORDER BY kills DESC LIMIT ?`,
    [period, periodKey, Math.min(Math.max(limit, 1), 100)],
  );
}

/** All-period stats for a single player. */
export async function getPlayer(playerId) {
  const rows = await query(
    `SELECT s.period_type, s.period_key, s.kills, s.deaths, s.teamkills, s.captures, s.headshots,
            s.longest_kill_m, s.kill_streak_best, s.playtime_seconds, p.name
       FROM player_stats s JOIN players p ON p.player_id = s.player_id
      WHERE s.player_id = ?`,
    [playerId],
  );
  if (rows.length === 0) return null;
  const out = { player_id: playerId, name: rows[0].name, periods: {} };
  for (const r of rows) {
    out.periods[r.period_type === 'all' ? 'all' : `${r.period_type}:${r.period_key}`] = {
      kills: r.kills, deaths: r.deaths, teamkills: r.teamkills, captures: r.captures,
      headshots: r.headshots, longest_kill_m: r.longest_kill_m, kill_streak_best: r.kill_streak_best,
      playtime_seconds: r.playtime_seconds,
      kd: r.deaths ? +(r.kills / r.deaths).toFixed(2) : r.kills,
    };
  }
  return out;
}

/** Directory of all known players with their all-time kills (for the website). */
export async function listPlayers({ limit = 1000 } = {}) {
  return query(
    `SELECT p.player_id, p.name, p.first_seen, p.last_seen,
            COALESCE(s.kills, 0) AS kills, COALESCE(s.deaths, 0) AS deaths
       FROM players p
       LEFT JOIN player_stats s
         ON s.player_id = p.player_id AND s.period_type = 'all' AND s.period_key = 'all'
      ORDER BY kills DESC, p.name ASC
      LIMIT ?`,
    [Math.min(Math.max(limit, 1), 5000)],
  );
}

/**
 * Everything the website's player page needs: identity, all-time totals, the
 * current day/week/month snapshots, and the full day-by-day history since the
 * player was first seen (this app's inception for them).
 */
export async function getPlayerProfile(playerId) {
  const players = await query(
    'SELECT player_id, name, current_streak, first_seen, last_seen FROM players WHERE player_id = ?',
    [playerId],
  );
  if (players.length === 0) return null;

  const statRows = await query(
    `SELECT period_type, period_key, kills, deaths, teamkills, captures, headshots,
            longest_kill_m, kill_streak_best, playtime_seconds
       FROM player_stats WHERE player_id = ?`,
    [playerId],
  );

  const withKd = (r) => ({ ...r, kd: r.deaths ? +(r.kills / r.deaths).toFixed(2) : r.kills });
  const blank = { kills: 0, deaths: 0, teamkills: 0, captures: 0, headshots: 0, longest_kill_m: 0, kill_streak_best: 0, playtime_seconds: 0, kd: 0 };

  const all = statRows.find((r) => r.period_type === 'all');
  const history = statRows
    .filter((r) => r.period_type === 'day')
    .map((r) => ({ date: r.period_key, ...withKd(r) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    player_id: players[0].player_id,
    name: players[0].name,
    current_streak: players[0].current_streak,
    first_seen: players[0].first_seen,
    last_seen: players[0].last_seen,
    totals: all ? withKd(all) : blank,
    history,
  };
}

// --- Diagnostics: are events actually arriving? ---
export async function eventCounts() {
  const total = await query('SELECT COUNT(*) AS c FROM events');
  const recent = await query("SELECT COUNT(*) AS c FROM events WHERE received_at > (NOW() - INTERVAL 1 HOUR)");
  const last = await query('SELECT type, received_at FROM events ORDER BY id DESC LIMIT 1');
  return {
    events_total: total[0].c,
    events_last_hour: recent[0].c,
    last_event_type: last[0]?.type ?? null,
    last_event_at: last[0]?.received_at ?? null,
  };
}

/** Most recent raw events, exactly as SAT sent them — for mapping field names. */
export async function recentEvents(limit = 20) {
  return query('SELECT id, type, payload, received_at FROM events ORDER BY id DESC LIMIT ?', [Math.min(Math.max(limit, 1), 100)]);
}

// --- Scheduler bookkeeping (meta key/value) ---
export async function getMeta(key) {
  const rows = await query('SELECT v FROM meta WHERE k = ?', [key]);
  return rows[0]?.v ?? null;
}
export async function setMeta(key, value) {
  await query(
    'INSERT INTO meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [key, String(value)],
  );
}
