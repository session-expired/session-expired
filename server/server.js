require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const http = require("http");
const bcrypt = require("bcrypt");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "localhost";
const publicDirectory = path.join(__dirname, "..", "public");
const pageDirectory = path.join(__dirname, "pages");
const publicPageDirectory = path.join(publicDirectory, "pages");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. See .env.example.");
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(
  session({
    store: new pgSession({ pool, tableName: "user_sessions", createTableIfMissing: false }),
    name: "session_expired.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

function sendPage(name) {
  return (request, response) => response.sendFile(path.join(pageDirectory, name));
}

function requireAuthentication(request, response, next) {
  if (!request.session.userId) {
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
  response.sendFile(path.join(publicDirectory, "lobbyPage.html"));
});
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
    const result = await pool.query("SELECT username, email FROM users WHERE id = $1", [request.session.userId]);
    if (!result.rows[0]) {
      return request.session.destroy(() => response.json({ authenticated: false }));
    }
    response.json({ authenticated: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("session_expired.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true"
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

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("register-user", (userId) => socket.join(`user:${userId}`));
  socket.on("private-message", (message) => {
    const { senderId, recipientId, text } = message;
    if (!senderId || !recipientId || !text?.trim()) return;
    const savedMessage = { senderId, recipientId, text: text.trim(), sentAt: new Date().toISOString() };
    io.to(`user:${recipientId}`).emit("private-message", savedMessage);
    io.to(`user:${senderId}`).emit("private-message", savedMessage);
  });
  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

function startServer() {
  server.listen(port, hostname, () => console.log(`http://${hostname}:${port}`));
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, pool, startServer };
