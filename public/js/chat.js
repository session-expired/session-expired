//This version has a security flaw, do not use in public release.
//The server is trusting senderID from the browser.
//User creation need to be written before further implementation.

const socket = io();

const currentUserId = 12;
const recipientId = 42;

const messageList = document.querySelector("#messages");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");

socket.emit("register-user", currentUserId);

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  socket.emit("private-message", {
    senderId: currentUserId,
    recipientId,
    text,
  });

  messageInput.value = "";
});

socket.on("private-message", (message) => {
  const belongsToConversation =
    (message.senderId === currentUserId &&
      message.recipientId === recipientId) ||
    (message.senderId === recipientId && message.recipientId === currentUserId);

  if (!belongsToConversation) {
    return;
  }

  const item = document.createElement("li");
  item.textContent = `${message.senderId}: ${message.text}`;
  messageList.appendChild(item);
});
