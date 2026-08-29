const hintCatalog = require("./hints.json");
const { rooms, roomAtPosition } = require("./board-data");
const { solutionPools } = require("./solution");

const MAX_HINTS_PER_SOURCE = 7;
const HINTS_PER_SEARCH = 2;
const solutionFieldByHintCategory = Object.freeze({
    murderer: "killer", victim: "victim", room: "room", method: "method"
});
const poolByHintCategory = Object.freeze({
    murderer: "killers", victim: "victims", room: "rooms", method: "methods"
});

function eliminatedCandidates(hint) {
    if (Array.isArray(hint.eliminates)) return hint.eliminates;
    return hint.excludes == null ? [] : [hint.excludes];
}

function hintSupportsSolution(hint, solution) {
    const field = solutionFieldByHintCategory[hint.category];
    return Boolean(field) && !eliminatedCandidates(hint).includes(solution[field]);
}

function selectRequiredHints(solution, catalog = hintCatalog) {
    const selected = [];
    for (const category of catalog.categories) {
        const solutionField = solutionFieldByHintCategory[category];
        const poolName = poolByHintCategory[category];
        if (!solutionField || !poolName) throw new Error(`Invalid hint category: ${category}`);
        const uncovered = new Set(solutionPools[poolName].map(candidate => candidate.id)
            .filter(id => id !== solution[solutionField]));
        const candidates = catalog.hints.filter(hint =>
            hint.category === category && hintSupportsSolution(hint, solution)
        );
        while (uncovered.size) {
            const best = candidates.filter(hint => !selected.includes(hint))
                .map(hint => ({ hint, coverage: eliminatedCandidates(hint).filter(id => uncovered.has(id)) }))
                .sort((left, right) => right.coverage.length - left.coverage.length)[0];
            if (!best?.coverage.length) {
                throw new Error(`Hint catalog cannot eliminate: ${category} ${[...uncovered].join(", ")}`);
            }
            selected.push(best.hint);
            best.coverage.forEach(id => uncovered.delete(id));
        }
    }
    return selected.map(hint => hint.id);
}

function distributeHints(solution, searchItems, random = Math.random, catalog = hintCatalog) {
    const sources = searchItems.map(item => ({ ...structuredClone(item), hintIds: [] }));
    const requiredHintIds = selectRequiredHints(solution, catalog);
    if (!sources.length && requiredHintIds.length) throw new Error("The board has no search sources.");
    if (requiredHintIds.length > sources.length * MAX_HINTS_PER_SOURCE) {
        throw new Error("The board has insufficient search-source capacity for the required hints.");
    }
    const offset = sources.length ? Math.floor(random() * sources.length) : 0;
    requiredHintIds.forEach((hintId, index) => {
        sources[(offset + index) % sources.length].hintIds.push(hintId);
    });
    return sources;
}

function validateHintDistribution(game, catalog = hintCatalog) {
    const definitions = new Map(catalog.hints.map(hint => [hint.id, hint]));
    const coverage = new Map(catalog.categories.map(category => [category, new Set()]));
    for (const source of game.board?.searchItems || []) {
        if (!Array.isArray(source.hintIds)) throw new Error(`Search source ${source.id} has invalid hint inventory.`);
        if (source.hintIds.length > MAX_HINTS_PER_SOURCE) {
            throw new Error(`Search source ${source.id} exceeds ${MAX_HINTS_PER_SOURCE} hints.`);
        }
        for (const hintId of source.hintIds) {
            const hint = definitions.get(hintId);
            if (!hint) throw new Error(`Placed hint does not exist: ${hintId}`);
            if (!catalog.categories.includes(hint.category)) throw new Error(`Hint ${hintId} has an invalid category.`);
            if (!hintSupportsSolution(hint, game.solution)) throw new Error(`Hint ${hintId} eliminates the actual solution.`);
            eliminatedCandidates(hint).forEach(id => coverage.get(hint.category).add(id));
        }
    }
    for (const category of catalog.categories) {
        const field = solutionFieldByHintCategory[category];
        const required = solutionPools[poolByHintCategory[category]].map(candidate => candidate.id)
            .filter(id => id !== game.solution[field]);
        const missing = required.filter(id => !coverage.get(category).has(id));
        if (missing.length) throw new Error(`Hint distribution cannot eliminate: ${category} ${missing.join(", ")}`);
    }
    return true;
}

