import { elements } from "./board-dom.js";
import { discoverHint, endTurn, loadGameResources, movePlayer, quitGame, rollMovement } from "./board-api.js";
import { createBoardLayout } from "./board-layout.js";
import { createAccusationControls } from "./accusation-controls.js";
import { createEntityRenderer } from "./entity-renderer.js";
import { renderMovementRange } from "./movement-range.js";
import { renderJournal } from "./journal.js";

const gameId = window.location.pathname.split("/").filter(Boolean).at(-1);
let gameState;
let currentUserId;
let debugCoordinates = false;
let entityRenderer;
const boardLayout = createBoardLayout(elements, () => entityRenderer?.positionSpeechBubbles());
entityRenderer = createEntityRenderer(elements.board, boardLayout, () => gameState);
const accusationControls = createAccusationControls(elements, gameId, {
    onState: applyAuthoritativeState,
    onStatus: message => { elements.status.textContent = message; },
    onDialogue: (character, group) => entityRenderer.showDialogue(character, group),
    onEligibilityChanged: () => { if (gameState) renderTurn(); }
});

function renderTurn() {
    const turn = gameState?.turn;
    if (!turn) return;
    const player = gameState.players.find(candidate => String(candidate.id) === String(turn.playerId));
    const isMine = String(turn.playerId) === currentUserId;
    if (turn.phase === "finished") elements.turnStatus.textContent = "Game finished";
    else if (turn.phase === "warden") elements.turnStatus.textContent = "The Warden is making his rounds…";
    else if (isMine) elements.turnStatus.textContent = turn.phase === "awaiting_roll"
        ? "YOUR TURN · roll for movement"
        : turn.phase === "awaiting_end"
            ? "YOUR TURN · movement complete · end your turn"
            : `YOUR TURN · rolled ${turn.die.roll} · ${turn.movementRemaining} moves left`;
    else elements.turnStatus.textContent = `Waiting for ${player?.username || "the next player"}…`;
    elements.rollMovementButton.hidden = turn.phase !== "awaiting_roll" || !isMine;
    elements.endTurnButton.hidden = !isMine || turn.phase !== "awaiting_end";
    accusationControls.render(gameState, currentUserId);
}

function renderGameState() {
    const finished = gameState?.status === "finished" && gameState?.winner;
    if (elements.gameResult) {
        elements.gameResult.hidden = !finished;
        if (finished) {
            const won = String(gameState.winner.id) === String(currentUserId);
            elements.gameResultMessage.textContent = won ? "You win!" : "Session Expired";
        }
    }
    elements.quitButton.hidden = Boolean(finished) || window.MULTI_TEST_MODE;
    renderTurn();
    renderJournal(elements, gameState, currentUserId);
    entityRenderer.render();
    renderMovementRange(gameState, currentUserId, boardLayout, elements);
}

function animateWardenMove(previousPosition) {
    entityRenderer.animate(
        elements.board.querySelector(".warden-sprite"),
        previousPosition,
        gameState.warden.position,
        gameState.warden.lastPath
    );
}

function applyAuthoritativeState(nextState) {
    const previousWardenPosition = gameState?.warden?.position ? { ...gameState.warden.position } : null;
    const previousWardenTurns = gameState?.warden?.turnsTaken || 0;
    const previousPlayerId = gameState?.turn?.playerId;
    gameState = nextState;
    const wardenMoved = (gameState.warden?.turnsTaken || 0) > previousWardenTurns;
    if (wardenMoved) entityRenderer.showDialogue(gameState.warden.character, "turn_start");
    if (gameState.turn?.playerId && String(gameState.turn.playerId) !== String(previousPlayerId)) {
        const nextPlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
        if (nextPlayer) entityRenderer.showDialogue(nextPlayer.character, "turn_start");
    }
    renderGameState();
    if (wardenMoved && previousWardenPosition) animateWardenMove(previousWardenPosition);
}

elements.rollMovementButton.addEventListener("click", async () => {
    elements.rollMovementButton.disabled = true;
    try {
        applyAuthoritativeState((await rollMovement(gameId)).state);
    } catch (error) {
        elements.status.textContent = error.message;
    } finally {
        elements.rollMovementButton.disabled = false;
    }
});

elements.endTurnButton.addEventListener("click", async () => {
    elements.endTurnButton.disabled = true;
    try {
        applyAuthoritativeState((await endTurn(gameId)).state);
    } catch (error) {
        elements.status.textContent = error.message;
    } finally {
        elements.endTurnButton.disabled = false;
    }
});

window.addEventListener("game-state", event => {
    if (event.detail) applyAuthoritativeState(event.detail);
});

window.addEventListener("game-perspective", event => {
    if (!window.MULTI_TEST_MODE) return;
    currentUserId = event.detail == null ? null : String(event.detail);
    if (gameState) renderGameState();
});

async function leaveGame(button, confirmLeave) {
    if (confirmLeave && !window.confirm("Are you sure you want to leave this game? You will not be able to rejoin.")) return;
    button.disabled = true;
    try {
        await quitGame(gameId);
        window.location.assign("/");
    } catch (error) {
        elements.status.textContent = error.message;
        button.disabled = false;
    }
}

elements.quitButton.addEventListener("click", () => leaveGame(elements.quitButton, true));
elements.finishedLeaveButton?.addEventListener("click", () => leaveGame(elements.finishedLeaveButton, false));

