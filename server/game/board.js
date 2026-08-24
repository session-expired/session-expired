// Compatibility facade for the game subsystems. Existing callers can continue
// importing this module while each rule set has one focused implementation.
module.exports = {
    ...require("./board-data"),
    ...require("./solution"),
    ...require("./hint-rules"),
    ...require("./game-state"),
    ...require("./movement"),
    ...require("./turns"),
    ...require("./accusations")
};
