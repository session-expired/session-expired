export function createEntityRenderer(boardElement, boardLayout, getGameState) {
    let characterDialogue = new Map();
    const activeDialogue = new Map();
    const movingAnimations = new Set();
    let speechPositionFrame = null;

    function setDialogue(dialogue) {
        characterDialogue = new Map(dialogue.map(character => [character.character, character.dialogue]));
    }

    function showDialogue(character, group) {
        const sayings = characterDialogue.get(character)?.[group] || [];
        if (!sayings.length) return "";
        const existing = activeDialogue.get(character);
        if (existing) window.clearTimeout(existing.timeout);
        const entry = { text: sayings[Math.floor(Math.random() * sayings.length)], timeout: null };
        const displayDuration = 12000 + (Math.random() * 4000 - 2000);
        entry.timeout = window.setTimeout(() => {
            if (activeDialogue.get(character) !== entry) return;
            activeDialogue.delete(character);
            render();
        }, displayDuration);
        activeDialogue.set(character, entry);
        return entry.text;
    }

    function positionSpeechBubbles() {
        const boardBounds = boardElement.getBoundingClientRect();
        if (!boardBounds.width || !boardBounds.height) return;
        boardElement.querySelectorAll(".character-speech").forEach(speech => {
            speech.style.maxWidth = `${Math.max(0, boardBounds.width - 4)}px`;
            speech.style.maxHeight = `${Math.max(0, boardBounds.height - 4)}px`;
            speech.style.transform = "translateX(-50%)";
            const bubbleBounds = speech.getBoundingClientRect();
            let horizontalShift = 0;
            let verticalShift = 0;
            if (bubbleBounds.left < boardBounds.left + 2) horizontalShift = boardBounds.left + 2 - bubbleBounds.left;
            else if (bubbleBounds.right > boardBounds.right - 2) horizontalShift = boardBounds.right - 2 - bubbleBounds.right;
            if (bubbleBounds.top < boardBounds.top + 2) verticalShift = boardBounds.top + 2 - bubbleBounds.top;
            else if (bubbleBounds.bottom > boardBounds.bottom - 2) verticalShift = boardBounds.bottom - 2 - bubbleBounds.bottom;
            speech.style.transform = `translate(calc(-50% + ${horizontalShift}px), ${verticalShift}px)`;
        });
    }

    function trackSpeechBubbles(animation) {
        movingAnimations.add(animation);
        if (speechPositionFrame === null) {
            const positionWhileMoving = () => {
                positionSpeechBubbles();
                speechPositionFrame = movingAnimations.size
                    ? window.requestAnimationFrame(positionWhileMoving)
                    : null;
            };
            speechPositionFrame = window.requestAnimationFrame(positionWhileMoving);
        }
        const stopTracking = () => {
            movingAnimations.delete(animation);
            positionSpeechBubbles();
        };
        animation.finished.then(stopTracking, stopTracking);
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
            const dialogue = activeDialogue.get(entity.character)?.text;
            if (dialogue) {
                const speech = document.createElement("span");
                speech.className = "character-speech";
                speech.textContent = dialogue;
                sprite.appendChild(speech);
            }
            square.appendChild(sprite);
        });
        window.requestAnimationFrame(positionSpeechBubbles);
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
        trackSpeechBubbles(movementAnimation);
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

    if ("ResizeObserver" in window) new ResizeObserver(positionSpeechBubbles).observe(boardElement);
    document.fonts?.ready.then(positionSpeechBubbles);

    return { setDialogue, showDialogue, positionSpeechBubbles, render, animate };
}
