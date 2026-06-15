// Rich embed builders. Titles, colors and leaderboard lines all come from the
// customizable templates in messages.js (which merges messages.json). Builders
// stay pure (no I/O) so they're trivially unit-testable.

import { messages, colorToInt, render, periodLabel } from './messages.js';

function base(title, color, fields = [], extra = {}) {
  return {
    title,
    color: colorToInt(color),
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: messages.leaderboard.footer || 'TGZ Event API' },
    ...extra,
  };
}

function styleFor(key) {
  return messages.events[key] || { title: key, color: '#7289da' };
}

export function killEmbed({ killer, victim, weapon, distance, headshot, teamkill, at }) {
  const style = styleFor(teamkill ? 'teamkill' : 'kill');
  // "Combat report" card: a code block so it reads like a clean dossier entry.
  const pad = (s) => (s + ' '.repeat(10)).slice(0, 10);
  const lines = [
    `${pad('Killer')}: ${killer || 'Unknown'}`,
    `${pad('Victim')}: ${victim || 'Unknown'}`,
    `${pad('Team Kill')}: ${teamkill ? 'YES ⚠️' : 'No'}`,
  ];
  if (weapon) lines.push(`${pad('Weapon')}: ${weapon}`);
  if (distance != null) lines.push(`${pad('Distance')}: ${Math.round(distance)} m`);
  if (headshot) lines.push(`${pad('Headshot')}: Yes`);
  return base(render(style.title), style.color, [], {
    description: '```yaml\n' + lines.join('\n') + '\n```',
    ...(at ? { timestamp: new Date(at).toISOString() } : {}),
  });
}

export function joinEmbed({ player, players, max }) {
  const style = styleFor('join');
  const fields = [{ name: 'Player', value: player || 'Unknown', inline: true }];
  if (players != null) fields.push({ name: 'Online', value: `${players}${max ? `/${max}` : ''}`, inline: true });
  return base(render(style.title), style.color, fields);
}

export function leaveEmbed({ player, players, max, playtime }) {
  const style = styleFor('leave');
  const fields = [{ name: 'Player', value: player || 'Unknown', inline: true }];
  if (playtime != null) fields.push({ name: 'Session', value: formatDuration(playtime), inline: true });
  if (players != null) fields.push({ name: 'Online', value: `${players}${max ? `/${max}` : ''}`, inline: true });
  return base(render(style.title), style.color, fields);
}

export function objectiveEmbed({ objective, faction, player }) {
  const style = styleFor('objective');
  const fields = [{ name: 'Objective', value: objective || 'Unknown', inline: true }];
  if (faction) fields.push({ name: 'Faction', value: faction, inline: true });
  if (player) fields.push({ name: 'By', value: player, inline: true });
  return base(render(style.title), style.color, fields);
}

export function adminEmbed({ action, admin, target, reason }) {
  const style = styleFor('admin');
  const fields = [{ name: 'Action', value: action || 'Unknown', inline: true }];
  if (admin) fields.push({ name: 'Admin', value: admin, inline: true });
  if (target) fields.push({ name: 'Target', value: target, inline: true });
  if (reason) fields.push({ name: 'Reason', value: reason, inline: false });
  return base(render(style.title), style.color, fields);
}

export function serverEmbed({ title, message }) {
  const style = styleFor('server');
  return base(render(style.title, { title: title || 'Server' }), style.color,
    message ? [{ name: 'Details', value: message }] : []);
}

export function leaderboardEmbed({ period, rows, sort = 'kills' }) {
  const cfg = messages.leaderboard;
  const lines = rows.map((r, i) => {
    const medal = cfg.medals[i] || `\`#${String(i + 1).padStart(2)}\``;
    return render(cfg.line, { ...r, medal, rank: i + 1, sort, value: r[sort] });
  });
  return base(
    render(cfg.title, { periodLabel: periodLabel(period), period, sort }),
    cfg.color,
    [],
    { description: lines.join('\n') || cfg.empty },
  );
}

export function weaponLeaderboardEmbed({ period, rows }) {
  const cfg = messages.weaponLeaderboard;
  const medals = messages.leaderboard.medals;
  const lines = rows.map((r, i) => {
    const medal = medals[i] || `\`#${String(i + 1).padStart(2)}\``;
    return render(cfg.line, { ...r, medal, rank: i + 1 });
  });
  return base(
    render(cfg.title, { periodLabel: periodLabel(period), period }),
    cfg.color,
    [],
    { description: lines.join('\n') || cfg.empty },
  );
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
