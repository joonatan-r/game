import { levelData, levelCharMap, levelTiles, infoTable, PLACEHOLDER_TP } from "./levelData.js";

export function initialize() {
    const table = document.getElementById("table");
    const area = [];
    const rendered = [];
    let levels = {};
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
    levels.generatedIdx = 0;
    
    for (let c of levelData) {
        switch (parseStatus) {
            case "":
                if (c === "\n") {
                    continue;
                }
                parseStatus = "name";
                // fall through
            case "name":
                if (c === "\n") {
                    parseStatus = "bg";
                } else {
                    lvlName += c;
                }
                break;
            case "bg":
                if (c === "\n") {
                    parseStatus = "travel";
                } else {
                    bg += c;
                }
                break;
            case "travel":
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
                break;
            case "lvl":
                if (!escaped && c === "e") {
                    escaped = true;
                } else if (escaped) {
                    level[yIdx][xIdx] = c;
                    xIdx++;
                    escaped = false;
                } else if (c === ";") {
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
                        // placeholder travelpoints connect to generated levels, will be properly added later
                        if (name === PLACEHOLDER_TP) {
                            if (!levels[lvlName].tempTravelPoints) levels[lvlName].tempTravelPoints = [];
                            levels[lvlName].tempTravelPoints.push(travelCoords.shift());
                            continue;
                        }
                        if (!levels[lvlName].travelPoints[name]) levels[lvlName].travelPoints[name] = [];
                        levels[lvlName].travelPoints[name].push(travelCoords.shift());
                    }
                    // NOTE: level with no predefined travelpoint also gets "accessible" set to true to keep
                    // track if a path to it has been generated
                    level = [[]];
                    yIdx = 0;
                    xIdx = 0;
                    parseStatus = "";
                    lvlName = "";
                    bg = "";
                    travelName = "";
                    travelNames = [];
                    travelCoords = [];
                } else if (c === "\n") {
                    level.push([]);
                    xIdx = 0;
                    yIdx++;
                } else {
                    if (Object.keys(levelCharMap).indexOf(c) !== -1) {
                        c = levelCharMap[c];
                    }
                    if (c === levelTiles.stairsDown || c === levelTiles.stairsUp || c === levelTiles.doorWay) {
                        travelCoords.push([yIdx, xIdx]);
                    }
                    level[yIdx][xIdx] = c;
                    xIdx++;
                }
                break;
            default:
                // continue
        }
    }
    levels.currentLvl = Object.keys(levels)[2];
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
        if (lvl === "currentLvl" || lvl === "generatedIdx") continue;
    
        for (let i = 0; i < level.length; i++) {
            levels[lvl].memorized.push([]);
    
            for (let j = 0; j < level[0].length; j++) {
                levels[lvl].memorized[i][j] = "";
            }
        }
    }
    levels["Woods"].overlayBg = "url(\"bgImages/hutOverlay.png\")";
    return {
        levels: levels,
        area: area,
        rendered: rendered
    };
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

