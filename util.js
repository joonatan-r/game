import { levelData } from "./levelData.js";

export function initialize(levels, table, area, rendered) {
    const levelCharMap = {
        "w": "*w", // "normal" wall
        "f": "*f", // "fake" wall
        "s": "*s", // "see-through" wall
        "t": "*t" // wall that blocks sight, but shows the background of the wall tile
    };
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

    levels.currentLvl = "";
    
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
    level = levels[levels.currentLvl].level;

    for (let i = 0; i < level.length; i++) {
        const tr = document.createElement("tr");
        table.appendChild(tr);
        area.push([]);
        rendered.push([]);
      
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            const td = document.createElement("td");
            tr.appendChild(td);
            area[i][j] = td;
            area[i][j].customProps = {};
            area[i][j].customProps.coords = [i, j];
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

// Bresenham's algorithm, modified to work for all directions

export function bresenham(y0, x0, y1, x1, onNewPos) {
    let swapYX = false;
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
        swapYX = true;
    }
    const incrE = 2 * dy;
    const incrNE = 2 * (dy - dx);
    let d = 2 * dy - dx;
    let x = x0;
    let y = y0;
    let y_temp, x_temp;

    while (x <= x1) {
        if (swapYX) {
            y_temp = mirrorY ? 2 * x0 - x : x;
            x_temp = mirrorX ? 2 * y0 - y : y;
        } else {
            y_temp = mirrorY ? 2 * y0 - y : y;
            x_temp = mirrorX ? 2 * x0 - x : x;
        }
        if (onNewPos(y_temp, x_temp) === "stop") {
            return;
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

makeTextFile.textFile = null;

export function makeTextFile(text) {
    const data = new Blob([text], {type: "text/plain"});

    if (makeTextFile.textFile !== null) {
        window.URL.revokeObjectURL(makeTextFile.textFile);
    }
    makeTextFile.textFile = window.URL.createObjectURL(data);
    return makeTextFile.textFile;
}

export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function removeByReference(arr, obj) {
    let index = arr.indexOf(obj);

    if (index !== -1) {
        arr.splice(index, 1);
    }
}

export function pixelCoordsToDrc(y, x) {
    if (x === 0) {
        if (y > 0) return 2; // b
        return 8; // t
    } else {
        let val = y/x;

        if (val > -0.4142 && val < 0.4142) {
            if (x > 0) return 6; // r
            return 4; // l
        } else if (val > -2.4142 && val < -0.4142) {
            if (x > 0) return 9; // tr
            return 1; // bl
        } else if (val > 0.4142 && val < 2.4142) {
            if (x > 0) return 3; // br
            return 7; // tl
        } else {
            if (y > 0) return 2; // b
            return 8; // t
        }
    }
}

export function getCoordsNextTo(pos) {
    return [        
        [pos[0], pos[1] - 1], // l
        [pos[0] - 1, pos[1] - 1], // tl
        [pos[0] - 1, pos[1]], // t
        [pos[0] - 1, pos[1] + 1], // tr
        [pos[0], pos[1] + 1], // r
        [pos[0] + 1, pos[1] + 1], // br
        [pos[0] + 1, pos[1]], // b
        [pos[0] + 1, pos[1] - 1] // bl
    ];
}

export function isNextTo(coord1, coord2, includeDiag) {
    includeDiag = (typeof includeDiag !== "undefined") ? includeDiag : true;

    if (coordsEq([coord1[0], coord1[1] - 1], coord2)
        || coordsEq([coord1[0], coord1[1] + 1], coord2)
        || coordsEq([coord1[0] - 1, coord1[1]], coord2)
        || coordsEq([coord1[0] + 1, coord1[1]], coord2)
        || includeDiag && (
           coordsEq([coord1[0] - 1, coord1[1] - 1], coord2)
        || coordsEq([coord1[0] + 1, coord1[1] - 1], coord2)
        || coordsEq([coord1[0] - 1, coord1[1] + 1], coord2)
        || coordsEq([coord1[0] + 1, coord1[1] + 1], coord2)
        )
    ) {
        return true;
    }
    return false;
}

export function coordsEq(coord1, coord2) {
    if (coord1[0] === coord2[0] && coord1[1] === coord2[1]) return true;
    return false;
}

export function movePosToDrc(posToMove, drc) {
    switch (drc) {
        case 4:
            posToMove[1]--;
            break;
        case 6:
            posToMove[1]++;
            break;
        case 8:
            posToMove[0]--;
            break;
        case 2:
            posToMove[0]++;
            break;
        case 7:
            posToMove[1]--;
            posToMove[0]--;
            break;
        case 1:
            posToMove[1]--;
            posToMove[0]++;
            break;
        case 9:
            posToMove[1]++;
            posToMove[0]--;
            break;
        case 3:
            posToMove[1]++;
            posToMove[0]++;
            break;
    }
}

export const oppositeDrcs = {
    1: 9,
    2: 8,
    3: 7,
    4: 6,
    6: 4,
    7: 3,
    8: 2,
    9: 1,
};

export const projectileFromDrc = {
    1: "/",
    2: "|",
    3: "\\",
    4: "\u2014",
    6: "\u2014",
    7: "\\",
    8: "|",
    9: "/",
};

export function isWall(tile) {
    return tile === "*w" || tile === "*f" || tile === "*s" || tile === "*t";
}

export function getSecondBestDirections(drcs, currentDrc, excluded) {
    const retDrcs = [];

    for (let d of drcs) {
        let skip = false;

        for (let coord of excluded) {
            if (coordsEq(d, coord)) {
                skip = true;
            }
        };
        if (!skip && isNextTo(d, currentDrc, false)) retDrcs.push(d);
    };
    return retDrcs;
}
