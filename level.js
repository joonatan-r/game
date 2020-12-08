const SIZE_Y = 25;
const SIZE_X = 40;
let level = [];
const edges = [];
const area = [];
const rendered = [];
const table = document.getElementById("table");

const levels = {
    currentLvl: "",
    test1: {
        mobs: [], 
        travelPoints: { test2: [11, 14] }
    },
    test2: {
        mobs: [], 
        travelPoints: { test1: [5, 4] }
    }
};

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if ((i + j) % 7 === 0 && (i * j) % 3 === 0
            || (i + j + 1) % 7 === 0 && (i * j + 1) % 3 === 0
        ) {
        // if (j === 15 && [2, 15].indexOf(i) === -1) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183"; // middle dot
        }
        if (i === 0 || j === 0 || i === SIZE_Y - 1 || j === SIZE_X - 1) {
            edges.push([i, j]);
        }
    }
}
level[11][14] = ">";
levels.test1.level = level;
level = [];

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        // if ((i + j) % 7 === 0 && (i * j) % 3 === 0
        //     || (i + j + 1) % 7 === 0 && (i * j + 1) % 3 === 0
        // ) {
        if (j === 15 && [2, 15].indexOf(i) === -1) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183";
        }
    }
}
level[5][4] = ">";
levels.test2.level = level;

level = levels.test1.level;
levels.currentLvl = "test1";

function changeLvl(fromLvl, toLvl, mobs) {
    levels[fromLvl].mobs = mobs;

    return {
        level: levels[toLvl].level,
        pos: levels[toLvl].travelPoints[fromLvl],
        mobs: levels[toLvl].mobs
    };
}

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
