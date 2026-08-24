import { elements } from "./board-dom.js";
import { endTurn, loadGameResources, movePlayer, quitGame, rollMovement } from "./board-api.js";
import { createBoardLayout } from "./board-layout.js";
import { createAccusationControls } from "./accusation-controls.js";

const gameId = window.location.pathname.split("/").filter(Boolean).at(-1);
const statusElement = elements.status;
const quitButton = elements.quitButton;
const gameElement = elements.game;
const boardElement = elements.board;
const turnStatusElement = elements.turnStatus;
const rollMovementButton = elements.rollMovementButton;
const endTurnButton = elements.endTurnButton;
let gameState;
let currentUserId;
let characterDialogue = new Map();
const activeDialogue = new Map();
const movingCharacterAnimations = new Set();
let speechPositionFrame = null;
const boardLayout = createBoardLayout(elements, positionSpeechBubbles);
const accusationControls = createAccusationControls(elements, gameId, {
    onState: applyAuthoritativeState,
    onStatus: message => { statusElement.textContent = message; },
    onEligibilityChanged: () => { if (gameState) renderTurn(); }
});
accusationControls.initialize();

function showCharacterDialogue(character, group) {
    const sayings = characterDialogue.get(character)?.[group] || [];
    if (!sayings.length) return "";
    const existing = activeDialogue.get(character);
    if (existing) window.clearTimeout(existing.timeout);

    const entry = {
        text: sayings[Math.floor(Math.random() * sayings.length)],
        timeout: null
    };
    const displayDuration = 12000 + (Math.random() * 4000 - 2000);
    entry.timeout = window.setTimeout(() => {
        if (activeDialogue.get(character) !== entry) return;
        activeDialogue.delete(character);
        renderPlayers();
    }, displayDuration);
    activeDialogue.set(character, entry);
    return entry.text;
}

function squareAt(row, col) {
    return boardLayout.squareAt(row, col);
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
    const cellSize = boardLayout.cellSize;
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
    const visitedThisTurn = new Set((turn.visitedPositions || [])
        .map(position => `${position.row},${position.col}`));
    visitedThisTurn.delete(`${player.position.row},${player.position.col}`);
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
            if (blocked.has(key) || visitedThisTurn.has(key) || distances.has(key)) continue;
            if (player.secretPassageCooldown?.row === row && player.secretPassageCooldown?.col === col) continue;
            if (squareAt(row, col)?.dataset.blocked === "true") continue;
            if (!canCrossRoomBoundary(current, { row, col })) continue;
            distances.set(key, distance + 1);
            squareAt(row, col)?.classList.add("movement-range");
            if (!entersDoorFromHallway(current, { row, col })) queue.push({ row, col });
        }
    }
    if (distances.size === 1) {
        endTurnButton.hidden = false;
        turnStatusElement.textContent = "YOUR TURN · no legal moves remain · end your turn";
    }
}

function renderGameState() {
    renderTurn();
    renderPlayers();
    renderMovementRange();
}

function applyAuthoritativeState(nextState) {
    const previousWardenPosition = gameState?.warden?.position ? { ...gameState.warden.position } : null;
    const previousWardenTurns = gameState?.warden?.turnsTaken || 0;
    const previousPlayerId = gameState?.turn?.playerId;
    gameState = nextState;
    const wardenMoved = (gameState.warden?.turnsTaken || 0) > previousWardenTurns;
    if (wardenMoved) showCharacterDialogue(gameState.warden.character, "turn_start");
    if (gameState.turn?.playerId && String(gameState.turn.playerId) !== String(previousPlayerId)) {
        const nextPlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
        if (nextPlayer) showCharacterDialogue(nextPlayer.character, "turn_start");
    }
    renderGameState();
    if (wardenMoved && previousWardenPosition) animateWardenMove(previousWardenPosition);
}

