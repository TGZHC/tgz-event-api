// Rich embed builders. Each returns a Discord embed object. Colors and a small
// icon vocabulary keep the feed scannable. Builders are pure (no I/O), so they
// are trivially unit-testable.

const COLOR = {
  kill: 0xe74c3c,     // red
  teamkill: 0xff8c00, // orange — stands out as a problem
  join: 0x2ecc71,     // green
  leave: 0x95a5a6,    // grey
  objective: 0x3498db,// blue
  admin: 0x9b59b6,    // purple
  server: 0xf1c40f,   // yellow
};

function base(title, color, fields = [], extra = {}) {
  return {
    title,
    color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'TGZ Event API' },
    ...extra,
  };
}

export function killEmbed({ killer, victim, weapon, distance, teamkill }) {
  const fields = [
    { name: 'Killer', value: killer || 'Unknown', inline: true },
    { name: 'Victim', value: victim || 'Unknown', inline: true },
  ];
  if (weapon) fields.push({ name: 'Weapon', value: weapon, inline: true });
  if (distance != null) fields.push({ name: 'Distance', value: `${Math.round(distance)} m`, inline: true });
  return base(
    teamkill ? '⚠️ Team Kill' : '💀 Kill',
    teamkill ? COLOR.teamkill : COLOR.kill,
    fields,
  );
}

export function joinEmbed({ player, players, max }) {
  const fields = [{ name: 'Player', value: player || 'Unknown', inline: true }];
  if (players != null) fields.push({ name: 'Online', value: `${players}${max ? `/${max}` : ''}`, inline: true });
  return base('🟢 Player Joined', COLOR.join, fields);
}

export function leaveEmbed({ player, players, max, playtime }) {
  const fields = [{ name: 'Player', value: player || 'Unknown', inline: true }];
  if (playtime != null) fields.push({ name: 'Session', value: formatDuration(playtime), inline: true });
  if (players != null) fields.push({ name: 'Online', value: `${players}${max ? `/${max}` : ''}`, inline: true });
  return base('⚪ Player Left', COLOR.leave, fields);
}

export function objectiveEmbed({ objective, faction, player }) {
  const fields = [{ name: 'Objective', value: objective || 'Unknown', inline: true }];
  if (faction) fields.push({ name: 'Faction', value: faction, inline: true });
  if (player) fields.push({ name: 'By', value: player, inline: true });
  return base('🚩 Objective Captured', COLOR.objective, fields);
}

export function adminEmbed({ action, admin, target, reason }) {
  const fields = [{ name: 'Action', value: action || 'Unknown', inline: true }];
  if (admin) fields.push({ name: 'Admin', value: admin, inline: true });
  if (target) fields.push({ name: 'Target', value: target, inline: true });
  if (reason) fields.push({ name: 'Reason', value: reason, inline: false });
  return base('🛡️ Admin Action', COLOR.admin, fields);
}

export function serverEmbed({ title, message }) {
  return base(`📡 ${title || 'Server'}`, COLOR.server, message ? [{ name: 'Details', value: message }] : []);
}

export function leaderboardEmbed({ period, rows, sort = 'kills' }) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => {
    const rank = medals[i] || `\`#${String(i + 1).padStart(2)}\``;
    return `${rank} **${r.name}** — ${r[sort]} ${sort} · K/D ${r.kd}`;
  });
  return base(
    `🏆 Leaderboard — ${period} (by ${sort})`,
    COLOR.objective,
    [],
    { description: lines.join('\n') || '_No data yet._' },
  );
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
