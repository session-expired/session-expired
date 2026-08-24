const { rooms, secretPass } = require("./board-data");

function movementDistances(state, playerId) {
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("Player not found.");
    const blocked = new Set(state.players
        .filter(candidate => String(candidate.id) !== String(playerId))
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (state.warden?.position) blocked.add(`${state.warden.position.row},${state.warden.position.col}`);
    const startKey = `${player.position.row},${player.position.col}`;
    const visitedThisTurn = new Set((state.turn.visitedPositions || [])
        .map(position => `${position.row},${position.col}`));
    visitedThisTurn.delete(startKey);
    const distances = new Map([[startKey, 0]]);
    const previous = new Map();
    const queue = [{ ...player.position }];
    const stateRooms = state.board.rooms || rooms;
    const roomAt = (row, col) => stateRooms.find(room =>
        row >= room.rows.start && row <= room.rows.end && col >= room.cols.start && col <= room.cols.end
    );
    const isBlockedTile = (row, col) => {
        if (player.secretPassageCooldown?.row === row && player.secretPassageCooldown?.col === col) return true;
        return roomAt(row, col)?.blockedTile?.some(tile => tile.row === row && tile.col === col) || false;
    };
    const canCrossRoomBoundary = (from, to) => {
        const fromRoom = roomAt(from.row, from.col);
        const toRoom = roomAt(to.row, to.col);
        if (fromRoom === toRoom) return true;
        const leavesThroughDoor = fromRoom && from.row === fromRoom.doors.row && from.col === fromRoom.doors.col;
        const entersThroughDoor = toRoom && to.row === toRoom.doors.row && to.col === toRoom.doors.col;
        return Boolean(leavesThroughDoor || entersThroughDoor);
    };
    const entersDoorFromHallway = (from, to) => {
        const fromRoom = roomAt(from.row, from.col);
        const toRoom = roomAt(to.row, to.col);
        return !fromRoom && Boolean(toRoom && to.row === toRoom.doors.row && to.col === toRoom.doors.col);
    };

    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const distance = distances.get(`${current.row},${current.col}`);
        if (distance >= state.turn.movementRemaining) continue;
        for (const [rowOffset, colOffset] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const row = current.row + rowOffset;
            const col = current.col + colOffset;
            const key = `${row},${col}`;
            if (row < 1 || row > state.board.rows || col < 1 || col > state.board.cols) continue;
            if (blocked.has(key) || visitedThisTurn.has(key) || distances.has(key)) continue;
            if (isBlockedTile(row, col) || !canCrossRoomBoundary(current, { row, col })) continue;
            distances.set(key, distance + 1);
            previous.set(key, { ...current });
            if (!entersDoorFromHallway(current, { row, col })) queue.push({ row, col });
        }
    }
    distances.delete(startKey);
    distances.previous = previous;
    return distances;
}

function movementPath(state, playerId, destination) {
    const distances = movementDistances(state, playerId);
    if (!distances.has(`${destination?.row},${destination?.col}`)) return [];
    const path = [];
    let current = { row: destination.row, col: destination.col };
    while (current) {
        path.push(current);
        current = distances.previous.get(`${current.row},${current.col}`);
    }
    path.reverse();
    path.shift();
    return path;
}

