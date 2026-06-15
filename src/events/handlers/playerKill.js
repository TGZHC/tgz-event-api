// Player kill / death. TGZ_Admin's `tgz_player_killed` payload is rich:
//   { victim, victimId, killer, killerId, weapon, distance, friendly,
//     killerIsAi, killerIsWorld, victimFaction, killerFaction }
// Legacy SAT's `serveradmintools_player_killed` was minimal (names + friendly,
// no weapon/distance), so every extra field is read defensively. Players key by
// UUID when present (TGZ_Admin), else by name (legacy SAT).

import { pick, playerKey } from '../normalize.js';
import { killEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { processKill } from '../../stats/repository.js';

export async function playerKill(event) {
  const data = event.data ?? event;

  const victim = playerKey(data, {
    idKeys: ['victimId', 'victimGuid', 'victimUid'],
    nameKeys: ['victim', 'player', 'victimName', 'playerName'],
  });
  const killerName = pick(data, 'killer', 'instigator', 'killerName', 'instigatorName');

  // AI / world / environment kills have no real killer — count only the death.
  // TGZ_Admin sends explicit flags; fall back to name sniffing for legacy SAT.
  const killerIsWorld = pick(data, 'killerIsWorld') === true || killerName === 'world';
  const killerIsAi = pick(data, 'killerIsAi') === true || killerName === 'AI';
  const killerIsPlayer = killerName && !killerIsAi && !killerIsWorld && killerName !== victim.name;

  const killerId = pick(data, 'killerId', 'killerGuid', 'killerUid') || killerName;
  const killer = { id: killerIsPlayer ? killerId : undefined, name: killerName };

  // A self / world death (or being your own killer) is a suicide.
  const suicide = killerIsWorld || (killerId && killerId === victim.id) || killerName === victim.name;

  // `friendly` (TGZ_Admin / SAT) marks a team kill (friendly fire).
  const teamkill = pick(data, 'friendly', 'teamkill', 'friendlyFire', 'isTeamKill') === true;

  const weapon = pick(data, 'weapon', 'weaponName');
  const distance = pick(data, 'distance', 'killDistance');
  const headshot = Boolean(pick(data, 'headshot', 'isHeadshot'));

  // Use SAT's event time when present (unix seconds), else now.
  const at = event.timestamp ? new Date(Number(event.timestamp) * 1000) : new Date();

  sendEmbed('kills', killEmbed({ killer: killer.name, victim: victim.name, weapon, distance, headshot, teamkill, at }));
  await processKill({ killer, victim, weapon, distance, headshot, teamkill, suicide, date: at });
}
