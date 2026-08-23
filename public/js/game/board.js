const gameId = window.location.pathname.split("/").filter(Boolean).at(-1);
const statusElement = document.getElementById("game-status");
const quitButton = document.getElementById("quit-game");
const gameElement = document.getElementById("game");
const boardElement = document.getElementById("board");
const boardViewport = document.getElementById("board-viewport");
const zoomOutButton = document.getElementById("zoom-out");
const zoomResetButton = document.getElementById("zoom-reset");
const zoomInButton = document.getElementById("zoom-in");
const turnStatusElement = document.getElementById("turn-status");
const rollMovementButton = document.getElementById("roll-movement");
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
let zoomLevel = 1;
let fittedCellSize = 1;
let boardRows = 0;
let boardCols = 0;
let gameState;
let currentUserId;
let characterDialogue = new Map();
const activeDialogue = new Map();
const movingCharacterAnimations = new Set();
let speechPositionFrame = null;

function showCharacterDialogue(character, group) {
    const sayings = characterDialogue.get(character)?.[group] || [];
    if (!sayings.length) return "";
    const existing = activeDialogue.get(character);
    if (existing) window.clearTimeout(existing.timeout);

    const entry = {
        text: sayings[Math.floor(Math.random() * sayings.length)],
        timeout: null
    };
    entry.timeout = window.setTimeout(() => {
        if (activeDialogue.get(character) !== entry) return;
        activeDialogue.delete(character);
        renderPlayers();
    }, 10000);
    activeDialogue.set(character, entry);
    return entry.text;
}

