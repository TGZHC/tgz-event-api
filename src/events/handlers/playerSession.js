// Player join / leave. Join just announces. Leave announces and, if SAT provides
// a session length, credits playtime to the player's stats.

import { pick, playerKey } from '../normalize.js';
import { joinEmbed, leaveEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { recordStat } from '../../stats/repository.js';
import { transaction } from '../../db/pool.js';
import { upsertPlayer } from '../../stats/repository.js';

// Key sessions by the same UUID the kill handler uses, so playtime/sessions and
// kills/deaths land on one player row. TGZ_Admin sends `identity`; legacy SAT
// payloads fall back to the player name.
const SESSION_ID_KEYS = ['identity', 'identityId', 'guid', 'GUID', 'uid', 'playerId'];
const SESSION_NAME_KEYS = ['player', 'playerName', 'PlayerName', 'name', 'Name'];

export async function playerJoin(event) {
  const data = event.data ?? event;
  const { id, name } = playerKey(data, { idKeys: SESSION_ID_KEYS, nameKeys: SESSION_NAME_KEYS });
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
  const { id, name } = playerKey(data, { idKeys: SESSION_ID_KEYS, nameKeys: SESSION_NAME_KEYS });
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