export function dijkstra(startPos, targetPos, level, posIsValid) {
    const INF = 1000;
    const nodes = {};
    let reachable = true;

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            const isStartNode = coordsEq(startPos, [i, j]);
            nodes[i + "_" + j] = {
                value: [i, j],
                visited: false,
                d: isStartNode ? 0 : INF,
                // disallow fake walls in posIsValid so player can't find them with autoTravel
                neighbors: getCoordsNextTo([i, j]).filter(pos => posIsValid(pos, true)),
                prevNode: null
            };
        }
    }
    const targetNode = nodes[targetPos[0] + "_" + targetPos[1]];
    let currentNode = nodes[startPos[0] + "_" + startPos[1]];
    let nodeToTravelTo = targetNode;

    while (1) {
        for (const neighbor of currentNode.neighbors) {
            const neighborNode = nodes[neighbor[0] + "_" + neighbor[1]];
            // prefer orthogonal neighbors by having slightly longer distance to diagonal ones,
            // they are equal in terms of game logic but visually further away diagonally
            const distanceThroughCurrent = (
                neighborNode.value[0] === currentNode.value[0] ||
                neighborNode.value[1] === currentNode.value[1]
            ) ? currentNode.d + 2 : currentNode.d + 3;

            if (distanceThroughCurrent < neighborNode.d) {
                neighborNode.d = distanceThroughCurrent;
                neighborNode.prevNode = currentNode;
            }
        }
        currentNode.visited = true;
        let closestUnvisited = null;

        for (const node of Object.values(nodes)) {
            if (!node.visited && (!closestUnvisited || node.d < closestUnvisited.d)) {
                closestUnvisited = node;
            }
        }
        if (!closestUnvisited || closestUnvisited.d === INF) {
            reachable = false;
            break;
        }
        if (closestUnvisited === targetNode) {
            break;
        }
        currentNode = closestUnvisited;
    }
    if (!reachable) {
        let closestNode = null;
        let smallestDistance = null;

        for (const node of Object.values(nodes)) {
            // squared distance, can still use for min search
            const distanceToTarget = (node.value[0] - targetNode.value[0])*(node.value[0] - targetNode.value[0]) + 
                                        (node.value[1] - targetNode.value[1])*(node.value[1] - targetNode.value[1]);
            if (node.visited && (!closestNode || distanceToTarget < smallestDistance)) {
                closestNode = node;
                smallestDistance = distanceToTarget;
            } 
        }
        nodeToTravelTo = closestNode;
    }
    const path = [nodeToTravelTo.value];
    let node = nodeToTravelTo.prevNode;

    while (node) {
        path.unshift(node.value);
        node = node.prevNode;
    }
    return path;
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

export function save(saveData) {
    const link = document.createElement("a");
    link.setAttribute("download", "save.json");
    link.href = makeTextFile(JSON.stringify(saveData, (key, val) => {
            if (typeof val === "function") {
                return "" + val; // store functions as string
            }
            const idx = saveData.referenced.indexOf(val);

            if (idx !== -1) {
                return "refTo " + idx;
            }
            return val;
        })
            .slice(0, -1) + ",\"referenced\":" + JSON.stringify(saveData.referenced) + "}"
            // objects that have multiple references to them are stored in "referenced", no replacer here
    );
    document.body.appendChild(link);
    window.requestAnimationFrame(() => {
        link.dispatchEvent(new MouseEvent("click"));
        document.body.removeChild(link);
    });
}

