const express = require("express");
const app = express();

const port = 3000;
const hostname = "localhost";

app.use(express.static("public"));

app.listen(port, hostname, () => {
  console.log(`http://${hostname}:${port}`);
});
