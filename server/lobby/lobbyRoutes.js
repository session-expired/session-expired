const express = require("express");
const { createInitialGameState } = require("../game/board");
const { moderateChatMessage } = require("../chat/moderation");
const { characters, characterIds } = require("./characters");

function validId(value) {
  return /^[1-9]\d*$/.test(value);
}

const membershipError = "You are already in a lobby or game. Leave it before joining another.";

function createLobbyRouter({ pool, requireAuthentication, minimumPlayers = 2 }) {
  const router = express.Router();
  router.use(requireAuthentication);

  async function removeExpiredEmptyLobbies() {
    await pool.query(
      `DELETE FROM lobbies l
       WHERE l.status = 'waiting'
         AND l.empty_since <= CURRENT_TIMESTAMP - INTERVAL '5 seconds'
         AND NOT EXISTS (SELECT 1 FROM lobby_players lp WHERE lp.lobby_id = l.id)`
    );
  }

  const cleanupTimer = setInterval(() => {
    removeExpiredEmptyLobbies().catch((error) => console.error("Unable to clean up empty lobbies:", error));
  }, 1000);
  cleanupTimer.unref();

  router.get("/", async (request, response, next) => {
    try {
      await removeExpiredEmptyLobbies();
      const result = await pool.query(
        `SELECT l.id, l.name, l.max_players, l.created_at,
                u.username AS host_username,
                COUNT(lp.user_id)::integer AS player_count,
                BOOL_OR(lp.user_id = $1) AS joined
         FROM lobbies l
         JOIN users u ON u.id = l.host_id
         LEFT JOIN lobby_players lp ON lp.lobby_id = l.id
         WHERE l.status = 'waiting'
         GROUP BY l.id, u.username
         HAVING COUNT(lp.user_id) < l.max_players OR BOOL_OR(lp.user_id = $1)
         ORDER BY l.created_at ASC`,
        [request.session.userId]
      );
      response.json({ lobbies: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    if (name.length < 3 || name.length > 50) {
      return response.status(400).json({ error: "Lobby name must be between 3 and 50 characters." });
    }
    const moderation = moderateChatMessage(name);
    if (moderation.action === "block") {
      return response.status(400).json({ error: "That lobby name violates the chat rules." });
    }
    if (moderation.action === "flag") {
      console.warn("Lobby name moderation:", {
        action: "flag",
        userId: request.session.userId,
        reasons: moderation.reasons
      });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const existingMembership = await client.query(
        "SELECT 1 FROM lobby_players WHERE user_id = $1",
        [request.session.userId]
      );
      if (existingMembership.rowCount) {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: membershipError });
      }
      const lobby = await client.query(
        "INSERT INTO lobbies (host_id, name) VALUES ($1, $2) RETURNING id",
        [request.session.userId, name]
      );
      await client.query(
        "INSERT INTO lobby_players (lobby_id, user_id) VALUES ($1, $2)",
        [lobby.rows[0].id, request.session.userId]
      );
      await client.query("COMMIT");
      response.status(201).json({ lobbyId: lobby.rows[0].id });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      if (error.code === "23505" && error.constraint === "lobby_players_one_active_membership") {
        return response.status(409).json({ error: membershipError });
      }
      next(error);
    } finally {
      client?.release();
    }
  });

  router.get("/:lobbyId", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    try {
      const lobbyResult = await pool.query(
        `SELECT l.id, l.name, l.status, l.max_players, l.host_id,
                g.id AS game_id
         FROM lobbies l
         LEFT JOIN games g ON g.lobby_id = l.id
         WHERE l.id = $1`,
        [request.params.lobbyId]
      );
      if (!lobbyResult.rows[0]) return response.status(404).json({ error: "Lobby not found." });
      const players = await pool.query(
        `SELECT u.id, u.username, lp.selected_character, lp.joined_at
         FROM lobby_players lp
         JOIN users u ON u.id = lp.user_id
         WHERE lp.lobby_id = $1
         ORDER BY lp.joined_at, u.id`,
        [request.params.lobbyId]
      );
      response.json({
        lobby: lobbyResult.rows[0],
        players: players.rows,
        currentUserId: String(request.session.userId),
        minimumPlayers,
        characters
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:lobbyId/join", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const lobbyResult = await client.query(
        "SELECT status, max_players FROM lobbies WHERE id = $1 FOR UPDATE",
        [request.params.lobbyId]
      );
      const lobby = lobbyResult.rows[0];
      if (!lobby) {
        await client.query("ROLLBACK");
        return response.status(404).json({ error: "Lobby not found." });
      }
      if (lobby.status !== "waiting") {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "This lobby has already started." });
      }
      const existing = await client.query(
        "SELECT lobby_id FROM lobby_players WHERE user_id = $1",
        [request.session.userId]
      );
      if (existing.rowCount && String(existing.rows[0].lobby_id) !== String(request.params.lobbyId)) {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: membershipError });
      }
      if (!existing.rowCount) {
        const count = await client.query("SELECT COUNT(*)::integer AS count FROM lobby_players WHERE lobby_id = $1", [request.params.lobbyId]);
        if (count.rows[0].count >= lobby.max_players) {
          await client.query("ROLLBACK");
          return response.status(409).json({ error: "This lobby is full." });
        }
        await client.query(
          "INSERT INTO lobby_players (lobby_id, user_id) VALUES ($1, $2)",
          [request.params.lobbyId, request.session.userId]
        );
        await client.query("UPDATE lobbies SET empty_since = NULL WHERE id = $1", [request.params.lobbyId]);
      }
      await client.query("COMMIT");
      response.json({ ok: true });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      if (error.code === "23505" && error.constraint === "lobby_players_one_active_membership") {
        return response.status(409).json({ error: membershipError });
      }
      next(error);
    } finally {
      client?.release();
    }
  });

  router.post("/:lobbyId/leave", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT host_id, status FROM lobbies WHERE id = $1 FOR UPDATE",
        [request.params.lobbyId]
      );
      const lobby = result.rows[0];
      if (!lobby) {
        await client.query("ROLLBACK");
        return response.status(404).json({ error: "Lobby not found." });
      }
      if (lobby.status !== "waiting") {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "Use Quit Game after a lobby has started." });
      }
      const removed = await client.query(
        "DELETE FROM lobby_players WHERE lobby_id = $1 AND user_id = $2 RETURNING user_id",
        [request.params.lobbyId, request.session.userId]
      );
      if (!removed.rowCount) {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "You are not a member of this lobby." });
      }

      const remaining = await client.query(
        `SELECT user_id FROM lobby_players
         WHERE lobby_id = $1 ORDER BY joined_at, user_id LIMIT 1`,
        [request.params.lobbyId]
      );
      const becameEmpty = !remaining.rowCount;
      if (becameEmpty) {
        await client.query("UPDATE lobbies SET empty_since = CURRENT_TIMESTAMP WHERE id = $1", [request.params.lobbyId]);
      } else if (String(lobby.host_id) === String(request.session.userId)) {
        await client.query(
          "UPDATE lobbies SET host_id = $1, empty_since = NULL WHERE id = $2",
          [remaining.rows[0].user_id, request.params.lobbyId]
        );
      }
      await client.query("COMMIT");
      response.json({ ok: true, deletesInSeconds: becameEmpty ? 5 : null });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      next(error);
    } finally {
      client?.release();
    }
  });

  router.post("/:lobbyId/character", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    const character = typeof request.body.character === "string" ? request.body.character : "";
    if (!characterIds.has(character)) return response.status(400).json({ error: "Choose a valid character." });

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const lobby = await client.query(
        "SELECT status FROM lobbies WHERE id = $1 FOR UPDATE",
        [request.params.lobbyId]
      );
      if (!lobby.rows[0]) {
        await client.query("ROLLBACK");
        return response.status(404).json({ error: "Lobby not found." });
      }
      if (lobby.rows[0].status !== "waiting") {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "Characters cannot be changed after the game starts." });
      }
      const updated = await client.query(
        `UPDATE lobby_players SET selected_character = $1
         WHERE lobby_id = $2 AND user_id = $3 RETURNING user_id`,
        [character, request.params.lobbyId, request.session.userId]
      );
      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return response.status(403).json({ error: "Join this lobby before choosing a character." });
      }
      await client.query("COMMIT");
      response.json({ ok: true, character });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      if (error.code === "23505" && error.constraint === "lobby_players_unique_character") {
        return response.status(409).json({ error: "That character has already been chosen." });
      }
      next(error);
    } finally {
      client?.release();
    }
  });

  router.delete("/:lobbyId", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT host_id, status FROM lobbies WHERE id = $1 FOR UPDATE",
        [request.params.lobbyId]
      );
      const lobby = result.rows[0];
      if (!lobby) {
        await client.query("ROLLBACK");
        return response.status(404).json({ error: "Lobby not found." });
      }
      if (String(lobby.host_id) !== String(request.session.userId)) {
        await client.query("ROLLBACK");
        return response.status(403).json({ error: "Only the lobby creator can delete it." });
      }
      if (lobby.status !== "waiting") {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "A lobby cannot be deleted after its game starts." });
      }
      await client.query("DELETE FROM lobbies WHERE id = $1", [request.params.lobbyId]);
      await client.query("COMMIT");
      response.json({ ok: true });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      next(error);
    } finally {
      client?.release();
    }
  });

  router.post("/:lobbyId/start", async (request, response, next) => {
    if (!validId(request.params.lobbyId)) return response.status(404).json({ error: "Lobby not found." });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const lobbyResult = await client.query("SELECT id, name, host_id, status FROM lobbies WHERE id = $1 FOR UPDATE", [request.params.lobbyId]);
      const lobby = lobbyResult.rows[0];
      if (!lobby) {
        await client.query("ROLLBACK");
        return response.status(404).json({ error: "Lobby not found." });
      }
      if (String(lobby.host_id) !== String(request.session.userId)) {
        await client.query("ROLLBACK");
        return response.status(403).json({ error: "Only the lobby host can launch the game." });
      }
      if (lobby.status !== "waiting") {
        const existingGame = await client.query("SELECT id FROM games WHERE lobby_id = $1", [request.params.lobbyId]);
        await client.query("ROLLBACK");
        return response.json({ gameId: existingGame.rows[0]?.id });
      }
      const players = await client.query(
        `SELECT u.id, u.username, lp.selected_character FROM lobby_players lp
         JOIN users u ON u.id = lp.user_id
         WHERE lp.lobby_id = $1 ORDER BY lp.joined_at, u.id`,
        [request.params.lobbyId]
      );
      if (players.rowCount < minimumPlayers) {
        await client.query("ROLLBACK");
        return response.status(409).json({
          error: `At least ${minimumPlayers} player${minimumPlayers === 1 ? "" : "s"} ${minimumPlayers === 1 ? "is" : "are"} required to launch a game.`
        });
      }
      if (players.rows.some((player) => !player.selected_character)) {
        await client.query("ROLLBACK");
        return response.status(409).json({ error: "Every player must choose a character before the game starts." });
      }
      const state = createInitialGameState(players.rows, Math.random, lobby);
      const game = await client.query(
        "INSERT INTO games (lobby_id, state) VALUES ($1, $2::jsonb) RETURNING id",
        [request.params.lobbyId, JSON.stringify(state)]
      );
      await client.query("UPDATE lobbies SET status = 'started' WHERE id = $1", [request.params.lobbyId]);
      await client.query("COMMIT");
      response.status(201).json({ gameId: game.rows[0].id });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}

module.exports = { createLobbyRouter };
