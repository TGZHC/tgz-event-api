// Player join / leave. Join just announces. Leave announces and, if SAT provides
// a session length, credits playtime to the player's stats.

import { pick, playerIdentity } from '../normalize.js';
import { joinEmbed, leaveEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { recordStat } from '../../stats/repository.js';
import { transaction } from '../../db/pool.js';
import { upsertPlayer } from '../../stats/repository.js';

export async function playerJoin(event) {
  const data = event.data ?? event;
  const { id, name } = playerIdentity(data);
  sendEmbed('joins', joinEmbed({
    player: name,
    players: pick(data, 'playerCount', 'players', 'onlinePlayers'),
    max: pick(data, 'maxPlayers', 'slots'),
  }));
  if (id) {
    // Register identity early so later events have a name to attach, and count
    // the session so "most active players" leaderboards work.
    await transaction((conn) => upsertPlayer(conn, id, name));
    await recordStat({ playerId: id, name, increments: { sessions: 1 } });
  }
}

export async function playerLeave(event) {
  const data = event.data ?? event;
  const { id, name } = playerIdentity(data);
  const playtime = pick(data, 'sessionSeconds', 'playtime', 'durationSeconds');
  sendEmbed('joins', leaveEmbed({
    player: name,
    playtime,
    players: pick(data, 'playerCount', 'players', 'onlinePlayers'),
    max: pick(data, 'maxPlayers', 'slots'),
  }));
  if (id && playtime != null) {
    await recordStat({ playerId: id, name, increments: { playtime_seconds: Math.floor(Number(playtime)) } });
  }
}
