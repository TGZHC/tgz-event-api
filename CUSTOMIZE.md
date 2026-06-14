# Customizing Your Site & Discord Messages (No Coding Needed)

You can change colors, fonts, wording, and Discord messages yourself. This guide
uses the **easiest method: editing right on GitHub.com** — no PC tools, no
commands. Every save automatically redeploys your site in ~1–2 minutes.

---

## The golden workflow (how ANY change goes live)

1. Go to **https://github.com/TGZHC/tgz-event-api**
2. Click the file you want to change (links below).
3. Click the **pencil ✏️ icon** (top-right of the file) = "Edit this file".
4. Make your change.
5. Scroll down, click the green **Commit changes** button.
6. Wait ~1–2 minutes — Railway sees the change and redeploys automatically.
7. Refresh your site (`tgztacnet.xyz`) to see it. (Tip: Ctrl+Shift+R to force-refresh.)

> You can't really break anything permanently — if a change looks wrong, just
> edit again and fix it. Nothing is live until the redeploy finishes.

---

## 1. Change the site's COLORS

**File:** `public/styles.css` — the block near the top marked **"CUSTOMIZE HERE."**

Each line is one color, written as a hex code like `#c2b280`. To get a new hex
code, go to **https://htmlcolorcodes.com**, pick a color, copy its `#......` value,
and paste it in.

| Line | What it controls |
|------|------------------|
| `--bg` | Page background |
| `--bg-2` | Panels / tables / cards |
| `--text` | Main text |
| `--muted` | Dim labels |
| `--tan` | **Main accent** — headings, links, #1 ranks |
| `--olive` | Active tab, secondary accent |
| `--danger` | "Bad" stats (deaths) |
| `--good` | "Good" stats (high K/D) |

Example: to make the accent red instead of tan, change
`--tan: #c2b280;` to `--tan: #c0392b;`.

---

## 2. Change the FONTS

**File:** `public/styles.css` — same CUSTOMIZE block, the two `--font-` lines.

- `--font-main` = all the normal text and headers
- `--font-mono` = the numbers

### Use a fancy/custom font (e.g. a military stencil font)
1. Go to **https://fonts.google.com**, find a font you like (e.g. "Black Ops One",
   "Oswald", "Teko"), and copy its name.
2. **File:** `public/index.html` — find the `<link rel="stylesheet" href="/styles.css" />`
   line and add this ABOVE it (replace the font name):
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
   ```
3. **File:** `public/styles.css` — set:
   ```css
   --font-main: "Oswald", sans-serif;
   ```
4. Commit both. Done.

---

## 3. Change the WEBSITE WORDING

**File:** `public/index.html` — for the things at the top and bottom:
- The brand text `TGZ // Combat Stats`
- The tab names `Leaderboards`, `Weapons`, `Operators`
- The footer line

**File:** `public/app.js` — for page titles and descriptions:
- Search for the words you see on a page (e.g. `Combat performance rankings`) and
  edit the text between the quotes. Don't touch the symbols around them
  (`<`, `>`, `${...}`, backticks) — just the plain words.

---

## 4. Change the DISCORD MESSAGES

**File:** `messages.json` (in the main folder) — this one is built for editing.

- **Titles & wording:** change the text in quotes, e.g.
  `"title": "Kill Confirmed"` → `"title": "Target Eliminated"`
- **Colors:** change the hex, e.g. `"color": "#7a8b3c"`
- **Leaderboard format:** the `line` value, using `{placeholders}` like `{name}`,
  `{kills}`, `{kd}`. The `_README` at the top of the file lists every placeholder.

Keep the quotes and commas exactly as they are — only change what's *inside* the
quotes. If something breaks, the site simply falls back to the default messages
(it won't crash).

---

## Quick reference: what's in which file

| I want to change... | File |
|---------------------|------|
| Site colors, fonts, spacing | `public/styles.css` |
| Brand name, tab names, footer | `public/index.html` |
| Page titles & descriptions | `public/app.js` |
| Discord message text & colors | `messages.json` |

---

## Safety net
- A bad edit can't take the site down permanently — fix it and commit again.
- Discord messages fall back to defaults if `messages.json` has a typo.
- The game data (kills, stats) is never affected by any of these style changes.
- Always-working backup address if your domain ever hiccups:
  `https://tgz-event-api-production.up.railway.app`
