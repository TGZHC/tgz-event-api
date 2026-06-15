// SAT event payloads are not perfectly consistent between event types and mod
// versions. These helpers pull a value from the first key that exists, so a
// handler keeps working if SAT renames "playerName" to "name" tomorrow. Adjust
// the candidate lists here in ONE place rather than across every handler.

/** First defined value among the given keys (supports dotted paths). */
export function pick(obj, ...keys) {
  for (const key of keys) {
    const val = key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], obj) : obj?.[key];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return undefined;
}

export function playerIdentity(obj, prefix = '') {
  const p = (k) => `${prefix}${k}`;
  const name = pick(obj, p('player'), p('playerName'), p('PlayerName'), p('name'), p('Name'), p('playerBiId'));
  // SAT kill events only carry NAMES (no UUID), so the player NAME is the only
  // identifier shared across every event type — key stats by it. Fall back to a
  // UUID only if a name isn't present.
  return {
    id: name || pick(obj, p('identity'), p('identityId'), p('guid'), p('GUID'), p('uid'), p('playerId'), p('id')),
    name,
  };
}

/** Normalize SAT's event type string to a lowercase canonical token. */
export function eventType(event) {
  const raw = pick(event, 'type', 'eventType', 'event', 'name') || '';
  return String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}
