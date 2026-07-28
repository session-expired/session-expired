//This is only intended as the entry point to start the project

const express = require("express");
const http = require("http");
const { server } = require(socket.io);

const app = express();
const port = 3000;
const hostname = "localhost";
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("register-user", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their private room`);
  });

  socket.on("private-message", async (message) => {
    const { senderId, recipientId, text } = message;

    if (!senderId || !recipientId || !text?.trim()) {
      return;
    }

    const savedMessage = {
      senderId,
      recipientId,
      text: text.trim(),
      sentAt: new Date().toISOString()
    };

    // Save savedMessage to SQL here.

    io.to(`user:${recipientId}`).emit(
      "private-message",
      savedMessage
    );

    // Send back to the sender.
    io.to(`user:${senderId}`).emit(
      "private-message",
      savedMessage
    );
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});



app.listen(port, hostname, () => {
  console.log(`http://${hostname}:${port}`);
});
