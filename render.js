// level, area, rendered, memorized, edges from level.js
// coordsEq, getCoordsNextTo, removeByReference from util.js

// NOTE: with current implementation, if a memorized level tile is changed, 
// it would be seen even if it's not rendered

const SHOW_MEMORIZED = true;
const GRAY_MEMORIZED = true;

const areaCache = [];

for (let i = 0; i < level.length; i++) {
    areaCache.push([]);
    for (let j = 0; j < level[0].length; j++) {
        areaCache[i][j] = "";
    }
}

function renderPos(posToRender, playerPos, items, mobs, customRenders) {
    if (!rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
        area[posToRender[0]][posToRender[1]].textContent = "";
        return;
    } else if (rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
        memorized[posToRender[0]][posToRender[1]] = true;
    } else if (!rendered[posToRender[0]][posToRender[1]] && SHOW_MEMORIZED && memorized[posToRender[0]][posToRender[1]]) {
        area[posToRender[0]][posToRender[1]].textContent = level[posToRender[0]][posToRender[1]];
        GRAY_MEMORIZED && (area[posToRender[0]][posToRender[1]].className = "mem");
        return;
    }
    area[posToRender[0]][posToRender[1]].textContent = level[posToRender[0]][posToRender[1]];
    area[posToRender[0]][posToRender[1]].customProps.infoKeys.unshift(level[posToRender[0]][posToRender[1]]);

    for (let item of items) {
        if (coordsEq(item.pos, posToRender) && !item.hidden) {
            area[item.pos[0]][item.pos[1]].textContent = item.symbol;
            area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
        }
    }
    if (coordsEq(playerPos, posToRender)) {
        area[playerPos[0]][playerPos[1]].textContent = "@";
        area[playerPos[0]][playerPos[1]].className = "player";
        area[playerPos[0]][playerPos[1]].customProps.infoKeys.unshift("Player");
    }
    for (let mob of mobs) {
        if (coordsEq(mob.pos, posToRender)) {
            area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
            area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
        }
    }
    for (let obj of customRenders) {
        if (coordsEq(obj.pos, posToRender)) {
            area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
        }
    }
}

function renderAll(playerPos, items, mobs, customRenders) {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            areaCache[i][j] = area[i][j].textContent;
            area[i][j].className = "";
            area[i][j].customProps.infoKeys = [];
        }
    }
    for (let coords of edges) {
        bresenham(playerPos[0], playerPos[1], coords[0], coords[1], (y,x) => {
            if (rendered[y][x]) {
                return level[y][x] === "" || level[y][x] === " " ? "stop" : "ok"; // wall blocks sight
            }
            if (level[y][x] !== areaCache[y][x]) area[y][x].textContent = level[y][x];

            area[y][x].customProps.infoKeys.unshift(level[y][x]);
            rendered[y][x] = true;
            return level[y][x] === "" || level[y][x] === " " ? "stop" : "ok";
        });
    }
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (rendered[i][j] && !memorized[i][j]) {
                memorized[i][j] = true;
            } else if (!rendered[i][j] && SHOW_MEMORIZED && memorized[i][j]) {
                area[i][j].textContent = level[i][j];
                GRAY_MEMORIZED && (area[i][j].className = "mem");
            } else if (!rendered[i][j]) {
                area[i][j].textContent = "";
            }
        }
    }
    for (let item of items) {
        if (rendered[item.pos[0]][item.pos[1]] && !item.hidden) {
            area[item.pos[0]][item.pos[1]].textContent = item.symbol;
            area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
        }
    }
    area[playerPos[0]][playerPos[1]].textContent = "@";
    area[playerPos[0]][playerPos[1]].className = "player";
    area[playerPos[0]][playerPos[1]].customProps.infoKeys.unshift("Player");

    for (let mob of mobs) {
        if (rendered[mob.pos[0]][mob.pos[1]]) {
            area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
            area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
        }
    }
    for (let obj of customRenders) {
        area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
    }

    // add walls last to check where to put them by what tiles are rendered

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (level[i][j] !== "" && level[i][j] !== " ") {
                continue;
            }
            const classes = ["wall"];

            if (i > 0 && j < level[0].length 
                && (rendered[i - 1][j] || (SHOW_MEMORIZED && memorized[i - 1][j]))
                && (level[i - 1][j] !== "" && level[i - 1][j] !== " ")
            ) {
                classes.push("t");
            }
            if (i + 1 < level.length && j < level[0].length 
                && (rendered[i + 1][j] || (SHOW_MEMORIZED && memorized[i + 1][j]))
                && (level[i + 1][j] !== "" && level[i + 1][j]!== " ")
            ) {
                classes.push("b");
            }
            if (i < level.length && j > 0 
                && (rendered[i][j - 1] || (SHOW_MEMORIZED && memorized[i][j - 1]))
                && (level[i][j - 1] !== "" && level[i][j - 1] !== " ")
            ) {
                classes.push("l");
            }
            if (i < level.length && j + 1 < level[0].length 
                && (rendered[i][j + 1] || (SHOW_MEMORIZED && memorized[i][j + 1]))
                && (level[i][j + 1] !== "" && level[i][j + 1] !== " ")
            ) {
                classes.push("r");
            }
            area[i][j].classList.add(...classes);
        }
    }
}

