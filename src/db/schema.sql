-- TGZ Event API schema. Idempotent: safe to run on every boot.

-- Canonical player identity. SAT identifiers (BattlEye GUID / platform id) are
-- stable across name changes, so they are the key — name is just the latest seen.
CREATE TABLE IF NOT EXISTS players (
  player_id   VARCHAR(128) NOT NULL PRIMARY KEY,
  name        VARCHAR(128) NOT NULL,
  first_seen  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

-- Aggregated stats, bucketed by period so all-time / weekly / monthly
-- leaderboards are a single indexed table instead of three.
--   period_type: 'all' | 'week' | 'month'
--   period_key : 'all' | ISO week '2026-W24' | month '2026-06'
CREATE TABLE IF NOT EXISTS player_stats (
  player_id        VARCHAR(128) NOT NULL,
  period_type      VARCHAR(8)   NOT NULL,
  period_key       VARCHAR(16)  NOT NULL,
  kills            INT          NOT NULL DEFAULT 0,
  deaths           INT          NOT NULL DEFAULT 0,
  teamkills        INT          NOT NULL DEFAULT 0,
  captures         INT          NOT NULL DEFAULT 0,
  playtime_seconds BIGINT       NOT NULL DEFAULT 0,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, period_type, period_key),
  INDEX idx_stats_leaderboard (period_type, period_key, kills DESC),
  CONSTRAINT fk_stats_player FOREIGN KEY (player_id)
    REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