function renderTurn() {
    const turn = gameState?.turn;
    if (!turn) return;
    const player = gameState.players.find(candidate => String(candidate.id) === String(turn.playerId));
    const isMine = String(turn.playerId) === currentUserId;
    if (turn.phase === "finished") turnStatusElement.textContent = "Game finished";
    else if (turn.phase === "warden") turnStatusElement.textContent = "The Warden is making his rounds…";
    else if (isMine) turnStatusElement.textContent = turn.phase === "awaiting_roll"
        ? "YOUR TURN · roll for movement"
        : turn.phase === "awaiting_end"
            ? "YOUR TURN · movement complete · end your turn"
            : `YOUR TURN · rolled ${turn.die.roll} · ${turn.movementRemaining} moves left`;
    else turnStatusElement.textContent = `Waiting for ${player?.username || "the next player"}…`;
    rollMovementButton.hidden = turn.phase !== "awaiting_roll" || String(turn.playerId) !== currentUserId;
    endTurnButton.hidden = !isMine || turn.phase !== "awaiting_end";
    accusationControls.render(gameState, currentUserId);
}

rollMovementButton.addEventListener("click", async () => {
    rollMovementButton.disabled = true;
    try {
        const data = await rollMovement(gameId);
        applyAuthoritativeState(data.state);
    } catch (error) {
        statusElement.textContent = error.message;
    } finally {
        rollMovementButton.disabled = false;
    }
});

endTurnButton.addEventListener("click", async () => {
    endTurnButton.disabled = true;
    try {
        const data = await endTurn(gameId);
        applyAuthoritativeState(data.state);
    } catch (error) {
        statusElement.textContent = error.message;
    } finally {
        endTurnButton.disabled = false;
    }
});

window.addEventListener("game-state", event => {
    if (!event.detail) return;
    applyAuthoritativeState(event.detail);
});

window.addEventListener("game-perspective", event => {
    if (!window.MULTI_TEST_MODE) return;
    currentUserId = event.detail == null ? null : String(event.detail);
    if (gameState) renderGameState();
});

quitButton.addEventListener("click", async () => {
    if (!window.confirm("Are you sure you want to leave this game? You will not be able to rejoin.")) return;
    quitButton.disabled = true;
    try {
        await quitGame(gameId);
        window.location.assign("/");
    } catch (error) {
        statusElement.textContent = error.message;
        quitButton.disabled = false;
    }
});

loadGameResources(gameId)
    .then(({ game: data, board: boardData, sayings: sayingsData }) => {
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
        if (window.MULTI_TEST_MODE && gameState.turn?.playerId) {
            const activePlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
            if (activePlayer) showCharacterDialogue(activePlayer.character, "turn_start");
        }
        const { rows, cols } = state.board;

        const container = boardElement;
        boardLayout.build({ rows, cols, rooms, spawnPoints, secretPass });
        window.addEventListener("resize", () => boardLayout.size(rows, cols));
        if (window.ResizeObserver) {
            new ResizeObserver(() => boardLayout.size(rows, cols)).observe(gameElement);
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
                const previousWardenDialogueEventId = gameState.warden?.dialogueEventId || 0;
                const previousTurnNumber = gameState.turn?.number || 0;
                let data;
                try {
                    data = await movePlayer(gameId, {
                        row: Number(square.dataset.row),
                        col: Number(square.dataset.col)
                    });
                } catch (error) {
                    statusElement.textContent = error.message;
                    return;
                }
                gameState = data.state;
                const wardenTookTurn = (gameState.warden?.turnsTaken || 0) > previousWardenTurns;
                if (wardenTookTurn) {
                    showCharacterDialogue(gameState.warden.character, "turn_start");
                }
                if ((gameState.turn?.number || 0) > previousTurnNumber &&
                    gameState.turn?.phase === "awaiting_roll") {
                    const nextPlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
                    if (nextPlayer) showCharacterDialogue(nextPlayer.character, "turn_start");
                }
                statusElement.textContent = `Moved ${data.cost} grid location${data.cost === 1 ? "" : "s"}.`;
                renderGameState();
                const movedPlayer = gameState.players.find(player => String(player.id) === currentUserId);
                if ((gameState.warden?.dialogueEventId || 0) > previousWardenDialogueEventId &&
                    gameState.warden.dialogueEvent) {
                    showCharacterDialogue(gameState.warden.character, gameState.warden.dialogueEvent);
                    renderPlayers();
                }
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
            elements.clickOutput.textContent =
                `${tileLabel}\ncol ${square.dataset.col}, row ${square.dataset.row}`;
        });
    })
    .catch(error => {
        statusElement.textContent = error.message;
    });
