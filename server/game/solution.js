const { methods } = require("../../public/assets/methods.json");
const { rooms } = require("../../public/assets/rooms.json");
const { murderers } = require("../../public/assets/murderers.json");
const { victims } = require("../../public/assets/victims.json");
const { characterIds } = require("../lobby/characters");

const WARDEN_VICTIM_SOURCE = "napoleon";

const solutionPools = Object.freeze({
    killers: murderers,
    victims,
    rooms: rooms.filter(room => room.canBeMurderScene),
    methods
});

function victimCandidatesForCharacters(activeCharacterIds) {
    const knownSources = new Set([...characterIds, WARDEN_VICTIM_SOURCE]);
    for (const victim of victims) {
        if (!victim?.id || typeof victim.name !== "string" || !knownSources.has(victim.sourceCharacter)) {
            throw new Error(`Victim ${victim?.id || "<missing id>"} has an invalid sourceCharacter.`);
        }
    }
    const requestedSources = activeCharacterIds.filter(source => source != null);
    const unknownSource = requestedSources.find(source => !characterIds.has(source));
    if (unknownSource) throw new Error(`Unknown active character: ${unknownSource}.`);
    // Older unit fixtures omit character selection; retain their full-pool behavior.
    const activeSources = requestedSources.length ? requestedSources : [...characterIds];
    const allowedSources = new Set([...activeSources, WARDEN_VICTIM_SOURCE]);
    const candidates = victims.filter(victim => allowedSources.has(victim.sourceCharacter));
    if (!candidates.length) throw new Error("The active character roster has no eligible victims.");
    return candidates;
}

function createSolution(random = Math.random, pools = solutionPools) {
    const choose = options => options[Math.floor(random() * options.length)];
    return {
        killer: choose(pools.killers).id,
        victim: choose(pools.victims).id,
        room: choose(pools.rooms).id,
        method: choose(pools.methods).id
    };
}

module.exports = { WARDEN_VICTIM_SOURCE, solutionPools, victimCandidatesForCharacters, createSolution };
