# TGZ Event API — Setup Guide for Complete Beginners

**Read this if you have never deployed a website, used GitHub, or touched a
database before.** Every step is spelled out. You do not need to understand the
code. Follow the steps in order, top to bottom, and don't skip any.

Estimated time: **45–90 minutes** the first time.

---

## Part 0: What are we even building?

Your Arma Reforger server can shout out "things happened!" — a player joined,
someone got a kill, a base was captured. We are setting up a little program (an
"API") that:

1. **Listens** for those shout-outs from your game server.
2. **Posts** nice messages about them into your Discord.
3. **Remembers** them in a database so we can build kill leaderboards.

The little program needs to live somewhere on the internet that's always on. We
will rent that space (for free/cheap) from a company called **Railway**.

Here's the whole picture. Don't worry if it's fuzzy — it'll make sense as you go:

```
   Arma Reforger Server  ──►  Our program (on Railway)  ──►  Discord
                                       │
                                       ▼
                                 Database (MariaDB)
                              (stores stats/leaderboards)
```

---

## Part 1: Things you need to create (accounts)

You'll make these free accounts. Do them now so they're ready. Use the same
email for all of them to keep life simple.

| # | Account | Website | Why |
|---|---------|---------|-----|
| 1 | **GitHub** | https://github.com/signup | Stores our program's code online |
| 2 | **Railway** | https://railway.app | Runs the program 24/7 + gives us a database |
| 3 | **Discord** | (you already have this) | Where messages get posted |

> 💡 **Tip:** When you sign up for Railway, click **"Login with GitHub."** That
> links them together and saves you a step later.

---

## Part 2: Install two free programs on your PC

You need two tools on your Windows PC. Both are "next, next, finish" installers.

### 2a. Install Node.js

Node.js is the engine that runs our program. We also use it to test things.

