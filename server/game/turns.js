const { rooms, blockingAreaAt } = require("./board-data");
const { movementDistances } = require("./movement");

function rollMovementDie(state, playerId, random = Math.random) {
    if (!state.turn || state.turn.phase !== "awaiting_roll") {
        throw new Error("The movement die has already been rolled for this turn.");
    }
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    const roll = Math.floor(random() * 8) + 1;
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    state.turn.phase = "moving";
    state.turn.die = { sides: 8, roll };
    state.turn.movementRemaining = roll;
    state.turn.visitedPositions = player?.position ? [{ ...player.position }] : [];
    return roll;
}

function takeWardenTurn(state, random = Math.random) {
    const office = (state.board.rooms || rooms).find(room => room.name === "Wardens_office");
    const roll = Math.floor(random() * 4) + 1;
    const start = { ...state.warden.position };
    const forbidden = new Set(state.players.map(player => `${player.position.row},${player.position.col}`));
    if (state.warden.previousPosition) {
        forbidden.add(`${state.warden.previousPosition.row},${state.warden.previousPosition.col}`);
    }
    for (let row = office.rows.start; row <= office.rows.end; row++) {
        for (let col = office.cols.start; col <= office.cols.end; col++) {
            if (blockingAreaAt(state, { row, col })) forbidden.add(`${row},${col}`);
        }
    }
    forbidden.add(`${office.doors.row},${office.doors.col}`);
    const visited = new Set([`${start.row},${start.col}`]);
    const path = [];
    let current = start;
    for (let step = 0; step < roll; step++) {
        const choices = [[-1, 0], [1, 0], [0, -1], [0, 1]]
            .map(([rowOffset, colOffset]) => ({ row: current.row + rowOffset, col: current.col + colOffset }))
            .filter(tile => tile.row >= office.rows.start && tile.row <= office.rows.end &&
                tile.col >= office.cols.start && tile.col <= office.cols.end &&
                !forbidden.has(`${tile.row},${tile.col}`) && !visited.has(`${tile.row},${tile.col}`));
        if (!choices.length) break;
        current = choices[Math.floor(random() * choices.length)];
        visited.add(`${current.row},${current.col}`);
        path.push({ ...current });
    }
    state.warden.previousPosition = start;
    state.warden.position = path.length ? { ...path[path.length - 1] } : start;
    if (state.warden.position.col < start.col) state.warden.facing = "left";
    else if (state.warden.position.col > start.col) state.warden.facing = "right";
    state.warden.lastRoll = roll;
    state.warden.lastPath = path;
    state.warden.turnsTaken = (state.warden.turnsTaken || 0) + 1;
    state.fullRounds = (state.fullRounds || 0) + 1;
    return path;
}

function activateTurn(state, index) {
    const playerId = state.turn.order[index];
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("The next player is no longer in this game.");
    player.secretPassageCooldown = null;
    Object.assign(state.turn, {
        playerIndex: index, playerId: player.id, number: state.turn.number + 1,
        phase: "awaiting_roll", die: { sides: 8, roll: null }, movementRemaining: 0,
        visitedPositions: []
    });
}

function activateNextEligibleTurn(state, startIndex, random = Math.random) {
    for (let index = startIndex; index < state.turn.order.length; index++) {
        const player = state.players.find(candidate => String(candidate.id) === String(state.turn.order[index]));
        if (!player) continue;
        if ((player.turnsToSkip || 0) > 0) {
            player.turnsToSkip -= 1;
            continue;
        }
        activateTurn(state, index);
        return { warden: false };
    }
    state.turn.playerId = null;
    state.turn.movementRemaining = 0;
    state.turn.phase = "warden";
    takeWardenTurn(state, random);
    return { warden: true };
}

function finishPlayerTurn(state, playerId, random = Math.random) {
    if (state.status !== "active" || state.turn.phase === "finished") {
        throw new Error("This game has already finished.");
    }
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    const completedIndex = state.turn.playerIndex;
    state.turn.playerId = null;
    state.turn.movementRemaining = 0;
    return activateNextEligibleTurn(state, completedIndex + 1, random);
}

function endPlayerTurn(state, playerId, random = Math.random) {
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    const usedAllMovement = state.turn.phase === "awaiting_end" && state.turn.movementRemaining === 0;
    const hasNoLegalMoves = state.turn.phase === "moving" && movementDistances(state, playerId).size === 0;
    if (!usedAllMovement && !hasNoLegalMoves) throw new Error("Use all movement points before ending your turn.");
    if (hasNoLegalMoves) {
        state.turn.phase = "awaiting_end";
        state.turn.movementRemaining = 0;
    }
    return finishPlayerTurn(state, playerId, random);
}

function completeWardenTurn(state, random = Math.random) {
    if (state.status !== "active" || state.turn.phase !== "warden" || state.turn.playerId !== null) return false;
    state.turn.round += 1;
    activateNextEligibleTurn(state, 0, random);
    return true;
}

function removePlayerFromGame(state, playerId, random = Math.random) {
    const id = String(playerId);
    const removedIndex = state.turn.order.findIndex(candidate => String(candidate) === id);
    const wasCurrent = String(state.turn.playerId) === id;
    state.players = state.players.filter(player => String(player.id) !== id);
    if (removedIndex < 0) return { warden: false };
    state.turn.order.splice(removedIndex, 1);
    if (!state.turn.order.length) {
        state.status = "finished";
        state.turn.phase = "finished";
        state.turn.playerId = null;
        return { warden: false };
    }
    if (!wasCurrent) {
        if (removedIndex < state.turn.playerIndex) state.turn.playerIndex -= 1;
        return { warden: false };
    }
    state.turn.playerId = null;
    state.turn.movementRemaining = 0;
    if (removedIndex >= state.turn.order.length) {
        state.turn.playerIndex = state.turn.order.length - 1;
        state.turn.phase = "warden";
        takeWardenTurn(state, random);
        return { warden: true };
    }
    return activateNextEligibleTurn(state, removedIndex, random);
}

module.exports = {
    rollMovementDie, takeWardenTurn, finishPlayerTurn, endPlayerTurn,
    completeWardenTurn, removePlayerFromGame
};
