// all coords are given as (y,x)

const SIZE_Y = 25;
const SIZE_X = 40;
const level = [];
const edges = [];

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if ((i + j) % 7 === 0 && (i * j) % 3 === 0
                || (i + j + 1) % 7 === 0 && (i * j + 1) % 3 === 0) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183"; // middle dot
        }
        if (i === 0 || j === 0 || i === SIZE_Y - 1 || j === SIZE_X - 1) {
            edges.push([i, j]);
        }
    }
}

const table = document.getElementById("table");
const status = document.getElementById("status");
const area = [];
const rendered = [];
let pos = [10, 13];

for (let i = 0; i < level.length; i++) {
    const tr = document.createElement("tr");
    table.appendChild(tr);
    area.push([]);
  
    for (let j = 0; j < level[0].length; j++) {
        const td = document.createElement("td");
        tr.appendChild(td);
        area[i][j] = td;
    }
}
for (let i = 0; i < level.length; i++) {
    rendered.push([]);

    for (let j = 0; j < level[0].length; j++) {
        rendered[i][j] = false;
    }
}

function render(y, x, y0, x0, mirrorY, mirrorX) {
    if (mirrorY) {
        y = 2 * y0 - y;
    }
    if (mirrorX) {
        x = 2 * x0 - x;
    }
    area[y][x].innerHTML = level[y][x];
    rendered[y][x] = true;

    if (level[y][x] === "") { // wall blocks sight
        return "stop";
    }
    return "ok";
}

// Bresenham's algorithm, modified to work for all directions

function renderLine(y0, x0, y1, x1) {
    let reverse = false;
    let mirrorY = false;
    let mirrorX = false;

    if (y0 > y1) {
        y1 = 2 * y0 - y1;
        mirrorY = true;
    }
    if (x0 > x1) {
        x1 = 2 * x0 - x1;
        mirrorX = true;
    }
    let dx = x1 - x0;
    let dy = y1 - y0;

    if (dy > dx) {
        const tempDy = dy;
        const tempY0 = y0;
        const tempY1 = y1;
        dy = dx;
        dx = tempDy;
        y0 = x0;
        x0 = tempY0;
        y1 = x1;
        x1 = tempY1;
        reverse = true;
    }
    const incrE = 2 * dy;
    const incrNE = 2 * (dy - dx);
    let d = 2 * dy - dx;
    let x = x0;
    let y = y0;

    while(x <= x1) {
        if (reverse) {
            const val = render(x, y, x0, y0, mirrorY, mirrorX);

            if (val === "stop") return;
        } else {
            const val = render(y, x, y0, x0, mirrorY, mirrorX);

            if (val === "stop") return;
        }
        if (d <= 0) {
            d += incrE;
            x++;
        } else {
            d += incrNE;
            x++;
            y++;
        }
    }
}

// ----------

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const make = {};
make.pos = [1, 17];
make.target = [2, 17];
make.calcTarget = () => {
    let dir;
    make.target = make.pos.slice();

    while (1) {
        const prevTarget = make.target.slice();
        dir = getRandomInt(1, 9);

        if (dir === 5) continue;

        switch (dir) {
            case 4:
                make.target[1]--;
                break;
            case 6:
                make.target[1]++;
                break;
            case 8:
                make.target[0]--;
                break;
            case 2:
                make.target[0]++;
                break;
            case 7:
                make.target[1]--;
                make.target[0]--;
                break;
            case 1:
                make.target[1]--;
                make.target[0]++;
                break;
            case 9:
                make.target[1]++;
                make.target[0]--;
                break;
            case 3:
                make.target[1]++;
                make.target[0]++;
                break;
        }
        if (make.target[0] > level.length - 1 || make.target[1] > level[0].length - 1 
            || make.target[0] < 0 || make.target[1] < 0
            || level[make.target[0]][make.target[1]] === "") {
                make.target = prevTarget.slice();
                continue;
        }
        break;
    }
};

// -----------

function processTurn() {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            const td = area[i][j];
            td.innerHTML = "";
            td.className = ""; // remove this to "remember" walls once seen
        }
    }
    for (let coords of edges) {
        renderLine(pos[0], pos[1], coords[0], coords[1]);
    }
    area[pos[0]][pos[1]].innerHTML = "@";

    // --------

    area[make.pos[0]][make.pos[1]].innerHTML = level[make.pos[0]][make.pos[1]];
    make.pos = make.target.slice();
    area[make.pos[0]][make.pos[1]].innerHTML = "M";
    make.calcTarget();

    if (pos[0] === make.pos[0] && pos[1] === make.pos[1]) {
        status.innerHTML = "Make hits you! You die...";
        document.removeEventListener("keydown", keypressListener);
    }
    
    // --------

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

processTurn();

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
