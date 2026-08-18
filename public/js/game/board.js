//Fetch call GET request server.js' api/board route
fetch("/api/board")
    .then(response => response.json())
    .then(data => {
        let rooms = data.rooms;

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

        for (let row = 0; row < 24; row++) {
            for (let col = 0; col < 30; col++) {
                let square = document.createElement("div");
                square.dataset.type = getSquareType(row, col);
                square.dataset.row = row;
                square.dataset.col = col;
                container.appendChild(square);
            }
        }

        //Clicker functionality so you can click on the board and see if it's a room, hallway, or door
        container.addEventListener("click", function(event) {
            let square = event.target;
            //console.log(square.dataset.type);
            //This is a temporary test feature that prints it on the screen under the board, the commented out line before this
            //Shows the same thing but in the console instead of on the page
            document.getElementById("clickOutput").textContent = square.dataset.type;
        });
    });