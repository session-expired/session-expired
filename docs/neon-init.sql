-- Session Expired: Neon database initialization
--
-- Run this once against the intended Neon database using the Neon SQL Editor,
-- or with a direct (non-pooled) Neon connection:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/neon-init.sql
--
-- This script is non-destructive and can be run again safely. It creates only
-- missing tables and indexes; it does not delete or seed application data.

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

-- PostgreSQL-backed sessions used by connect-pg-simple.
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
    ON user_sessions (expire);

-- Existing private-message schema. Current live Socket.IO delivery does not
-- require this table, but creating it keeps the complete project schema ready.
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

COMMIT;
