import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, playerIdentity, eventType } from '../src/events/normalize.js';
import { bucketsFor, isoWeek } from '../src/stats/periods.js';
import { killEmbed, leaderboardEmbed } from '../src/discord/embeds.js';

test('pick returns the first present key, supports dotted paths', () => {
  assert.equal(pick({ a: 1, b: 2 }, 'x', 'b'), 2);
  assert.equal(pick({ nested: { v: 9 } }, 'nested.v'), 9);
  assert.equal(pick({ a: '' }, 'a', 'fallbackMissing'), undefined);
});

test('playerIdentity reads varied SAT key spellings', () => {
  assert.deepEqual(playerIdentity({ playerId: 'g1', playerName: 'Mike' }), { id: 'g1', name: 'Mike' });
  assert.deepEqual(playerIdentity({ killerGUID: 'k1', killerName: 'A' }, 'killer'), { id: 'k1', name: 'A' });
});

test('eventType normalizes punctuation and case', () => {
  assert.equal(eventType({ type: 'Player.Kill' }), 'playerkill');
  assert.equal(eventType({ eventType: 'PLAYER_CONNECT' }), 'playerconnect');
});

test('bucketsFor yields all/week/month buckets', () => {
  const buckets = bucketsFor(new Date('2026-06-14T12:00:00Z'));
  assert.equal(buckets.length, 3);
  assert.deepEqual(buckets[0], { type: 'all', key: 'all' });
  assert.equal(buckets[2].key, '2026-06');
  assert.match(buckets[1].key, /^2026-W\d{2}$/);
});

test('isoWeek computes a sane week number', () => {
  const { week } = isoWeek(new Date('2026-06-14T00:00:00Z'));
  assert.ok(week >= 23 && week <= 25);
});

test('killEmbed flags team kills distinctly', () => {
  const normal = killEmbed({ killer: 'A', victim: 'B', teamkill: false });
  const tk = killEmbed({ killer: 'A', victim: 'B', teamkill: true });
  assert.match(normal.title, /Kill/);
  assert.match(tk.title, /Team Kill/);
  assert.notEqual(normal.color, tk.color);
});

test('leaderboardEmbed renders medals and a fallback', () => {
  const embed = leaderboardEmbed({ period: 'week', sort: 'kills', rows: [
    { name: 'Mike', kills: 10, kd: 2 },
    { name: 'Sam', kills: 8, kd: 1.5 },
  ] });
  assert.match(embed.description, /🥇 \*\*Mike\*\*/);
  const empty = leaderboardEmbed({ period: 'week', rows: [] });
  assert.match(empty.description, /No data/);
});
