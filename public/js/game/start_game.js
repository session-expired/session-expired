import { createHintPool } from "./hints.js";

export function startGame(players, rooms, characters, methods) {
    const murderer = randomItem(characters);
    const murderRoom = randomItem(rooms);
    const murderMethod = randomItem(methods);

    return {
        players,
        currentPlayer: 0,

        solution: {
            murderer,
            room: murderRoom,
            weapon: murderWeapon
        },

        hints: createHintPool({
            murderer,
            murderRoom,
            murderWeapon,
            characters,
            rooms,
            weapons
        }),

        started: true,
        finished: false
    };
}

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}