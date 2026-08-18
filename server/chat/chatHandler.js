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
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    const userId = socket.request.session?.userId;
    if (userId) {
      socket.join(`user:${userId}`);
      const cutoff = Date.now() - globalChatWindowMs;
      while (globalChatHistory[0] && Date.parse(globalChatHistory[0].sentAt) < cutoff) {
        globalChatHistory.shift();
      }
      socket.emit("global-history", globalChatHistory);
    }

    socket.on("global-message", async ({ text } = {}) => {
      if (!userId || typeof text !== "string" || !text.trim()) return;
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
      if (!userId || !Number.isInteger(targetId) || typeof text !== "string" || !text.trim()) return;
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
        io.to(`user:${targetId}`).emit("private-message", message);
        io.to(`user:${userId}`).emit("private-message", message);
      } catch (error) {
        console.error("Unable to send private message:", error);
      }
    });

    socket.on("error", (error) => console.error(`Socket ${socket.id} error:`, error));
    socket.on("disconnect", (reason) => console.log("Socket disconnected:", socket.id, reason));
  });
}

module.exports = { registerChatHandlers };
