const gameId = window.location.pathname.split("/").filter(Boolean).at(-1);
const statusElement = document.getElementById("game-status");

fetch(`/api/games/${gameId}`)
    .then(async response => {
        if (response.status === 401) {
            window.location.assign("/login");
            throw new Error("Your session has expired. Redirecting to login.");
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error(`The server returned an unexpected response (${response.status}).`);
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this game.");
        return data.game.state;
    })
    .then(state => {
        const { rooms, rows, cols } = state.board;

        //Fetch brings over the raw Room array, brought the getSquareType logic here too
        function getSquareType(row, col) {
            for (let room of rooms) {
                let inRows = row >= room.rows.start && row <= room.rows.end;
                let inCols = col >= room.cols.start && col <= room.cols.end;

                if (inRows && inCols) {
                    if (row == room.doors.row && col == room.doors.col) {
                        return "door";
                    }
                    return "room";
                }
            }
        return "hallway";
        }

        //This loop creates the board

        let container = document.getElementById("board");

        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                let square = document.createElement("div");
                square.dataset.type = getSquareType(row, col);
                square.dataset.row = row;
                square.dataset.col = col;
                container.appendChild(square);
            }
        }

        statusElement.textContent = `Game loaded · ${state.players.length} players`;

        // Temporary inspection aid; no gameplay behavior is implemented yet.
        container.addEventListener("click", function(event) {
            let square = event.target;
            if (square.dataset.type) document.getElementById("clickOutput").textContent = square.dataset.type;
        });
    })
    .catch(error => {
        statusElement.textContent = error.message;
    });
