CREATE TABLE IF NOT EXISTS bans (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by BIGINT NOT NULL REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS bans_one_active_per_user
    ON bans (user_id);

CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES users(id),
    target_user_id BIGINT NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('kick', 'ban', 'unban')),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions (created_at DESC);

ALTER TABLE messages ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'private';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS lobby_id BIGINT REFERENCES lobbies(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS game_id BIGINT REFERENCES games(id) ON DELETE SET NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE messages ADD CONSTRAINT messages_channel_check CHECK (channel IN ('global', 'private', 'game'));
CREATE INDEX IF NOT EXISTS messages_sent_idx ON messages (sent_at DESC, id DESC);
