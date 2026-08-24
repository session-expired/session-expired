const hintCatalog = require("./hints.json");

//Room object to hold the actual rooms and their dimensions/door location
class Room {
    constructor(id, name, cols, rows, doors, blockedTile = []) {
        this.id = id;
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.doors = doors;
        this.blockedTile = blockedTile;
        this.hintIds = hintCatalog.hints
            .filter(hint => hint.roomId === id)
            .map(hint => hint.id);
    }
}

//Array for the spawn locations
const spawnPoints = [
    {row: 2, col: 10}, {row: 2, col: 21},
    {row: 24, col: 10}, {row: 24, col: 21},
    {row: 9, col: 1}, {row: 9, col: 30},
    {row: 15, col: 1}, {row: 15, col: 30}
];

const secretPass = [
    {row:2, col: 23}, {row:23, col: 3},
    {row:2, col: 7}, {row:23, col: 28},
]

const { methods } = require("../../public/assets/methods.json");
const { rooms: roomOptions } = require("../../public/assets/rooms.json");
const { murderers } = require("../../public/assets/murderers.json");
const { victims } = require("../../public/assets/victims.json");

const solutionPools = Object.freeze({
    killers: murderers,
    victims,
    rooms: roomOptions.filter(room => room.canBeMurderScene),
    methods
});

function createSolution(random = Math.random) {
    const choose = options => options[Math.floor(random() * options.length)];
    return {
        killer: choose(solutionPools.killers).id,
        victim: choose(solutionPools.victims).id,
        room: choose(solutionPools.rooms).id,
        method: choose(solutionPools.methods).id
    };
}

const solutionFieldByHintCategory = Object.freeze({
    murderer: "killer",
    victim: "victim",
    room: "room",
    method: "method"
});

function hintSupportsSolution(hint, solution) {
    const solutionField = solutionFieldByHintCategory[hint.category];
    return Boolean(solutionField) && hint.excludes !== solution[solutionField];
}

function roomsForSolution(solution) {
    return rooms.map(room => ({
        ...room,
        hintIds: hintCatalog.hints
            .filter(hint => hint.roomId === room.id && hintSupportsSolution(hint, solution))
            .map(hint => hint.id)
    }));
}

//Initializing all rooms
let wardensOffice = new Room("wardens_office", "Wardens_office", {start: 12, end: 19}, {start: 8, end: 17}, {col: 19, row: 12});
let paddedCells = new Room("padded_cells", "Padded Cells", {start: 1, end: 9}, {start: 17, end: 24}, {col: 4, row: 17});
let cafeteria = new Room("cafeteria", "Cafeteria", {start: 22, end: 30},
    {start: 1, end: 7}, 
    {col: 28, row: 7},
[
    {row: 6, col: 23},
    {row: 7, col: 24}
]);
let operatingTheater = new Room("operating_theater", "Operating Theater", {start: 22, end: 30}, {start: 17, end: 24}, {col: 25, row: 17});
let recRoom = new Room("rec_room", "Rec Room", {start: 1, end: 9}, {start: 1, end: 7}, {col: 7, row: 7});
let showers = new Room("showers", "Showers", {start: 12, end: 19}, {start: 20, end: 24}, {col: 15, row: 20});
let solitaryConfinement = new Room("solitary_confinement", "Solitary Confinement", {start: 12, end: 19}, {start: 1, end: 5}, {col: 16, row: 5});
let hydrotherapy = new Room("hydrotherapy", "Hydrotherapy", {start: 23, end: 30}, {start: 10, end: 14}, {col: 25, row: 10});
let electrotherapy = new Room("electrotherapy", "Electrotherapy", {start: 1, end: 8}, {start: 10, end: 14}, {col: 7, row: 14});



//Array of rooms to easily access their dimensions
const rooms = [wardensOffice, paddedCells, cafeteria, operatingTheater, recRoom, showers,
    solitaryConfinement, hydrotherapy, electrotherapy];

//Tells you if you're in a room, if not, you're in a hallway
function getSquareType(row, col) {
    for (let room of rooms) {
        let inRows = row >= room.rows.start && row <= room.rows.end;
        let inCols = col >= room.cols.start && col <= room.cols.end;

        if (inRows && inCols) {
            if (row == room.doors.row && col == room.doors.col) {
                return "door";
            }
            return "room";
        }
    }
    return "hallway";
}

function shuffledSpawnPoints(random = Math.random) {
    const availableSpawnPoints = spawnPoints.map(point => ({ ...point }));

    for (let index = availableSpawnPoints.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [availableSpawnPoints[index], availableSpawnPoints[swapIndex]] =
            [availableSpawnPoints[swapIndex], availableSpawnPoints[index]];
    }

    return availableSpawnPoints;
}

