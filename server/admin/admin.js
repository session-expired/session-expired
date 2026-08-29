const express = require("express");

function validId(value) {
  return /^[1-9]\d*$/.test(String(value));
}

function createRequireAdmin(pool) {
  return async function requireAdmin(request, response, next) {
    if (!request.session.userId) {
      if (request.originalUrl.startsWith("/api/")) return response.status(401).json({ error: "Please log in." });
      return response.redirect(`/login?returnTo=${encodeURIComponent(request.originalUrl)}`);
    }
    try {
      const result = await pool.query(
        `SELECT u.role, EXISTS (
           SELECT 1 FROM bans b WHERE b.user_id = u.id
           AND (b.expires_at IS NULL OR b.expires_at > CURRENT_TIMESTAMP)
         ) AS banned FROM users u WHERE u.id = $1`,
        [request.session.userId]
      );
      if (!result.rows[0]) return response.status(401).json({ error: "Please log in." });
      if (result.rows[0].banned) return response.status(403).json({ error: "This account is banned." });
      if (result.rows[0].role !== "admin") return response.status(403).json({ error: "Administrator access required." });
      next();
    } catch (error) { next(error); }
  };
}

function createAdminRouter({ pool, io }) {
  const router = express.Router();

  router.get("/users", async (request, response, next) => {
    try {
      const sockets = await io.fetchSockets();
      const connections = new Map();
      for (const socket of sockets) {
        const id = socket.request.session?.userId;
        if (id) connections.set(String(id), (connections.get(String(id)) || 0) + 1);
      }
      if (!connections.size) return response.json({ users: [] });
      const result = await pool.query(
        `SELECT u.id, u.username, u.role, l.id AS lobby_id, l.name AS lobby_name, g.id AS game_id
         FROM users u
         LEFT JOIN lobby_players lp ON lp.user_id = u.id
         LEFT JOIN lobbies l ON l.id = lp.lobby_id
         LEFT JOIN games g ON g.lobby_id = l.id
         WHERE u.id = ANY($1::bigint[]) ORDER BY LOWER(u.username)`,
        [[...connections.keys()]]
      );
      response.json({ users: result.rows.map((user) => ({ ...user, connectionCount: connections.get(String(user.id)) })) });
    } catch (error) { next(error); }
  });

  router.get("/bans", async (request, response, next) => {
    try {
      const result = await pool.query(
        `SELECT b.id, b.user_id, target.username, b.reason, b.created_at, b.expires_at,
                admin.username AS banned_by
         FROM bans b JOIN users target ON target.id = b.user_id
         JOIN users admin ON admin.id = b.banned_by
         WHERE b.expires_at IS NULL OR b.expires_at > CURRENT_TIMESTAMP
         ORDER BY b.created_at DESC`
      );
      response.json({ bans: result.rows });
    } catch (error) { next(error); }
  });

  router.get("/messages", async (request, response, next) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
    const before = validId(request.query.before) ? request.query.before : null;
    try {
      const result = await pool.query(
        `SELECT m.id, m.message_text AS message, m.sent_at, m.channel, m.lobby_id, m.game_id,
                u.id AS user_id, u.username
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE ($1::bigint IS NULL OR m.id < $1)
         ORDER BY m.id DESC LIMIT $2`,
        [before, limit]
      );
      response.json({ messages: result.rows, nextBefore: result.rowCount === limit ? result.rows.at(-1).id : null });
    } catch (error) { next(error); }
  });

  router.get("/actions", async (request, response, next) => {
    try {
      const result = await pool.query(
        `SELECT aa.id, aa.action, aa.details, aa.created_at,
                admin.username AS admin, target.username AS target
         FROM admin_actions aa JOIN users admin ON admin.id = aa.admin_user_id
         JOIN users target ON target.id = aa.target_user_id
         ORDER BY aa.created_at DESC LIMIT 50`
      );
      response.json({ actions: result.rows });
    } catch (error) { next(error); }
  });

  router.post("/users/:id/kick", async (request, response, next) => {
    if (!validId(request.params.id)) return response.status(404).json({ error: "User not found." });
    if (String(request.params.id) === String(request.session.userId)) return response.status(400).json({ error: "You cannot kick yourself." });
    try {
      const target = await pool.query("SELECT username FROM users WHERE id = $1", [request.params.id]);
      if (!target.rowCount) return response.status(404).json({ error: "User not found." });
      const sockets = await io.in(`user:${request.params.id}`).fetchSockets();
      await pool.query(
        "INSERT INTO admin_actions (admin_user_id, target_user_id, action, details) VALUES ($1, $2, 'kick', $3)",
        [request.session.userId, request.params.id, `${sockets.length} connection(s) disconnected`]
      );
      io.in(`user:${request.params.id}`).disconnectSockets(true);
      response.json({ ok: true, disconnected: sockets.length, username: target.rows[0].username });
    } catch (error) { next(error); }
  });

  router.post("/users/:id/ban", async (request, response, next) => {
    if (!validId(request.params.id)) return response.status(404).json({ error: "User not found." });
    if (String(request.params.id) === String(request.session.userId)) return response.status(400).json({ error: "You cannot ban yourself." });
    const reason = typeof request.body.reason === "string" ? request.body.reason.trim().slice(0, 500) : "";
    const hours = [1, 24, 168].includes(Number(request.body.durationHours)) ? Number(request.body.durationHours) : null;
    let client;
    try {
      const target = await pool.query("SELECT username FROM users WHERE id = $1", [request.params.id]);
      if (!target.rowCount) return response.status(404).json({ error: "User not found." });
      client = await pool.connect();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO bans (user_id, banned_by, reason, expires_at)
         VALUES ($1, $2, $3, CASE WHEN $4::integer IS NULL THEN NULL ELSE CURRENT_TIMESTAMP + ($4 * INTERVAL '1 hour') END)
         ON CONFLICT (user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason,
           created_at = CURRENT_TIMESTAMP, expires_at = EXCLUDED.expires_at`,
        [request.params.id, request.session.userId, reason || null, hours]
      );
      await client.query(
        "INSERT INTO admin_actions (admin_user_id, target_user_id, action, details) VALUES ($1, $2, 'ban', $3)",
        [request.session.userId, request.params.id, reason || (hours ? `${hours} hour ban` : "Permanent ban")]
      );
      await client.query("COMMIT");
      io.in(`user:${request.params.id}`).disconnectSockets(true);
      response.json({ ok: true, username: target.rows[0].username });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally { client?.release(); }
  });

  router.post("/users/:id/unban", async (request, response, next) => {
    if (!validId(request.params.id)) return response.status(404).json({ error: "User not found." });
    try {
      const removed = await pool.query("DELETE FROM bans WHERE user_id = $1 RETURNING user_id", [request.params.id]);
      if (!removed.rowCount) return response.status(404).json({ error: "Active ban not found." });
      await pool.query(
        "INSERT INTO admin_actions (admin_user_id, target_user_id, action, details) VALUES ($1, $2, 'unban', NULL)",
        [request.session.userId, request.params.id]
      );
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createAdminRouter, createRequireAdmin };
