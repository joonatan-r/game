// levelData from levelData.js
// options from options.js

function createLevels() {
    const levelCharMap = {
        "w": "*w", // "normal" wall
        "f": "*f", // "fake" wall
        "s": "*s", // "see-through" wall
        "t": "*t" // wall that blocks sight, but shows the wall tile contents
    };
    let levels = { currentLvl: "" };
    let level = [[]];
    let yIdx = 0;
    let xIdx = 0;
    let parseStatus = "";
    let lvlName = "";
    let bg = "";
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
                parseStatus = "bg";
                continue;
            }
            lvlName += c;
            continue;
        }
        if (parseStatus === "bg") {
            if (c === "\n") {
                parseStatus = "travel";
                continue;
            }
            bg += c;
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
                bg: bg,
                mobs: [],
                items: [],
                memorized: [],
                spawnRate: 0,
                spawnDistribution: {},
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
            bg = "";
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
        if (!escaped && (c === ">" || c === "<" || c === "^")) travelCoords.push([yIdx, xIdx]);
        level[yIdx][xIdx] = c;
        xIdx++;
        escaped = false;
    }
    levels.currentLvl = Object.keys(levels)[1];
    return levels;
}

function initialize(table, levels, area, areaCache, rendered, edges) {
    let level = levels[levels.currentLvl].level;

    for (let i = 0; i < level.length; i++) {
        const tr = document.createElement("tr");
        table.appendChild(tr);
        area.push([]);
        areaCache.push([]);
        rendered.push([]);
      
        for (let j = 0; j < level[0].length; j++) {
            if (i === 0 || j === 0 || i === level.length - 1 || j === level[0].length - 1) {
                edges.push([i, j]);
            }
            rendered[i][j] = false;
            const td = document.createElement("td");
            tr.appendChild(td);
            area[i][j] = td;
            area[i][j].customProps = {};
            area[i][j].customProps.coords = [i, j];
            areaCache[i][j] = "";
        }
    }
    for (let lvl of Object.keys(levels)) {
        if (lvl === "currentLvl") continue;
    
        for (let i = 0; i < level.length; i++) {
            levels[lvl].memorized.push([]);
    
            for (let j = 0; j < level[0].length; j++) {
                levels[lvl].memorized[i][j] = false;
            }
        }
    }
}