function roomsForSolution(solution) {
    return rooms.map(room => ({
        ...room,
        hintIds: hintCatalog.hints
            .filter(hint => hint.roomId === room.id && hintSupportsSolution(hint, solution))
            .map(hint => hint.id)
    }));
}

function isAdjacentToArea(position, area) {
    const rowDistance = position.row < area.rows.start ? area.rows.start - position.row :
        position.row > area.rows.end ? position.row - area.rows.end : 0;
    const colDistance = position.col < area.cols.start ? area.cols.start - position.col :
        position.col > area.cols.end ? position.col - area.cols.end : 0;
    return rowDistance + colDistance === 1;
}

function discoverHint(state, playerId, searchItemId, catalog = hintCatalog) {
    if (state.status !== "active") throw new Error("This game has already finished.");
    if (String(state.turn.playerId) !== String(playerId)) throw new Error("It is not this player's turn.");
    if (state.turn.phase !== "moving" || state.turn.movementRemaining <= 0) {
        throw new Error("Roll and retain movement points before searching.");
    }
    const player = state.players.find(candidate => String(candidate.id) === String(playerId));
    if (!player) throw new Error("Player not found.");
    const searchItem = state.board.searchItems?.find(item =>
        item.id === searchItemId || item.hintIds?.includes(searchItemId)
    );
    if (!searchItem) throw new Error("This search source is not active in this game.");
    const currentRoom = roomAtPosition(state, player.position);
    if (!currentRoom || currentRoom.id !== searchItem.roomId) throw new Error("You can only search objects in your current room.");
    if (!isAdjacentToArea(player.position, searchItem)) throw new Error("You must be adjacent to the search item to discover its hint.");

    const awardedIds = searchItem.hintIds.splice(0, HINTS_PER_SEARCH);
    const hints = awardedIds.map(hintId => {
        const hint = catalog.hints.find(candidate => candidate.id === hintId);
        if (!hint) throw new Error(`Placed hint does not exist: ${hintId}`);
        if (!catalog.categories.includes(hint.category)) throw new Error(`Hint ${hintId} has an invalid category.`);
        if (!hintSupportsSolution(hint, state.solution)) throw new Error(`Hint ${hintId} conflicts with the game's solution.`);
        return hint;
    });
    if (!Array.isArray(player.discoveredHintIds)) player.discoveredHintIds = [];
    if (!Array.isArray(player.discoveredHints)) player.discoveredHints = [];
    for (const hint of hints) {
        if (!player.discoveredHintIds.includes(hint.id)) player.discoveredHintIds.push(hint.id);
        const discovered = {
            id: hint.id, category: hint.category, text: hint.text,
            excludes: hint.excludes, searchItemId: searchItem.id
        };
        if (Array.isArray(hint.eliminates)) discovered.eliminates = [...hint.eliminates];
        player.discoveredHints.push(discovered);
    }
    if (!hints.length) {
        player.dialogueEvent = "empty_search";
        player.dialogueEventId = (player.dialogueEventId || 0) + 1;
    }
    state.turn.movementRemaining = 0;
    state.turn.phase = "awaiting_end";
    return { hints, hint: hints[0] || null, empty: hints.length === 0, remainingHintCount: searchItem.hintIds.length };
}

module.exports = {
    MAX_HINTS_PER_SOURCE, HINTS_PER_SEARCH, hintCatalog, eliminatedCandidates, hintSupportsSolution,
    selectRequiredHints, distributeHints, validateHintDistribution, roomsForSolution, isAdjacentToArea, discoverHint
};
