require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  quiet: true
});

const path = require("path");
const express = require("express");
const http = require("http");
const bcrypt = require("bcrypt");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const { Server } = require("socket.io");
const { registerChatHandlers } = require("./chat/chatHandler");
const { moderateUsername } = require("./chat/moderation");
const { createLobbyRouter } = require("./lobby/lobbyRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const globalChatHistory = [];
const globalChatWindowMs = 30 * 60 * 1000;
const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";
const hostname = process.env.HOST || "0.0.0.0";
const databaseSslEnabled = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === "true"
  : isProduction;
const secureCookies = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : isProduction;
const publicDirectory = path.join(__dirname, "..", "public");
const pageDirectory = path.join(__dirname, "pages");
const publicPageDirectory = path.join(publicDirectory, "pages");
const {
  rooms, spawnPoints, secretPass, rollMovementDie, movementPath, movePlayer,
  endPlayerTurn, completeWardenTurn, removePlayerFromGame, discoverHint, submitAccusation
} = require("./game/board");
const minimumLobbyPlayers = process.env.SESSION_EXPIRED_DEV_RUNNER === "true" ? 1 : 2;
const wardenPhaseMs = Number(process.env.WARDEN_PHASE_MS) || 1200;
const wardenTimers = new Map();


if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. See .env.example.");
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseSslEnabled ? { rejectUnauthorized: false } : false
});

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.get("/health", (request, response) => response.status(200).json({ status: "ok" }));
const sessionMiddleware = session({
    store: new pgSession({ pool, tableName: "user_sessions", createTableIfMissing: false }),
    name: "session_expired.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  });
app.use(sessionMiddleware);

function sendPage(name) {
  return (request, response) => response.sendFile(path.join(pageDirectory, name));
}

function requireAuthentication(request, response, next) {
  if (!request.session.userId) {
    if (request.path.startsWith("/api/") || request.originalUrl.startsWith("/api/")) {
      return response.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    return response.redirect("/login");
  }
  next();
}

app.get("/register", sendPage("register.html"));
app.get("/login", (request, response) => {
  if (request.session.userId) return response.redirect("/account");
  response.sendFile(path.join(publicPageDirectory, "login.html"));
});
app.get("/account", requireAuthentication, sendPage("account.html"));
app.get("/lobby", requireAuthentication, (request, response) => {
  response.sendFile(path.join(publicPageDirectory, "lobbyPage.html"));
});

function broadcastGameState(gameId, state) {
  io.to(`game:${gameId}`).emit("game-state", state);
}

function scheduleWardenCompletion(gameId) {
  const key = String(gameId);
  if (wardenTimers.has(key)) return;
  const timer = setTimeout(async () => {
    wardenTimers.delete(key);
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query("SELECT state FROM games WHERE id = $1 FOR UPDATE", [gameId]);
      const state = result.rows[0]?.state;
      if (!state || !completeWardenTurn(state)) {
        await client.query("ROLLBACK");
        return;
      }
      await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), gameId]);
      await client.query("COMMIT");
      broadcastGameState(gameId, state);
      if (state.turn.phase === "warden") scheduleWardenCompletion(gameId);
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Unable to complete Warden phase:", error);
    } finally {
      client?.release();
    }
  }, wardenPhaseMs);
  wardenTimers.set(key, timer);
}

function cancelWardenCompletion(gameId) {
  const key = String(gameId);
  const timer = wardenTimers.get(key);
  if (timer) clearTimeout(timer);
  wardenTimers.delete(key);
}
app.get("/lobbyPage.html", requireAuthentication, (request, response) => {
  response.redirect("/lobby");
});

