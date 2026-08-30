require("dotenv").config({ quiet: true });

// This flag is set only by the npm run dev entry point. The normal server entry
// point never enables the single-player testing exception.
process.env.SESSION_EXPIRED_DEV_RUNNER = "true";

const { startServer } = require("./server");

startServer();
