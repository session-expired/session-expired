const { getSquareType } = require("./board");

let turnState = {
    currentPlayer: 0,
    actionTaken: false
};

//Call once at game start to randomize who goes first
//Can be called in createInitialGameStance
function initializeTurnOrder(numPlayers) {
    turnState.currentPlayer = Math.floor(Math.random() * numPlayers);
    turnState.actionTaken = false;
}

//This should be called after movement or a guess to change flag to true
function endTurn(numPlayers) {
    turnState.currentPlayer = (turnState.currentPlayer + 1) % numPlayers;
    turnState.actionTaken = false;
}

//This would be called before movement to see if it's that players turn
function isPlayersTurn(playerIndex) {
    return turnState.currentPlayer === playerIndex;
}

function hasActed(playerIndex) {
    return isPlayersTurn(playerIndex) && turnState.actionTaken;
}

//Gate to check before letting a player roll or guess at all
function canAct(playerIndex) {
    return isPlayersTurn(playerIndex) && !turnState.actionTaken;
}

function canGuess(row, col) {
    return getSquareType(row, col) === "room" || getSquareType(row, col) === "door";
}

module.exports = { turnState, initializeTurnOrder, endTurn, isPlayersTurn, hasActed, canAct, canGuess };