1. Go to **https://nodejs.org**.
2. Click the big button that says **"LTS"** (it'll have a version number like
   `20.x.x` — that's fine, anything 20 or higher works).
3. Open the downloaded file and click **Next → Next → I accept → Next → Install**.
   Accept all the defaults. If it asks about "tools for native modules," you can
   leave it unchecked.
4. **Check it worked.** Press the **Windows key**, type `powershell`, and open
   **Windows PowerShell**. In the blue window, type this and press Enter:

   ```powershell
   node --version
   ```

   If you see something like `v20.11.0`, it worked. 🎉 If you see "not
   recognized," restart your PC and try again.

### 2b. Install Git

Git is the tool that uploads our code to GitHub.

1. Go to **https://git-scm.com/download/win** — the download starts on its own.
2. Run the installer. There are a LOT of screens. **Just click Next on every
   single one** and accept the defaults. (The defaults are fine for us.)
3. **Check it worked.** Open a NEW PowerShell window (close the old one first)
   and type:

   ```powershell
   git --version
   ```

   If you see `git version 2.x.x`, you're good.

---

## Part 3: Get the code onto your PC and up to GitHub

The program's code is the `TGZ_EventAPI` folder. We need to put it on GitHub so
Railway can grab it.

### 3a. Make an empty home for it on GitHub

1. Go to **https://github.com** and log in.
2. Click the **green "New"** button (or the **+** in the top-right → **New
   repository**).
3. **Repository name:** type `tgz-event-api`
4. Leave it set to **Private** (recommended) or Public — your choice.
5. **Do NOT** check "Add a README" or any other boxes. We want it empty.
6. Click **Create repository**.
7. The next page shows some commands. **Leave this browser tab open** — we'll
   copy from it in a second.

### 3b. Upload your code

1. Open PowerShell.
2. Go into your project folder by typing this (copy it exactly):

   ```powershell
   cd "C:\Users\mikem\OneDrive\Documents\Claude\TGZ_EventAPI"
   ```

3. Now run these commands **one line at a time** (press Enter after each). The
   first time, Git may pop up a window asking you to log in to GitHub — do that.

   ```powershell
   git init
   git add .
   git commit -m "First version of TGZ Event API"
   git branch -M main
   ```

4. Now go back to your GitHub browser tab. Find the line that looks like this and
   **copy it** (yours will have your username):

   ```
   git remote add origin https://github.com/YOUR-USERNAME/tgz-event-api.git
   ```

   Paste it into PowerShell and press Enter. Then run:

   ```powershell
   git push -u origin main
   ```

5. Refresh your GitHub browser tab. You should now see all your files
   (`src`, `package.json`, `README.md`, etc.). **The code is now on GitHub.** ✅

> 🔒 **Important:** There is no `.env` file uploaded, and that's on purpose — it
> would hold secret passwords. We set those secrets directly in Railway instead
> (Part 5).

---

## Part 4: Set up Discord (where messages appear)

A "webhook" is just a secret web address. Anything sent to that address shows up
as a message in a specific Discord channel. We'll make a few.

### 4a. Make your channels

In your Discord server, create text channels for the categories you want. You
don't need all of them — even one is fine to start. Suggested:

- `#server-feed` (general / fallback)
- `#kill-feed`
- `#joins-and-leaves`
- `#objectives`
- `#admin-log`

### 4b. Make a webhook for each channel

For **each** channel, do this:

1. Hover over the channel name → click the **gear icon** (Edit Channel).
2. On the left, click **Integrations**.
3. Click **Create Webhook** (or **Webhooks → New Webhook**).
4. Give it a name like `TGZ Feed` (optional).
5. Click **Copy Webhook URL**. This copies a long secret link to your clipboard.
6. **Paste it somewhere safe** — open Notepad and paste it, labeling which
   channel it's for. You'll need these in Part 5.

   It looks like: `https://discord.com/api/webhooks/123456789/aBcDeF...`

7. Click **Save Changes**.

Repeat for each channel. Keep your Notepad list handy. **Treat these URLs like
passwords** — anyone with one can post to your channel.

---

## Part 5: Deploy on Railway (put the program online)

This is the big one. Take your time.

### 5a. Create the project from your GitHub code

1. Go to **https://railway.app** and log in (use **Login with GitHub**).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. If asked, click **Configure GitHub App** and give Railway permission to see
   your `tgz-event-api` repository. Then come back.
5. Select **`tgz-event-api`** from the list.
6. Railway will start trying to build it. **It will probably fail or crash-loop
   for now — that's expected.** We haven't given it the database or secrets yet.
   Don't panic. Continue below.

### 5b. Add the MariaDB database

1. Inside your project, click **New** (or **Create** / the **+** button).
2. Choose **Database** → **Add MariaDB**.
3. Railway creates a database box next to your app. Done — it's running.

### 5c. Connect the app to the database

The app needs to know the database's address and password. Railway stores those
as "variables" on the database. We just point the app at them.

1. Click your **app service** (the `tgz-event-api` box, NOT the database box).
2. Click the **Variables** tab.
3. Click **New Variable** and add each of the following. For the database ones,
   Railway lets you "reference" the database's values so you don't copy
   passwords by hand. Type the variable name, and for the value start typing
   `${{` — Railway will suggest the MariaDB values. Pick the matching one.

   Add these **database** variables (the right-side values come from your
   MariaDB service — Railway calls them things like `MYSQLHOST`, `MYSQLPORT`,
   etc.):

   | Variable name (left) | Value to reference (right) |
   |----------------------|----------------------------|
   | `DB_HOST` | `${{MariaDB.MYSQLHOST}}` |
   | `DB_PORT` | `${{MariaDB.MYSQLPORT}}` |
   | `DB_USER` | `${{MariaDB.MYSQLUSER}}` |
   | `DB_PASSWORD` | `${{MariaDB.MYSQLPASSWORD}}` |
   | `DB_NAME` | `${{MariaDB.MYSQLDATABASE}}` |

   > If the suggestions show slightly different names (e.g. `MARIADBHOST`), just
   > pick whatever matches host / port / user / password / database. The names on
   > the LEFT (`DB_HOST`, etc.) must stay exactly as written.

4. Now add the **secret token** the game server will use. Pick a long random
   password. Easy way: in PowerShell run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   and copy what it prints. Then add:

   | Variable name | Value |
   |---------------|-------|
   | `API_TOKEN` | *(paste your long random token)* |
   | `NODE_ENV` | `production` |

5. Now add your **Discord webhooks** from your Notepad list. Only add the ones
   you made — leave out the rest. `DISCORD_WEBHOOK_DEFAULT` is the fallback used
   for anything without its own channel, so set at least that one.

   | Variable name | Value |
   |---------------|-------|
   | `DISCORD_WEBHOOK_DEFAULT` | *(your #server-feed webhook URL)* |
   | `DISCORD_WEBHOOK_KILLS` | *(your #kill-feed webhook URL)* |
   | `DISCORD_WEBHOOK_JOINS` | *(your #joins-and-leaves webhook URL)* |
   | `DISCORD_WEBHOOK_OBJECTIVES` | *(your #objectives webhook URL)* |
   | `DISCORD_WEBHOOK_ADMIN` | *(your #admin-log webhook URL)* |
   | `DISCORD_WEBHOOK_SERVER` | *(your #server-feed webhook URL again, or a dedicated one)* |

6. After adding everything, Railway will **redeploy automatically**. If it
   doesn't, click the **Deployments** tab → **Deploy** / **Redeploy**.

### 5d. Turn on a public web address

Right now the app runs but has no public URL. Let's give it one.

1. Click your **app service** → **Settings** tab.
2. Find **Networking** → **Public Networking** → click **Generate Domain**.
3. Railway gives you a URL like `https://tgz-event-api-production.up.railway.app`.
   **Copy it and save it in your Notepad.** This is your API's address.

### 5e. Check it's alive

1. Open a new browser tab and go to **`YOUR-RAILWAY-URL/health`**
   (for example `https://tgz-event-api-production.up.railway.app/health`).
2. You should see something like:

   ```json
   {"status":"ok","db":"ok","uptime_seconds":12,"version":"1.0.0"}
   ```

   - `"status":"ok"` and `"db":"ok"` = **everything works!** 🎉
   - `"db":"down"` = the database variables in Step 5c aren't right. Recheck them.
   - Page won't load at all = the app crashed. Go to the **Deployments** tab →
     click the latest deployment → **View Logs**, and read the red error. The
     most common cause is a misspelled variable name.

---

## Part 6: Test Discord before touching the game

Let's make sure messages reach Discord. We'll send a test from PowerShell.

1. Open PowerShell.
2. Copy the command below. Replace `YOUR-RAILWAY-URL` with your real URL and
   `YOUR-API-TOKEN` with the token you made in Step 5c-4. Paste and Enter:

   ```powershell
   $headers = @{ "Authorization" = "Bearer YOUR-API-TOKEN"; "Content-Type" = "application/json" }
   Invoke-RestMethod -Uri "YOUR-RAILWAY-URL/test/discord" -Method Post -Headers $headers -Body '{"category":"server"}'
   ```

3. Go look at your Discord `#server-feed` channel. A **"Test Message"** embed
   should appear. ✅

   - Nothing appeared? Double-check the webhook URL in Railway for that category.
   - Got a `401 unauthorized`? Your `API_TOKEN` in the command doesn't match the
     one in Railway.

---

## Part 7: Point your Arma Reforger server at the API

Now connect the game server so real events flow in.

1. Open your Reforger **Server Admin Tools (SAT)** configuration. (This is in
   your server's mod/config setup — wherever you set up SAT originally.)
2. Find the **Event API** settings. Set:
   - **URL / Endpoint:** `YOUR-RAILWAY-URL/events`
     (e.g. `https://tgz-event-api-production.up.railway.app/events`)
   - **Token / API Key:** the same `API_TOKEN` value from Railway.
3. Save the config and **restart your Reforger server** so it picks up the change.
4. Join your server and do something (or have a friend join). Watch your Discord
   channels — joins, kills, and captures should start appearing.

> SAT usually sends the token as `Bearer <token>`. This API accepts that format
> **and** a plain token, so you don't have to fuss with it — either works.

---

## Part 8: See your leaderboard

Once some kills have happened, open this in your browser
(no login needed):

```
YOUR-RAILWAY-URL/stats/leaderboard?period=week&sort=kills
```

You'll get the weekly kill leaderboard as data. Change `period` to `all`,
`week`, or `month`, and `sort` to `kills`, `deaths`, `captures`, etc.

To **post** a nice leaderboard embed into Discord on demand, run this in
PowerShell (same headers as Part 6):

```powershell
$headers = @{ "Authorization" = "Bearer YOUR-API-TOKEN"; "Content-Type" = "application/json" }
Invoke-RestMethod -Uri "YOUR-RAILWAY-URL/stats/leaderboard/post" -Method Post -Headers $headers -Body '{"period":"week","sort":"kills"}'
```

---

## Part 9: Updating the code later

If you (or someone) change the code on your PC, push the update like this and
Railway redeploys automatically:

```powershell
cd "C:\Users\mikem\OneDrive\Documents\Claude\TGZ_EventAPI"
git add .
git commit -m "describe what you changed"
git push
```

---

## Cheat sheet: keep these 4 things in your Notepad

1. **Railway URL** — `https://...up.railway.app`
2. **API_TOKEN** — your long random secret
3. **Discord webhook URLs** — one per channel
4. **GitHub repo** — `https://github.com/YOUR-USERNAME/tgz-event-api`

---

## Troubleshooting quick table

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| `/health` won't load | App crashed on boot | Deployments → latest → View Logs, read the red line. Usually a misspelled variable. |
| `/health` shows `"db":"down"` | Database variables wrong | Recheck the 5 `DB_*` variables reference your MariaDB service. |
| Test message doesn't reach Discord | Wrong/blank webhook URL | Recopy the webhook from Discord into the matching Railway variable. |
| `401 unauthorized` | Token mismatch | Make the token in your request/SAT exactly match `API_TOKEN` in Railway. |
| Game events not showing | SAT URL/token wrong, or server not restarted | Verify SAT points to `URL/events` with the right token; restart the server. |
| Some events show but not others | That category has no webhook | Add the missing `DISCORD_WEBHOOK_*` variable, or rely on `DEFAULT`. |

When stuck, the **Railway Deployments → View Logs** screen is your best friend —
the program writes a clear line explaining what's wrong.
