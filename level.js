// "global" variables

const area = [];
const rendered = [];
const edges = [];
let memorized = [];
let levels = { currentLvl: "" };
let level = [[]];

// end "global" variables

const table = document.getElementById("table");
const levelCharMap = {
    ".": "\u00B7",
    "w": ""
};
let yIdx = 0;
let xIdx = 0;
let parseStatus = "";
let lvlName = "";
let travelNames = [];
let travelName = "";
let travelCoords = [];
let escaped = false;

for (let c of levelData) {
    if (parseStatus === "" && c !== "\n") {
        parseStatus = "name";
    }
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
    if (parseStatus !== "lvl") {
        continue;
    }
    if (!escaped && c === "e") {
        escaped = true;
        continue;
    }
    if (!escaped && c === ";") {
        levels[lvlName] = {
            level: level,
            mobs: [],
            items: [],
            memorized: [],
            spawnsHostiles: false,
            travelPoints: {}
        };
        // NOTE: currently if multiple passages between two lvls, they are always connected
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
    if (!escaped && c === "\n") {
        level.push([]);
        xIdx = 0;
        yIdx++;
        continue;
    }
    if (!escaped && Object.keys(levelCharMap).indexOf(c) !== -1) {
        c = levelCharMap[c];
    }
    if (c === ">" || c === "<" || c === "^") travelCoords.push([yIdx, xIdx]);
    level[yIdx][xIdx] = c;
    xIdx++;
    escaped = false;
}
levels["Wilderness"].spawnsHostiles = true;
levels.currentLvl = Object.keys(levels)[1];
level = levels[levels.currentLvl].level;

for (let i = 0; i < level.length; i++) {
    const tr = document.createElement("tr");
    table.appendChild(tr);
    area.push([]);
    rendered.push([]);
    memorized.push([]);
  
    for (let j = 0; j < level[0].length; j++) {
        if (i === 0 || j === 0 || i === level.length - 1 || j === level[0].length - 1) {
            edges.push([i, j]);
        }
        rendered[i][j] = false;
        memorized[i][j] = false;
        const td = document.createElement("td");
        tr.appendChild(td);
        area[i][j] = td;
        area[i][j].customProps = {};
        area[i][j].customProps.coords = [i, j];
    }
}
for (let lvl of Object.keys(levels)) {
    if (lvl === "currentLvl") continue;

    let tempMem = [];

    for (let i = 0; i < level.length; i++) {
        tempMem.push([]);

        for (let j = 0; j < level[0].length; j++) {
            tempMem[i][j] = false;
        }
    }
    levels[lvl].memorized = tempMem;
}

function changeLvl(fromLvl, toLvl, pointIdx, mobs, items, memorized) {
    levels[fromLvl].mobs = mobs;
    levels[fromLvl].items = items;
    levels[fromLvl].memorized = memorized;

    return {
        level: levels[toLvl].level,
        pos: levels[toLvl].travelPoints[fromLvl][pointIdx],
        mobs: levels[toLvl].mobs,
        items: levels[toLvl].items,
        memorized: levels[toLvl].memorized
    };
}

const infoTable = {
    "": "[ ]: A wall",
    " ": "[ ]: A wall",
    "\u00B7": "[\u00B7]: The floor",
    "^": "[^]: A doorway",
    "Player": "[@]: You, the player",
    "some money": "[$]: Some money",
    "a weird object": "[?]: A strange object",
    "a chest": "[(]: A chest",
    "Ukko": "[@]: Ukko, a peaceful human",
    "Some guy": "[@]: Some guy, a peaceful human",
    "Shady guy": "[@]: Shady guy, a peaceful human",
    "Make": "[M]: Make, a hostile human",
    "Pekka": "[P]: Pekka, a hostile human shooter",
    "Jorma": "[J]: Jorma, a hostile human",
};
