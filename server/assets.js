require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  quiet: true
});

const path = require("path");
const fs = require("fs");
const express = require("express");

const app = express();
const port = Number(process.env.ASSETS_PORT) || 3001;
const hostname = process.env.HOST || "127.0.0.1";
const publicDirectory = path.join(__dirname, "..", "public");
const musicDirectory = path.join(publicDirectory, "assets", "audio", "music");
const supportedAudioExtensions = new Set([".mp3", ".ogg", ".wav", ".m4a", ".aac", ".flac", ".webm"]);

const musicFiles = fs.readdirSync(musicDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && supportedAudioExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

app.disable("x-powered-by");

function sendTester(request, response) {
  response.sendFile(path.join(publicDirectory, "pages", "assets_tester.html"));
}

app.get(["/", "/assets_tester.html"], sendTester);
app.get("/api/music", (request, response) => {
  response.json({ files: musicFiles });
});

// Keep this server deliberately narrow. These are the only directories the
// tester needs now, and /js/game leaves room for the future board test harness.
app.use("/assets", express.static(path.join(publicDirectory, "assets"), { fallthrough: false }));
app.use("/js/game", express.static(path.join(publicDirectory, "js", "game"), { fallthrough: false }));

app.use((request, response) => {
  response.status(404).type("text").send("Not found");
});

app.use((error, request, response, next) => {
  if (error.status === 404) {
    return response.status(404).type("text").send("Not found");
  }

  console.error(error);
  response.status(500).type("text").send("Asset test server error");
});

if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Asset tester: http://${hostname}:${port}`);
    console.log(`Music tracks: ${musicFiles.length}`);
  });
}

module.exports = { app, musicFiles };
