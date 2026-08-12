const board = {
    rows: 24,
    columns: 30,

    cells: [
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "ps", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "ps", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "le", "le", "le", "le", "dr", "le", "le", "le", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc", "sc"],
        ["sc", "sc", "sc", "sc", "sc", "dr", "sc", "sc", "sc", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "sc", "sc", "sc", "sc", "sc", "sc", "dr", "sc", "sc"],
        ["hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw"],
        ["ps", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "ps"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "dr", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "dr", "dr", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "se", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["se", "se", "se", "se", "se", "se", "dr", "se", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "se", "se", "se", "se", "se", "se", "se", "se"],
        ["ps", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "ps"],
        ["hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "wa", "hw", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw"],
        ["lc", "lc", "lc", "dr", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "hw", "lc", "lc", "lc", "lc", "dr", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "hw", "hw", "hw", "dr", "hw", "hw", "hw", "hw", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "dr", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "hw", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "hw", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"],
        ["lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "ps", "hw", "le", "le", "le", "le", "le", "le", "le", "le", "hw", "ps", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc", "lc"]
    ]
};

//guide:
//wa = warden
//lc = large corner
//sc = small corner
//le = large edge
//se = small edge
//dr = door
//sp = secret passage
//ps = player start
//hw = hallway

/*
null example

    cells: [
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]
    ]
*/