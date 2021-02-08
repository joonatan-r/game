// coordsEq, getCoordsNextTo, removeByReference from util.js

// NOTE: with current implementation, if a memorized level tile is changed, 
// it would be seen even if it's not rendered

const SHOW_MEMORIZED = true;
const GRAY_MEMORIZED = true;
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
    
        if (!render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = "";
            return;
        } else if (render.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            memorized[posToRender[0]][posToRender[1]] = true;
        } else if (!render.rendered[posToRender[0]][posToRender[1]] && SHOW_MEMORIZED && memorized[posToRender[0]][posToRender[1]]) {
            render.area[posToRender[0]][posToRender[1]].textContent = level[posToRender[0]][posToRender[1]];
            GRAY_MEMORIZED && (render.area[posToRender[0]][posToRender[1]].className = "mem");
            return;
        }
        render.area[posToRender[0]][posToRender[1]].textContent = level[posToRender[0]][posToRender[1]];
        render.area[posToRender[0]][posToRender[1]].className = "";
        render.area[posToRender[0]][posToRender[1]].customProps.infoKeys.unshift(level[posToRender[0]][posToRender[1]]);
    
        for (let item of items) {
            if (coordsEq(item.pos, posToRender) && !item.hidden) {
                render.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                render.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (coordsEq(player.pos, posToRender) && !player.dead) {
            render.area[player.pos[0]][player.pos[1]].textContent = "@";
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
                render.area[i][j].className = "";
                render.area[i][j].customProps.infoKeys = [];
            }
        }
        for (let coords of render.edges) {
            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                if (render.rendered[y][x]) {
                    return level[y][x] === "" || level[y][x] === " " ? "stop" : "ok"; // wall blocks sight
                }
                if (level[y][x] !== render.areaCache[y][x]) render.area[y][x].textContent = level[y][x];
    
                render.area[y][x].customProps.infoKeys.unshift(level[y][x]);
                render.rendered[y][x] = true;
                return level[y][x] === "" || level[y][x] === " " ? "stop" : "ok";
            });
        }
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                if (render.rendered[i][j] && !memorized[i][j]) {
                    memorized[i][j] = true;
                } else if (!render.rendered[i][j] && SHOW_MEMORIZED && memorized[i][j]) {
                    render.area[i][j].textContent = level[i][j];
                    GRAY_MEMORIZED && (render.area[i][j].className = "mem");
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
                if (level[i][j] !== "" && level[i][j] !== " ") {
                    continue;
                }
                const classes = ["wall"];
    
                if (i > 0 && j < level[0].length 
                    && (render.rendered[i - 1][j] || (SHOW_MEMORIZED && memorized[i - 1][j]))
                    && (level[i - 1][j] !== "" && level[i - 1][j] !== " ")
                ) {
                    classes.push("t");
                }
                if (i + 1 < level.length && j < level[0].length 
                    && (render.rendered[i + 1][j] || (SHOW_MEMORIZED && memorized[i + 1][j]))
                    && (level[i + 1][j] !== "" && level[i + 1][j]!== " ")
                ) {
                    classes.push("b");
                }
                if (i < level.length && j > 0 
                    && (render.rendered[i][j - 1] || (SHOW_MEMORIZED && memorized[i][j - 1]))
                    && (level[i][j - 1] !== "" && level[i][j - 1] !== " ")
                ) {
                    classes.push("l");
                }
                if (i < level.length && j + 1 < level[0].length 
                    && (render.rendered[i][j + 1] || (SHOW_MEMORIZED && memorized[i][j + 1]))
                    && (level[i][j + 1] !== "" && level[i][j + 1] !== " ")
                ) {
                    classes.push("r");
                }
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
        
        // also doesn't show on walls because then symbol is "" which becomes false
        if (prevSymbols[0]) {
            render.area[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
            obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
            customRenders.push(obj0);
        }
        if (prevSymbols[1]) {
            render.area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
            obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
            customRenders.push(obj1);
        }
        if (prevSymbols[2]) {
            render.area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
            obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
            customRenders.push(obj2);
        }
        if (prevSymbols[3]) {
            render.area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
            obj3 = { symbol: "/", pos: [shotPos[0] + 1, shotPos[1] - 1] };
            customRenders.push(obj3);
        }
        await new Promise(r => setTimeout(r, 300));
        
        if (prevSymbols[0]) {
            removeByReference(customRenders, obj0);
            render.renderPos([shotPos[0] - 1, shotPos[1] - 1], player, levels, customRenders);
        }
        if (prevSymbols[1]) {
            removeByReference(customRenders, obj1);
            render.renderPos([shotPos[0] - 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (prevSymbols[2]) {
            removeByReference(customRenders, obj2);
            render.renderPos([shotPos[0] + 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (prevSymbols[3]) {
            removeByReference(customRenders, obj3);
            render.renderPos([shotPos[0] + 1, shotPos[1] - 1], player, levels, customRenders);
        }
    }
};
