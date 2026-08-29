export function createEntityRenderer(boardElement, boardLayout, getGameState) {
    let characterDialogue = new Map();
    const activeAnimations = new Set();
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

    function nextFrame() {
        return new Promise(resolve => window.requestAnimationFrame(resolve));
    }

    async function animate(sprite, previousPosition, currentPosition, path) {
        if (!sprite || !path?.length) return false;
        const tiles = [previousPosition, ...path];
        const token = { cancelled: false };
        activeAnimations.add(token);
        const transformFor = tile => `translate(calc(-50% + ${(tile.col - currentPosition.col) * boardLayout.cellSize}px), ${(tile.row - currentPosition.row) * boardLayout.cellSize}px)`;
        let frame = 1;
        const art = sprite.querySelector(".sprite-art");
        const frameTimer = window.setInterval(() => {
            art.style.backgroundPosition = `${(frame / 7) * 100}% top`;
            frame = frame === 6 ? 1 : frame + 1;
        }, 100);

        try {
            sprite.style.transform = transformFor(tiles[0]);
            // Two frames guarantee that the starting position is painted before
            // progression begins in browsers with different compositor timing.
            await nextFrame();
            await nextFrame();
            for (let index = 1; index < tiles.length && !token.cancelled; index += 1) {
                const from = tiles[index - 1];
                const to = tiles[index];
                const startedAt = performance.now();
                await new Promise(resolve => {
                    function step(now) {
                        if (token.cancelled) return resolve();
                        const progress = Math.min(1, (now - startedAt) / 180);
                        const tile = {
                            row: from.row + ((to.row - from.row) * progress),
                            col: from.col + ((to.col - from.col) * progress)
                        };
                        sprite.style.transform = transformFor(tile);
                        if (progress < 1) window.requestAnimationFrame(step);
                        else resolve();
                    }
                    window.requestAnimationFrame(step);
                });
            }
            if (!token.cancelled) sprite.style.transform = transformFor(currentPosition);
            return !token.cancelled;
        } finally {
            window.clearInterval(frameTimer);
            art.style.backgroundPosition = "left top";
            activeAnimations.delete(token);
        }
    }

    function cancelAnimations() {
        activeAnimations.forEach(token => { token.cancelled = true; });
    }

    return { setDialogue, showDialogue, positionSpeechBubbles, render, animate, cancelAnimations };
}
