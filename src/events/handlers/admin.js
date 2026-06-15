// Admin actions (kick/ban/teleport/etc.) and generic server-health events.
// These post to dedicated channels and can optionally ping an alert role.

import { pick, playerIdentity } from '../normalize.js';
import { adminEmbed, serverEmbed } from '../../discord/embeds.js';
import { sendEmbed } from '../../discord/webhooks.js';

export async function adminAction(event) {
  const data = event.data ?? event;
  sendEmbed('admin', adminEmbed({
    action: pick(data, 'action', 'adminAction', 'command'),
    admin: pick(data, 'admin', 'adminName', 'by'),
    // TGZ_Admin sends a bare `target` name; legacy SAT used target* prefixed keys.
    target: pick(data, 'target') || playerIdentity(data, 'target').name || playerIdentity(data).name,
    reason: pick(data, 'reason', 'message'),
  }), { mention: true });
}

export async function serverHealth(event) {
  const data = event.data ?? event;
  sendEmbed('server', serverEmbed({
    title: pick(data, 'title', 'status', 'event'),
    message: pick(data, 'message', 'details', 'description'),
  }), { mention: Boolean(pick(data, 'alert', 'critical')) });
}
