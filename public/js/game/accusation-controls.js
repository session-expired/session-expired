import { accuse, loadAccusationOptions } from "./board-api.js";

export function createAccusationControls(elements, gameId, callbacks) {
    let optionsLoaded = false;

    function renderEliminatedOptions(player) {
        const fieldByCategory = {
            murderer: "killer",
            victim: "victim",
            room: "room",
            method: "method"
        };
        const eliminatedByField = new Map();

        for (const hint of player?.discoveredHints || []) {
            const field = fieldByCategory[hint.category];
            if (!field || !hint.excludes) continue;
            if (!eliminatedByField.has(field)) eliminatedByField.set(field, new Set());
            eliminatedByField.get(field).add(hint.excludes);
        }

        for (const field of Object.values(fieldByCategory)) {
            const select = elements.accusationForm.elements.namedItem(field);
            const eliminated = eliminatedByField.get(field) || new Set();
            for (const option of select?.options || []) {
                option.classList.toggle("accusation-option-eliminated", eliminated.has(option.value));
            }
        }
    }

    async function initialize() {
        if (!elements.accusationForm) return;
        try {
            const groups = await loadAccusationOptions();
            for (const [name, options] of Object.entries(groups)) {
                elements.accusationForm.elements.namedItem(name)
                    .replaceChildren(...options.map(item => new Option(item.name, item.id)));
            }
            optionsLoaded = true;
            callbacks.onEligibilityChanged();
        } catch {
            elements.accusationStatus.textContent = "Accusation options could not be loaded.";
            elements.accuseButton.disabled = true;
        }
    }

    function render(state, currentUserId) {
        if (!elements.accusationForm) return;
        const isMine = String(state.turn?.playerId) === currentUserId;
        const player = state.players.find(candidate => String(candidate.id) === currentUserId);
        renderEliminatedOptions(player);
        const adjacent = player?.position && state.warden?.position &&
            Math.abs(player.position.row - state.warden.position.row) +
            Math.abs(player.position.col - state.warden.position.col) === 1;
        const eligible = optionsLoaded && state.status === "active" && isMine && adjacent && player?.canAccuse;
        elements.accuseButton.disabled = !eligible;
        elements.accusationStatus.textContent = eligible ? "You are adjacent to the Warden." :
            !isMine ? "You may only accuse during your turn." :
                !adjacent ? "You must reach the Warden to make an accusation." :
                    "You cannot make another accusation.";
    }

    elements.accusationForm?.addEventListener("submit", async event => {
        event.preventDefault();
        elements.accuseButton.disabled = true;
        try {
            const data = await accuse(gameId, Object.fromEntries(new FormData(elements.accusationForm)));
            callbacks.onStatus(data.correct ? "Correct accusation — game finished." :
                "Incorrect accusation — your turn has ended.");
            callbacks.onState(data.state);
        } catch (error) {
            callbacks.onStatus(error.message);
            callbacks.onEligibilityChanged();
        }
    });

    return { initialize, render };
}