function useSecretPassage(state, player, entry, random = Math.random) {
    if (!secretPass.some(tile => tile.row === entry.row && tile.col === entry.col)) return false;
    const destinations = secretPass.filter(tile => tile.row !== entry.row || tile.col !== entry.col);
    const destination = destinations[Math.floor(random() * destinations.length)];
    const occupied = new Set(state.players
        .filter(candidate => String(candidate.id) !== String(player.id))
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (state.warden?.position) occupied.add(`${state.warden.position.row},${state.warden.position.col}`);
    const stateRooms = state.board.rooms || rooms;
    const destinationRoom = stateRooms.find(room =>
        destination.row >= room.rows.start && destination.row <= room.rows.end &&
        destination.col >= room.cols.start && destination.col <= room.cols.end
    );
    const blockedByArt = tile => destinationRoom?.blockedTile?.some(blocked =>
        blocked.row === tile.row && blocked.col === tile.col
    );
    const isAvailable = tile => tile.row >= 1 && tile.row <= state.board.rows &&
        tile.col >= 1 && tile.col <= state.board.cols &&
        (!destinationRoom || (tile.row >= destinationRoom.rows.start && tile.row <= destinationRoom.rows.end &&
            tile.col >= destinationRoom.cols.start && tile.col <= destinationRoom.cols.end)) &&
        !occupied.has(`${tile.row},${tile.col}`) && !blockedByArt(tile);

    let arrival = destination;
    if (!isAvailable(arrival)) {
        const adjacent = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                if (rowOffset === 0 && colOffset === 0) continue;
                const tile = { row: destination.row + rowOffset, col: destination.col + colOffset };
                if (isAvailable(tile)) adjacent.push(tile);
            }
        }
        if (!adjacent.length) return false;
        arrival = adjacent[Math.floor(random() * adjacent.length)];
    }
    player.position = { ...arrival };
    player.secretPassageCooldown = { ...destination };
    player.dialogueEvent = "secret_passage_entry";
    player.dialogueEventId = (player.dialogueEventId || 0) + 1;
    return true;
}

function movePlayer(state, playerId, destination, random = Math.random) {
    if (!state.turn || state.turn.phase !== "moving") throw new Error("Roll the movement die before moving.");
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    if (!Number.isInteger(destination?.row) || !Number.isInteger(destination?.col)) {
        throw new Error("Choose a valid board location.");
    }
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    const distance = movementDistances(state, playerId).get(`${destination.row},${destination.col}`);
    if (distance === undefined) throw new Error("That location is outside the player's movement range.");
    const path = movementPath(state, playerId, destination);
    const stateRooms = state.board.rooms || rooms;
    const destinationRoom = stateRooms.find(room => destination.row >= room.rows.start &&
        destination.row <= room.rows.end && destination.col >= room.cols.start && destination.col <= room.cols.end);
    const startingRoom = stateRooms.find(room => player.position.row >= room.rows.start &&
        player.position.row <= room.rows.end && player.position.col >= room.cols.start && player.position.col <= room.cols.end);
    const entersDoor = !startingRoom && destinationRoom &&
        destination.row === destinationRoom.doors.row && destination.col === destinationRoom.doors.col;
    const cost = entersDoor ? state.turn.movementRemaining : distance;
    if (destination.col < player.position.col) player.facing = "left";
    else if (destination.col > player.position.col) player.facing = "right";
    player.position = { row: destination.row, col: destination.col };
    if (entersDoor) {
        if (destinationRoom.name === "Wardens_office") {
            state.warden.dialogueEvent = "enter";
            state.warden.dialogueEventId = (state.warden.dialogueEventId || 0) + 1;
        } else {
            player.dialogueEvent = "door_open";
            player.dialogueEventId = (player.dialogueEventId || 0) + 1;
        }
    }
    useSecretPassage(state, player, destination, random);
    if (!Array.isArray(state.turn.visitedPositions)) state.turn.visitedPositions = [];
    for (const position of path) {
        if (!state.turn.visitedPositions.some(visited => visited.row === position.row && visited.col === position.col)) {
            state.turn.visitedPositions.push({ ...position });
        }
    }
    if (!state.turn.visitedPositions.some(visited =>
        visited.row === player.position.row && visited.col === player.position.col
    )) state.turn.visitedPositions.push({ ...player.position });
    state.turn.movementRemaining -= cost;
    if (state.turn.movementRemaining === 0) state.turn.phase = "awaiting_end";
    return cost;
}

module.exports = { movementDistances, movementPath, movePlayer };
