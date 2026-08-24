const { spawnPoints } = require("./board-data");
const { finishPlayerTurn } = require("./turns");

function isAdjacent(firstPosition, secondPosition) {
    if (!firstPosition || !secondPosition) return false;
    return Math.abs(firstPosition.row - secondPosition.row) +
        Math.abs(firstPosition.col - secondPosition.col) === 1;
}

function moveToRandomSpawn(state, player, random = Math.random) {
    const occupied = new Set(state.players
        .filter(candidate => String(candidate.id) !== String(player.id))
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (state.warden?.position) occupied.add(`${state.warden.position.row},${state.warden.position.col}`);
    const available = spawnPoints.filter(position => !occupied.has(`${position.row},${position.col}`));
    if (!available.length) throw new Error("No starting point is available.");
    player.position = { ...available[Math.floor(random() * available.length)] };
    player.secretPassageCooldown = null;
}

function submitAccusation(state, playerId, accusation, random = Math.random) {
    if (state.status !== "active") throw new Error("This game has already finished.");
    if (String(state.turn.playerId) !== String(playerId) ||
        !["awaiting_roll", "moving", "awaiting_end"].includes(state.turn.phase)) {
        throw new Error("It is not this player's turn.");
    }
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("Player not found.");
    if (!player.canAccuse) throw new Error("This player cannot accuse again.");
    if (!isAdjacent(player.position, state.warden?.position)) {
        throw new Error("You must be adjacent to the Warden to make an accusation.");
    }
    const fields = ["killer", "victim", "room", "method"];
    if (fields.some(field => typeof accusation?.[field] !== "string")) {
        throw new Error("Choose a killer, victim, room, and method.");
    }
    const correct = fields.every(field =>
        accusation[field].trim().toLowerCase() === String(state.solution[field]).toLowerCase()
    );
    if (correct) {
        state.status = "finished";
        state.turn.phase = "finished";
        state.turn.playerId = null;
        state.turn.movementRemaining = 0;
        state.winner = { id: player.id, username: player.username, character: player.character };
    } else {
        moveToRandomSpawn(state, player, random);
        player.turnsToSkip = (player.turnsToSkip || 0) + 1;
        finishPlayerTurn(state, playerId, random);
    }
    return correct;
}

module.exports = { isAdjacent, moveToRandomSpawn, submitAccusation };
