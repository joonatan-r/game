import { bresenham, coordsEq, isWall, removeByReference } from "./util.js";
import options from "./options.js";

// NOTE: with current implementation, if a memorized level tile is changed, 
// it would be seen even if it's not rendered

export function changeRenderOptions(newOptions) {
    for (let key of Object.keys(newOptions)) {
        options[key] = newOptions[key];
    }
    if (options.USE_DOTS) {
        tileConversion["."] = "\u00B7";
    }
    USE_BG_IMG = options.USE_BG_IMG;
    OBJ_BG = options.OBJ_BG;
    OBJ_IMG = options.OBJ_IMG;
    SHOW_MEMORIZED = options.SHOW_MEMORIZED;
    GRAY_MEMORIZED = options.GRAY_MEMORIZED;
}

function blocksSight(tile) {
    return tile === "*w" || tile === "*f";
}

function getTileToRender(tile) {
    if (Object.keys(tileConversion).indexOf(tile) !== -1) {
        return tileConversion[tile];
    }
    return tile;
}

const tileConversion = {
    ".": "",
    "*w": "",
    "*f": "",
    "*s": "",
    "*t": ""
};

if (options.USE_DOTS) {
    tileConversion["."] = "\u00B7";
}
let USE_BG_IMG = options.USE_BG_IMG;
let OBJ_BG = options.OBJ_BG;
let OBJ_IMG = options.OBJ_IMG;
let SHOW_MEMORIZED = options.SHOW_MEMORIZED;
let GRAY_MEMORIZED = options.GRAY_MEMORIZED;

