import { accuse, guess, loadAccusationOptions } from "./board-api.js";

const fieldLabels = { killer: "Murderer", victim: "Victim", room: "Room", method: "Method" };
const fieldByCategory = { murderer: "killer", victim: "victim", room: "room", method: "method" };

export function createDeductionControls(elements, gameId, callbacks) {
    let mode = null;
    let optionsByField = null;
    let currentState = null;
    let currentUserId = null;
    let submitting = false;
    const selections = {};
    const fieldElements = new Map();

    function eliminatedValues(player) {
        const result = new Map(Object.values(fieldByCategory).map(field => [field, new Set()]));
        for (const hint of player?.discoveredHints || []) {
            const field = fieldByCategory[hint.category];
            if (!field) continue;
            const values = Array.isArray(hint.eliminates) ? hint.eliminates : hint.excludes == null ? [] : [hint.excludes];
            values.forEach(value => result.get(field).add(value));
        }
        return result;
    }

    function closeOptionLists(except = null) {
        for (const controls of fieldElements.values()) {
            if (controls.list === except) continue;
            controls.list.hidden = true;
            controls.trigger.setAttribute("aria-expanded", "false");
        }
    }

    function renderOptions() {
        if (!optionsByField || !currentState) return;
        const player = currentState.players.find(candidate => String(candidate.id) === String(currentUserId));
        const eliminated = eliminatedValues(player);
        for (const [field, controls] of fieldElements) {
            const allowedVictims = new Set(currentState.candidates?.victims || []);
            const options = field === "victim" && allowedVictims.size
                ? optionsByField[field].filter(option => allowedVictims.has(option.id))
                : optionsByField[field];
            if (!options.some(option => option.id === selections[field])) selections[field] = options[0]?.id;
            const selected = options.find(option => option.id === selections[field]);
            controls.value.textContent = selected?.name || "Choose";
            controls.list.replaceChildren(...options.map(option => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "deduction-option";
                button.setAttribute("role", "option");
                button.setAttribute("aria-selected", String(option.id === selections[field]));
                const isEliminated = eliminated.get(field).has(option.id);
                button.classList.toggle("eliminated", isEliminated);
                const mark = document.createElement("span");
                mark.className = "elimination-mark";
                mark.textContent = isEliminated ? "×" : "";
                mark.setAttribute("aria-hidden", "true");
                const label = document.createElement("span");
                label.textContent = option.name;
                button.setAttribute("aria-label", `${isEliminated ? "Known eliminated: " : ""}${option.name}`);
                button.append(mark, label);
                button.addEventListener("click", () => {
                    selections[field] = option.id;
                    renderOptions();
                    closeOptionLists();
                    controls.trigger.focus();
                });
                return button;
            }));
        }
    }

    function buildFields() {
        elements.deductionFields.replaceChildren();
        for (const field of Object.keys(fieldLabels)) {
            const group = document.createElement("div");
            group.className = "deduction-field";
            const label = document.createElement("span");
            label.className = "deduction-label";
            label.textContent = fieldLabels[field];
            const trigger = document.createElement("button");
            trigger.type = "button";
            trigger.className = "deduction-trigger";
            trigger.setAttribute("aria-haspopup", "listbox");
            trigger.setAttribute("aria-expanded", "false");
            trigger.setAttribute("aria-label", `Choose ${fieldLabels[field]}`);
            const value = document.createElement("span");
            const arrow = document.createElement("span");
            arrow.textContent = "▾";
            arrow.setAttribute("aria-hidden", "true");
            trigger.append(value, arrow);
            const list = document.createElement("div");
            list.className = "deduction-options";
            list.setAttribute("role", "listbox");
            list.setAttribute("aria-label", fieldLabels[field]);
            list.hidden = true;
            trigger.addEventListener("click", () => {
                const opening = list.hidden;
                closeOptionLists(list);
                list.hidden = !opening;
                trigger.setAttribute("aria-expanded", String(opening));
                if (opening) list.querySelector('[aria-selected="true"]')?.focus();
            });
            group.append(label, trigger, list);
            elements.deductionFields.append(group);
            fieldElements.set(field, { trigger, value, list });
        }
    }

    function eligibility(state, userId) {
        const player = state.players.find(candidate => String(candidate.id) === String(userId));
        const mine = String(state.turn?.playerId) === String(userId);
        const adjacent = player?.position && state.warden?.position &&
            Math.abs(player.position.row - state.warden.position.row) + Math.abs(player.position.col - state.warden.position.col) === 1;
        const acceptsInput = callbacks.canPerformAction?.() !== false;
        return {
            guess: Boolean(acceptsInput && optionsByField && state.status === "active" && mine && state.turn.phase === "awaiting_end" &&
                state.turn.movementRemaining === 0 && !state.turn.hasGuessedThisTurn),
            accusation: Boolean(acceptsInput && optionsByField && state.status === "active" && mine && adjacent && player?.canAccuse),
            mine, adjacent, player
        };
    }

    function close() {
        mode = null;
        elements.deductionPanel.hidden = true;
        closeOptionLists();
    }

    function open(nextMode) {
        if (!currentState || !eligibility(currentState, currentUserId)[nextMode]) return;
        mode = nextMode;
        elements.deductionTitle.textContent = nextMode === "guess" ? "Make a Guess" : "Make an Accusation";
        elements.submitDeductionButton.textContent = nextMode === "guess" ? "Make Guess" : "Accuse";
        elements.deductionPanel.hidden = false;
        renderOptions();
        fieldElements.values().next().value?.trigger.focus();
    }

    async function initialize() {
        buildFields();
        try {
            optionsByField = await loadAccusationOptions();
            for (const [field, options] of Object.entries(optionsByField)) selections[field] = options[0]?.id;
            callbacks.onEligibilityChanged();
        } catch { callbacks.onStatus("Deduction options could not be loaded."); }
    }

    function render(state, userId) {
        currentState = state;
        currentUserId = String(userId);
        const allowed = eligibility(state, currentUserId);
        elements.openGuessButton.disabled = !allowed.guess || submitting;
        elements.openAccusationButton.disabled = !allowed.accusation || submitting;
        elements.guessAvailability.textContent = allowed.guess ? "Ready" : !allowed.mine ? "Wait for your turn" : "Use all movement";
        elements.accusationAvailability.textContent = allowed.accusation ? "Warden in range" : !allowed.mine ? "Wait for your turn" : !allowed.adjacent ? "Warden out of range" : "Unavailable";
        if (mode && !allowed[mode]) close();
        else if (mode) renderOptions();
    }

    elements.openGuessButton.addEventListener("click", () => open("guess"));
    elements.openAccusationButton.addEventListener("click", () => open("accusation"));
    elements.cancelDeductionButton.addEventListener("click", close);
    elements.deductionPanel.addEventListener("submit", async event => {
        event.preventDefault();
        if (!mode || submitting) return;
        submitting = true;
        elements.submitDeductionButton.disabled = true;
        const submittedMode = mode;
        const currentPlayerCharacter = allowedCharacter();
        try {
            const data = submittedMode === "guess" ? await guess(gameId, selections) : await accuse(gameId, selections);
            close();
            if (submittedMode === "guess") {
                callbacks.onStatus(data.hint ? `${data.provider.username} disproved your guess: ${data.hint.text}` :
                    data.disproved ? `${data.provider.username} could disprove your guess, but you already knew the relevant hint.` :
                        "No player could disprove your guess.");
            } else {
                if (currentPlayerCharacter) {
                    callbacks.onDialogue(currentPlayerCharacter, "accuse");
                    callbacks.onDialogue(currentPlayerCharacter, data.correct ? "correct_accusation" : "wrong_accusation");
                }
                callbacks.onStatus(data.correct ? "Correct accusation — game finished." : "Incorrect accusation — your session has ended.");
            }
            callbacks.onState(data.state);
        } catch (error) { callbacks.onStatus(error.message); }
        finally { submitting = false; elements.submitDeductionButton.disabled = false; callbacks.onEligibilityChanged(); }
    });

    function allowedCharacter() {
        return currentState?.players.find(player => String(player.id) === currentUserId)?.character || null;
    }

    document.addEventListener("click", event => {
        if (!elements.deductionPanel.contains(event.target)) closeOptionLists();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeOptionLists();
    });

    return { initialize, render, close };
}
