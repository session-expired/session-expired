async function jsonRequest(url, options = {}, fallbackMessage = "Request failed.") {
    const response = await fetch(url, options);
    if (response.status === 401) {
        window.location.assign("/login");
        throw new Error("Your session has expired. Redirecting to login.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        throw new Error(`The server returned an unexpected response (${response.status}).`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || fallbackMessage);
    return data;
}

export async function loadGameResources(gameId) {
    const [game, board, sayings] = await Promise.all([
        jsonRequest(`/api/games/${gameId}`, {}, "Unable to load this game."),
        jsonRequest("/api/board", {}, "Unable to load the board."),
        jsonRequest("/assets/character_sayings.json", {}, "Unable to load character sayings.")
    ]);
    return { game, board, sayings };
}

export const rollMovement = gameId =>
    jsonRequest(`/api/games/${gameId}/roll`, { method: "POST" }, "Unable to roll the movement die.");

export const endTurn = gameId =>
    jsonRequest(`/api/games/${gameId}/end-turn`, { method: "POST" }, "Unable to end the turn.");

export const movePlayer = (gameId, destination) => jsonRequest(`/api/games/${gameId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(destination)
}, "Unable to move there.");

export const discoverHint = (gameId, hintId) =>
    jsonRequest(`/api/games/${gameId}/hints/${encodeURIComponent(hintId)}`, {
        method: "POST"
    }, "Unable to investigate that object.");

export const accuse = (gameId, accusation) => jsonRequest(`/api/games/${gameId}/accuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accusation)
}, "Unable to make that accusation.");

export const quitGame = gameId => jsonRequest(`/api/games/${gameId}/quit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
}, "Unable to quit the game.");

export async function loadAccusationOptions() {
    const [killers, victims, rooms, methods] = await Promise.all([
        jsonRequest("/assets/murderers.json"),
        jsonRequest("/assets/victims.json"),
        jsonRequest("/assets/rooms.json"),
        jsonRequest("/assets/methods.json")
    ]);
    return {
        killer: killers.murderers,
        victim: victims.victims,
        room: rooms.rooms.filter(room => room.canBeMurderScene),
        method: methods.methods
    };
}
