export function renderMovementRange(state, currentUserId, boardLayout, elements) {
    elements.board.querySelectorAll(".movement-range")
        .forEach(square => square.classList.remove("movement-range"));
    elements.board.querySelectorAll(".search-item-in-range")
        .forEach(square => square.classList.remove("search-item-in-range"));
    elements.board.querySelectorAll(".search-item-has-hints")
        .forEach(square => square.classList.remove("search-item-has-hints"));
    const turn = state?.turn;
    if (turn?.phase !== "moving" || String(turn.playerId) !== currentUserId) return;
    const player = state.players.find(candidate => String(candidate.id) === currentUserId);
    const blocked = new Set(state.players
        .filter(candidate => String(candidate.id) !== currentUserId)
        .map(candidate => `${candidate.position.row},${candidate.position.col}`));
    if (state.warden?.position) blocked.add(`${state.warden.position.row},${state.warden.position.col}`);
    const distances = new Map([[`${player.position.row},${player.position.col}`, 0]]);
    const visited = new Set((turn.visitedPositions || []).map(position => `${position.row},${position.col}`));
    visited.delete(`${player.position.row},${player.position.col}`);
    const queue = [{ ...player.position }];
    const canCrossBoundary = (from, to) => {
        const fromSquare = boardLayout.squareAt(from.row, from.col);
        const toSquare = boardLayout.squareAt(to.row, to.col);
        if ((fromSquare?.dataset.roomName || null) === (toSquare?.dataset.roomName || null)) return true;
        return fromSquare?.dataset.type === "door" || toSquare?.dataset.type === "door";
    };
    const entersDoor = (from, to) => {
        const fromSquare = boardLayout.squareAt(from.row, from.col);
        const toSquare = boardLayout.squareAt(to.row, to.col);
        return !fromSquare?.dataset.roomName && toSquare?.dataset.type === "door";
    };
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const distance = distances.get(`${current.row},${current.col}`);
        if (distance >= turn.movementRemaining) continue;
        for (const [rowOffset, colOffset] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const row = current.row + rowOffset;
            const col = current.col + colOffset;
            const key = `${row},${col}`;
            if (row < 1 || row > state.board.rows || col < 1 || col > state.board.cols) continue;
            if (blocked.has(key) || visited.has(key) || distances.has(key)) continue;
            if (player.secretPassageCooldown?.row === row && player.secretPassageCooldown?.col === col) continue;
            if (boardLayout.squareAt(row, col)?.dataset.blocked === "true") continue;
            if (!canCrossBoundary(current, { row, col })) continue;
            distances.set(key, distance + 1);
            boardLayout.squareAt(row, col)?.classList.add("movement-range");
            if (!entersDoor(current, { row, col })) queue.push({ row, col });
        }
    }
    const reachable = new Set([...distances]
        .filter(([, distance]) => distance < turn.movementRemaining)
        .map(([position]) => position));
    reachable.add(`${player.position.row},${player.position.col}`);
    const currentRoom = state.board.rooms.find(room =>
        player.position.row >= room.rows.start && player.position.row <= room.rows.end &&
        player.position.col >= room.cols.start && player.position.col <= room.cols.end
    );
    for (const item of state.board.searchItems || []) {
        if (!currentRoom || item.roomId !== currentRoom.id) continue;
        let canReachAdjacentTile = false;
        for (let row = item.rows.start; row <= item.rows.end && !canReachAdjacentTile; row++) {
            for (let col = item.cols.start; col <= item.cols.end && !canReachAdjacentTile; col++) {
                canReachAdjacentTile = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([rowOffset, colOffset]) =>
                    reachable.has(`${row + rowOffset},${col + colOffset}`)
                );
            }
        }
        if (canReachAdjacentTile) {
            elements.board.querySelectorAll("[data-search-item-id]").forEach(square => {
                if (square.dataset.searchItemId !== item.id) return;
                square.classList.add("search-item-in-range");
                if (item.hintIds?.length) square.classList.add("search-item-has-hints");
            });
        }
    }
    if (distances.size === 1) {
        elements.endTurnButton.hidden = false;
        elements.turnStatus.textContent = "YOUR TURN · no legal moves remain · end your turn";
    }
}