async function handleMovementClick(square) {
    const movingPlayer = gameState.players.find(player => String(player.id) === currentUserId);
    const previousPosition = movingPlayer?.position ? { ...movingPlayer.position } : null;
    const previousDialogueEventId = movingPlayer?.dialogueEventId || 0;
    const previousWardenPosition = gameState.warden?.position ? { ...gameState.warden.position } : null;
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
        elements.status.textContent = error.message;
        return;
    }
    gameState = data.state;
    const wardenTookTurn = (gameState.warden?.turnsTaken || 0) > previousWardenTurns;
    if (wardenTookTurn) entityRenderer.showDialogue(gameState.warden.character, "turn_start");
    if ((gameState.turn?.number || 0) > previousTurnNumber && gameState.turn?.phase === "awaiting_roll") {
        const nextPlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
        if (nextPlayer) entityRenderer.showDialogue(nextPlayer.character, "turn_start");
    }
    elements.status.textContent = `Moved ${data.cost} grid location${data.cost === 1 ? "" : "s"}.`;
    renderGameState();
    const movedPlayer = gameState.players.find(player => String(player.id) === currentUserId);
    if ((gameState.warden?.dialogueEventId || 0) > previousWardenDialogueEventId && gameState.warden.dialogueEvent) {
        entityRenderer.showDialogue(gameState.warden.character, gameState.warden.dialogueEvent);
        entityRenderer.render();
    }
    if ((movedPlayer?.dialogueEventId || 0) > previousDialogueEventId && movedPlayer.dialogueEvent) {
        entityRenderer.showDialogue(movedPlayer.character, movedPlayer.dialogueEvent);
        entityRenderer.render();
    }
    if (previousPosition && movedPlayer) {
        entityRenderer.animate(
            elements.board.querySelector(`.player-sprite[data-entity-id="${currentUserId}"]`),
            previousPosition,
            movedPlayer.position,
            data.path
        );
    }
    if (wardenTookTurn && previousWardenPosition && gameState.warden && (
        previousWardenPosition.row !== gameState.warden.position.row ||
        previousWardenPosition.col !== gameState.warden.position.col
    )) animateWardenMove(previousWardenPosition);
}

function bindBoardInput() {
    elements.board.addEventListener("click", async event => {
        const square = event.target.closest("[data-row][data-col]");
        if (!square?.dataset.type) return;
        if (square.classList.contains("movement-range")) await handleMovementClick(square);
        if (square.classList.contains("search-item-in-range")) {
            const item = gameState.board.searchItems?.find(candidate =>
                candidate.id === square.dataset.searchItemId
            );
            const player = gameState.players.find(candidate => String(candidate.id) === currentUserId);
            const currentRoom = gameState.board.rooms.find(room => player?.position &&
                player.position.row >= room.rows.start && player.position.row <= room.rows.end &&
                player.position.col >= room.cols.start && player.position.col <= room.cols.end
            );
            if (!currentRoom || item?.roomId !== currentRoom.id) {
                elements.status.textContent = "You can only search objects in your current room.";
                return;
            }
            const adjacent = player?.position && item && (() => {
                const rowDistance = player.position.row < item.rows.start
                    ? item.rows.start - player.position.row
                    : player.position.row > item.rows.end ? player.position.row - item.rows.end : 0;
                const colDistance = player.position.col < item.cols.start
                    ? item.cols.start - player.position.col
                    : player.position.col > item.cols.end ? player.position.col - item.cols.end : 0;
                return rowDistance + colDistance === 1;
            })();
            if (!adjacent) {
                elements.status.textContent = "Move beside the object, then click it to search.";
                return;
            }
            try {
                const data = await discoverHint(gameId, item.id);
                elements.status.textContent = data.empty
                    ? `${item.description} contains no evidence.`
                    : `${item.description} ${data.hints.map(hint => `Hint: ${hint.text}`).join(" ")}`;
                applyAuthoritativeState(data.state);
            } catch (error) {
                elements.status.textContent = error.message;
            }
        }
        if (debugCoordinates) {
            const tileLabel = square.dataset.searchDescription || (
                ["door", "secret passage"].includes(square.dataset.type)
                    ? [square.dataset.type, square.dataset.roomName].filter(Boolean).join(", ")
                    : square.dataset.roomName || square.dataset.type
            );
            elements.clickOutput.textContent = `${tileLabel}\ncol ${square.dataset.col}, row ${square.dataset.row}`;
        }
    });
}

loadGameResources(gameId)
    .then(({ game, board, sayings }) => {
        gameState = game.game.state;
        currentUserId = String(game.currentUserId);
        debugCoordinates = game.debugCoordinates === true;
        elements.clickOutput.hidden = !debugCoordinates;
        entityRenderer.setDialogue(sayings.characters);
        [...gameState.players, gameState.warden]
            .filter(entity => entity?.character)
            .forEach(entity => entityRenderer.showDialogue(entity.character, "game_start"));
        if (window.MULTI_TEST_MODE && gameState.turn?.playerId) {
            const activePlayer = gameState.players.find(player => String(player.id) === String(gameState.turn.playerId));
            if (activePlayer) entityRenderer.showDialogue(activePlayer.character, "turn_start");
        }
        const { rows, cols } = gameState.board;
        boardLayout.build({
            rows,
            cols,
            rooms: board.rooms,
            spawnPoints: board.spawnPoints,
            secretPass: board.secretPass,
            blockedTiles: gameState.board.blockedTiles || board.blockedTiles,
            searchItems: gameState.board.searchItems || board.searchItems
        });
        window.addEventListener("resize", () => boardLayout.size(rows, cols));
        if (window.ResizeObserver) {
    new ResizeObserver(() => boardLayout.size(rows, cols)).observe(elements.gameMain);
        }
        elements.status.textContent = `Game loaded · ${gameState.players.length} players`;
        renderGameState();
        bindBoardInput();
    })
    .catch(error => { elements.status.textContent = error.message; });

accusationControls.initialize();