app.post("/api/register", async (request, response, next) => {
  const username = typeof request.body.username === "string" ? request.body.username.trim() : "";
  const email = typeof request.body.email === "string" ? request.body.email.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const confirmPassword = typeof request.body.confirmPassword === "string" ? request.body.confirmPassword : "";
  const errors = {};

  if (!username) errors.username = "Username is required.";
  else if (username.length < 3 || username.length > 30) errors.username = "Username must be between 3 and 30 characters.";
  else if (!/^[A-Za-z0-9_-]+$/.test(username)) errors.username = "Username may contain only letters, numbers, underscores, and hyphens.";
  else if (moderateUsername(username).action === "block") errors.username = "That username is not allowed.";

  if (!email) errors.email = "Email address is required.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (!password) errors.password = "Password is required.";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  if (Object.keys(errors).length) return response.status(400).json({ errors });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      [username, email, passwordHash]
    );
    response.status(201).json({ ok: true, redirect: "/login?registered=1" });
  } catch (error) {
    if (error.code === "23505") {
      const fields = {
        users_username_lower_unique: "username",
        users_email_lower_unique: "email"
      };
      const field = fields[error.constraint];
      if (field) {
        return response.status(409).json({ errors: { [field]: `That ${field} is already registered.` } });
      }
    }
    next(error);
  }
});

