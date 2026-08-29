const { solutionPools } = require("./solution");
const { eliminatedCandidates, hintCatalog } = require("./hint-rules");
const { finishPlayerTurn } = require("./turns");

const fields = ["killer", "victim", "room", "method"];
const poolByField = { killer: "killers", victim: "victims", room: "rooms", method: "methods" };
const fieldByCategory = { murderer: "killer", victim: "victim", room: "room", method: "method" };

function validateGuess(guess, pools = solutionPools) {
    if (fields.some(field => typeof guess?.[field] !== "string")) {
        throw new Error("Choose a killer, victim, room, and method.");
    }
    const normalized = {};
    for (const field of fields) {
        normalized[field] = guess[field].trim();
        const pool = field === "victim" && Array.isArray(pools.victims) && typeof pools.victims[0] === "string"
            ? pools.victims.map(id => ({ id })) : pools[poolByField[field]];
        if (!pool.some(option => option.id === normalized[field])) {
            throw new Error(`Choose a valid ${field}.`);
        }
    }
    return normalized;
}

function hintDisprovesGuess(hint, guess) {
    const field = fieldByCategory[hint.category];
    return Boolean(field) && eliminatedCandidates(hint).includes(guess[field]);
}

function orderedOpponents(state, playerId) {
    const order = state.turn.order.map(String);
    const start = order.indexOf(String(playerId));
    if (start < 0) return [];
    return order.slice(start + 1).concat(order.slice(0, start))
        .map(id => state.players.find(player => String(player.id) === id))
        .filter(Boolean);
}

function submitGuess(state, playerId, submittedGuess, random = Math.random, catalog = hintCatalog) {
    if (state.status !== "active" || state.turn.phase === "finished") throw new Error("This game has already finished.");
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    if (state.turn.phase !== "awaiting_end" || state.turn.movementRemaining !== 0) {
        throw new Error("Use all movement points before making a guess.");
    }
    if (state.turn.hasGuessedThisTurn) throw new Error("You have already guessed this turn.");
    const guess = validateGuess(submittedGuess, { ...solutionPools, victims: state.candidates?.victims || solutionPools.victims });
    const guessingPlayer = state.players.find(player => String(player.id) === String(playerId));
    if (!guessingPlayer) throw new Error("Player not found.");
    state.turn.hasGuessedThisTurn = true;

    const definitions = new Map(catalog.hints.map(hint => [hint.id, hint]));
    const known = new Set(guessingPlayer.discoveredHintIds || []);
    let provider = null;
    let qualifying = [];
    for (const opponent of orderedOpponents(state, playerId)) {
        qualifying = (opponent.discoveredHintIds || [])
            .map(id => definitions.get(id))
            .filter(hint => hint && hintDisprovesGuess(hint, guess));
        if (qualifying.length) { provider = opponent; break; }
    }

    const newHints = qualifying.filter(hint => !known.has(hint.id));
    const revealed = newHints.length ? newHints[Math.floor(random() * newHints.length)] : null;
    if (revealed) {
        if (!Array.isArray(guessingPlayer.discoveredHintIds)) guessingPlayer.discoveredHintIds = [];
        if (!Array.isArray(guessingPlayer.discoveredHints)) guessingPlayer.discoveredHints = [];
        guessingPlayer.discoveredHintIds.push(revealed.id);
        guessingPlayer.discoveredHints.push({
            id: revealed.id, category: revealed.category, text: revealed.text, excludes: revealed.excludes,
            ...(Array.isArray(revealed.eliminates) ? { eliminates: [...revealed.eliminates] } : {}),
            searchItemId: null, source: "shared", sharedByPlayerId: provider.id
        });
    }

    const result = {
        disproved: Boolean(provider),
        provider: provider ? { id: provider.id, username: provider.username } : null,
        hint: revealed ? { id: revealed.id, category: revealed.category, text: revealed.text } : null,
        guess
    };
    result.transition = finishPlayerTurn(state, playerId, random);
    return result;
}

module.exports = { fields, validateGuess, hintDisprovesGuess, orderedOpponents, submitGuess };
