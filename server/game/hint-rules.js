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

function isAdjacentToArea(position, area) {
    const rowDistance = position.row < area.rows.start ? area.rows.start - position.row :
        position.row > area.rows.end ? position.row - area.rows.end : 0;
    const colDistance = position.col < area.cols.start ? area.cols.start - position.col :
        position.col > area.cols.end ? position.col - area.cols.end : 0;
    return rowDistance + colDistance === 1;
}

function discoverHint(state, playerId, hintId, catalog = hintCatalog) {
    if (state.status !== "active") throw new Error("This game has already finished.");
    if (String(state.turn.playerId) !== String(playerId)) {
        throw new Error("It is not this player's turn.");
    }
    if (state.turn.phase !== "moving" || state.turn.movementRemaining <= 0) {
        throw new Error("Roll and retain movement points before searching.");
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
    const searchItem = state.board.searchItems?.find(item => item.hintIds?.includes(hint.id));
    if (!searchItem) throw new Error("This hint is not active in this game.");
    const currentRoom = roomAtPosition(state, player.position);
    if (!currentRoom || currentRoom.id !== searchItem.roomId) {
        throw new Error("You can only search objects in your current room.");
    }
    if (!isAdjacentToArea(player.position, searchItem)) {
        throw new Error("You must be adjacent to the search item to discover its hint.");
    }
    if (!Array.isArray(player.discoveredHintIds)) player.discoveredHintIds = [];
    if (!Array.isArray(player.discoveredHints)) player.discoveredHints = [];
    const alreadyDiscovered = player.discoveredHintIds.includes(hint.id);
    if (!alreadyDiscovered) {
        player.discoveredHintIds.push(hint.id);
        player.discoveredHints.push({
            id: hint.id,
            category: hint.category,
            text: hint.text,
            excludes: hint.excludes,
            searchItemId: searchItem.id
        });
    }
    state.turn.movementRemaining = 0;
    state.turn.phase = "awaiting_end";
    return { hint, alreadyDiscovered };
}

module.exports = { hintCatalog, hintSupportsSolution, roomsForSolution, isAdjacentToArea, discoverHint };
