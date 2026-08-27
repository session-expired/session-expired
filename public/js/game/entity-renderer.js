export function createEntityRenderer(boardElement, boardLayout, getGameState) {
    let characterDialogue = new Map();
    const characterNames = {
        bonaparte: "Napolean",
        rasputin: "Rasputin",
        crowley: "Crowley",
        lovelace: "Lovelace",
        brahe: "Brahe",
        curie: "Curie",
        mallon: "Typhoid Mary"
    };

    function setDialogue(dialogue) {
        characterDialogue = new Map(dialogue.map(character => [character.character, character.dialogue]));
    }

    function showDialogue(character, group) {
        const sayings = characterDialogue.get(character)?.[group] || [];
        if (!sayings.length) return "";
        const text = sayings[Math.floor(Math.random() * sayings.length)];
        const sender = characterNames[character];
        if (!sender) return "";
        window.dispatchEvent(new CustomEvent("game-flavor-message", {
            detail: { sender, text }
        }));
        return text;
    }

    function positionSpeechBubbles() {
        // Kept as a layout callback; flavor text now renders in game chat.
    }

    function render() {
        const state = getGameState();
        if (!state) return;
        boardElement.querySelectorAll(".player-sprite").forEach(sprite => sprite.remove());
        const entities = [...state.players, ...(state.warden ? [{ ...state.warden, username: "Warden" }] : [])];
        entities.forEach(entity => {
            if (!entity.character || !entity.position) return;
            const square = boardLayout.squareAt(entity.position.row, entity.position.col);
            if (!square) return;
            const sprite = document.createElement("div");
            sprite.className = "player-sprite";
            if (entity.username === "Warden") sprite.classList.add("warden-sprite");
            if (entity.id) sprite.dataset.entityId = String(entity.id);
            const art = document.createElement("div");
            art.className = "sprite-art";
            art.style.backgroundImage = `url("/assets/images/chars/${encodeURIComponent(entity.character)}/${encodeURIComponent(entity.character)}.png")`;
            if (entity.facing === "left") art.classList.add("facing-left");
            sprite.appendChild(art);
            sprite.title = `${entity.username} (${entity.character})`;
            sprite.setAttribute("role", "img");
            sprite.setAttribute("aria-label", sprite.title);
            square.appendChild(sprite);
        });
    }

    function animate(sprite, previousPosition, currentPosition, path) {
        if (!sprite || !path?.length) return;
        const duration = Math.max(400, path.length * 180);
        const tiles = [previousPosition, ...path];
        const keyframes = tiles.map((tile, index) => ({
            offset: index / (tiles.length - 1),
            transform: `translate(calc(-50% + ${(tile.col - currentPosition.col) * boardLayout.cellSize}px), ${(tile.row - currentPosition.row) * boardLayout.cellSize}px)`
        }));
        const movementAnimation = sprite.animate(keyframes, { duration, easing: "linear" });
        let frame = 1;
        const art = sprite.querySelector(".sprite-art");
        const frameTimer = window.setInterval(() => {
            art.style.backgroundPosition = `${(frame / 7) * 100}% top`;
            frame = frame === 6 ? 1 : frame + 1;
        }, 100);
        window.setTimeout(() => {
            window.clearInterval(frameTimer);
            art.style.backgroundPosition = "left top";
        }, duration);
    }

    return { setDialogue, showDialogue, positionSpeechBubbles, render, animate };
}
