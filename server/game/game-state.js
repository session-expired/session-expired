const { spawnPoints, blockedTiles, searchItems } = require("./board-data");
const { createSolution, solutionPools, victimCandidatesForCharacters } = require("./solution");
const { hintCatalog, roomsForSolution, dealStartingHints, distributeHints, validateHintDistribution } = require("./hint-rules");

const MAX_GAME_PLAYERS = 4;

function shuffle(items, random) {
    for (let index = items.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

function createInitialGameState(gamePlayers, random = Math.random, lobby = {}) {
    if (gamePlayers.length > MAX_GAME_PLAYERS) {
        throw new Error(`A game supports at most ${MAX_GAME_PLAYERS} players.`);
    }
    if (gamePlayers.length > spawnPoints.length) {
        throw new Error("There are more players than available spawn points.");
    }
    const availableSpawnPoints = shuffle(spawnPoints.map(point => ({ ...point })), random);
    const victimCandidates = victimCandidatesForCharacters(gamePlayers.map(player => player.selected_character));
    const candidatePools = { ...solutionPools, victims: victimCandidates };
    const solution = createSolution(random, candidatePools);
    const startingHands = dealStartingHints(solution, gamePlayers.length, random, hintCatalog, candidatePools);
    const startingHintIds = [...new Set(startingHands.flat().map(hint => hint.id))];
    const gameRooms = roomsForSolution(solution, hintCatalog, startingHintIds, candidatePools);
    const players = gamePlayers.map((player, index) => ({
        id: String(player.id), username: player.username, character: player.selected_character,
        canAccuse: true, turnsToSkip: 0,
        discoveredHintIds: startingHands[index].map(hint => hint.id),
        discoveredHints: startingHands[index].map(hint => ({
            id: hint.id, category: hint.category, text: hint.text, excludes: hint.excludes,
            ...(Array.isArray(hint.eliminates) ? { eliminates: [...hint.eliminates] } : {}),
            searchItemId: null, source: "starting"
        })),
        position: availableSpawnPoints[index],
        facing: "right", dialogueEvent: null, dialogueEventId: 0, secretPassageCooldown: null
    }));
    const turnOrder = shuffle(players.map(player => String(player.id)), random);
    const gameSearchItems = distributeHints(solution, searchItems, random, hintCatalog, startingHintIds, candidatePools);

    const state = {
        lobbyId: lobby.id == null ? null : String(lobby.id),
        lobbyName: lobby.name ?? null,
        status: "active",
        candidates: { victims: victimCandidates.map(victim => victim.id) },
        board: {
            rows: 24,
            cols: 30,
            rooms: gameRooms,
            blockedTiles: structuredClone(blockedTiles),
            searchItems: gameSearchItems
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
            die: { sides: 8, roll: null }, movementRemaining: 0, visitedPositions: [], hasGuessedThisTurn: false
        },
        fullRounds: 0,
        solution,
        winner: null,
        endedAt: null,
        createdAt: Date.now()
    };
    validateHintDistribution(state, hintCatalog, candidatePools);
    return state;
}

module.exports = { MAX_GAME_PLAYERS, createInitialGameState };
