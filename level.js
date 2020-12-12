const SIZE_Y = 25;
const SIZE_X = 40;
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
        travelPoints: { test1: [5, 4], test3: [8, 18] }
    },
    test3: {
        mobs: [],
        travelPoints: { test2: [8, 8] }
    }
};
let level = [];

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if (((i + j) % 9 === 0 && (i * j) % 9 === 0)
            || (
                ((i + j) % 29 === 0 || (i + j) % 30 === 0) && i % 7 !== 0
            )
        ) {
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

        if ((j === 15 || j === 26) && [2, 15].indexOf(i) === -1) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183";
        }
    }
}
level[5][4] = ">";
level[8][18] = ">";
levels.test2.level = level;
level = [];

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if ((i % 9 === 0 || j % 9 === 0) && [9, 15].indexOf(j) === -1 
            && i !== 4 && j !== 21
        ) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183";
        }
    }
}
level[8][8] = ">";
levels.test3.level = level;

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
