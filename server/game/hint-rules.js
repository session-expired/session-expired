const hintCatalog = require("./hints.json");
const { rooms, roomAtPosition } = require("./board-data");

const solutionFieldByHintCategory = Object.freeze({
    murderer: "killer",
    victim: "victim",
    room: "room",
    method: "method"
});

function hintSupportsSolution(hint, solution) {
    const field = solutionFieldByHintCategory[hint.category];
    return Boolean(field) && hint.excludes !== solution[field];
}

function roomsForSolution(solution) {
    return rooms.map(room => ({
        ...room,
        hintIds: hintCatalog.hints
            .filter(hint => hint.roomId === room.id && hintSupportsSolution(hint, solution))
            .map(hint => hint.id)
    }));
}

function discoverHint(state, playerId, hintId, catalog = hintCatalog) {
    if (state.status !== "active") throw new Error("This game has already finished.");
    if (String(state.turn.playerId) !== String(playerId) ||
        !["awaiting_roll", "moving", "awaiting_end"].includes(state.turn.phase)) {
        throw new Error("It is not this player's turn.");
    }
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("Player not found.");
    const hint = catalog.hints.find(candidate => candidate.id === hintId);
    if (!hint) throw new Error("Hint not found.");
    if (!catalog.categories.includes(hint.category)) throw new Error("This hint has an invalid category.");
    if (!catalog.roomIds.includes(hint.roomId)) throw new Error("This hint has an invalid room.");
    if (hint.excludes && !hintSupportsSolution(hint, state.solution)) {
        throw new Error("This hint conflicts with the game's solution.");
    }
    const currentRoom = roomAtPosition(state, player.position);
    if (!currentRoom || currentRoom.id !== hint.roomId) {
        throw new Error("You must be in the hint's room to discover it.");
    }
    if (catalog === hintCatalog && !currentRoom.hintIds?.includes(hint.id)) {
        throw new Error("This hint is not active in this game.");
    }
    if (!Array.isArray(player.discoveredHintIds)) player.discoveredHintIds = [];
    const alreadyDiscovered = player.discoveredHintIds.includes(hint.id);
    if (!alreadyDiscovered) player.discoveredHintIds.push(hint.id);
    return { hint, alreadyDiscovered };
}

module.exports = { hintCatalog, hintSupportsSolution, roomsForSolution, discoverHint };
