//Room object to hold the actual rooms and their dimensions/door location
class Room {
    constructor(name, cols, rows, doors) {
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.doors = doors;
    }
}

//Array for the spawn locations
const spawnPoints = [
    {row: 1, col: 10}, {row: 1, col: 21},
    {row: 24, col: 10}, {row: 24, col: 21},
    {row: 9, col: 1}, {row: 9, col: 30},
    {row: 15, col: 1}, {row: 15, col: 30}
];

//Initializing all rooms
let wardensOffice = new Room("Wardens_office", {start: 12, end: 19}, {start: 8, end: 16}, {col: 19, row: 12});
let paddedCells = new Room("Padded Cells", {start: 1, end: 9}, {start: 1, end: 7}, {col: 6, row: 7});
let cafeteria = new Room("Cafeteria", {start: 22, end: 30}, {start: 1, end: 7}, {col: 28, row: 7});
let operatingTheater = new Room("Operating Theater", {start: 1, end: 9}, {start: 17, end: 24}, {col: 4, row: 17});
let recRoom = new Room("Rec Room", {start: 22, end: 30}, {start: 17, end: 24}, {col: 26, row: 17});
let showers = new Room("Showers", {start: 12, end: 19}, {start: 1, end: 5}, {col: 16, row: 5});
let solitaryConfinement = new Room("Solitary Confinement", {start: 12, end: 19}, {start: 19, end: 24}, {col: 15, row: 19});
let hydrotherapy = new Room("Hydrotherapy", {start: 1, end: 8}, {start: 10, end: 14}, {col: 7, row: 14});
let electrotherapy = new Room("Electrotherapy", {start: 23, end: 30}, {start: 10, end: 14}, {col: 24, row: 10});

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

function createInitialGameState(gamePlayers) {
    return {
        status: "initialized",
        board: {
            rows: 24,
            cols: 30,
            rooms
        },
        players: gamePlayers.map((player, index) => ({
            id: String(player.id),
            username: player.username,
            character: player.selected_character,
            position: spawnPoints[index]
        }))
    };
}

module.exports = { rooms, spawnPoints, createInitialGameState, getSquareType };
