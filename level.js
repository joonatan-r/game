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
let parseStatus = "";
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
            if (travelName.length === 0) {
                parseStatus = "lvl";
            } else {
                travelNames.push(travelName);
                travelName = "";
            }
        } else {
            travelName += c;
        }
        continue;
    }
    if (c === ";" && parseStatus !== "lvl") {
        parseStatus = "name";
        continue;
    }
    if (c === ";" && parseStatus === "lvl") {
        levels[lvlName] = {
            level: level,
            mobs: [], 
            travelPoints: {}
        };
        // TODO currently if multiple passages between two lvls, they are always connected
        // in the order they appear in the lvls
        for (let name of travelNames) {
            if (!levels[lvlName].travelPoints[name]) levels[lvlName].travelPoints[name] = [];
            levels[lvlName].travelPoints[name].push(travelCoords.shift());
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
    if (c === ">" || c === "<" || c === "^") travelCoords.push([yIdx, xIdx]);
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

function changeLvl(fromLvl, toLvl, pointIdx, mobs) {
    levels[fromLvl].mobs = mobs;

    return {
        level: levels[toLvl].level,
        pos: levels[toLvl].travelPoints[fromLvl][pointIdx],
        mobs: levels[toLvl].mobs
    };
}
