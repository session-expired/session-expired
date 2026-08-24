const hintCatalog = require("./hints.json");

class Room {
    constructor(id, name, cols, rows, doors, blockedTile = []) {
        this.id = id;
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.doors = doors;
        this.blockedTile = blockedTile;
        this.hintIds = hintCatalog.hints.filter(hint => hint.roomId === id).map(hint => hint.id);
    }
}

const spawnPoints = [
    {row: 2, col: 10}, {row: 2, col: 21}, {row: 24, col: 10}, {row: 24, col: 21},
    {row: 9, col: 1}, {row: 9, col: 30}, {row: 15, col: 1}, {row: 15, col: 30}
];

const secretPass = [
    {row: 2, col: 23}, {row: 23, col: 3}, {row: 2, col: 7}, {row: 23, col: 28}
];

const rooms = [
    new Room("wardens_office", "Wardens_office", {start: 12, end: 19}, {start: 8, end: 17}, {col: 19, row: 12}),
    new Room("padded_cells", "Padded Cells", {start: 1, end: 9}, {start: 17, end: 24}, {col: 4, row: 17}),
    new Room("cafeteria", "Cafeteria", {start: 22, end: 30}, {start: 1, end: 7}, {col: 28, row: 7}, [
        {row: 6, col: 23}, {row: 7, col: 24}
    ]),
    new Room("operating_theater", "Operating Theater", {start: 22, end: 30}, {start: 17, end: 24}, {col: 25, row: 17}),
    new Room("rec_room", "Rec Room", {start: 1, end: 9}, {start: 1, end: 7}, {col: 7, row: 7}),
    new Room("showers", "Showers", {start: 12, end: 19}, {start: 20, end: 24}, {col: 15, row: 20}),
    new Room("solitary_confinement", "Solitary Confinement", {start: 12, end: 19}, {start: 1, end: 5}, {col: 16, row: 5}),
    new Room("hydrotherapy", "Hydrotherapy", {start: 23, end: 30}, {start: 10, end: 14}, {col: 25, row: 10}),
    new Room("electrotherapy", "Electrotherapy", {start: 1, end: 8}, {start: 10, end: 14}, {col: 7, row: 14})
];

function roomAtPosition(state, position) {
    return (state.board.rooms || rooms).find(room =>
        position.row >= room.rows.start && position.row <= room.rows.end &&
        position.col >= room.cols.start && position.col <= room.cols.end
    );
}

function getSquareType(row, col) {
    const room = rooms.find(candidate =>
        row >= candidate.rows.start && row <= candidate.rows.end &&
        col >= candidate.cols.start && col <= candidate.cols.end
    );
    if (!room) return "hallway";
    return row === room.doors.row && col === room.doors.col ? "door" : "room";
}

module.exports = { rooms, spawnPoints, secretPass, roomAtPosition, getSquareType };
