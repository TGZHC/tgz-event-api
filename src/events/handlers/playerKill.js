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
  // SAT puts the VICTIM in `player`/`identity` and the KILLER in `instigator`.
  // Fall back to other mods' spellings for portability.
  const victim = playerIdentity(data); // player / identity
  fillMissing(victim, playerIdentity(data, 'victim'));
  fillMissing(victim, playerIdentity(data, 'target'));

  const killer = {
    id: pick(data, 'instigatorIdentity', 'instigatorIdentityId', 'instigatorId', 'instigatorUid',
      'killerIdentity', 'killerId', 'killerguid'),
    name: pick(data, 'instigator', 'instigatorName', 'killer', 'killerName'),
  };

  // SAT's `friendly` flag marks a friendly-fire / team kill.
  const teamkill = Boolean(pick(data, 'friendly', 'teamkill', 'friendlyFire', 'isTeamKill'));
  const headshot = Boolean(pick(data, 'headshot', 'isHeadshot', 'headShot'));
  const weapon = pick(data, 'weapon', 'weaponName', 'killerWeapon');
  const distance = pick(data, 'distance', 'killDistance');

  sendEmbed('kills', killEmbed({
    killer: killer.name, victim: victim.name, weapon, distance, headshot, teamkill,
  }));

  await processKill({ killer, victim, weapon, distance, headshot, teamkill });
}

// Copy id/name from `alt` only where `base` is still empty.
function fillMissing(base, alt) {
  if (!base.id && alt.id) base.id = alt.id;
  if (!base.name && alt.name) base.name = alt.name;
}
