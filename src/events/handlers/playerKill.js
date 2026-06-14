// Player kill / death. Posts to Discord and records stats atomically via
// processKill: victim death + streak reset, killer kill/headshot/weapon/streak/
// longest-kill record. Team kills are flagged (orange + ⚠️) and counted
// separately without building a kill streak.

import { pick, playerIdentity } from '../normalize.js';
import { killEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { processKill } from '../../stats/repository.js';

export async function playerKill(event) {
  const data = event.data ?? event;
  const killer = playerIdentity(data, 'killer');
  const victim = playerIdentity(data, 'victim');
  if (!killer.id) Object.assign(killer, playerIdentity(data, 'instigator'));
  if (!victim.id) Object.assign(victim, playerIdentity(data, 'target'));

  const teamkill = Boolean(pick(data, 'teamkill', 'friendlyFire', 'isTeamKill'));
  const headshot = Boolean(pick(data, 'headshot', 'isHeadshot', 'headShot'));
  const weapon = pick(data, 'weapon', 'weaponName', 'killerWeapon');
  const distance = pick(data, 'distance', 'killDistance');

  sendEmbed('kills', killEmbed({
    killer: killer.name, victim: victim.name, weapon, distance, headshot, teamkill,
  }));

  await processKill({ killer, victim, weapon, distance, headshot, teamkill });
}
