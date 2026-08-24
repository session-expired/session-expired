/*
 * BOARD_LAYOUT  -> fixed overall asylum geometry
 * ROOM TYPE     -> architectural slot ("lc")
 * ROOM INSTANCE -> specific gameplay location ("lc2")
 * ROOM VARIANT  -> selected version/layout of that room ("lc_03")
 * CELL          -> points to a room instance ("lc2")
 */
// Populate variants with possible layouts later. Variant selection will not
// change a room instance's stable gameplay ID or architectural type.
export const ROOM_TYPES = {
    sc: { name: "Small Corner", variants: [] },
    le: { name: "Large Edge", variants: [] },
    wa: { name: "Warden's Office", variants: [] },
    se: { name: "Small Edge", variants: [] },
    lc: { name: "Large Corner", variants: [] }
};

// Existing layout: non-room tags (hw, dr, and ps) remain unchanged.
const BOARD_LAYOUT = [
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "ps", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "ps", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "dr", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "dr", "sc", "sc", "sc", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "dr", "sc", "sc"],
        ["hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw"],
        ["ps", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "ps"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "dr", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "dr", "dr", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "dr", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["ps", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "ps"],
        ["hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw"],
        ["lc", "lc", "lc", "dr", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "lc", "lc", "lc", "lc", "dr", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "dr", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "ps", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "ps", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"]
];

const roomCountsByBoard = new WeakMap();

export function createRoomInstance(board, type, options = {}) {
    if (!ROOM_TYPES[type]) {
        throw new Error(`Unknown room type: ${type}`);
    }

    const roomCounts = roomCountsByBoard.get(board);
    if (!roomCounts) {
        throw new Error("Room instances can only be added to a board created by createBoard()");
    }

    let id = options.id;
    if (!id) {
        roomCounts[type] = (roomCounts[type] || 0) + 1;
        id = `${type}${roomCounts[type]}`;
    }

    if (board.rooms[id]) {
        throw new Error(`Room ID already exists: ${id}`);
    }

    const room = {
        id,
        type,
        variant: options.variant ?? null,
        occupants: options.occupants ? [...options.occupants] : [],
        searched: options.searched ?? false,
        secretPassage: options.secretPassage ?? null
    };

    board.rooms[id] = room;
    return room;
}

export function isValidPosition(board, row, column) {
    return Number.isInteger(row) && Number.isInteger(column)
        && row >= 0 && row < board.rows
        && column >= 0 && column < board.columns;
}

export function getRoomIdAt(board, row, column) {
    if (!isValidPosition(board, row, column)) return null;

    const cell = board.cells[row][column];
    return board.rooms[cell] ? cell : null;
}

export function getRoomById(board, roomId) {
    return board.rooms[roomId] || null;
}

export function getRoomAt(board, row, column) {
    return getRoomById(board, getRoomIdAt(board, row, column));
}

export function getRoomType(board, roomId) {
    const room = getRoomById(board, roomId);
    return room ? ROOM_TYPES[room.type] : null;
}

function convertRoomRegionsToInstances(board) {
    const visited = BOARD_LAYOUT.map((row) => row.map(() => false));
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let row = 0; row < board.rows; row += 1) {
        for (let column = 0; column < board.columns; column += 1) {
            const type = BOARD_LAYOUT[row][column];
            if (!ROOM_TYPES[type] || visited[row][column]) continue;

            // The Warden's Office is fixed; other IDs represent orthogonally
            // connected regions in this particular board layout.
            const room = createRoomInstance(board, type, type === "wa" ? { id: "warden" } : {});
            const pending = [[row, column]];
            visited[row][column] = true;

            while (pending.length > 0) {
                const [currentRow, currentColumn] = pending.pop();
                board.cells[currentRow][currentColumn] = room.id;

                for (const [rowOffset, columnOffset] of directions) {
                    const nextRow = currentRow + rowOffset;
                    const nextColumn = currentColumn + columnOffset;

                    if (isValidPosition(board, nextRow, nextColumn)
                        && !visited[nextRow][nextColumn]
                        && BOARD_LAYOUT[nextRow][nextColumn] === type) {
                        visited[nextRow][nextColumn] = true;
                        pending.push([nextRow, nextColumn]);
                    }
                }
            }
        }
    }
}

export function createBoard() {
    const newBoard = {
        rows: BOARD_LAYOUT.length,
        columns: BOARD_LAYOUT[0].length,
        rooms: {},
        cells: BOARD_LAYOUT.map((row) => [...row])
    };

    roomCountsByBoard.set(newBoard, {});
    convertRoomRegionsToInstances(newBoard);
    return newBoard;
}

// Retained as the current/default board.
export const board = createBoard();