function squareAt(row, col) {
    return boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function positionSpeechBubbles() {
    const boardBounds = boardElement.getBoundingClientRect();
    if (!boardBounds.width || !boardBounds.height) return;

    boardElement.querySelectorAll(".character-speech").forEach(speech => {
        speech.style.maxWidth = `${Math.max(0, boardBounds.width - 4)}px`;
        speech.style.maxHeight = `${Math.max(0, boardBounds.height - 4)}px`;
        speech.style.transform = "translateX(-50%)";
        const bubbleBounds = speech.getBoundingClientRect();
        let horizontalShift = 0;
        let verticalShift = 0;

        if (bubbleBounds.left < boardBounds.left + 2) {
            horizontalShift = boardBounds.left + 2 - bubbleBounds.left;
        } else if (bubbleBounds.right > boardBounds.right - 2) {
            horizontalShift = boardBounds.right - 2 - bubbleBounds.right;
        }
        if (bubbleBounds.top < boardBounds.top + 2) {
            verticalShift = boardBounds.top + 2 - bubbleBounds.top;
        } else if (bubbleBounds.bottom > boardBounds.bottom - 2) {
            verticalShift = boardBounds.bottom - 2 - bubbleBounds.bottom;
        }

        speech.style.transform =
            `translate(calc(-50% + ${horizontalShift}px), ${verticalShift}px)`;
    });
}

function positionMovingSpeechBubbles() {
    positionSpeechBubbles();
    if (movingCharacterAnimations.size) {
        speechPositionFrame = window.requestAnimationFrame(positionMovingSpeechBubbles);
    } else {
        speechPositionFrame = null;
    }
}

function trackMovingSpeechBubbles(movementAnimation) {
    movingCharacterAnimations.add(movementAnimation);
    if (speechPositionFrame === null) {
        speechPositionFrame = window.requestAnimationFrame(positionMovingSpeechBubbles);
    }

    const stopTracking = () => {
        movingCharacterAnimations.delete(movementAnimation);
        positionSpeechBubbles();
    };
    movementAnimation.finished.then(stopTracking, stopTracking);
}

function renderPlayers() {
    boardElement.querySelectorAll(".player-sprite").forEach(sprite => sprite.remove());
    const entities = [
        ...gameState.players,
        ...(gameState.warden ? [{ ...gameState.warden, username: "Warden" }] : [])
    ];
    entities.forEach(entity => {
        if (!entity.character || !entity.position) return;
        const square = squareAt(entity.position.row, entity.position.col);
        if (!square) return;

        const sprite = document.createElement("div");
        sprite.className = "player-sprite";
        if (entity.username === "Warden") sprite.classList.add("warden-sprite");
        if (entity.id) sprite.dataset.entityId = String(entity.id);
        const spriteArt = document.createElement("div");
        spriteArt.className = "sprite-art";
        spriteArt.style.backgroundImage =
            `url("/assets/images/chars/${encodeURIComponent(entity.character)}/${encodeURIComponent(entity.character)}.png")`;
        if (entity.facing === "left") spriteArt.classList.add("facing-left");
        sprite.appendChild(spriteArt);
        sprite.title = `${entity.username} (${entity.character})`;
        sprite.setAttribute("role", "img");
        sprite.setAttribute("aria-label", sprite.title);
        const dialogue = activeDialogue.get(entity.character)?.text;
        if (dialogue) {
            const speech = document.createElement("span");
            speech.className = "character-speech";
            speech.textContent = dialogue;
            sprite.appendChild(speech);
        }
        square.appendChild(sprite);
    });
    window.requestAnimationFrame(positionSpeechBubbles);
}

if ("ResizeObserver" in window) {
    new ResizeObserver(positionSpeechBubbles).observe(boardElement);
}
document.fonts?.ready.then(positionSpeechBubbles);

function animateCharacterMove(sprite, previousPosition, currentPosition, path) {
    if (!sprite || !path?.length) return;
    const duration = Math.max(400, path.length * 180);
    const cellSize = fittedCellSize * zoomLevel;
    const animationTiles = [previousPosition, ...path];
    const keyframes = animationTiles.map((tile, index) => ({
        offset: index / (animationTiles.length - 1),
        transform: `translate(calc(-50% + ${(tile.col - currentPosition.col) * cellSize}px), ${(tile.row - currentPosition.row) * cellSize}px)`
    }));
    const movementAnimation = sprite.animate(keyframes, { duration, easing: "linear" });
    trackMovingSpeechBubbles(movementAnimation);
    let frame = 1;
    const spriteArt = sprite.querySelector(".sprite-art");
    const animation = window.setInterval(() => {
        spriteArt.style.backgroundPosition = `${(frame / 7) * 100}% top`;
        frame = frame === 6 ? 1 : frame + 1;
    }, 100);
    window.setTimeout(() => {
        window.clearInterval(animation);
        spriteArt.style.backgroundPosition = "left top";
    }, duration);
}

function animateWardenMove(previousPosition) {
    animateCharacterMove(
        boardElement.querySelector(".warden-sprite"),
        previousPosition,
        gameState.warden.position,
        gameState.warden.lastPath
    );
}

function renderMovementRange() {
    boardElement.querySelectorAll(".movement-range").forEach(square => square.classList.remove("movement-range"));
    const turn = gameState?.turn;
    if (turn?.phase !== "moving" || String(turn.playerId) !== currentUserId) return;

    const player = gameState.players.find(candidate => String(candidate.id) === currentUserId);
    const blocked = new Set(gameState.players
        .filter(candidate => String(candidate.id) !== currentUserId)
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (gameState.warden?.position) {
        blocked.add(`${gameState.warden.position.row},${gameState.warden.position.col}`);
    }
    const distances = new Map([[`${player.position.row},${player.position.col}`, 0]]);
    const queue = [{ ...player.position }];

    function canCrossRoomBoundary(from, to) {
        const fromSquare = squareAt(from.row, from.col);
        const toSquare = squareAt(to.row, to.col);
        const fromRoom = fromSquare?.dataset.roomName || null;
        const toRoom = toSquare?.dataset.roomName || null;
        if (fromRoom === toRoom) return true;
        return fromSquare?.dataset.type === "door" || toSquare?.dataset.type === "door";
    }

    function entersDoorFromHallway(from, to) {
        const fromSquare = squareAt(from.row, from.col);
        const toSquare = squareAt(to.row, to.col);
        return !fromSquare?.dataset.roomName && toSquare?.dataset.type === "door";
    }

    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const distance = distances.get(`${current.row},${current.col}`);
        if (distance >= turn.movementRemaining) continue;
        for (const [rowOffset, colOffset] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const row = current.row + rowOffset;
            const col = current.col + colOffset;
            const key = `${row},${col}`;
            if (row < 1 || row > gameState.board.rows || col < 1 || col > gameState.board.cols) continue;
            if (blocked.has(key) || distances.has(key)) continue;
            if (player.secretPassageCooldown?.row === row && player.secretPassageCooldown?.col === col) continue;
            if (squareAt(row, col)?.dataset.blocked === "true") continue;
            if (!canCrossRoomBoundary(current, { row, col })) continue;
            distances.set(key, distance + 1);
            squareAt(row, col)?.classList.add("movement-range");
            if (!entersDoorFromHallway(current, { row, col })) queue.push({ row, col });
        }
    }
}

function renderGameState() {
    renderTurn();
    renderPlayers();
    renderMovementRange();
}

function renderTurn() {
    const turn = gameState?.turn;
    if (!turn) return;
    const player = gameState.players[turn.playerIndex];
    turnStatusElement.textContent = turn.phase === "awaiting_roll"
        ? `${player?.username || "Player"}'s turn · roll for movement`
        : `${player?.username || "Player"} rolled ${turn.die.roll} · ${turn.movementRemaining} moves left`;
    rollMovementButton.hidden = turn.phase !== "awaiting_roll" || String(turn.playerId) !== currentUserId;
}

rollMovementButton.addEventListener("click", async () => {
    rollMovementButton.disabled = true;
    try {
        const response = await fetch(`/api/games/${gameId}/roll`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to roll the movement die.");
        gameState = data.state;
        renderGameState();
    } catch (error) {
        statusElement.textContent = error.message;
    } finally {
        rollMovementButton.disabled = false;
    }
});

function applyBoardZoom() {
    const cellSize = fittedCellSize * zoomLevel;
    boardElement.style.width = `${cellSize * boardCols}px`;
    boardElement.style.height = `${cellSize * boardRows}px`;
    zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`;
    zoomOutButton.disabled = zoomLevel <= MIN_ZOOM;
    zoomInButton.disabled = zoomLevel >= MAX_ZOOM;
    window.requestAnimationFrame(positionSpeechBubbles);
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
    fetch("/api/board"),
    fetch("/assets/character_sayings.json")
])
    .then(async ([gameResponse, boardResponse, sayingsResponse]) => {
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
        if (!sayingsResponse.ok) throw new Error("Unable to load character sayings.");
        const sayingsData = await sayingsResponse.json();

        return {
            state: data.game.state,
            currentUserId: String(data.currentUserId),
            rooms: boardData.rooms,
            spawnPoints: boardData.spawnPoints,
            secretPass: boardData.secretPass,
            characterDialogue: sayingsData.characters
        };
    })
    .then(({ state, currentUserId: loadedUserId, rooms, spawnPoints, secretPass, characterDialogue: loadedDialogue }) => {
        gameState = state;
        currentUserId = loadedUserId;
        characterDialogue = new Map(loadedDialogue.map(character => [character.character, character.dialogue]));
        [...gameState.players, gameState.warden]
            .filter(entity => entity?.character)
            .forEach(entity => showCharacterDialogue(entity.character, "game_start"));
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
                const isBlockedTile = room?.blockedTile?.some(tile => row === tile.row && col === tile.col);
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
                if (isBlockedTile) square.dataset.blocked = "true";
                square.dataset.row = row;
                square.dataset.col = col;
                container.appendChild(square);
            }
        }

        statusElement.textContent = `Game loaded · ${state.players.length} players`;
        renderGameState();

        container.addEventListener("click", async function(event) {
            const square = event.target.closest("[data-row][data-col]");
            if (!square?.dataset.type) return;

            if (square.classList.contains("movement-range")) {
                const movingPlayer = gameState.players.find(player => String(player.id) === currentUserId);
                const previousPlayerPosition = movingPlayer?.position ? { ...movingPlayer.position } : null;
                const previousDialogueEventId = movingPlayer?.dialogueEventId || 0;
                const previousWardenPosition = gameState.warden?.position
                    ? { ...gameState.warden.position }
                    : null;
                const previousWardenTurns = gameState.warden?.turnsTaken || 0;
                const previousTurnPlayerId = gameState.turn?.playerId;
                const response = await fetch(`/api/games/${gameId}/move`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        row: Number(square.dataset.row),
                        col: Number(square.dataset.col)
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    statusElement.textContent = data.error || "Unable to move there.";
                    return;
                }
                gameState = data.state;
                const wardenTookTurn = (gameState.warden?.turnsTaken || 0) > previousWardenTurns;
                if (String(gameState.turn?.playerId) !== String(previousTurnPlayerId)) {
                    const nextPlayer = gameState.players[gameState.turn.playerIndex];
                    if (nextPlayer) showCharacterDialogue(nextPlayer.character, "turn_start");
                }
                statusElement.textContent = `Moved ${data.cost} grid location${data.cost === 1 ? "" : "s"}.`;
                renderGameState();
                const movedPlayer = gameState.players.find(player => String(player.id) === currentUserId);
                if ((movedPlayer?.dialogueEventId || 0) > previousDialogueEventId && movedPlayer.dialogueEvent) {
                    showCharacterDialogue(movedPlayer.character, movedPlayer.dialogueEvent);
                    renderPlayers();
                }
                if (previousPlayerPosition && movedPlayer) {
                    animateCharacterMove(
                        boardElement.querySelector(`.player-sprite[data-entity-id="${currentUserId}"]`),
                        previousPlayerPosition,
                        movedPlayer.position,
                        data.path
                    );
                }
                if (wardenTookTurn && previousWardenPosition && gameState.warden && (
                    previousWardenPosition.row !== gameState.warden.position.row ||
                    previousWardenPosition.col !== gameState.warden.position.col
                )) animateWardenMove(previousWardenPosition);
            }

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
