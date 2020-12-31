const SIZE_Y = 25;
const SIZE_X = 40;
const edges = [];
const area = [];
const rendered = [];
const table = document.getElementById("table");
const levelCharMap = {
    ".": "&#183",
    "w": ""
};
const levels = { currentLvl: "" };
let level = [[]];
let yIdx = 0;
let xIdx = 0;
let parseStatus = null;
let lvlName = "";
let travelNames = [];
let travelName = "";
let travelCoords = [];

for (let c of levelData) {
    if (parseStatus === "name") {
        if (c === "\n") {
            parseStatus = "travel";
            continue;
        }
        lvlName += c;
        continue;
    }
    if (parseStatus === "travel") {
        if (c === "\n") {
            travelNames.push(travelName);
            travelName = "";
            continue;
        } else if (c === "/") {
            parseStatus = "lvl";
            continue;
        }
        travelName += c;
        continue;
    }
    if (c === "{") {
        parseStatus = "name";
        continue;
    }
    if (c === "}") {
        levels[lvlName] = {
            level: level,
            mobs: [], 
            travelPoints: {}
        };
        for (let name of travelNames) {
            levels[lvlName].travelPoints[name] = travelCoords[travelNames.indexOf(name)];
        }
        level = [[]];
        yIdx = 0;
        xIdx = 0;
        parseStatus = "";
        lvlName = "";
        travelName = "";
        travelNames = [];
        travelCoords = [];
        continue;
    }
    if (parseStatus === "") continue;
    if (c === "\n") {
        level.push([]);
        xIdx = 0;
        yIdx++;
        continue;
    }
    if (Object.keys(levelCharMap).indexOf(c) !== -1) {
        c = levelCharMap[c];
    }
    if (c === ">") travelCoords.push([yIdx, xIdx]);
    level[yIdx][xIdx] = c;
    xIdx++;
}
levels.currentLvl = Object.keys(levels)[1];
level = levels[levels.currentLvl].level;

for (let i = 0; i < level.length; i++) {
    const tr = document.createElement("tr");
    table.appendChild(tr);
    area.push([]);
    rendered.push([]);
  
    for (let j = 0; j < level[0].length; j++) {
        if (i === 0 || j === 0 || i === SIZE_Y - 1 || j === SIZE_X - 1) {
            edges.push([i, j]);
        }
        rendered[i][j] = false;
        const td = document.createElement("td");
        tr.appendChild(td);
        area[i][j] = td;
    }
}

function changeLvl(fromLvl, toLvl, mobs) {
    levels[fromLvl].mobs = mobs;

    return {
        level: levels[toLvl].level,
        pos: levels[toLvl].travelPoints[fromLvl],
        mobs: levels[toLvl].mobs
    };
}