function shuffledPlayerIds(players, random = Math.random) {
    const ids = players.map(player => String(player.id));
    for (let index = ids.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    return ids;
}

function createInitialGameState(gamePlayers, random = Math.random, lobby = {}) {
    if (gamePlayers.length > spawnPoints.length) {
        throw new Error("There are more players than available spawn points.");
    }

    const availableSpawnPoints = shuffledSpawnPoints(random);
    const solution = createSolution(random);

    const players = gamePlayers.map((player, index) => ({
        id: String(player.id),
        username: player.username,
        character: player.selected_character,
        canAccuse: true,
        turnsToSkip: 0,
        discoveredHintIds: [],
        position: availableSpawnPoints[index],
        facing: "right",
        dialogueEvent: null,
        dialogueEventId: 0,
        secretPassageCooldown: null
    }));
    const turnOrder = shuffledPlayerIds(players, random);

    return {
        lobbyId: lobby.id == null ? null : String(lobby.id),
        lobbyName: lobby.name ?? null,
        status: "active",
        board: {
            rows: 24,
            cols: 30,
            rooms: roomsForSolution(solution)
        },
        players,
        warden: {
            character: "bonaparte",
            position: { row: 13, col: 13 },
            previousPosition: null,
            lastRoll: null,
            lastPath: [],
            turnsTaken: 0,
            dialogueEvent: null,
            dialogueEventId: 0,
            facing: "right"
        },
        turn: {
            number: 1,
            round: 1,
            order: turnOrder,
            playerIndex: 0,
            playerId: turnOrder[0] ?? null,
            phase: "awaiting_roll",
            die: { sides: 8, roll: null },
            movementRemaining: 0,
            visitedPositions: []
        },
        solution,
        winner: null,
        createdAt: Date.now()
    };
}

function rollMovementDie(state, playerId, random = Math.random) {
    if (!state.turn || state.turn.phase !== "awaiting_roll") {
        throw new Error("The movement die has already been rolled for this turn.");
    }
    if (String(state.turn.playerId) !== String(playerId)) {
        throw new Error("It is not this player's turn.");
    }

    const roll = Math.floor(random() * 8) + 1;
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    state.turn.phase = "moving";
    state.turn.die = { sides: 8, roll };
    state.turn.movementRemaining = roll;
    state.turn.visitedPositions = player?.position ? [{ ...player.position }] : [];
    return roll;
}

function movementDistances(state, playerId) {
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("Player not found.");

    const blocked = new Set(state.players
        .filter(candidate => String(candidate.id) !== String(playerId))
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (state.warden?.position) {
        blocked.add(`${state.warden.position.row},${state.warden.position.col}`);
    }
    const startKey = `${player.position.row},${player.position.col}`;
    const visitedThisTurn = new Set((state.turn.visitedPositions || [])
        .map(position => `${position.row},${position.col}`));
    visitedThisTurn.delete(startKey);
    const distances = new Map([[startKey, 0]]);
    const previous = new Map();
    const queue = [{ ...player.position }];

    const stateRooms = state.board.rooms || rooms;

    function roomAt(row, col) {
        return stateRooms.find(room =>
            row >= room.rows.start && row <= room.rows.end &&
            col >= room.cols.start && col <= room.cols.end
        );
    }

    function isBlockedTile(row, col) {
        if (player.secretPassageCooldown?.row === row && player.secretPassageCooldown?.col === col) {
            return true;
        }
        const room = roomAt(row, col);
        return room?.blockedTile?.some(tile => tile.row === row && tile.col === col) || false;
    }

    function canCrossRoomBoundary(from, to) {
        const fromRoom = roomAt(from.row, from.col);
        const toRoom = roomAt(to.row, to.col);
        if (fromRoom === toRoom) return true;
        const leavesThroughDoor = fromRoom && from.row === fromRoom.doors.row && from.col === fromRoom.doors.col;
        const entersThroughDoor = toRoom && to.row === toRoom.doors.row && to.col === toRoom.doors.col;
        return Boolean(leavesThroughDoor || entersThroughDoor);
    }

    function entersDoorFromHallway(from, to) {
        const fromRoom = roomAt(from.row, from.col);
        const toRoom = roomAt(to.row, to.col);
        return !fromRoom && Boolean(
            toRoom && to.row === toRoom.doors.row && to.col === toRoom.doors.col
        );
    }

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
            if (isBlockedTile(row, col)) continue;
            if (!canCrossRoomBoundary(current, { row, col })) continue;
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
    const destinationKey = `${destination?.row},${destination?.col}`;
    const distances = movementDistances(state, playerId);
    if (!distances.has(destinationKey)) return [];

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

function takeWardenTurn(state, random = Math.random) {
    const office = (state.board.rooms || rooms).find(room => room.name === "Wardens_office");
    const roll = Math.floor(random() * 4) + 1;
    const start = { ...state.warden.position };
    const forbidden = new Set(state.players.map(player => `${player.position.row},${player.position.col}`));
    if (state.warden.previousPosition) {
        forbidden.add(`${state.warden.previousPosition.row},${state.warden.previousPosition.col}`);
    }
    for (const tile of office.blockedTile || []) forbidden.add(`${tile.row},${tile.col}`);
    forbidden.add(`${office.doors.row},${office.doors.col}`);

    const visited = new Set([`${start.row},${start.col}`]);
    const path = [];
    let current = start;
    for (let step = 0; step < roll; step++) {
        const choices = [[-1, 0], [1, 0], [0, -1], [0, 1]]
            .map(([rowOffset, colOffset]) => ({
                row: current.row + rowOffset,
                col: current.col + colOffset
            }))
            .filter(tile =>
                tile.row >= office.rows.start && tile.row <= office.rows.end &&
                tile.col >= office.cols.start && tile.col <= office.cols.end &&
                !forbidden.has(`${tile.row},${tile.col}`) &&
                !visited.has(`${tile.row},${tile.col}`)
            );
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
    return path;
}

function activateTurn(state, index) {
    const playerId = state.turn.order[index];
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("The next player is no longer in this game.");
    player.secretPassageCooldown = null;
    state.turn.playerIndex = index;
    state.turn.playerId = player.id;
    state.turn.number += 1;
    state.turn.phase = "awaiting_roll";
    state.turn.die = { sides: 8, roll: null };
    state.turn.movementRemaining = 0;
    state.turn.visitedPositions = [];
}

function activateNextEligibleTurn(state, startIndex, random = Math.random) {
    for (let index = startIndex; index < state.turn.order.length; index++) {
        const playerId = state.turn.order[index];
        const player = state.players.find(candidate => String(candidate.id) === String(playerId));
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
    if (String(state.turn.playerId) !== String(playerId)) {
        throw new Error("It is not this player's turn.");
    }
    const completedIndex = state.turn.playerIndex;
    state.turn.playerId = null;
    state.turn.movementRemaining = 0;
    return activateNextEligibleTurn(state, completedIndex + 1, random);
}

function endPlayerTurn(state, playerId, random = Math.random) {
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    const usedAllMovement = state.turn.phase === "awaiting_end" && state.turn.movementRemaining === 0;
    const hasNoLegalMoves = state.turn.phase === "moving" && movementDistances(state, playerId).size === 0;
    if (!usedAllMovement && !hasNoLegalMoves) {
        throw new Error("Use all movement points before ending your turn.");
    }
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

function isAdjacent(firstPosition, secondPosition) {
    if (!firstPosition || !secondPosition) return false;
    return Math.abs(firstPosition.row - secondPosition.row) +
        Math.abs(firstPosition.col - secondPosition.col) === 1;
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
    const isAvailable = tile =>
        tile.row >= 1 && tile.row <= state.board.rows &&
        tile.col >= 1 && tile.col <= state.board.cols &&
        (!destinationRoom || (
            tile.row >= destinationRoom.rows.start && tile.row <= destinationRoom.rows.end &&
            tile.col >= destinationRoom.cols.start && tile.col <= destinationRoom.cols.end
        )) &&
        !occupied.has(`${tile.row},${tile.col}`) &&
        !blockedByArt(tile);

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
    if (!state.turn || state.turn.phase !== "moving") {
        throw new Error("Roll the movement die before moving.");
    }
    if (String(state.turn.playerId) !== String(playerId)) {
        throw new Error("It is not this player's turn.");
    }
    if (!Number.isInteger(destination?.row) || !Number.isInteger(destination?.col)) {
        throw new Error("Choose a valid board location.");
    }

    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    const distance = movementDistances(state, playerId).get(`${destination.row},${destination.col}`);
    if (distance === undefined) throw new Error("That location is outside the player's movement range.");
    const path = movementPath(state, playerId, destination);

    const destinationRoom = (state.board.rooms || rooms).find(room =>
        destination.row >= room.rows.start && destination.row <= room.rows.end &&
        destination.col >= room.cols.start && destination.col <= room.cols.end
    );
    const startingRoom = (state.board.rooms || rooms).find(room =>
        player.position.row >= room.rows.start && player.position.row <= room.rows.end &&
        player.position.col >= room.cols.start && player.position.col <= room.cols.end
    );
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

function roomAtPosition(state, position) {
    return state.board.rooms.find(room =>
        position.row >= room.rows.start && position.row <= room.rows.end &&
        position.col >= room.cols.start && position.col <= room.cols.end
    );
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
        state.winner = {
            id: player.id,
            username: player.username,
            character: player.character
        };
    } else {
        moveToRandomSpawn(state, player, random);
        player.turnsToSkip = (player.turnsToSkip || 0) + 1;
        finishPlayerTurn(state, playerId, random);
    }
    return correct;
}

module.exports = {
    rooms,
    spawnPoints,
    secretPass,
    hintCatalog,
    hintSupportsSolution,
    solutionPools,
    createSolution,
    createInitialGameState,
    rollMovementDie,
    movementDistances,
    movementPath,
    movePlayer,
    takeWardenTurn,
    endPlayerTurn,
    completeWardenTurn,
    removePlayerFromGame,
    isAdjacent,
    moveToRandomSpawn,
    discoverHint,
    submitAccusation
};
