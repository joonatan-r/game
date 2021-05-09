// coordsEq, getCoordsNextTo, isWall, removeByReference from util.js
// options from options.js

// NOTE: with current implementation, if a memorized level tile is changed, 
// it would be seen even if it's not rendered

function blocksSight(tile) {
    return tile === "*w" || tile === "*f";
}

function getTileToRender(tile) {
    if (Object.keys(tileConversion).indexOf(tile) !== -1) {
        return tileConversion[tile];
    }
    return tile;
}

function addWall(i, j, currentTile, addCallback) {
    if (level[i] && (typeof level[i][j] !== "undefined")
        && (render.rendered[i][j] || (SHOW_MEMORIZED && memorized[i][j]))
        && (!isWall(level[i][j]) 
        || (blocksSight(currentTile) && !blocksSight(level[i][j])))
    ) {
        addCallback();
    }
}

const tileConversion = {
    "*w": "",
    "*f": "",
    "*s": ""
};
const USE_BG_IMG = options.USE_BG_IMG;
const SHOW_MEMORIZED = options.SHOW_MEMORIZED;
const GRAY_MEMORIZED = options.GRAY_MEMORIZED;
const render = {
    area: [], // these have to be initialized before use
    areaCache: [],
    rendered: [],
    edges: [],
    renderPos: function(posToRender, player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        
        render.area[posToRender[0]][posToRender[1]].className = "not-rendered";
    
        if (!render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = "";
            return;
        } else if (render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            memorized[posToRender[0]][posToRender[1]] = true;
        } else if (!render.rendered[posToRender[0]][posToRender[1]] && SHOW_MEMORIZED && memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = getTileToRender(level[posToRender[0]][posToRender[1]]);

            if (!blocksSight(level[posToRender[0]][posToRender[1]])) { // always 
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
        !blocksSight(level[posToRender[0]][posToRender[1]]) && (render.area[posToRender[0]][posToRender[1]].className = "rendered");
        render.rendered[posToRender[0]][posToRender[1]] = true;
    
        for (let item of items) {
            if (coordsEq(item.pos, posToRender) && !item.hidden) {
                render.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                render.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (coordsEq(player.pos, posToRender) && !player.dead) {
            render.area[player.pos[0]][player.pos[1]].textContent = "@";
            // render.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.jpg\"/>";
            render.area[player.pos[0]][player.pos[1]].className = "player";
            render.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (coordsEq(mob.pos, posToRender)) {
                render.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
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
        addWall(posToRender[0] - 1, posToRender[1], level[posToRender[0]][posToRender[1]], () => classes.push("t"));
        addWall(posToRender[0], posToRender[1] - 1, level[posToRender[0]][posToRender[1]], () => classes.push("l"));
        addWall(posToRender[0], posToRender[1] + 1, level[posToRender[0]][posToRender[1]], () => classes.push("r"));
        addWall(posToRender[0] + 1, posToRender[1], level[posToRender[0]][posToRender[1]], () => classes.push("b"));
        render.area[posToRender[0]][posToRender[1]].classList.add(...classes);
    },
    renderAll: function(player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                render.rendered[i][j] = false;
                render.areaCache[i][j] = render.area[i][j].textContent;
                // render.area[i][j].firstChild 
                //     && render.area[i][j].firstChild.tagName === "IMG"
                //     && render.area[i][j].removeChild(render.area[i][j].firstChild);
                render.area[i][j].className = "not-rendered";
                render.area[i][j].customProps.infoKeys = [];
            }
        }
        for (let coords of render.edges) {
            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                if (render.rendered[y][x]) {
                    return blocksSight(level[y][x]) ? "stop" : "ok";
                }
                if (getTileToRender(level[y][x]) !== render.areaCache[y][x]) render.area[y][x].textContent = getTileToRender(level[y][x]);
    
                render.area[y][x].customProps.infoKeys.unshift(level[y][x]);
                !blocksSight(level[y][x]) && (render.area[y][x].className = "rendered");
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
                render.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (!player.dead) {
            render.area[player.pos[0]][player.pos[1]].textContent = "@";
            // render.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.jpg\"/>";
            render.area[player.pos[0]][player.pos[1]].className = "player";
            render.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (render.rendered[mob.pos[0]][mob.pos[1]]) {
                render.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
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
                addWall(i + 1, j, level[i][j], () => classes.push("b"));
                addWall(i - 1, j, level[i][j], () => classes.push("t"));
                addWall(i, j - 1, level[i][j], () => classes.push("l"));
                addWall(i, j + 1, level[i][j], () => classes.push("r"));
                render.area[i][j].classList.add(...classes);
            }
        }
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
