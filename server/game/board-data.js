const hintCatalog = require("./hints.json");
const blockedCatalog = require("./blocked.json");

class Room {
    constructor(id, name, cols, rows, doors) {
        this.id = id;
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.doors = doors;
        this.hintIds = hintCatalog.hints.filter(hint => hint.roomId === id).map(hint => hint.id);
    }
}

const spawnPoints = [
    {row: 2, col: 10}, {row: 2, col: 21}, {row: 23, col: 10}, {row: 23, col: 21},
    {row: 9, col: 2}, {row: 9, col: 29}, {row: 15, col: 2}, {row: 15, col: 29}
];

const secretPass = [
    {row: 2, col: 23}, {row: 23, col: 3}, {row: 2, col: 7}, {row: 23, col: 28}
];

const rooms = [
    new Room("wardens_office", "Wardens_office", {start: 12, end: 19}, {start: 8, end: 17}, {col: 19, row: 12}),
    new Room("padded_cell", "Padded Cell", {start: 1, end: 9}, {start: 17, end: 24}, {col: 4, row: 17}),
    new Room("cafeteria", "Cafeteria", {start: 22, end: 30}, {start: 1, end: 7}, {col: 28, row: 7}),
    new Room("operating_theater", "Operating Theater", {start: 22, end: 30}, {start: 17, end: 24}, {col: 25, row: 17}),
    new Room("rec_room", "Rec Room", {start: 1, end: 9}, {start: 1, end: 7}, {col: 7, row: 7}),
    new Room("showers", "Showers", {start: 12, end: 19}, {start: 20, end: 24}, {col: 15, row: 20}),
    new Room("solitary_confinement", "Solitary Confinement", {start: 12, end: 19}, {start: 1, end: 5}, {col: 16, row: 5}),
    new Room("hydrotherapy", "Hydrotherapy", {start: 23, end: 30}, {start: 10, end: 14}, {col: 25, row: 10}),
    new Room("electrotherapy", "Electrotherapy", {start: 1, end: 8}, {start: 10, end: 14}, {col: 7, row: 14})
];

const blockedTiles = blockedCatalog.blocked_tiles.filter(area => area.enabled !== false);
const searchItems = blockedCatalog.search_items.filter(item => item.enabled !== false);

function positionInArea(position, area) {
    return position.row >= area.rows.start && position.row <= area.rows.end &&
        position.col >= area.cols.start && position.col <= area.cols.end;
}

function blockingAreaAt(state, position) {
    const boardBlockedTiles = state?.board?.blockedTiles || blockedTiles;
    const boardSearchItems = state?.board?.searchItems || searchItems;
    return boardSearchItems.find(item => positionInArea(position, item)) ||
        boardBlockedTiles.find(area => positionInArea(position, area));
}

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

module.exports = {
    rooms, spawnPoints, secretPass, blockedTiles, searchItems,
    positionInArea, blockingAreaAt, roomAtPosition, getSquareType
};
