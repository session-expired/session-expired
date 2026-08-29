const { moderateChatMessage } = require("./moderation");

const REJECTION = { reason: "This message violates the chat rules." };

function logModeration(action, channel, userId, result) {
  console.warn("Chat moderation:", {
    action,
    channel,
    userId,
    reasons: result.reasons
  });
}

function checkMessage(socket, channel, userId, text) {
  const result = moderateChatMessage(text);
  if (result.action === "flag") logModeration("flag", channel, userId, result);
  if (result.action === "block") {
    logModeration("block", channel, userId, result);
    socket.emit("chat-rejected", REJECTION);
    return false;
  }
  return true;
}

function registerChatHandlers({ io, pool, globalChatHistory, globalChatWindowMs }) {
  const gameChatHistories = new Map();

  async function isBanned(userId) {
    const result = await pool.query(
      `SELECT 1 FROM bans WHERE user_id = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1`,
      [userId]
    );
    return result.rowCount > 0;
  }

  async function mayParticipate(socket, userId) {
    if (!userId || await isBanned(userId)) {
      if (userId) socket.disconnect(true);
      return false;
    }
    return true;
  }

  function trimHistory(history) {
    const cutoff = Date.now() - globalChatWindowMs;
    while (history[0] && Date.parse(history[0].sentAt) < cutoff) history.shift();
  }

  io.on("connection", async (socket) => {
    console.log("Socket connected:", socket.id);
    const userId = socket.request.session?.userId;
    if (userId && await isBanned(userId)) return socket.disconnect(true);
    if (userId) {
      socket.join(`user:${userId}`);
      const cutoff = Date.now() - globalChatWindowMs;
      while (globalChatHistory[0] && Date.parse(globalChatHistory[0].sentAt) < cutoff) {
        globalChatHistory.shift();
      }
      socket.emit("global-history", globalChatHistory);
    }

    socket.on("global-message", async ({ text } = {}) => {
      if (!userId || typeof text !== "string" || !text.trim() || !await mayParticipate(socket, userId)) return;
      const cleanText = text.trim().slice(0, 500);
      if (!checkMessage(socket, "global", userId, cleanText)) return;

      try {
        const result = await pool.query("SELECT username FROM users WHERE id = $1", [userId]);
        if (!result.rows[0]) return;
        const message = {
          senderId: userId,
          sender: result.rows[0].username,
          text: cleanText,
          sentAt: new Date().toISOString()
        };
        await pool.query(
          "INSERT INTO messages (sender_id, recipient_id, message_text, channel) VALUES ($1, NULL, $2, 'global')",
          [userId, cleanText]
        );
        globalChatHistory.push(message);
        const cutoff = Date.now() - globalChatWindowMs;
        while (globalChatHistory[0] && Date.parse(globalChatHistory[0].sentAt) < cutoff) {
          globalChatHistory.shift();
        }
        io.emit("global-message", message);
      } catch (error) {
        console.error("Unable to send global message:", error);
      }
    });

    socket.on("private-message", async ({ recipientId, text } = {}) => {
      const targetId = Number(recipientId);
      if (!userId || !Number.isInteger(targetId) || typeof text !== "string" || !text.trim() || !await mayParticipate(socket, userId)) return;
      const cleanText = text.trim().slice(0, 500);
      if (!checkMessage(socket, "private", userId, cleanText)) return;

      try {
        const result = await pool.query("SELECT username FROM users WHERE id = $1", [userId]);
        if (!result.rows[0]) return;
        const message = {
          senderId: userId,
          sender: result.rows[0].username,
          recipientId: targetId,
          text: cleanText,
          sentAt: new Date().toISOString()
        };
        await pool.query(
          "INSERT INTO messages (sender_id, recipient_id, message_text, channel) VALUES ($1, $2, $3, 'private')",
          [userId, targetId, cleanText]
        );
        io.to(`user:${targetId}`).emit("private-message", message);
        io.to(`user:${userId}`).emit("private-message", message);
      } catch (error) {
        console.error("Unable to send private message:", error);
      }
    });

    socket.on("join-game-chat", async ({ gameId } = {}) => {
      const targetGameId = Number(gameId);
      if (!userId || !Number.isInteger(targetGameId) || targetGameId < 1 || !await mayParticipate(socket, userId)) return;
      try {
        const membership = await pool.query(
          `SELECT 1 FROM games g
           JOIN lobby_players lp ON lp.lobby_id = g.lobby_id
           WHERE g.id = $1 AND lp.user_id = $2`,
          [targetGameId, userId]
        );
        if (!membership.rowCount) return;
        socket.data.gameId = targetGameId;
        socket.join(`game:${targetGameId}`);
        const history = gameChatHistories.get(targetGameId) || [];
        trimHistory(history);
        gameChatHistories.set(targetGameId, history);
        socket.emit("game-chat-ready", { gameId: targetGameId });
        socket.emit("game-history", history);
      } catch (error) {
        console.error("Unable to join game chat:", error);
      }
    });

    socket.on("game-message", async ({ text } = {}) => {
      const gameId = socket.data.gameId;
      if (!userId || !gameId || typeof text !== "string" || !text.trim() || !await mayParticipate(socket, userId)) return;
      const cleanText = text.trim().slice(0, 500);
      if (!checkMessage(socket, "game", userId, cleanText)) return;

      try {
        const result = await pool.query("SELECT username FROM users WHERE id = $1", [userId]);
        if (!result.rows[0]) return;
        const message = {
          senderId: userId,
          sender: result.rows[0].username,
          text: cleanText,
          sentAt: new Date().toISOString()
        };
        await pool.query(
          `INSERT INTO messages (sender_id, recipient_id, message_text, channel, game_id, lobby_id)
           SELECT $1, NULL, $2, 'game', g.id, g.lobby_id FROM games g WHERE g.id = $3`,
          [userId, cleanText, gameId]
        );
        const history = gameChatHistories.get(gameId) || [];
        history.push(message);
        trimHistory(history);
        gameChatHistories.set(gameId, history);
        io.to(`game:${gameId}`).emit("game-message", message);
      } catch (error) {
        console.error("Unable to send game message:", error);
      }
    });

    socket.on("error", (error) => console.error(`Socket ${socket.id} error:`, error));
    socket.on("disconnect", (reason) => console.log("Socket disconnected:", socket.id, reason));
  });
}

module.exports = { registerChatHandlers };
