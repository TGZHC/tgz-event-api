/* TGZ Stats front-end. Vanilla JS, no dependencies. Talks to the same-origin
   API (/stats/*). Hash routing keeps player pages shareable (#/player/<id>). */

const view = document.getElementById('view');

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All-Time' },
];
const SORTS = [
  { key: 'kills', label: 'Kills' },
  { key: 'kd', label: 'K/D' },
  { key: 'kill_streak_best', label: 'Best Streak' },
  { key: 'longest_kill_m', label: 'Longest Kill' },
  { key: 'playtime_seconds', label: 'Playtime' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'teamkills', label: 'Team Kills' },
  { key: 'suicides', label: 'Suicides' },
];

// --- helpers ---
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const medal = (i) => (['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`);
function fmtPlaytime(sec) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function kdClass(kd) { return kd >= 1 ? 'kd-good' : 'kd-bad'; }
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
function setActiveTab(name) {
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
}

// --- Leaderboards view ---
let lbState = { period: 'week', sort: 'kills' };
async function renderLeaderboards() {
  setActiveTab('leaderboards');
  view.innerHTML = `
    <h1 class="page-title">Leaderboards</h1>
    <p class="subtitle">Combat performance rankings across all operators.</p>
    <div class="controls">
      <div class="segment" id="lb-periods">${PERIODS.map((p) => `<button data-k="${p.key}" class="${p.key === lbState.period ? 'active' : ''}">${p.label}</button>`).join('')}</div>
      <select id="lb-sort">${SORTS.map((s) => `<option value="${s.key}" ${s.key === lbState.sort ? 'selected' : ''}>Sort: ${s.label}</option>`).join('')}</select>
    </div>
    <div id="lb-table" class="card"><div class="loading">Loading…</div></div>`;

  document.getElementById('lb-periods').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    lbState.period = b.dataset.k; renderLeaderboards();
  });
  document.getElementById('lb-sort').addEventListener('change', (e) => { lbState.sort = e.target.value; renderLeaderboards(); });

  try {
    // For K/D we sort client-side (it isn't a stored column); fetch a wider set.
    const apiSort = lbState.sort === 'kd' ? 'kills' : lbState.sort;
    const data = await api(`/stats/leaderboard?period=${lbState.period}&sort=${apiSort}&limit=50`);
    let rows = data.rows;
    if (lbState.sort === 'kd') rows = [...rows].sort((a, b) => b.kd - a.kd);
    rows = rows.slice(0, 25);
    document.getElementById('lb-table').innerHTML = lbTable(rows);
  } catch (err) {
    document.getElementById('lb-table').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}
function lbTable(rows) {
  if (!rows.length) return '<div class="empty">No combat data recorded for this period.</div>';
  return `<table>
    <thead><tr>
      <th class="rank">#</th><th>Player</th>
      <th class="num">Kills</th><th class="num">Deaths</th><th class="num">K/D</th>
      <th class="num hide-sm">TK</th><th class="num hide-sm">Suicides</th><th class="num hide-sm">Streak</th><th class="num hide-sm">Longest</th><th class="num hide-sm">Sessions</th>
    </tr></thead><tbody>
    ${rows.map((r, i) => `<tr>
      <td class="rank ${i < 3 ? 'medal' : ''}">${medal(i)}</td>
      <td class="pname"><a href="#/player/${encodeURIComponent(r.player_id)}">${esc(r.name)}</a></td>
      <td class="num">${r.kills}</td>
      <td class="num">${r.deaths}</td>
      <td class="num ${kdClass(r.kd)}">${r.kd}</td>
      <td class="num hide-sm ${r.teamkills ? 'kd-bad' : ''}">${r.teamkills}</td>
      <td class="num hide-sm">${r.suicides}</td>
      <td class="num hide-sm">${r.kill_streak_best}</td>
      <td class="num hide-sm">${r.longest_kill_m ? r.longest_kill_m + 'm' : '—'}</td>
      <td class="num hide-sm">${r.sessions}</td>
    </tr>`).join('')}
    </tbody></table>`;
}

// --- Weapons view ---
let wpState = { period: 'all' };
async function renderWeapons() {
  setActiveTab('weapons');
  view.innerHTML = `
    <h1 class="page-title">Deadliest Weapons</h1>
    <p class="subtitle">Most kills by weapon.</p>
    <div class="controls">
      <div class="segment" id="wp-periods">${PERIODS.map((p) => `<button data-k="${p.key}" class="${p.key === wpState.period ? 'active' : ''}">${p.label}</button>`).join('')}</div>
    </div>
    <div id="wp-table" class="card"><div class="loading">Loading…</div></div>`;
  document.getElementById('wp-periods').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; wpState.period = b.dataset.k; renderWeapons();
  });
  try {
    const data = await api(`/stats/weapons?period=${wpState.period}&limit=25`);
    const rows = data.rows;
    document.getElementById('wp-table').innerHTML = rows.length
      ? `<table><thead><tr><th class="rank">#</th><th>Weapon</th><th class="num">Kills</th></tr></thead><tbody>
         ${rows.map((r, i) => `<tr><td class="rank ${i < 3 ? 'medal' : ''}">${medal(i)}</td><td class="pname">${esc(r.weapon)}</td><td class="num">${r.kills}</td></tr>`).join('')}
         </tbody></table>`
      : '<div class="empty">No weapon data yet.</div>';
  } catch (err) {
    document.getElementById('wp-table').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

// --- Players directory ---
let playersCache = null;
async function renderPlayers() {
  setActiveTab('players');
  view.innerHTML = `
    <h1 class="page-title">Operators</h1>
    <p class="subtitle">Search for an operator to view their full service record.</p>
    <div class="controls"><input type="search" id="psearch" placeholder="Search operators…" autocomplete="off" /></div>
    <div id="plist" class="card"><div class="loading">Loading…</div></div>`;
  const input = document.getElementById('psearch');
  input.addEventListener('input', () => drawPlayers(input.value.trim().toLowerCase()));
  try {
    if (!playersCache) playersCache = (await api('/stats/players?limit=2000')).players;
    drawPlayers('');
  } catch (err) {
    document.getElementById('plist').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}
function drawPlayers(filter) {
  let list = playersCache || [];
  if (filter) list = list.filter((p) => p.name.toLowerCase().includes(filter));
  list = list.slice(0, 100);
  document.getElementById('plist').innerHTML = list.length
    ? `<table><thead><tr><th>Player</th><th class="num">Kills</th><th class="num">Deaths</th><th class="num hide-sm">Sessions</th><th class="num hide-sm">First seen</th></tr></thead><tbody>
       ${list.map((p) => `<tr>
         <td class="pname"><a href="#/player/${encodeURIComponent(p.player_id)}">${esc(p.name)}</a></td>
         <td class="num">${p.kills}</td><td class="num">${p.deaths}</td>
         <td class="num hide-sm">${p.sessions ?? 0}</td>
         <td class="num hide-sm">${fmtDate(p.first_seen)}</td></tr>`).join('')}
       </tbody></table>`
    : '<div class="empty">No operators found.</div>';
}

// --- Player profile ---
async function renderProfile(id) {
  setActiveTab('players');
  view.innerHTML = '<div class="loading">Loading player…</div>';
  let p;
  try {
    p = await api(`/stats/player/${encodeURIComponent(id)}`);
  } catch (err) {
    view.innerHTML = `<div class="error">${err.message.includes('404') ? 'Player not found.' : esc(err.message)}</div><p><a class="back" href="#/players">← Back to operators</a></p>`;
    return;
  }
  const t = p.totals;
  const stat = (v, l, accent) => `<div class="stat"><div class="v ${accent ? 'accent' : ''}">${v}</div><div class="l">${l}</div></div>`;
  view.innerHTML = `
    <p><a class="back" href="#/players">← Back to operators</a></p>
    <div class="profile-head"><h1>${esc(p.name)}</h1>
      <span class="subtitle">Service record: ${fmtDate(p.first_seen)} → ${fmtDate(p.last_seen)}</span></div>
    <div class="stat-grid">
      ${stat(t.kills, 'Kills', true)}
      ${stat(t.deaths, 'Deaths')}
      ${stat(t.kd, 'K/D')}
      ${stat(t.teamkills, 'Team Kills')}
      ${stat(t.suicides, 'Suicides')}
      ${stat(t.kill_streak_best, 'Best Streak')}
      ${stat(t.longest_kill_m ? t.longest_kill_m + 'm' : '—', 'Longest Kill')}
      ${stat(t.sessions, 'Sessions')}
      ${stat(fmtPlaytime(t.playtime_seconds), 'Playtime')}
    </div>
    <div class="card chart-card">
      <h3>Combat Record</h3>
      <div class="legend"><span><i style="background:var(--tan)"></i>Cumulative kills</span><span><i style="background:var(--danger)"></i>Cumulative deaths</span></div>
      ${historyChart(p.history)}
    </div>
    <div class="card chart-card">
      <h3>Daily Log</h3>
      ${dayTable(p.history)}
    </div>`;
}

// Build cumulative series and draw a responsive SVG line chart (no libraries).
function historyChart(history) {
  if (!history || history.length === 0) return '<div class="empty">No daily history yet.</div>';
  let ck = 0, cd = 0;
  const pts = history.map((h) => ({ date: h.date, kills: (ck += h.kills), deaths: (cd += h.deaths) }));
  const W = 800, H = 280, padL = 40, padR = 16, padT = 16, padB = 28;
  const maxY = Math.max(5, ...pts.map((p) => Math.max(p.kills, p.deaths)));
  const n = pts.length;
  const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const y = (v) => H - padB - (v / maxY) * (H - padT - padB);
  const line = (sel) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[sel]).toFixed(1)}`).join(' ');
  const gy = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = Math.round(maxY * f), yy = y(val);
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 6}" y="${yy + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${val}</text>`;
  }).join('');
  const ticks = pts.filter((_, i) => i % Math.ceil(n / 6) === 0 || i === n - 1)
    .map((p) => `<text x="${x(pts.indexOf(p))}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="10">${p.date.slice(5)}</text>`).join('');
  const dot = (p, i, sel, color) => `<circle cx="${x(i)}" cy="${y(p[sel])}" r="2.5" fill="${color}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${gy}${ticks}
    <path d="${line('deaths')}" fill="none" stroke="var(--danger)" stroke-width="2"/>
    <path d="${line('kills')}" fill="none" stroke="var(--tan)" stroke-width="2.5"/>
    ${pts.map((p, i) => dot(p, i, 'kills', 'var(--tan)')).join('')}
  </svg>`;
}
function dayTable(history) {
  if (!history || !history.length) return '<div class="empty">No daily history yet.</div>';
  const rows = [...history].reverse();
  return `<table><thead><tr><th>Date</th><th class="num">Kills</th><th class="num">Deaths</th><th class="num">K/D</th><th class="num hide-sm">TK</th><th class="num hide-sm">Suicides</th></tr></thead><tbody>
    ${rows.map((h) => `<tr><td>${esc(h.date)}</td><td class="num">${h.kills}</td><td class="num">${h.deaths}</td><td class="num ${kdClass(h.kd)}">${h.kd}</td><td class="num hide-sm">${h.teamkills}</td><td class="num hide-sm">${h.suicides}</td></tr>`).join('')}
    </tbody></table>`;
}

// --- Router ---
function route() {
  const hash = location.hash || '#/leaderboards';
  const m = hash.match(/^#\/player\/(.+)$/);
  if (m) return renderProfile(decodeURIComponent(m[1]));
  if (hash.startsWith('#/weapons')) return renderWeapons();
  if (hash.startsWith('#/players')) return renderPlayers();
  return renderLeaderboards();
}
window.addEventListener('hashchange', route);

// Footer player count + initial route.
(async () => {
  try {
    const { players } = await api('/stats/players?limit=5000');
    playersCache = players;
    document.getElementById('player-count').textContent = players.length;
  } catch { /* ignore */ }
  route();
})();
