const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export function createBoardLayout(elements, onLayout = () => {}) {
    let zoomLevel = 1;
    let fittedCellSize = 1;
    let boardRows = 0;
    let boardCols = 0;

    function applyZoom() {
        const cellSize = fittedCellSize * zoomLevel;
        elements.board.style.width = `${cellSize * boardCols}px`;
        elements.board.style.height = `${cellSize * boardRows}px`;
        elements.zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`;
        elements.zoomOutButton.disabled = zoomLevel <= MIN_ZOOM;
        elements.zoomInButton.disabled = zoomLevel >= MAX_ZOOM;
        window.requestAnimationFrame(onLayout);
    }

    function setZoom(nextZoom) {
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
        applyZoom();
    }

    function size(rows, cols) {
        const styles = window.getComputedStyle(elements.gameMain);
        const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        const availableWidth = elements.gameMain.clientWidth - horizontalPadding;
        const reservedHeight = [...elements.gameMain.children]
            .filter(element => element !== elements.boardViewport)
            .reduce((total, element) => {
                const childStyles = window.getComputedStyle(element);
                return total + element.offsetHeight +
                    parseFloat(childStyles.marginTop) + parseFloat(childStyles.marginBottom);
            }, verticalPadding);
        const availableHeight = Math.max(1, elements.gameMain.clientHeight - reservedHeight);
        fittedCellSize = Math.max(1, Math.floor(Math.min(1150 / cols, availableWidth / cols, availableHeight / rows)));
        boardRows = rows;
        boardCols = cols;
        elements.boardViewport.style.width = `${fittedCellSize * cols}px`;
        elements.boardViewport.style.height = `${fittedCellSize * rows}px`;
        elements.board.style.aspectRatio = `${cols} / ${rows}`;
        applyZoom();
    }

    function build({ rows, cols, rooms, spawnPoints, secretPass, blockedTiles = [], searchItems = [] }) {
        const roomAt = (row, col) => rooms.find(room =>
            row >= room.rows.start && row <= room.rows.end &&
            col >= room.cols.start && col <= room.cols.end
        );
        elements.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        elements.board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        elements.board.replaceChildren();
        const contains = (area, row, col) => row >= area.rows.start && row <= area.rows.end &&
            col >= area.cols.start && col <= area.cols.end;
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                const square = document.createElement("div");
                const room = roomAt(row, col);
                const isDoor = room && row === room.doors.row && col === room.doors.col;
                const isSpawn = spawnPoints.some(point => row === point.row && col === point.col);
                const isPassage = secretPass.some(point => row === point.row && col === point.col);
                const blockedArea = blockedTiles.find(area => contains(area, row, col));
                const searchItem = searchItems.find(item => contains(item, row, col));
                square.dataset.type = isPassage ? "secret passage" : isDoor ? "door" :
                    room ? "room" : isSpawn ? "spawn point" : "hallway";
                if (room) square.dataset.roomName = room.name;
                if (blockedArea || searchItem) square.dataset.blocked = "true";
                if (blockedArea) square.dataset.blockedAreaId = blockedArea.id;
                if (searchItem) {
                    square.dataset.searchItemId = searchItem.id;
                    square.dataset.searchDescription = searchItem.description;
                    square.dataset.searchRoomId = searchItem.roomId;
                }
                square.dataset.row = row;
                square.dataset.col = col;
                elements.board.appendChild(square);
            }
        }
        size(rows, cols);
    }

    elements.zoomOutButton.addEventListener("click", () => setZoom(zoomLevel - ZOOM_STEP));
    elements.zoomInButton.addEventListener("click", () => setZoom(zoomLevel + ZOOM_STEP));
    elements.zoomResetButton.addEventListener("click", () => setZoom(1));

    return {
        build,
        size,
        squareAt: (row, col) => elements.board.querySelector(`[data-row="${row}"][data-col="${col}"]`),
        get cellSize() { return fittedCellSize * zoomLevel; }
    };
}
