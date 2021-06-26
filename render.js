import { bresenham, coordsEq, isWall, removeByReference } from "./util.js";
import options from "./options.js";

// NOTE: with current implementation, if a memorized level tile is changed, 
// it would be seen even if it's not rendered

function blocksSight(tile) {
    return tile === "*w" || tile === "*f";
}

export default class Renderer {
    tileConversion = {
        ".": "",
        "*w": "",
        "*f": "",
        "*s": "",
        "*t": ""
    };

    constructor(area, rendered) { // NOTE: area has to be initialized before
        this.area = area;
        this.rendered = rendered;
        this.areaCache = [];
        this.edges = [];

        if (options.USE_DOTS) {
            this.tileConversion["."] = "\u00B7";
        }
        for (let i = 0; i < area.length; i++) {
            this.areaCache.push([]);
          
            for (let j = 0; j < area[0].length; j++) {
                if (i === 0 || j === 0 || i === area.length - 1 || j === area[0].length - 1) {
                    this.edges.push([i, j]);
                }
                this.areaCache[i][j] = "";
            }
        }
    }

    getTileToRender(tile) {
        if (Object.keys(this.tileConversion).indexOf(tile) !== -1) {
            return this.tileConversion[tile];
        }
        return tile;
    }

    changeRenderOptions(newOptions) {
        for (let key of Object.keys(newOptions)) {
            options[key] = newOptions[key];
        }
        if (options.USE_DOTS) {
            this.tileConversion["."] = "\u00B7";
        }
    }

