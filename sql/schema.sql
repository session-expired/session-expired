BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email));

-- PostgreSQL session table used by connect-pg-simple.
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
    ON user_sessions (expire);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES users(id),
    recipient_id BIGINT NOT NULL REFERENCES users(id),
    message_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_sender_sent_idx
    ON messages (sender_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS messages_recipient_sent_idx
    ON messages (recipient_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS lobbies (
    id BIGSERIAL PRIMARY KEY,
    host_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(50) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'started')),
    max_players SMALLINT NOT NULL DEFAULT 4
        CHECK (max_players BETWEEN 2 AND 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lobby_players (
    lobby_id BIGINT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lobby_id, user_id)
);

-- Older builds allowed a player to join several lobbies. Preserve one
-- membership, preferring a started game and then the most recent lobby.
WITH ranked_memberships AS (
    SELECT lp.lobby_id,
           lp.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY lp.user_id
               ORDER BY (l.status = 'started') DESC, lp.joined_at DESC, lp.lobby_id DESC
           ) AS membership_rank
    FROM lobby_players lp
    JOIN lobbies l ON l.id = lp.lobby_id
)
DELETE FROM lobby_players lp
USING ranked_memberships ranked
WHERE lp.lobby_id = ranked.lobby_id
  AND lp.user_id = ranked.user_id
  AND ranked.membership_rank > 1;

DROP INDEX IF EXISTS lobby_players_user_idx;

CREATE UNIQUE INDEX IF NOT EXISTS lobby_players_one_active_membership
    ON lobby_players (user_id);

CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    lobby_id BIGINT NOT NULL UNIQUE REFERENCES lobbies(id),
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
