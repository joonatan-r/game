// level, edges, area, rendered from level.js
// renderLine, isNextTo, movingAIs from util.js
// all coords are given as (y,x)

const status = document.getElementById("status");
let pos = [10, 13];

const make = {};
make.pos = [7, 17];
make.target = [7, 17];
make.calcTarget = () => {
    if (rendered[make.pos[0]][make.pos[1]]) { // if player can see mob, mob can see player
        movingAIs.towardsPos(make, pos)
    } else {
        movingAIs.random(make);
    }
};

function processTurn() {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            const td = area[i][j];
            td.innerHTML = "";
            td.className = ""; // remove this to "remember" walls once seen
        }
    }
    status.innerHTML = "";

    for (let coords of edges) {
        renderLine(pos[0], pos[1], coords[0], coords[1]);
    }
    area[pos[0]][pos[1]].innerHTML = "@";

    if (isNextTo(pos, make.pos)) { // don't move, hit
        status.innerHTML = "Make hits you! You die...";
        document.removeEventListener("keydown", keypressListener);
    } else if (!(pos[0] === make.target[0] && pos[1] === make.target[1]) && !(make.target[0] > level.length - 1 
        || make.target[1] > level[0].length - 1 
        || make.target[0] < 0 || make.target[1] < 0
        || level[make.target[0]][make.target[1]] === "") // extra safeguard, later add other mobs too
        ) {
        if (rendered[make.pos[0]][make.pos[1]]) {
            area[make.pos[0]][make.pos[1]].innerHTML = level[make.pos[0]][make.pos[1]];
        }
        make.pos = make.target.slice();
    }
    if (rendered[make.pos[0]][make.pos[1]]) {
        area[make.pos[0]][make.pos[1]].innerHTML = "M";
    }
    make.calcTarget();

    // add walls last to check where to put them by what tiles are rendered

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            const td = area[i][j];

            if (rendered[i][j] && level[i][j] === "") {
                const classes = ["wall"];
    
                if (i > 0 && j < level[0].length && rendered[i - 1][j] && level[i - 1][j] !== "") {
                    classes.push("t");
                }
                if (i + 1 < level.length && j < level[0].length && rendered[i + 1][j] && level[i + 1][j] !== "") {
                    classes.push("b");
                }
                if (i < level.length && j > 0 && rendered[i][j - 1] && level[i][j - 1] !== "") {
                    classes.push("l");
                }
                if (i < level.length && j + 1 < level[0].length && rendered[i][j + 1] && level[i][j + 1] !== "") {
                    classes.push("r");
                }
                td.classList.add(...classes);
            }
        }
    }
}

const keypressListener = e => {
    const prevPos = pos.slice();

    switch (e.key) {
        case "4":
            pos[1]--;
            break;
        case "6":
            pos[1]++;
            break;
        case "8":
            pos[0]--;
            break;
        case "2":
            pos[0]++;
            break;
        case "7":
            pos[1]--;
            pos[0]--;
            break;
        case "1":
            pos[1]--;
            pos[0]++;
            break;
        case "9":
            pos[1]++;
            pos[0]--;
            break;
        case "3":
            pos[1]++;
            pos[0]++;
            break;
        default:
            return;
    }
    if (pos[0] > level.length - 1 || pos[1] > level[0].length - 1 || pos[0] < 0 || pos[1] < 0
            || level[pos[0]][pos[1]] === "" 
            || (pos[0] === make.pos[0] && pos[1] === make.pos[1])) { // ---------
        pos = prevPos.slice();
        return;
    }
    area[prevPos[0]][prevPos[1]].innerHTML = level[prevPos[0]][prevPos[1]];
    processTurn();
}
document.addEventListener("keydown", keypressListener);
processTurn();
