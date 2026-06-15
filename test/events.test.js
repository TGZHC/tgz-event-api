import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, playerIdentity, eventType } from '../src/events/normalize.js';
import { bucketsFor, isoWeek, previousKey, PERIOD_TYPES } from '../src/stats/periods.js';
import { killEmbed, leaderboardEmbed } from '../src/discord/embeds.js';

test('pick returns the first present key, supports dotted paths', () => {
  assert.equal(pick({ a: 1, b: 2 }, 'x', 'b'), 2);
  assert.equal(pick({ nested: { v: 9 } }, 'nested.v'), 9);
  assert.equal(pick({ a: '' }, 'a', 'fallbackMissing'), undefined);
});

test('playerIdentity keys by name (kills carry no UUID)', () => {
  // SAT join: { player, identity } — name is the key, not the UUID.
  assert.deepEqual(playerIdentity({ player: 'Mike', identity: 'uuid-123' }), { id: 'Mike', name: 'Mike' });
  // Falls back to a UUID only when no name is present.
  assert.deepEqual(playerIdentity({ identity: 'uuid-123' }), { id: 'uuid-123', name: undefined });
});

test('eventType normalizes punctuation and case', () => {
  assert.equal(eventType({ type: 'Player.Kill' }), 'playerkill');
  assert.equal(eventType({ eventType: 'PLAYER_CONNECT' }), 'playerconnect');
});

test('bucketsFor yields all/day/week/month buckets', () => {
  const buckets = bucketsFor(new Date('2026-06-14T12:00:00Z'));
  assert.equal(buckets.length, 4);
  assert.deepEqual(buckets[0], { type: 'all', key: 'all' });
  assert.deepEqual(buckets[1], { type: 'day', key: '2026-06-14' });
  assert.match(buckets[2].key, /^2026-W\d{2}$/);
  assert.equal(buckets[3].key, '2026-06');
});

test('PERIOD_TYPES includes the four periods', () => {
  assert.deepEqual(PERIOD_TYPES, ['all', 'day', 'week', 'month']);
});

test('previousKey returns the just-completed period', () => {
  const d = new Date('2026-06-14T12:00:00Z');
  assert.equal(previousKey('day', d), '2026-06-13');
  assert.equal(previousKey('month', d), '2026-05');
  assert.equal(previousKey('all', d), null);
});

test('isoWeek computes a sane week number', () => {
  const { week } = isoWeek(new Date('2026-06-14T00:00:00Z'));
  assert.ok(week >= 23 && week <= 25);
});

test('killEmbed flags team kills distinctly', () => {
  const normal = killEmbed({ killer: 'A', victim: 'B', teamkill: false });
  const tk = killEmbed({ killer: 'A', victim: 'B', teamkill: true });
  // Wording is customizable, but a team kill must be visibly distinct from a
  // normal kill — different title and different color.
  assert.notEqual(normal.title, tk.title);
  assert.notEqual(normal.color, tk.color);
});

test('killEmbed shows killer, victim and team-kill status', () => {
  const e = killEmbed({ killer: 'A', victim: 'B', teamkill: true });
  assert.match(e.description, /A/);
  assert.match(e.description, /B/);
  assert.match(e.description, /Team Kill\s*:\s*YES/);
});

test('leaderboardEmbed renders rows and a fallback', () => {
  const embed = leaderboardEmbed({ period: 'week', sort: 'kills', rows: [
    { name: 'Mike', kills: 10, kd: 2 },
    { name: 'Sam', kills: 8, kd: 1.5 },
  ] });
  // Renders each player and their value; exact formatting is template-driven.
  assert.match(embed.description, /Mike/);
  assert.match(embed.description, /Sam/);
  const empty = leaderboardEmbed({ period: 'week', rows: [] });
  assert.ok(empty.description.length > 0); // shows the customizable empty text
});
