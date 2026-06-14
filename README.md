# TGZ Event API

Bridges **Arma Reforger Server Admin Tools (SAT)** events to **Discord** and a
**MariaDB**-backed stats / leaderboard engine. This is a clean rebuild of the
original Railway prototype, designed to not crash, not drop events, and to grow
into a full server-management dashboard.

## What's better than the old setup

| Problem in the old build | Fix here |
| --- | --- |
| SAT sent `Bearer <token>`, API expected a bare token → 401s | [`auth.js`](src/middleware/auth.js) accepts **both** `Bearer <token>` and bare tokens, plus `X-Api-Token`, with constant-time comparison. Covered by tests. |
| Markdown/template syntax errors crashed Railway on deploy | Modular files + `npm test` + a CI-friendly import smoke check catch these *before* deploy. |
| Flat JSON → half-done MariaDB migration | First-class MariaDB layer: pooled connections, auto-migrating schema, transactional stat upserts. |
| One mistake took the whole process down | Central error handler, `unhandledRejection`/`uncaughtException` guards, and handlers run **out-of-band** so Discord/DB hiccups never fail ingestion or crash the server. |
| Discord rate limits dropped messages | Serial send queue that **respects `Retry-After`** and retries with backoff. |
| No way to test Discord without the game server | `POST /test/discord` returns the real Discord result. |
| No stats foundation | Period-bucketed stats (`all` / `week` / `month`) with leaderboards that "reset" automatically — no cron wipes. |

## Architecture

```
SAT  ──POST /events──►  Express  ──► persist raw event (audit/replay)
                                  └─► route by type ─► handler ─┬─► Discord (queued embeds)
                                                                └─► MariaDB stats (all/week/month)
```

- **Raw events are stored first**, then handled. A handler bug never loses data —
  you can recompute stats from the `events` table at any time.
- **Stats are bucketed by period.** One kill increments three rows: all-time, the
  current ISO week (`2026-W24`), and the current month (`2026-06`). Weekly/monthly
  leaderboards are a single indexed lookup and roll over automatically.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | no | Liveness + DB check (Railway healthcheck) |
| `POST` | `/events` | yes | SAT event ingestion (single object or array) |
| `GET` | `/stats/leaderboard?period=week&sort=kills&limit=10` | no | Leaderboard JSON |
| `GET` | `/stats/player/:id` | no | One player's stats across all periods |
| `POST` | `/stats/leaderboard/post` | yes | Push a leaderboard embed to Discord (e.g. from cron) |
| `POST` | `/test/discord` | yes | Send a test embed, return the real Discord result |

Auth: send `Authorization: Bearer <API_TOKEN>` (or bare token, or `X-Api-Token`).

## Quick start (local)

```bash
cp .env.example .env        # fill in API_TOKEN + DB_* + at least one webhook
npm install
npm run migrate             # create tables (also runs automatically on boot)
npm start
npm test                    # pure-logic tests, no DB needed
```

Smoke-test Discord once running:

```bash
curl -X POST http://localhost:3000/test/discord \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"category":"server"}'
```

## Deploy to Railway

1. Push this folder to a GitHub repo, create a Railway service from it.
   The included [`Dockerfile`](Dockerfile) + [`railway.json`](railway.json) pin
   Node 20 and wire the `/health` healthcheck.
2. Add a **MariaDB** plugin and set `DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME` from its variables.
3. Set `API_TOKEN` and your `DISCORD_WEBHOOK_*` variables.
4. Deploy. The schema migrates itself on first boot.

## Point SAT at it

In your Reforger server's SAT config, set the event API URL to
`https://<your-railway-app>/events` and the token to your `API_TOKEN`.
Both `Bearer`-prefixed and bare tokens are accepted, so the common SAT
Authorization-header behavior just works.

## Adapting to your exact SAT payloads

SAT field names vary by version. All field extraction is centralized in
[`src/events/normalize.js`](src/events/normalize.js) and the per-type handlers in
[`src/events/handlers/`](src/events/handlers). When you see a real event in the
`events` table that isn't mapping, add its key spelling to the candidate lists in
one place — no handler rewrites needed. New event types: add a token → handler
entry in [`src/events/router.js`](src/events/router.js).

## Roadmap hooks already in place

- **Web dashboard** — the `/stats/*` JSON API is the backend; point any frontend at it.
- **Scheduled leaderboard posts** — hit `POST /stats/leaderboard/post` from a
  Railway cron or Discord bot weekly/monthly.
- **Faction & weapon analytics** — every raw event is retained in `events`; add
  new aggregate tables and backfill from it.
```
