-- TGZ Event API schema. Idempotent: safe to run on every boot. CREATE statements
-- use IF NOT EXISTS. The ALTER statements that add columns to already-existing
-- tables are allowed to fail harmlessly on re-run (migrate.js ignores
-- "duplicate column" errors), so upgrading an existing database just works.

-- Canonical player identity. SAT identifiers (BattlEye GUID / platform id) are
-- stable across name changes, so they are the key — name is just the latest seen.
CREATE TABLE IF NOT EXISTS players (
  player_id      VARCHAR(128) NOT NULL PRIMARY KEY,
  name           VARCHAR(128) NOT NULL,
  current_streak INT          NOT NULL DEFAULT 0,
  first_seen     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Raw event log. Every accepted event is stored verbatim so stats can be
-- recomputed/replayed and nothing is ever lost to a handler bug.
CREATE TABLE IF NOT EXISTS events (
  id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(64)  NOT NULL,
  payload     JSON         NOT NULL,
  received_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_type_time (type, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aggregated player stats, bucketed by period so day/week/month/all-time
-- leaderboards are one indexed table.
--   period_type: 'all' | 'day' | 'week' | 'month'
--   period_key : 'all' | '2026-06-14' | '2026-W24' | '2026-06'
CREATE TABLE IF NOT EXISTS player_stats (
  player_id        VARCHAR(128) NOT NULL,
  period_type      VARCHAR(8)   NOT NULL,
  period_key       VARCHAR(16)  NOT NULL,
  kills            INT          NOT NULL DEFAULT 0,
  deaths           INT          NOT NULL DEFAULT 0,
  teamkills        INT          NOT NULL DEFAULT 0,
  captures         INT          NOT NULL DEFAULT 0,
  headshots        INT          NOT NULL DEFAULT 0,
  sessions         INT          NOT NULL DEFAULT 0,
  longest_kill_m   INT          NOT NULL DEFAULT 0,
  kill_streak_best INT          NOT NULL DEFAULT 0,
  playtime_seconds BIGINT       NOT NULL DEFAULT 0,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, period_type, period_key),
  INDEX idx_stats_leaderboard (period_type, period_key, kills DESC),
  CONSTRAINT fk_stats_player FOREIGN KEY (player_id)
    REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-weapon kill tallies, bucketed the same way, for "deadliest weapon" boards.
CREATE TABLE IF NOT EXISTS weapon_stats (
  weapon      VARCHAR(96)  NOT NULL,
  period_type VARCHAR(8)   NOT NULL,
  period_key  VARCHAR(16)  NOT NULL,
  kills       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (weapon, period_type, period_key),
  INDEX idx_weapon_leaderboard (period_type, period_key, kills DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Small key/value store for scheduler bookkeeping (last leaderboard posted, etc).
CREATE TABLE IF NOT EXISTS meta (
  k          VARCHAR(64) NOT NULL PRIMARY KEY,
  v          VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Upgrade path for databases created before these columns existed. Each of these
-- is allowed to fail with "duplicate column" on a fresh DB — migrate.js ignores
-- that specific error so the schema converges either way.
ALTER TABLE players ADD COLUMN current_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN headshots INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN sessions INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN longest_kill_m INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN kill_streak_best INT NOT NULL DEFAULT 0;
