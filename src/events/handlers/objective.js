// Objective / base capture. Announces to the objectives channel and, when a
// capturing player is identified, credits them a capture stat.

import { pick, playerIdentity } from '../normalize.js';
import { objectiveEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';
import { recordStat } from '../../stats/repository.js';

export async function objectiveCapture(event) {
  const data = event.data ?? event;
  const objective = pick(data, 'objective', 'objectiveName', 'base', 'location', 'name');
  const faction = pick(data, 'faction', 'factionName', 'side', 'team');
  const { id, name } = playerIdentity(data);

  sendEmbed('objectives', objectiveEmbed({ objective, faction, player: name }));

  if (id) {
    await recordStat({ playerId: id, name, increments: { captures: 1 } });
  }
}
