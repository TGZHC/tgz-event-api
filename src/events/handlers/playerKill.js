// Player kill / death. SAT's `serveradmintools_player_killed` payload is minimal:
//   { player: <victim name>, instigator: <killer name>, friendly: <bool> }
// plus an event-level `timestamp`. It does NOT include weapon/distance/headshot,
// so those simply aren't tracked (the game never sends them). Players are keyed
// by NAME because kills carry no UUID.

import { pick } from '../normalize.js';
import { killEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { processKill } from '../../stats/repository.js';

export async function playerKill(event) {
  const data = event.data ?? event;

  const victimName = pick(data, 'player', 'victim', 'victimName', 'playerName');
  const killerName = pick(data, 'instigator', 'killer', 'killerName', 'instigatorName');
  // AI / world / environment kills have no real killer — count only the death.
  const killerIsPlayer = killerName && killerName !== 'AI' && killerName !== victimName;

  const victim = { id: victimName, name: victimName };
  const killer = { id: killerIsPlayer ? killerName : undefined, name: killerName };

  // SAT's `friendly` flag marks a team kill (friendly fire).
  const teamkill = pick(data, 'friendly', 'teamkill', 'friendlyFire', 'isTeamKill') === true;

  // Not provided by SAT, but kept so other mods that DO send them still work.
  const weapon = pick(data, 'weapon', 'weaponName');
  const distance = pick(data, 'distance', 'killDistance');
  const headshot = Boolean(pick(data, 'headshot', 'isHeadshot'));

  // Use SAT's event time when present (unix seconds), else now.
  const at = event.timestamp ? new Date(Number(event.timestamp) * 1000) : new Date();

  sendEmbed('kills', killEmbed({ killer: killer.name, victim: victim.name, weapon, distance, headshot, teamkill, at }));
  await processKill({ killer, victim, weapon, distance, headshot, teamkill, date: at });
}
