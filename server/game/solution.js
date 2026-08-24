const { methods } = require("../../public/assets/methods.json");
const { rooms } = require("../../public/assets/rooms.json");
const { murderers } = require("../../public/assets/murderers.json");
const { victims } = require("../../public/assets/victims.json");

const solutionPools = Object.freeze({
    killers: murderers,
    victims,
    rooms: rooms.filter(room => room.canBeMurderScene),
    methods
});

function createSolution(random = Math.random) {
    const choose = options => options[Math.floor(random() * options.length)];
    return {
        killer: choose(solutionPools.killers).id,
        victim: choose(solutionPools.victims).id,
        room: choose(solutionPools.rooms).id,
        method: choose(solutionPools.methods).id
    };
}

module.exports = { solutionPools, createSolution };
