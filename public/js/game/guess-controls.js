import { guess, loadAccusationOptions } from "./board-api.js";

export function createGuessControls(elements, gameId, callbacks) {
    let optionsLoaded = false;
    let submitting = false;

    async function initialize() {
        try {
            const groups = await loadAccusationOptions();
            for (const [name, options] of Object.entries(groups)) {
                elements.guessForm.elements.namedItem(name)
                    .replaceChildren(...options.map(item => new Option(item.name, item.id)));
            }
            optionsLoaded = true;
            callbacks.onEligibilityChanged();
        } catch { callbacks.onStatus("Guess options could not be loaded."); }
    }

    function render(state, currentUserId) {
        const mineAtEnd = String(state.turn?.playerId) === String(currentUserId) && state.turn.phase === "awaiting_end";
        const eligible = optionsLoaded && !submitting && state.status === "active" && mineAtEnd &&
            state.turn.movementRemaining === 0 && !state.turn.hasGuessedThisTurn;
        elements.openGuessButton.hidden = !mineAtEnd;
        elements.openGuessButton.disabled = !eligible;
    }

    elements.openGuessButton.addEventListener("click", () => elements.guessDialog.showModal());
    elements.cancelGuessButton.addEventListener("click", () => elements.guessDialog.close());
    elements.guessForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (submitting) return;
        submitting = true;
        const submit = elements.guessForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            const data = await guess(gameId, Object.fromEntries(new FormData(elements.guessForm)));
            elements.guessDialog.close();
            callbacks.onState(data.state);
            callbacks.onStatus(data.hint
                ? `${data.provider.username} disproved your guess: ${data.hint.text}`
                : data.disproved
                    ? `${data.provider.username} could disprove your guess, but you already knew the relevant hint.`
                    : "No player could disprove your guess.");
        } catch (error) { callbacks.onStatus(error.message); }
        finally { submitting = false; submit.disabled = false; callbacks.onEligibilityChanged(); }
    });

    return { initialize, render };
}
