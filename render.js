import { levelTiles } from "./levelData.js";
import { bresenham, isWall, removeByReference } from "./util.js";
import options from "./options.js";

function blocksSight(tile) {
    return tile === levelTiles.wall || tile === levelTiles.fakeWall;
}

const table = document.getElementById("table");

export default class Renderer {
    tileConversion = {
        [levelTiles.floor]: "",
        [levelTiles.wall]: "",
        [levelTiles.fakeWall]: "",
        [levelTiles.seeThroughWall]: "",
        [levelTiles.transparentBgWall]: ""
    };

    constructor(area, rendered) { // NOTE: area has to be initialized before
        this.area = area;
        this.rendered = rendered;
        this.areaCache = [];
        this.edges = [];
        this.imageCache = [];
        this.imgCoordsToDelete = []; // used to not replace imgs unless necessary

        if (options.USE_DOTS) {
            this.tileConversion[levelTiles.floor] = "\u00B7";
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
        this.loadImagesToCache();
    }

    loadImagesToCache() {
        for (let i = 1; i <= 9; i++) {
            if (i === 5) continue;
            const img = this.createImage("./playerImages/player_" + i + ".png");
            const img2 = this.createImage("./mobImages/mob_" + i + ".png");
            const moveImg = this.createImage("./playerImages/player_" + i + "_move.png");
            const moveImg2 = this.createImage("./mobImages/mob_" + i + "_move.png");
            const moveImg3 = this.createImage("./playerImages/player_" + i + "_2_move.png");
            const moveImg4 = this.createImage("./mobImages/mob_" + i + "_2_move.png");
            this.imageCache.push(img, img2, moveImg, moveImg2, moveImg3, moveImg4);
        }
    }

    createImage(src) {
        const img = new Image();
        img.src = src;
    }

    getTileToRender(tile) {
        if (Object.keys(this.tileConversion).indexOf(tile) !== -1) {
            return this.tileConversion[tile];
        }
        return tile;
    }

    changeOptions(newOptions) {
        if (newOptions.USE_DOTS) {
            this.tileConversion[levelTiles.floor] = "\u00B7";
        }
    }

    setBg(levels) {
        if (options.USE_BG_IMG) {
            if (levels[levels.currentLvl].bg.startsWith("#")) {
                table.style.backgroundColor = levels[levels.currentLvl].bg;
                table.style.backgroundImage = 'none';
            } else {
                table.style.backgroundImage = levels[levels.currentLvl].bg;
                table.style.backgroundColor = 'none';
            }
        } else {
            table.style.backgroundColor = "#000";
        }
    }

    renderAll(player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        let visitedTTypeWall = false;
        let selectionPos = null; // used to not erase selection marker on pos when inspecting
    
        // TODO could still optimize having items etc in areaCache and not overwriting

        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const areaPos = this.area[i][j];

                this.rendered[i][j] = false;
                this.areaCache[i][j] = areaPos.textContent;
                areaPos.firstChild 
                    && areaPos.firstChild.tagName === "IMG"
                    && areaPos.removeChild(areaPos.firstChild);

                if (areaPos.classList.contains("selected")) {
                    selectionPos = [i, j];
                }
                areaPos.className = "hidden";
                areaPos.style.backgroundImage !== "none" && (this.imgCoordsToDelete.push(areaPos));
                areaPos.customProps.infoKeys = [];
            }
        }
        for (let coords of this.edges) {
            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                const levelTile = level[y][x];

                if (levelTile === levelTiles.transparentBgWall) {
                    visitedTTypeWall = true;
                } else if (visitedTTypeWall) {
                    visitedTTypeWall = false;
                    return "stop";
                }
                if (this.rendered[y][x]) {
                    return blocksSight(levelTile) ? "stop" : "ok";
                }
                const tileToRender = this.getTileToRender(levelTile);
                const areaPos = this.area[y][x];

                if (tileToRender !== this.areaCache[y][x]) {
                    areaPos.textContent = tileToRender;
                }
                areaPos.customProps.infoKeys.unshift(levelTile);
                !blocksSight(levelTile) && (areaPos.className = "shown");
                this.rendered[y][x] = true;
                return blocksSight(levelTile) ? "stop" : "ok";
            });
        }
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const levelTile = level[i][j];
                const areaPos = this.area[i][j];
                const posRendered = this.rendered[i][j];
                const posMemorized = memorized[i][j];

                if (posRendered && (posMemorized === "" || posMemorized !== levelTile)) {
                    memorized[i][j] = levelTile;
                } else if (!posRendered && options.SHOW_MEMORIZED && posMemorized !== "") {
                    const tileToRender = this.getTileToRender(posMemorized);

                    if (tileToRender !== this.areaCache[i][j]) {
                        areaPos.textContent = tileToRender;
                    }
                    if (!blocksSight(posMemorized)) {
                        if (options.GRAY_MEMORIZED) {
                            areaPos.className = "mem";
                        } else {
                            areaPos.className = "";
                        }
                    }
                } else if (!posRendered && areaPos.textContent !== "") {
                    areaPos.textContent = "";
                }
            }
        }
        for (let item of items) {
            if (this.rendered[item.pos[0]][item.pos[1]] && !item.hidden) {
                const areaPos = this.area[item.pos[0]][item.pos[1]];
                areaPos.textContent = item.symbol;
                options.OBJ_BG && (areaPos.className = "obj-bg");
                areaPos.customProps.infoKeys.unshift(item.name);
            }
        }
        if (!player.dead) {
            const playerPos = this.area[player.pos[0]][player.pos[1]];

            if (options.OBJ_IMG) {
                const imageToUse = "url(\"./playerImages/player_" + player.image + ".png\")";

                if (playerPos.textContent !== "") {
                    playerPos.textContent = "";
                }
                if (playerPos.style.backgroundImage !== imageToUse) {
                    playerPos.style.backgroundImage = imageToUse;
                }
                removeByReference(this.imgCoordsToDelete, playerPos);
            } else {
                playerPos.textContent = "@";
                
                if (options.OBJ_BG) {
                    playerPos.className = "player obj-bg"
                } else {
                    playerPos.className = "player";
                }
            }
            playerPos.customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (this.rendered[mob.pos[0]][mob.pos[1]]) {
                const mobPos = this.area[mob.pos[0]][mob.pos[1]];

                if (options.OBJ_IMG) {
                    const imageToUse = "url(\"./mobImages/mob_" + (mob.image || 2) + ".png\")";

                    if ( mobPos.textContent !== "") {
                        mobPos.textContent = "";
                    }
                    if (mobPos.style.backgroundImage !== imageToUse) {
                        mobPos.style.backgroundImage = imageToUse;
                    }
                    removeByReference(this.imgCoordsToDelete, mobPos);
                } else {
                    mobPos.textContent = mob.symbol;
                    options.OBJ_BG && (mobPos.className = "obj-bg");
                }
                mobPos.customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            if (this.rendered[obj.pos[0]][obj.pos[1]]) {
                this.area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
            }
        }
        for (const pos of this.imgCoordsToDelete) {
            pos.style.backgroundImage = "none";
        }
        // add walls last to check where to put them by what tiles are rendered
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const levelTile = level[i][j];

                if (!isWall(levelTile)) {
                    continue;
                }
                const classes = [];

                if (!blocksSight(levelTile) && levelTile !== levelTiles.transparentBgWall) {
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
                        || (blocksSight(levelTile) && !blocksSight(level[p.i][p.j])))
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
        const currLvl = levels.currentLvl;
        let obj, obj0, obj1, obj2, obj3;

        if (this.rendered[shotPos[0]][shotPos[1]]) {
            this.area[shotPos[0]][shotPos[1]].textContent = "x";
        }
        obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
        customRenders.push(obj);
        
        await new Promise(r => setTimeout(r, 300));
        if (levels.currentLvl !== currLvl) return;
        
        removeByReference(customRenders, obj);
        this.renderAll(player, levels, customRenders);

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
        
        removeByReference(customRenders, obj0);
        removeByReference(customRenders, obj1);
        removeByReference(customRenders, obj2);
        removeByReference(customRenders, obj3);
        this.renderAll(player, levels, customRenders);
    }
};
