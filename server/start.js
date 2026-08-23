// Normal application startup must never reset or seed the database. Development
// fixtures are intentionally confined to server/dev.js.
const { startServer } = require("./server");

startServer();
