# Custom Domain Setup (Porkbun → Railway) — Beginner Guide

Goal: turn `https://tgz-event-api-production.up.railway.app` into something clean
like `https://stats.YOURDOMAIN.xyz`. Time: ~15 minutes (plus a short DNS wait).

5 parts:
1. Buy a domain on Porkbun
2. Tell Railway your domain
3. Add one DNS record on Porkbun
4. Wait for it to go live (HTTPS issues automatically)
5. (Optional) Update your SAT config

> Replace `YOURDOMAIN.xyz` with whatever you actually buy, and
> `stats.YOURDOMAIN.xyz` with the address you want players to visit.

---

## Part 1 — Buy the domain on Porkbun

1. Go to **https://porkbun.com**.
2. In the search box, type the name you want (e.g. `tgzhc`, `tgzstats`, `tgz-arma`).
3. Pick an available one. **`.xyz` is usually the cheapest** (often ~$1–2 the
   first year). Note the *renewal* price too so there are no surprises next year.
4. Click **Add to Cart → Checkout**, make a free account, and pay.
5. Done — the domain is in your Porkbun account.

> 💡 Decide your address now:
> - **Subdomain (recommended, simplest):** `stats.YOURDOMAIN.xyz`
> - **Root:** `YOURDOMAIN.xyz` (works too — see the note in Part 3)

---

## Part 2 — Tell Railway about your domain

1. Railway → your **tgz-event-api** service → **Settings** tab.
2. Scroll to **Networking → Public Networking**.
3. Click **+ Custom Domain**.
4. Type the exact address you want, e.g. **`stats.YOURDOMAIN.xyz`**, and confirm.
5. Railway shows a **CNAME target** like `abc123xyz.up.railway.app`. **Copy it.**
   Leave this tab open — it'll say "Waiting for DNS update."

---

## Part 3 — Add the DNS record on Porkbun

1. Go to **https://porkbun.com/account/domainsSpeedy** (or log in → **Account →
   Domain Management**).
2. Find your domain and click the **DNS / "Details"** button next to it to open
   its DNS records editor.
3. Add a new record with these values:

   **For a subdomain (`stats.YOURDOMAIN.xyz`) — recommended:**
   - **Type:** `CNAME`
   - **Host:** `stats`
   - **Answer / Target:** paste Railway's value (e.g. `abc123xyz.up.railway.app`)
   - **TTL:** leave default (600)
   - Click **Add**.

   **For the root (`YOURDOMAIN.xyz`) instead:**
   - First **delete** Porkbun's default `ALIAS` and `A` records on the root
     (Host blank/`@`) that point to Porkbun's parking page.
   - Then add: **Type:** `ALIAS`, **Host:** leave blank, **Answer:** Railway's value.
   - (Porkbun's `ALIAS` works at the root where a plain CNAME can't.)

4. Save.

> Porkbun adds some default "parked" records when you buy. For a **subdomain**
> setup you can ignore them. For a **root** setup you must remove the conflicting
> root records first (above).

---

## Part 4 — Wait for it to go live

1. Back on the Railway tab, within a few minutes (sometimes up to ~30) the custom
   domain turns **active/green** and Railway auto-issues a free HTTPS certificate.
2. Open **`https://stats.YOURDOMAIN.xyz`** — your TGZ Stats site loads with the
   padlock 🔒.

> Still "waiting" after 30 min? Re-check the **Host** (`stats`) and **Answer**
> (Railway's exact value) on the Porkbun record.

---

## Part 5 — (Optional) Update your SAT config

The old `…up.railway.app` address keeps working, so nothing breaks. To run
everything under your own domain, point SAT's Event API at the new one:

- **Event API URL:** `https://stats.YOURDOMAIN.xyz/events`
- **Token:** unchanged

Restart the server after changing it.

---

## What you end up with

| Thing | Address |
|---|---|
| Public stats website | `https://stats.YOURDOMAIN.xyz` |
| API for SAT | `https://stats.YOURDOMAIN.xyz/events` (or the old railway URL) |
| Health check | `https://stats.YOURDOMAIN.xyz/health` |

Both the new domain and the original `up.railway.app` address work at the same
time — no downtime, nothing to break.
