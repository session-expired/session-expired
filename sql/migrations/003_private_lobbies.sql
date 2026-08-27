ALTER TABLE lobbies
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS invite_token VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS lobbies_invite_token_unique
    ON lobbies (invite_token)
    WHERE invite_token IS NOT NULL;

ALTER TABLE lobbies DROP CONSTRAINT IF EXISTS lobbies_private_invite_check;
ALTER TABLE lobbies
    ADD CONSTRAINT lobbies_private_invite_check CHECK (
        (is_private = FALSE AND invite_token IS NULL)
        OR (is_private = TRUE AND invite_token IS NOT NULL)
    );
