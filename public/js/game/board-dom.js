export const elements = {
    status: document.getElementById("game-status"),
    quitButton: document.getElementById("quit-game"),
    game: document.getElementById("game"),
    board: document.getElementById("board"),
    boardViewport: document.getElementById("board-viewport"),
    zoomOutButton: document.getElementById("zoom-out"),
    zoomResetButton: document.getElementById("zoom-reset"),
    zoomInButton: document.getElementById("zoom-in"),
    turnStatus: document.getElementById("turn-status"),
    rollMovementButton: document.getElementById("roll-movement"),
    endTurnButton: document.getElementById("end-turn"),
    accusationForm: document.getElementById("accusation-form"),
    accusationStatus: document.getElementById("accusation-status"),
    clickOutput: document.getElementById("clickOutput")
};

elements.accuseButton = elements.accusationForm?.querySelector('button[type="submit"]');
