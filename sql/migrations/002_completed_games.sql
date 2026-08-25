CREATE TABLE IF NOT EXISTS completed_games (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    lobby_id BIGINT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    lobby_name VARCHAR(50),
    winner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    full_rounds INTEGER NOT NULL CHECK (full_rounds >= 0),
    ended_at TIMESTAMPTZ NOT NULL,
    end_state JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS completed_games_winner_rounds_idx
    ON completed_games (winner_user_id, full_rounds, ended_at);