app.post("/api/login", async (request, response, next) => {
  const identifier = typeof request.body.identifier === "string" ? request.body.identifier.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const invalidMessage = "Invalid username/email or password.";

  if (!identifier || !password) {
    return response.status(400).json({ errors: { form: invalidMessage } });
  }

  try {
    const result = await pool.query(
      "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1",
      [identifier]
    );
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) return response.status(401).json({ errors: { form: invalidMessage } });

    request.session.regenerate((error) => {
      if (error) return next(error);
      request.session.userId = user.id;
      request.session.save((saveError) => {
        if (saveError) return next(saveError);
        response.json({ ok: true, redirect: "/lobby" });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session", async (request, response, next) => {
  if (!request.session.userId) return response.json({ authenticated: false });
  try {
    const result = await pool.query(
      `SELECT u.username, u.email, active_game.id AS active_game_id
       FROM users u
       LEFT JOIN LATERAL (
         SELECT g.id
         FROM lobby_players lp
         JOIN lobbies l ON l.id = lp.lobby_id AND l.status = 'started'
         JOIN games g ON g.lobby_id = l.id
         WHERE lp.user_id = u.id
         LIMIT 1
       ) active_game ON TRUE
       WHERE u.id = $1`,
      [request.session.userId]
    );
    if (!result.rows[0]) {
      return request.session.destroy(() => response.json({ authenticated: false }));
    }
    const { active_game_id: activeGameId, ...user } = result.rows[0];
    response.json({
      authenticated: true,
      user,
      activeGame: activeGameId ? { id: String(activeGameId), url: `/game/${activeGameId}` } : null
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", requireAuthentication, async (request, response, next) => {
  try {
    const result = await pool.query(
      "SELECT id, username FROM users WHERE id <> $1 ORDER BY LOWER(username)",
      [request.session.userId]
    );
    response.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

app.use("/api/lobbies", createLobbyRouter({
  pool,
  requireAuthentication,
  minimumPlayers: minimumLobbyPlayers
}));

app.get("/game/:gameId", requireAuthentication, (request, response) => {
  response.sendFile(path.join(publicPageDirectory, "game.html"));
});

app.get("/api/games/:gameId", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) {
    return response.status(404).json({ error: "Game not found." });
  }
  try {
    const result = await pool.query(
      `SELECT g.id, g.state, g.created_at
       FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) return response.status(404).json({ error: "Game not found." });
    response.json({ game: result.rows[0], currentUserId: String(request.session.userId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/games/:gameId/roll", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) {
    return response.status(404).json({ error: "Game not found." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.state FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2
       FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }

    const state = result.rows[0].state;
    let roll;
    try {
      roll = rollMovementDie(state, request.session.userId);
    } catch (error) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: error.message });
    }
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query("COMMIT");
    broadcastGameState(request.params.gameId, state);
    response.json({ roll, state });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/games/:gameId/move", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) {
    return response.status(404).json({ error: "Game not found." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.state FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2
       FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }

    const state = result.rows[0].state;
    let cost;
    let path;
    try {
      path = movementPath(state, request.session.userId, request.body);
      cost = movePlayer(state, request.session.userId, request.body);
    } catch (error) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: error.message });
    }
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query("COMMIT");
    broadcastGameState(request.params.gameId, state);
    response.json({ cost, distance: path.length, path, state });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/games/:gameId/hints/:hintId", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) {
    return response.status(404).json({ error: "Game not found." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.state FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2
       FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }

    const state = result.rows[0].state;
    let discovery;
    try {
      discovery = discoverHint(state, request.session.userId, request.params.hintId);
    } catch (error) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: error.message });
    }
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query("COMMIT");
    broadcastGameState(request.params.gameId, state);
    response.json({ ...discovery, state });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/games/:gameId/end-turn", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) return response.status(404).json({ error: "Game not found." });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.state FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2 FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }
    const state = result.rows[0].state;
    let transition;
    try {
      transition = endPlayerTurn(state, request.session.userId);
    } catch (error) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: error.message });
    }
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query("COMMIT");
    broadcastGameState(request.params.gameId, state);
    if (transition.warden) scheduleWardenCompletion(request.params.gameId);
    response.json({ state });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/games/:gameId/accuse", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) return response.status(404).json({ error: "Game not found." });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.state FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2 FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }
    const state = result.rows[0].state;
    let correct;
    try {
      correct = submitAccusation(state, request.session.userId, request.body);
    } catch (error) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: error.message });
    }
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query("COMMIT");
    if (correct) cancelWardenCompletion(request.params.gameId);
    broadcastGameState(request.params.gameId, state);
    if (!correct && state.turn.phase === "warden") scheduleWardenCompletion(request.params.gameId);
    response.json({ correct, state });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/games/:gameId/quit", requireAuthentication, async (request, response, next) => {
  if (!/^[1-9]\d*$/.test(request.params.gameId)) {
    return response.status(404).json({ error: "Game not found." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT g.lobby_id, g.state
       FROM games g
       JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
       WHERE g.id = $1 AND lp.user_id = $2
       FOR UPDATE OF g`,
      [request.params.gameId, request.session.userId]
    );
    const game = result.rows[0];
    if (!game) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Game not found." });
    }

    const state = game.state;
    const transition = removePlayerFromGame(state, request.session.userId);
    await client.query("UPDATE games SET state = $1::jsonb WHERE id = $2", [JSON.stringify(state), request.params.gameId]);
    await client.query(
      "DELETE FROM lobby_players WHERE lobby_id = $1 AND user_id = $2",
      [game.lobby_id, request.session.userId]
    );
    await client.query("COMMIT");
    broadcastGameState(request.params.gameId, state);
    if (transition.warden) scheduleWardenCompletion(request.params.gameId);
    response.json({ ok: true, redirect: "/" });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    next(error);
  } finally {
    client?.release();
  }
});

//mss446
app.get("/api/board", requireAuthentication, (request, response) => {
  response.json({ rooms, spawnPoints, secretPass });
});

app.post("/api/logout", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("session_expired.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies
    });
    response.redirect(303, "/login");
  });
});

app.use(express.static(publicDirectory));

app.use((error, request, response, next) => {
  console.error(error);
  if (response.headersSent) return next(error);
  response.status(500).json({ errors: { form: "Something went wrong. Please try again." } });
});

io.engine.use(sessionMiddleware);
io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
});

registerChatHandlers({ io, pool, globalChatHistory, globalChatWindowMs });

async function startServer() {
  const interruptedWardens = await pool.query(
    "SELECT id FROM games WHERE state->>'status' = 'active' AND state->'turn'->>'phase' = 'warden'"
  );
  interruptedWardens.rows.forEach(game => scheduleWardenCompletion(game.id));
  return server.listen(port, hostname, () => console.log(`http://${hostname}:${port}`));
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, pool, startServer };
