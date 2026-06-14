// Player kill / death. Updates Discord and stats. Team kills are flagged so they
// both stand out in the feed (orange + ⚠️) and count toward a separate stat that
// a future anti-TK leaderboard or admin report can use.

import { pick, playerIdentity } from '../normalize.js';
import { killEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { recordStat } from '../../stats/repository.js';

export async function playerKill(event) {
  const data = event.data ?? event;
  const killer = playerIdentity(data, 'killer');
  const victim = playerIdentity(data, 'victim');
  // Fallbacks for flatter payloads.
  if (!killer.id) Object.assign(killer, playerIdentity(data, 'instigator'));
  if (!victim.id) Object.assign(victim, playerIdentity(data, 'target'));

  const teamkill = Boolean(pick(data, 'teamkill', 'friendlyFire', 'isTeamKill'));
  const weapon = pick(data, 'weapon', 'weaponName', 'killerWeapon');
  const distance = pick(data, 'distance', 'killDistance');

  sendEmbed('kills', killEmbed({
    killer: killer.name, victim: victim.name, weapon, distance, teamkill,
  }));

  // Self-kills / environment deaths: only the victim's death counts.
  const tasks = [];
  if (victim.id) {
    tasks.push(recordStat({ playerId: victim.id, name: victim.name, increments: { deaths: 1 } }));
  }
  if (killer.id && killer.id !== victim.id) {
    tasks.push(recordStat({
      playerId: killer.id, name: killer.name,
      increments: teamkill ? { teamkills: 1 } : { kills: 1 },
    }));
  }
  await Promise.all(tasks);
}
