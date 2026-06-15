// Maps a normalized SAT event type to a handler. Every accepted event is first
// persisted verbatim to the `events` table (audit + replay), THEN handled. A
// handler throwing does not lose the event and does not fail the HTTP request —
// the route returns 202 once the event is safely stored.

import { eventType } from './normalize.js';
import { query } from '../db/pool.js';
import { logger } from '../logger.js';
import { playerKill } from './handlers/playerKill.js';
import { playerJoin, playerLeave } from './handlers/playerSession.js';
import { objectiveCapture } from './handlers/objective.js';
import { adminAction, serverHealth } from './handlers/admin.js';

// Canonical type token -> handler. Tokens are lowercased & stripped of
// punctuation by eventType(), so "Player.Kill", "PLAYER_KILL" and "playerkill"
// all collapse to "playerkill".
const HANDLERS = {
  playerkill: playerKill,
  kill: playerKill,
  playerkilled: playerKill,
  playerjoin: playerJoin,
  playerconnect: playerJoin,
  playerconnected: playerJoin,
  playerleave: playerLeave,
  playerdisconnect: playerLeave,
  playerdisconnected: playerLeave,
  objectivecaptured: objectiveCapture,
  basecaptured: objectiveCapture,
  capture: objectiveCapture,
  adminaction: adminAction,
  admincommand: adminAction,
  serverhealth: serverHealth,
  serverstatus: serverHealth,

  // --- Arma Reforger Server Admin Tools (SAT) event names ---
  // eventType() lowercases and strips underscores, so
  // "serveradmintools_player_killed" -> "serveradmintoolsplayerkilled".
  serveradmintoolsplayerkilled: playerKill,
  serveradmintoolsplayerjoined: playerJoin,
  serveradmintoolsplayerleft: playerLeave,
  serveradmintoolsplayerdisconnected: playerLeave,
  serveradmintoolsconflictbasecaptured: objectiveCapture,
  serveradmintoolsadminaction: adminAction,
  serveradmintoolsserverfpslow: serverHealth,
  serveradmintoolsgamestarted: serverHealth,
  serveradmintoolsgameended: serverHealth,
  serveradmintoolsvotestarted: serverHealth,
  serveradmintoolsvoteended: serverHealth,
};

/** Persist then dispatch. Returns { stored, handled, type }. */
export async function handleEvent(event) {
  const type = eventType(event);

  await query('INSERT INTO events (type, payload) VALUES (?, ?)', [type || 'unknown', JSON.stringify(event)]);

  const handler = HANDLERS[type];
  if (!handler) {
    logger.debug('No handler for event type, stored only', { type });
    return { stored: true, handled: false, type };
  }

  // Handle out-of-band so a slow Discord/DB call never blocks the response.
  handler(event).catch((err) => logger.error('Handler error', { type, error: err.message }));
  return { stored: true, handled: true, type };
}

export const knownTypes = Object.keys(HANDLERS);

/**
 * Normalize a request body into a flat list of events. Handles:
 *  - SAT's batch format: { token, events: [ {name, data, ...}, ... ] }
 *  - a bare array of events
 *  - a single event object
 */
export function toEventList(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.events)) return body.events;
  return [body];
}
