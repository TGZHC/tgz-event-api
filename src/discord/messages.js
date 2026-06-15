// Customizable Discord message templates. Built-in DEFAULTS below are merged
// with whatever the user puts in messages.json at the project root, so editing
// messages.json changes titles/colors/wording with no code changes — and a bad
// or missing file just falls back to these defaults instead of crashing.
//
// Templates use {placeholder} substitution. Available placeholders depend on the
// message (documented in messages.json).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';

const DEFAULTS = {
  events: {
    kill: { title: '💀 Combat Report', color: '#b5503f' },
    teamkill: { title: '⚠️ Combat Report — Friendly Fire', color: '#ff8c00' },
    join: { title: '🟢 Player Joined', color: '#2ecc71' },
    leave: { title: '⚪ Player Left', color: '#95a5a6' },
    objective: { title: '🚩 Objective Captured', color: '#3498db' },
    admin: { title: '🛡️ Admin Action', color: '#9b59b6' },
    server: { title: '📡 {title}', color: '#f1c40f' },
  },
  leaderboard: {
    title: '🏆 {periodLabel} Leaderboard — by {sort}',
    color: '#3498db',
    medals: ['🥇', '🥈', '🥉'],
    line: '{medal} **{name}** — {value} {sort} · K/D {kd}',
    empty: '_No data yet for this period._',
    footer: 'TGZ Event API',
  },
  weaponLeaderboard: {
    title: '🔫 Deadliest Weapons — {periodLabel}',
    color: '#e67e22',
    line: '{medal} **{weapon}** — {kills} kills',
    empty: '_No weapon data yet._',
  },
  periodLabels: { all: 'All-Time', day: 'Daily', week: 'Weekly', month: 'Monthly' },
};

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (typeof override !== 'object' || override === null) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function load() {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages.json');
    const fileCfg = JSON.parse(readFileSync(path, 'utf8'));
    logger.info('Loaded custom messages.json');
    return deepMerge(DEFAULTS, fileCfg);
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn('messages.json ignored (invalid), using defaults', { error: err.message });
    return DEFAULTS;
  }
}

export const messages = load();

/** "#3498db" or 0x3498db or 3447003 -> integer Discord understands. */
export function colorToInt(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string') return parseInt(color.replace(/^#/, ''), 16) || 0;
  return 0;
}

/** Replace {key} tokens with values from vars (missing -> empty string). */
export function render(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

export function periodLabel(type) {
  return messages.periodLabels[type] || type;
}
