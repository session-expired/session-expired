//Room object to hold the actual rooms and their dimensions/door location
class Room {
    constructor(name, cols, rows, doors, blockedTile = []) {
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.doors = doors;
        this.blockedTile = blockedTile;
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

//Initializing all rooms
let wardensOffice = new Room("Wardens_office", {start: 12, end: 19}, {start: 8, end: 17}, {col: 19, row: 12});
let paddedCells = new Room("Padded Cells", {start: 1, end: 9}, {start: 17, end: 24}, {col: 4, row: 17});
let cafeteria = new Room("Cafeteria", {start: 22, end: 30}, 
    {start: 1, end: 7}, 
    {col: 28, row: 7},
[
    {row: 6, col: 23},
    {row: 7, col: 24}
]);
let operatingTheater = new Room("Operating Theater", {start: 22, end: 30}, {start: 17, end: 24}, {col: 25, row: 17});
let recRoom = new Room("Rec Room", {start: 1, end: 9}, {start: 1, end: 7}, {col: 7, row: 7});
let showers = new Room("Solitary Confinement", {start: 12, end: 19}, {start: 1, end: 5}, {col: 16, row: 5});
let solitaryConfinement = new Room("Showers", {start: 12, end: 19}, {start: 19, end: 24}, {col: 15, row: 20});
let hydrotherapy = new Room("Electrotherapy", {start: 1, end: 8}, {start: 10, end: 14}, {col: 7, row: 14});
let electrotherapy = new Room("Hydrotherapy", {start: 23, end: 30}, {start: 10, end: 14}, {col: 25, row: 10});

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

function createInitialGameState(gamePlayers, random = Math.random) {
    if (gamePlayers.length > spawnPoints.length) {
        throw new Error("There are more players than available spawn points.");
    }

    const availableSpawnPoints = shuffledSpawnPoints(random);

    const players = gamePlayers.map((player, index) => ({
        id: String(player.id),
        username: player.username,
        character: player.selected_character,
        position: availableSpawnPoints[index],
        facing: "right"
    }));

    return {
        status: "active",
        board: {
            rows: 24,
            cols: 30,
            rooms
        },
        players,
        warden: {
            character: "bonaparte",
            position: { row: 13, col: 13 },
            previousPosition: null,
            lastRoll: null,
            lastPath: [],
            turnsTaken: 0,
            facing: "right"
        },
        turn: {
            number: 1,
            playerIndex: 0,
            playerId: players[0]?.id ?? null,
            phase: "awaiting_roll",
            die: { sides: 8, roll: null },
            movementRemaining: 0
        }
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
    state.turn.phase = "moving";
    state.turn.die = { sides: 8, roll };
    state.turn.movementRemaining = roll;
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
            if (blocked.has(key) || distances.has(key)) continue;
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

function advanceTurn(state, random = Math.random) {
    const completedPlayerIndex = state.turn.playerIndex;
    state.turn.playerIndex = (completedPlayerIndex + 1) % state.players.length;
    if (completedPlayerIndex === state.players.length - 1) takeWardenTurn(state, random);
    state.turn.playerId = state.players[state.turn.playerIndex].id;
    state.turn.number += 1;
    state.turn.phase = "awaiting_roll";
    state.turn.die = { sides: 8, roll: null };
    state.turn.movementRemaining = 0;
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
    state.turn.movementRemaining -= cost;
    if (state.turn.movementRemaining === 0) advanceTurn(state, random);
    return cost;
}

module.exports = {
    rooms,
    spawnPoints,
    secretPass,
    createInitialGameState,
    rollMovementDie,
    movementDistances,
    movementPath,
    movePlayer,
    takeWardenTurn
};