export function load(onLoad) {
    const loadInput = document.getElementById("loadInputFile");
    const listener = function() {
        const fr = new FileReader();
        fr.onload = () => {
            const refs = [];
            const loadData = JSON.parse(fr.result, function(key, val) {
                if (typeof val === "string" && val.startsWith("function")) {
                    // convert string representations of functions back to functions
                    return eval("(" + val + ")");
                }
                if (typeof val === "string" && val.startsWith("refTo ")) {
                    refs.push({ obj: this, key: key });
                }
                return val;
            });
    
            for (let ref of refs) {
                const idx = ref.obj[ref.key].split(" ")[1];
                ref.obj[ref.key] = loadData.referenced[idx]; // replace references with actual objects
            }
            onLoad(loadData);
            loadInput.removeEventListener("change", listener);
        };
        fr.readAsText(this.files[0]);
        this.value = null;
    };
    loadInput.addEventListener("change", listener);
    loadInput.click();
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

export function relativeCoordsToDrc(y, x) {
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

export function getPosInfo(infoKeys) {
    let msg = "";

    if (!infoKeys.length) {
        msg += "[ ]: An unseen area\n";
    }
    for (let key of infoKeys) {
        if (key === levelTiles.floor) continue; // ignore floor
        if (typeof infoTable[key] !== "undefined") {
            msg += infoTable[key] + "\n";
        } else {
            msg += "No info\n";
        }
    }
    if (msg === "") msg = "No info\n";
    return msg.slice(0, -1);
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

export function inputToDrc(input, options) {
    let drc = input;

    if (input === options.CONTROLS.BOTTOM_LEFT || input === options.CONTROLS.ACT_BOTTOM_LEFT) {
        drc = 1;
    } else if (input === options.CONTROLS.BOTTOM || input === options.CONTROLS.ACT_BOTTOM) {
        drc = 2;
    } else if (input === options.CONTROLS.BOTTOM_RIGHT || input === options.CONTROLS.ACT_BOTTOM_RIGHT) {
        drc = 3;
    } else if (input === options.CONTROLS.LEFT || input === options.CONTROLS.ACT_LEFT) {
        drc = 4;
    } else if (input === options.CONTROLS.RIGHT || input === options.CONTROLS.ACT_RIGHT) {
        drc = 6;
    } else if (input === options.CONTROLS.TOP_LEFT || input === options.CONTROLS.ACT_TOP_LEFT) {
        drc = 7;
    } else if (input === options.CONTROLS.TOP || input === options.CONTROLS.ACT_TOP) {
        drc = 8;
    } else if (input === options.CONTROLS.TOP_RIGHT || input === options.CONTROLS.ACT_TOP_RIGHT) {
        drc = 9;
    }
    return drc;
}

export function isWall(tile) {
    return tile === levelTiles.wall 
        || tile === levelTiles.fakeWall 
        || tile === levelTiles.seeThroughWall 
        || tile === levelTiles.transparentBgWall;
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

export function getAdjacentOrthogonalDirections(pos, drc) {
    let alternatives = null;
    let drcs = null;

    if (drc === 1) {
        const first = pos.slice();
        const second = pos.slice();
        movePosToDrc(first, 4);
        movePosToDrc(second, 2);
        alternatives = [first, second];
        drcs = [4, 2];
    } else if (drc === 3) {
        const first = pos.slice();
        const second = pos.slice();
        movePosToDrc(first, 6);
        movePosToDrc(second, 2);
        alternatives = [first, second];
        drcs = [6, 2];
    } else if (drc === 7) {
        const first = pos.slice();
        const second = pos.slice();
        movePosToDrc(first, 4);
        movePosToDrc(second, 8);
        alternatives = [first, second];
        drcs = [4, 8];
    } else if (drc === 9) {
        const first = pos.slice();
        const second = pos.slice();
        movePosToDrc(first, 6);
        movePosToDrc(second, 8);
        alternatives = [first, second];
        drcs = [6, 8];
    }
    return {
        alternatives: alternatives,
        drcs: drcs
    };
}

export function itemNameWithNumber(item) {
    return item.number > 1 ? item.name + " (" + item.number + ")" : item.name; 
}

export function getClosestSide(pos, level) {
    const distances = {
        top: pos[0],
        bottom: level.length - 1 - pos[0],
        left: pos[1],
        right: level[0].length - 1 - pos[1]
    };
    return Object.keys(distances).sort((a,b) => distances[a] - distances[b])[0];
};

export function getClosestTravelPoint(tps, pos, level) {
    const closestSide = getClosestSide(pos, level);
    const opposites = {
        top: "bottom",
        bottom: "top",
        left: "right",
        right: "left"
    };
    let closestTp = null;

    for (const tp of tps) {
        if (opposites[closestSide] === getClosestSide(tp, level)) {
            closestTp = tp;
            break;
        }
    }
    if (closestTp) {
        removeByReference(tps, closestTp);
        return closestTp;
    }
    return tps.shift();
}

function getCssRuleIdx(selector) {
    let idx = -1;
    Array.from(document.styleSheets[0].cssRules).forEach((rule, i) => {
        if (rule.selectorText === selector) {
            idx = i;
        }
    });
    return idx;
}

export function addOrReplaceCss(selector, newRule) {
    const oldRuleIndex = getCssRuleIdx(selector);

    if (oldRuleIndex !== -1) {
        document.styleSheets[0].deleteRule(oldRuleIndex);
    }
    document.styleSheets[0].insertRule(newRule);
}
