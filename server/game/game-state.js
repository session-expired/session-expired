const { spawnPoints, blockedTiles, searchItems } = require("./board-data");
const { createSolution } = require("./solution");
const { roomsForSolution } = require("./hint-rules");

function shuffle(items, random) {
    for (let index = items.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

function createInitialGameState(gamePlayers, random = Math.random, lobby = {}) {
    if (gamePlayers.length > spawnPoints.length) {
        throw new Error("There are more players than available spawn points.");
    }
    const availableSpawnPoints = shuffle(spawnPoints.map(point => ({ ...point })), random);
    const solution = createSolution(random);
    const gameRooms = roomsForSolution(solution);
    const activeHintIds = new Set(gameRooms.flatMap(room => room.hintIds));
    const players = gamePlayers.map((player, index) => ({
        id: String(player.id), username: player.username, character: player.selected_character,
        canAccuse: true, turnsToSkip: 0, discoveredHintIds: [], position: availableSpawnPoints[index],
        facing: "right", dialogueEvent: null, dialogueEventId: 0, secretPassageCooldown: null
    }));
    const turnOrder = shuffle(players.map(player => String(player.id)), random);

    return {
        lobbyId: lobby.id == null ? null : String(lobby.id),
        lobbyName: lobby.name ?? null,
        status: "active",
        board: {
            rows: 24,
            cols: 30,
            rooms: gameRooms,
            blockedTiles: structuredClone(blockedTiles),
            searchItems: searchItems.map(item => ({
                ...structuredClone(item),
                hintIds: (item.hintIds || []).filter(hintId => activeHintIds.has(hintId))
            }))
        },
        players,
        warden: {
            character: "bonaparte", position: { row: 13, col: 13 }, previousPosition: null,
            lastRoll: null, lastPath: [], turnsTaken: 0, dialogueEvent: null,
            dialogueEventId: 0, facing: "right"
        },
        turn: {
            number: 1, round: 1, order: turnOrder, playerIndex: 0,
            playerId: turnOrder[0] ?? null, phase: "awaiting_roll",
            die: { sides: 8, roll: null }, movementRemaining: 0, visitedPositions: []
        },
        solution,
        winner: null,
        createdAt: Date.now()
    };
}

module.exports = { createInitialGameState };
