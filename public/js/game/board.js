const gameId = window.location.pathname.split("/").filter(Boolean).at(-1);
const statusElement = document.getElementById("game-status");
const quitButton = document.getElementById("quit-game");
const gameElement = document.getElementById("game");
const boardElement = document.getElementById("board");
const boardViewport = document.getElementById("board-viewport");
const zoomOutButton = document.getElementById("zoom-out");
const zoomResetButton = document.getElementById("zoom-reset");
const zoomInButton = document.getElementById("zoom-in");
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
let zoomLevel = 1;
let fittedCellSize = 1;
let boardRows = 0;
let boardCols = 0;

function applyBoardZoom() {
    const cellSize = fittedCellSize * zoomLevel;
    boardElement.style.width = `${cellSize * boardCols}px`;
    boardElement.style.height = `${cellSize * boardRows}px`;
    zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`;
    zoomOutButton.disabled = zoomLevel <= MIN_ZOOM;
    zoomInButton.disabled = zoomLevel >= MAX_ZOOM;
}

function setZoom(nextZoom) {
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    applyBoardZoom();
}

function sizeBoard(rows, cols) {
    const gameStyles = window.getComputedStyle(gameElement);
    const horizontalPadding = parseFloat(gameStyles.paddingLeft) + parseFloat(gameStyles.paddingRight);
    const availableWidth = gameElement.clientWidth - horizontalPadding;

    // Match the vertical space reserved for the board in game.css.
    const rootStyles = window.getComputedStyle(document.documentElement);
    const footerHeight = parseFloat(rootStyles.getPropertyValue("--footer-height")) || 0;
    const chatDeadHeight = parseFloat(rootStyles.getPropertyValue("--chat-dead-height")) || 0;
    const availableHeight = window.innerHeight - 52 - footerHeight - chatDeadHeight - 120;

    // Whole-pixel cells keep every horizontal and vertical interval identical.
    fittedCellSize = Math.max(1, Math.floor(Math.min(1150 / cols, availableWidth / cols, availableHeight / rows)));
    boardRows = rows;
    boardCols = cols;
    boardViewport.style.width = `${fittedCellSize * cols}px`;
    boardViewport.style.height = `${fittedCellSize * rows}px`;
    boardElement.style.aspectRatio = `${cols} / ${rows}`;
    applyBoardZoom();
}

zoomOutButton.addEventListener("click", () => setZoom(zoomLevel - ZOOM_STEP));
zoomInButton.addEventListener("click", () => setZoom(zoomLevel + ZOOM_STEP));
zoomResetButton.addEventListener("click", () => setZoom(1));

quitButton.addEventListener("click", async () => {
    if (!window.confirm("Are you sure you want to leave this game? You will not be able to rejoin.")) return;
    quitButton.disabled = true;
    try {
        const response = await fetch(`/api/games/${gameId}/quit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        if (response.status === 401) {
            window.location.assign("/login");
            return;
        }
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await response.json() : {};
        if (!response.ok) throw new Error(data.error || "Unable to quit the game.");
        window.location.assign("/");
    } catch (error) {
        statusElement.textContent = error.message;
        quitButton.disabled = false;
    }
});

Promise.all([
    fetch(`/api/games/${gameId}`),
    // This endpoint reads server/game/board.js, so the inspection aid always
    // uses the current room placement instead of the game's saved snapshot.
    fetch("/api/board")
])
    .then(async ([gameResponse, boardResponse]) => {
        const response = gameResponse;
        if (response.status === 401) {
            window.location.assign("/login");
            throw new Error("Your session has expired. Redirecting to login.");
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error(`The server returned an unexpected response (${response.status}).`);
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this game.");

        if (boardResponse.status === 401) {
            window.location.assign("/login");
            throw new Error("Your session has expired. Redirecting to login.");
        }
        const boardContentType = boardResponse.headers.get("content-type") || "";
        if (!boardContentType.includes("application/json")) {
            throw new Error(`The server returned an unexpected response (${boardResponse.status}).`);
        }
        const boardData = await boardResponse.json();
        if (!boardResponse.ok) throw new Error(boardData.error || "Unable to load the board.");

        return {
            state: data.game.state,
            rooms: boardData.rooms,
            spawnPoints: boardData.spawnPoints,
            secretPass: boardData.secretPass
        };
    })
    .then(({ state, rooms, spawnPoints, secretPass }) => {
        const { rows, cols } = state.board;

        function getRoomAt(row, col) {
            return rooms.find(room => {
                const inRows = row >= room.rows.start && row <= room.rows.end;
                const inCols = col >= room.cols.start && col <= room.cols.end;
                return inRows && inCols;
            });
        }

        //This loop creates the board

        let container = boardElement;

        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        sizeBoard(rows, cols);
        window.addEventListener("resize", () => sizeBoard(rows, cols));
        if (window.ResizeObserver) {
            new ResizeObserver(() => sizeBoard(rows, cols)).observe(gameElement);
        }
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                let square = document.createElement("div");
                const room = getRoomAt(row, col);
                const isDoor = room && row === room.doors.row && col === room.doors.col;
                const isSpawnPoint = spawnPoints.some(point => row === point.row && col === point.col);
                const isSecretPass = secretPass.some(point => row === point.row && col === point.col);
                square.dataset.type = isSecretPass
                    ? "secret passage"
                    : isDoor
                        ? "door"
                        : room
                            ? "room"
                            : isSpawnPoint
                                ? "spawn point"
                                : "hallway";
                if (room) square.dataset.roomName = room.name;
                square.dataset.row = row;
                square.dataset.col = col;
                container.appendChild(square);
            }
        }

        statusElement.textContent = `Game loaded · ${state.players.length} players`;

        // Temporary inspection aid; no gameplay behavior is implemented yet.
        container.addEventListener("click", function(event) {
            let square = event.target;
            if (!square.dataset.type) return;

            const tileLabel = ["door", "secret passage"].includes(square.dataset.type)
                ? [square.dataset.type, square.dataset.roomName].filter(Boolean).join(", ")
                : square.dataset.roomName || square.dataset.type;
            document.getElementById("clickOutput").textContent =
                `${tileLabel}\ncol ${square.dataset.col}, row ${square.dataset.row}`;
        });
    })
    .catch(error => {
        statusElement.textContent = error.message;
    });