export const render = {
    updateFields: function(area, areaCache, rendered, edges) {
        render.area = area;
        render.areaCache = areaCache;
        render.rendered = rendered;
        render.edges = edges;
    },
    renderPos: function(posToRender, player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        
        render.area[posToRender[0]][posToRender[1]].className = "hidden";
    
        if (!render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = "";
            return;
        } else if (render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            memorized[posToRender[0]][posToRender[1]] = true;
        } else if (!render.rendered[posToRender[0]][posToRender[1]] && SHOW_MEMORIZED && memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = getTileToRender(level[posToRender[0]][posToRender[1]]);

            if (!blocksSight(level[posToRender[0]][posToRender[1]])) { // always (<-- i have no idea what this comment means)
                if (GRAY_MEMORIZED) {
                    render.area[posToRender[0]][posToRender[1]].className = "mem";
                } else {
                    render.area[posToRender[0]][posToRender[1]].className = "";
                }
            }
            return;
        }
        render.area[posToRender[0]][posToRender[1]].textContent = getTileToRender(level[posToRender[0]][posToRender[1]]);
        render.area[posToRender[0]][posToRender[1]].customProps.infoKeys.unshift(level[posToRender[0]][posToRender[1]]);
        !blocksSight(level[posToRender[0]][posToRender[1]]) && (render.area[posToRender[0]][posToRender[1]].className = "shown");
        render.rendered[posToRender[0]][posToRender[1]] = true;
    
        for (let item of items) {
            if (coordsEq(item.pos, posToRender) && !item.hidden) {
                render.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                OBJ_BG && (render.area[item.pos[0]][item.pos[1]].className = "obj-bg");
                render.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (coordsEq(player.pos, posToRender) && !player.dead) {
            if (OBJ_IMG) {
                render.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
            } else {
                render.area[player.pos[0]][player.pos[1]].textContent = "@";
            }
            if (OBJ_BG) {
                render.area[player.pos[0]][player.pos[1]].className = "player obj-bg"
            } else {
                render.area[player.pos[0]][player.pos[1]].className = "player";
            }
            render.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (coordsEq(mob.pos, posToRender)) {
                if (OBJ_IMG) {
                    render.area[mob.pos[0]][mob.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
                } else {
                    render.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
                }
                OBJ_BG && (render.area[mob.pos[0]][mob.pos[1]].className = "obj-bg");
                render.area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            if (coordsEq(obj.pos, posToRender)) {
                render.area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
            }
        }
        if (!isWall(level[posToRender[0]][posToRender[1]])) {
            return;
        }
        const classes = [];

        if (!blocksSight(level[posToRender[0]][posToRender[1]])) {
            if (USE_BG_IMG) {
                classes.push("wall-s-bg");
            } else {
                classes.push("wall-s");
            }
        } else {
            classes.push("wall");
        }
        const paramList = [
            { i: posToRender[0] - 1, j: posToRender[1], side: "t" },
            { i: posToRender[0], j: posToRender[1] - 1, side: "l" },
            { i: posToRender[0], j: posToRender[1] + 1, side: "r" },
            { i: posToRender[0] + 1, j: posToRender[1], side: "b" }
        ];

        for (let p of paramList) {
            if (level[p.i] && (typeof level[p.i][p.j] !== "undefined")
                && (render.rendered[p.i][p.j] || (SHOW_MEMORIZED && memorized[p.i][p.j]))
                && (!isWall(level[p.i][p.j]) 
                || (blocksSight(level[posToRender[0]][posToRender[1]]) && !blocksSight(level[p.i][p.j])))
            ) {
                classes.push(p.side);
            }
        }
        render.area[posToRender[0]][posToRender[1]].classList.add(...classes);
    },
    renderAll: function(player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        let visitedTTypeWall = false;
        let selectionPos = null; // used to not erase selection marker on pos when inspecting
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                render.rendered[i][j] = false;
                render.areaCache[i][j] = render.area[i][j].textContent;
                render.area[i][j].firstChild 
                    && render.area[i][j].firstChild.tagName === "IMG"
                    && render.area[i][j].removeChild(render.area[i][j].firstChild);

                if (render.area[i][j].classList.contains("selected")) {
                    selectionPos = [i, j];
                }
                render.area[i][j].className = "hidden";
                render.area[i][j].customProps.infoKeys = [];
            }
        }
        for (let coords of render.edges) {
            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                if (level[y][x] === "*t") {
                    visitedTTypeWall = true;
                } else if (visitedTTypeWall) {
                    visitedTTypeWall = false;
                    return "stop";
                }
                if (render.rendered[y][x]) {
                    return blocksSight(level[y][x]) ? "stop" : "ok";
                }
                if (getTileToRender(level[y][x]) !== render.areaCache[y][x]) render.area[y][x].textContent = getTileToRender(level[y][x]);
    
                render.area[y][x].customProps.infoKeys.unshift(level[y][x]);
                !blocksSight(level[y][x]) && (render.area[y][x].className = "shown");
                render.rendered[y][x] = true;
                return blocksSight(level[y][x]) ? "stop" : "ok";
            });
        }
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                if (render.rendered[i][j] && !memorized[i][j]) {
                    memorized[i][j] = true;
                } else if (!render.rendered[i][j] && SHOW_MEMORIZED && memorized[i][j]) {
                    render.area[i][j].textContent = getTileToRender(level[i][j]);

                    if (!blocksSight(level[i][j])) {
                        if (GRAY_MEMORIZED) {
                            render.area[i][j].className = "mem";
                        } else {
                            render.area[i][j].className = "";
                        }
                    }
                } else if (!render.rendered[i][j]) {
                    render.area[i][j].textContent = "";
                }
            }
        }
        for (let item of items) {
            if (render.rendered[item.pos[0]][item.pos[1]] && !item.hidden) {
                render.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                OBJ_BG && (render.area[item.pos[0]][item.pos[1]].className = "obj-bg");
                render.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (!player.dead) {
            if (OBJ_IMG) {
                render.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
            } else {
                render.area[player.pos[0]][player.pos[1]].textContent = "@";
            }
            if (OBJ_BG) {
                render.area[player.pos[0]][player.pos[1]].className = "player obj-bg"
            } else {
                render.area[player.pos[0]][player.pos[1]].className = "player";
            }
            render.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (render.rendered[mob.pos[0]][mob.pos[1]]) {
                if (OBJ_IMG) {
                    render.area[mob.pos[0]][mob.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
                } else {
                    render.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
                }
                OBJ_BG && (render.area[mob.pos[0]][mob.pos[1]].className = "obj-bg");
                render.area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            render.area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
        }
    
        // add walls last to check where to put them by what tiles are rendered
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                if (!isWall(level[i][j])) {
                    continue;
                }
                const classes = [];

                if (!blocksSight(level[i][j])) {
                    if (USE_BG_IMG) {
                        classes.push("wall-s-bg");
                    } else {
                        classes.push("wall-s");
                    }
                } else {
                    classes.push("wall");
                }
                const paramList = [
                    { i: i - 1, j: j, side: "t" },
                    { i: i, j: j - 1, side: "l" },
                    { i: i, j: j + 1, side: "r" },
                    { i: i + 1, j: j, side: "b" }
                ];
                
                for (let p of paramList) {
                    if (level[p.i] && (typeof level[p.i][p.j] !== "undefined")
                        && (render.rendered[p.i][p.j] || (SHOW_MEMORIZED && memorized[p.i][p.j]))
                        && (!isWall(level[p.i][p.j]) 
                        || (blocksSight(level[i][j]) && !blocksSight(level[p.i][p.j])))
                    ) {
                        classes.push(p.side);
                    }
                }
                render.area[i][j].classList.add(...classes);
            }
        }
        selectionPos && render.area[selectionPos[0]][selectionPos[1]].classList.add("selected");
    },
    shotEffect: async function(shotPos, player, levels, customRenders) {
        const prevSymbols = [null, null, null, null];
        let obj, obj0, obj1, obj2, obj3;
        render.area[shotPos[0]][shotPos[1]].textContent = "x";
        obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
        customRenders.push(obj);
    
        await new Promise(r => setTimeout(r, 300));
        
        removeByReference(customRenders, obj);
        render.renderPos(shotPos, player, levels, customRenders);
        render.area[shotPos[0] - 1] && render.area[shotPos[0] - 1][shotPos[1] - 1]
            && (prevSymbols[0] = render.area[shotPos[0] - 1][shotPos[1] - 1].textContent);
        render.area[shotPos[0] - 1] && render.area[shotPos[0] - 1][shotPos[1] + 1] 
            && (prevSymbols[1] = render.area[shotPos[0] - 1][shotPos[1] + 1].textContent);
        render.area[shotPos[0] + 1] && render.area[shotPos[0] + 1][shotPos[1] + 1] 
            && (prevSymbols[2] = render.area[shotPos[0] + 1][shotPos[1] + 1].textContent);
        render.area[shotPos[0] + 1] && render.area[shotPos[0] + 1][shotPos[1] - 1] 
            && (prevSymbols[3] = render.area[shotPos[0] + 1][shotPos[1] - 1].textContent);
        
        if (prevSymbols[0] !== null) {
            render.area[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
            obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
            customRenders.push(obj0);
        }
        if (prevSymbols[1] !== null) {
            render.area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
            obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
            customRenders.push(obj1);
        }
        if (prevSymbols[2] !== null) {
            render.area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
            obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
            customRenders.push(obj2);
        }
        if (prevSymbols[3] !== null) {
            render.area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
            obj3 = { symbol: "/", pos: [shotPos[0] + 1, shotPos[1] - 1] };
            customRenders.push(obj3);
        }
        await new Promise(r => setTimeout(r, 300));
        
        if (prevSymbols[0] !== null) {
            removeByReference(customRenders, obj0);
            render.renderPos([shotPos[0] - 1, shotPos[1] - 1], player, levels, customRenders);
        }
        if (prevSymbols[1] !== null) {
            removeByReference(customRenders, obj1);
            render.renderPos([shotPos[0] - 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (prevSymbols[2] !== null) {
            removeByReference(customRenders, obj2);
            render.renderPos([shotPos[0] + 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (prevSymbols[3] !== null) {
            removeByReference(customRenders, obj3);
            render.renderPos([shotPos[0] + 1, shotPos[1] - 1], player, levels, customRenders);
        }
    }
};