    renderPos(posToRender, player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        
        this.area[posToRender[0]][posToRender[1]].className = "hidden";
    
        if (!this.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            this.area[posToRender[0]][posToRender[1]].textContent = "";
            return;
        } else if (this.rendered[posToRender[0]][posToRender[1]] && !memorized[posToRender[0]][posToRender[1]]) {
            memorized[posToRender[0]][posToRender[1]] = true;
        } else if (!this.rendered[posToRender[0]][posToRender[1]] && options.SHOW_MEMORIZED && memorized[posToRender[0]][posToRender[1]]) {
            this.area[posToRender[0]][posToRender[1]].textContent = this.getTileToRender(level[posToRender[0]][posToRender[1]]);

            if (!blocksSight(level[posToRender[0]][posToRender[1]])) { // always (<-- i have no idea what this comment means)
                if (options.GRAY_MEMORIZED) {
                    this.area[posToRender[0]][posToRender[1]].className = "mem";
                } else {
                    this.area[posToRender[0]][posToRender[1]].className = "";
                }
            }
            return;
        }
        this.area[posToRender[0]][posToRender[1]].textContent = this.getTileToRender(level[posToRender[0]][posToRender[1]]);
        this.area[posToRender[0]][posToRender[1]].customProps.infoKeys.unshift(level[posToRender[0]][posToRender[1]]);
        !blocksSight(level[posToRender[0]][posToRender[1]]) && (this.area[posToRender[0]][posToRender[1]].className = "shown");
        this.rendered[posToRender[0]][posToRender[1]] = true;
    
        for (let item of items) {
            if (coordsEq(item.pos, posToRender) && !item.hidden) {
                this.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                options.OBJ_BG && (this.area[item.pos[0]][item.pos[1]].className = "obj-bg");
                this.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (coordsEq(player.pos, posToRender) && !player.dead) {
            if (options.OBJ_IMG) {
                this.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
            } else {
                this.area[player.pos[0]][player.pos[1]].textContent = "@";
            }
            if (options.OBJ_BG) {
                this.area[player.pos[0]][player.pos[1]].className = "player obj-bg"
            } else {
                this.area[player.pos[0]][player.pos[1]].className = "player";
            }
            this.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (coordsEq(mob.pos, posToRender)) {
                if (options.OBJ_IMG) {
                    this.area[mob.pos[0]][mob.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
                } else {
                    this.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
                }
                options.OBJ_BG && (this.area[mob.pos[0]][mob.pos[1]].className = "obj-bg");
                this.area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            if (coordsEq(obj.pos, posToRender)) {
                this.area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
            }
        }
        if (!isWall(level[posToRender[0]][posToRender[1]])) {
            return;
        }
        const classes = [];

        if (!blocksSight(level[posToRender[0]][posToRender[1]])) {
            if (options.USE_BG_IMG) {
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
                && (this.rendered[p.i][p.j] || (options.SHOW_MEMORIZED && memorized[p.i][p.j]))
                && (!isWall(level[p.i][p.j]) 
                || (blocksSight(level[posToRender[0]][posToRender[1]]) && !blocksSight(level[p.i][p.j])))
            ) {
                classes.push(p.side);
            }
        }
        this.area[posToRender[0]][posToRender[1]].classList.add(...classes);
    }

    renderAll(player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        let visitedTTypeWall = false;
        let selectionPos = null; // used to not erase selection marker on pos when inspecting
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                this.rendered[i][j] = false;
                this.areaCache[i][j] = this.area[i][j].textContent;
                this.area[i][j].firstChild 
                    && this.area[i][j].firstChild.tagName === "IMG"
                    && this.area[i][j].removeChild(this.area[i][j].firstChild);

                if (this.area[i][j].classList.contains("selected")) {
                    selectionPos = [i, j];
                }
                this.area[i][j].className = "hidden";
                this.area[i][j].customProps.infoKeys = [];
            }
        }
        for (let coords of this.edges) {
            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                if (level[y][x] === "*t") {
                    visitedTTypeWall = true;
                } else if (visitedTTypeWall) {
                    visitedTTypeWall = false;
                    return "stop";
                }
                if (this.rendered[y][x]) {
                    return blocksSight(level[y][x]) ? "stop" : "ok";
                }
                if (this.getTileToRender(level[y][x]) !== this.areaCache[y][x]) {
                    this.area[y][x].textContent = this.getTileToRender(level[y][x]);
                }
    
                this.area[y][x].customProps.infoKeys.unshift(level[y][x]);
                !blocksSight(level[y][x]) && (this.area[y][x].className = "shown");
                this.rendered[y][x] = true;
                return blocksSight(level[y][x]) ? "stop" : "ok";
            });
        }
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                if (this.rendered[i][j] && !memorized[i][j]) {
                    memorized[i][j] = true;
                } else if (!this.rendered[i][j] && options.SHOW_MEMORIZED && memorized[i][j]) {
                    this.area[i][j].textContent = this.getTileToRender(level[i][j]);

                    if (!blocksSight(level[i][j])) {
                        if (options.GRAY_MEMORIZED) {
                            this.area[i][j].className = "mem";
                        } else {
                            this.area[i][j].className = "";
                        }
                    }
                } else if (!this.rendered[i][j]) {
                    this.area[i][j].textContent = "";
                }
            }
        }
        for (let item of items) {
            if (this.rendered[item.pos[0]][item.pos[1]] && !item.hidden) {
                this.area[item.pos[0]][item.pos[1]].textContent = item.symbol;
                options.OBJ_BG && (this.area[item.pos[0]][item.pos[1]].className = "obj-bg");
                this.area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
            }
        }
        if (!player.dead) {
            if (options.OBJ_IMG) {
                this.area[player.pos[0]][player.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
            } else {
                this.area[player.pos[0]][player.pos[1]].textContent = "@";
            }
            if (options.OBJ_BG) {
                this.area[player.pos[0]][player.pos[1]].className = "player obj-bg"
            } else {
                this.area[player.pos[0]][player.pos[1]].className = "player";
            }
            this.area[player.pos[0]][player.pos[1]].customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (this.rendered[mob.pos[0]][mob.pos[1]]) {
                if (options.OBJ_IMG) {
                    this.area[mob.pos[0]][mob.pos[1]].innerHTML = "<img src=\"./img.png\"/>";
                } else {
                    this.area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
                }
                options.OBJ_BG && (this.area[mob.pos[0]][mob.pos[1]].className = "obj-bg");
                this.area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            this.area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
        }
    
        // add walls last to check where to put them by what tiles are rendered
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                if (!isWall(level[i][j])) {
                    continue;
                }
                const classes = [];

                if (!blocksSight(level[i][j])) {
                    if (options.USE_BG_IMG) {
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
                        && (this.rendered[p.i][p.j] || (options.SHOW_MEMORIZED && memorized[p.i][p.j]))
                        && (!isWall(level[p.i][p.j]) 
                        || (blocksSight(level[i][j]) && !blocksSight(level[p.i][p.j])))
                    ) {
                        classes.push(p.side);
                    }
                }
                this.area[i][j].classList.add(...classes);
            }
        }
        selectionPos && this.area[selectionPos[0]][selectionPos[1]].classList.add("selected");
    }

    async shotEffect(shotPos, player, levels, customRenders) {
        let obj, obj0, obj1, obj2, obj3;

        if (this.rendered[shotPos[0]][shotPos[1]]) {
            this.area[shotPos[0]][shotPos[1]].textContent = "x";
            obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
            customRenders.push(obj);
        }
        await new Promise(r => setTimeout(r, 300));
        
        removeByReference(customRenders, obj);
        
        if (this.rendered[shotPos[0]][shotPos[1]]) {
            this.renderPos(shotPos, player, levels, customRenders);
        } else if (obj) {
            this.area[shotPos[0]][shotPos[1]].textContent = "";
        }
        if (this.area[shotPos[0] - 1] && this.area[shotPos[0] - 1][shotPos[1] - 1]
            && this.rendered[shotPos[0] - 1][shotPos[1] - 1]
        ) {
            this.area[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
            obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
            customRenders.push(obj0);
        }
        if (this.area[shotPos[0] - 1] && this.area[shotPos[0] - 1][shotPos[1] + 1]
            && this.rendered[shotPos[0] - 1][shotPos[1] + 1]
        ) {
            this.area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
            obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
            customRenders.push(obj1);
        }
        if (this.area[shotPos[0] + 1] && this.area[shotPos[0] + 1][shotPos[1] + 1]
            && this.rendered[shotPos[0] + 1][shotPos[1] + 1]
        ) {
            this.area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
            obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
            customRenders.push(obj2);
        }
        if (this.area[shotPos[0] + 1] && this.area[shotPos[0] + 1][shotPos[1] - 1]
            && this.rendered[shotPos[0] + 1][shotPos[1] - 1]
        ) {
            this.area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
            obj3 = { symbol: "/", pos: [shotPos[0] + 1, shotPos[1] - 1] };
            customRenders.push(obj3);
        }
        await new Promise(r => setTimeout(r, 300));
        
        if (obj0) {
            removeByReference(customRenders, obj0);
            this.renderPos([shotPos[0] - 1, shotPos[1] - 1], player, levels, customRenders);
        }
        if (obj1) {
            removeByReference(customRenders, obj1);
            this.renderPos([shotPos[0] - 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (obj2) {
            removeByReference(customRenders, obj2);
            this.renderPos([shotPos[0] + 1, shotPos[1] + 1], player, levels, customRenders);
        }
        if (obj3) {
            removeByReference(customRenders, obj3);
            this.renderPos([shotPos[0] + 1, shotPos[1] - 1], player, levels, customRenders);
        }
    }
};