async function shotEffect(shotPos, playerPos, items, mobs, customRenders) {
    const prevSymbol = area[shotPos[0]][shotPos[1]].textContent;
    const prevSymbols = [null, null, null, null];
    let obj, obj0, obj1, obj2, obj3;
    area[shotPos[0]][shotPos[1]].textContent = "x";
    obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
    customRenders.push(obj);

    await new Promise(r => setTimeout(r, 300));
    
    removeByReference(customRenders, obj);
    area[shotPos[0]][shotPos[1]].textContent = prevSymbol;
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] - 1]
        && (prevSymbols[0] = area[shotPos[0] - 1][shotPos[1] - 1].textContent);
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] + 1] 
        && (prevSymbols[1] = area[shotPos[0] - 1][shotPos[1] + 1].textContent);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] + 1] 
        && (prevSymbols[2] = area[shotPos[0] + 1][shotPos[1] + 1].textContent);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] - 1] 
        && (prevSymbols[3] = area[shotPos[0] + 1][shotPos[1] - 1].textContent);
    
    // also doesn't show on walls because then symbol is "" which becomes false
    if (prevSymbols[0]) {
        area[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
        obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
        customRenders.push(obj0);
    }
    if (prevSymbols[1]) {
        area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
        obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
        customRenders.push(obj1);
    }
    if (prevSymbols[2]) {
        area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
        obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
        customRenders.push(obj2);
    }
    if (prevSymbols[3]) {
        area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
        obj3 = { symbol: "/", pos: [shotPos[0] + 1, shotPos[1] - 1] };
        customRenders.push(obj3);
    }
    await new Promise(r => setTimeout(r, 300));
    
    if (prevSymbols[0]) {
        removeByReference(customRenders, obj0);
        renderPos([shotPos[0] - 1, shotPos[1] - 1], playerPos, items, mobs, customRenders);
    }
    if (prevSymbols[1]) {
        removeByReference(customRenders, obj1);
        renderPos([shotPos[0] - 1, shotPos[1] + 1], playerPos, items, mobs, customRenders);
    }
    if (prevSymbols[2]) {
        removeByReference(customRenders, obj2);
        renderPos([shotPos[0] + 1, shotPos[1] + 1], playerPos, items, mobs, customRenders);
    }
    if (prevSymbols[3]) {
        removeByReference(customRenders, obj3);
        renderPos([shotPos[0] + 1, shotPos[1] - 1], playerPos, items, mobs, customRenders);
    }
}