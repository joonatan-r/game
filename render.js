import { levelTiles } from "./levelData.js";
import { bresenham, coordsEq, isWall, removeByReference } from "./util.js";
import options from "./options.js";

function blocksSight(tile) {
    return tile === levelTiles.wall || tile === levelTiles.fakeWall;
}

const table = document.getElementById("table");
const overlayTable = document.getElementById("overlayTable");

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
        this.overlayArea = [];
        this.prevAreaBuffer = [];
        this.rendered = rendered;
        this.edges = [];
        this.imageCache = [];
        this.queuePromise = Promise.resolve();

        if (options.USE_DOTS) {
            this.tileConversion[levelTiles.floor] = "\u00B7";
        }
        for (let i = 0; i < area.length; i++) {
            this.prevAreaBuffer.push([]);
            const tr = document.createElement("tr");
            overlayTable.appendChild(tr);
            this.overlayArea.push([]);
          
            for (let j = 0; j < area[0].length; j++) {
                if (i === 0 || j === 0 || i === area.length - 1 || j === area[0].length - 1) {
                    this.edges.push([i, j]);
                }
                this.prevAreaBuffer[i][j] = {
                    classList: ["hidden"],
                    style: {},
                    customProps: {
                        infoKeys: []
                    }
                };
                const td = document.createElement("td");
                tr.appendChild(td);
                this.overlayArea[i][j] = td;
            }
        }
        this.loadImagesToCache();
    }

    // Can be used as a semaphore to execute changes in an async task. All other async tasks
    // wait until the previous is ready before proceeding. Usage: await this function's return
    // value, execute changes, and call the return value to release the lock. 

    async addToQueue() {
        return new Promise(resolve => {
            this.queuePromise = this.queuePromise.then(() => {
                return new Promise(queueResolve => {
                    resolve(queueResolve);
                });
            });
        });
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
        return img;
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
            if (levels[levels.currentLvl].overlayBg) {
                overlayTable.style.backgroundImage = levels[levels.currentLvl].overlayBg;
            } else {
                overlayTable.style.backgroundImage = 'none';
            }
        } else {
            table.style.backgroundColor = "#000";
        }
    }

    renderSymbolAtPos(symbol, pos, player, levels) {
        let level = levels[levels.currentLvl].level;
        let visitedTTypeWall = false;
        bresenham(player.pos[0], player.pos[1], pos[0], pos[1], (y,x) => {
            const levelTile = level[y][x];

            if (levelTile === levelTiles.transparentBgWall) {
                visitedTTypeWall = true;
            } else if (visitedTTypeWall) {
                visitedTTypeWall = false;
                return "stop";
            }
            if (coordsEq([y, x], pos)) {
                this.area[y][x].textContent = symbol;
                this.prevAreaBuffer[y][x].textContent = symbol;
            }
            return blocksSight(levelTile) ? "stop" : "ok";
        });
    }

    async renderAll(player, levels, customRenders) {
        let level = levels[levels.currentLvl].level;
        let mobs = levels[levels.currentLvl].mobs;
        let items = levels[levels.currentLvl].items;
        let memorized = levels[levels.currentLvl].memorized;
        let visitedTTypeWall = false;
        let selectionPos = null; // used to not erase selection marker on pos when inspecting

        const areaBuffer = [];
        const renderedBuffer = [];
        const memorizedBuffer = [];
        const imgCoordsToDelete = []; // used to not replace imgs unless necessary

        for (let i = 0; i < level.length; i++) {
            areaBuffer.push([]);
            renderedBuffer.push([]);
            memorizedBuffer.push([]);

            for (let j = 0; j < level[0].length; j++) {
                areaBuffer[i][j] = {
                    classList: ["hidden"],
                    style: {},
                    customProps: {
                        infoKeys: []
                    }
                };
                renderedBuffer[i][j] = false;
                memorizedBuffer[i][j] = memorized[i][j];
                const areaPos = this.area[i][j];

                if (areaPos.classList.contains("selected")) {
                    selectionPos = [i, j];
                }
                areaPos.style.backgroundImage !== "none" && (imgCoordsToDelete.push(areaBuffer[i][j]));
            }
        }
        for (let coords of this.edges) {
            visitedTTypeWall = false;
            let stopCoordIfAllSeenBefore = [];

            // Draw a line from player's position to all edge positions, stop the line at sight blocking
            // obstacles. Mark all reached tiles for rendering. More complicated logic is for handling
            // t-walls. Initially they are hidden like everything, but when seeing them for the first time,
            // the player should "see" through them until encountering a tile other than t-wall in the line
            // (to reveal the whole object). After this, for the graying out to look good, the player should
            // only see past the first t-wall in the line if it encounters a position not seen before 
            // (Only possible if the whole line is t-walls).

            bresenham(player.pos[0], player.pos[1], coords[0], coords[1], (y,x) => {
                const levelTile = level[y][x];

                if (visitedTTypeWall && memorizedBuffer[y][x] !== "" && !stopCoordIfAllSeenBefore.length) {
                    stopCoordIfAllSeenBefore = [y, x];
                }
                if (levelTile === levelTiles.transparentBgWall) {
                    visitedTTypeWall = true;
                } else if (visitedTTypeWall) {
                    return "stop";
                }
                if (renderedBuffer[y][x]) {
                    return blocksSight(levelTile) ? "stop" : "ok";
                }
                if (stopCoordIfAllSeenBefore.length) {
                    if (memorizedBuffer[y][x]) return blocksSight(levelTile) ? "stop" : "ok";
                }
                const tileToRender = this.getTileToRender(levelTile);
                areaBuffer[y][x].textContent = tileToRender;
                areaBuffer[y][x].customProps.infoKeys.unshift(levelTile);
                !blocksSight(levelTile) && (areaBuffer[y][x].classList[0] = "shown");
                renderedBuffer[y][x] = true;
                return blocksSight(levelTile) ? "stop" : "ok";
            });
        }
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const levelTile = level[i][j];
                const posRendered = renderedBuffer[i][j];
                const posMemorized = memorizedBuffer[i][j];

                if (posRendered && (posMemorized === "" || posMemorized !== levelTile)) {
                    memorizedBuffer[i][j] = levelTile;
                } else if (!posRendered && options.SHOW_MEMORIZED && posMemorized !== "") {
                    const tileToRender = this.getTileToRender(posMemorized);
                    areaBuffer[i][j].textContent = tileToRender;

                    if (!blocksSight(posMemorized)) {
                        if (options.GRAY_MEMORIZED) {
                            areaBuffer[i][j].classList[0] = "mem";
                        } else {
                            areaBuffer[i][j].classList[0] = "shown";
                        }
                    }
                } else if (!posRendered && areaBuffer[i][j].textContent !== "") {
                    areaBuffer[i][j].textContent = "";
                }
            }
        }
        for (let item of items) {
            if (renderedBuffer[item.pos[0]][item.pos[1]] && !item.hidden) {
                const areaPos = areaBuffer[item.pos[0]][item.pos[1]];
                areaPos.textContent = item.symbol;
                options.OBJ_BG && (areaPos.classList[0] = "obj-bg");
                areaPos.customProps.infoKeys.unshift(item.name);
            }
        }
        if (!player.dead) {
            const playerPos = areaBuffer[player.pos[0]][player.pos[1]];

            if (options.OBJ_IMG) {
                // TODO: clean this, not used anymore with the smoother animation

                // const imageToUse = "url(\"./playerImages/player_" + player.image + ".png\")";

                // if (playerPos.textContent !== "") {
                //     playerPos.textContent = "";
                // }
                // if (playerPos.style.backgroundImage !== imageToUse) {
                //     playerPos.style.backgroundImage = imageToUse;
                // }
                // removeByReference(imgCoordsToDelete, playerPos);
            } else {
                playerPos.textContent = "@";
                
                if (options.OBJ_BG) {
                    playerPos.classList = ["player", "obj-bg"];
                } else {
                    playerPos.classList[0] = "player";
                }
            }
            playerPos.customProps.infoKeys.unshift("Player");
        }
        for (let mob of mobs) {
            if (renderedBuffer[mob.pos[0]][mob.pos[1]]) {
                const mobPos = areaBuffer[mob.pos[0]][mob.pos[1]];

                if (options.OBJ_IMG) {
                    const imageToUse = "url(\"./mobImages/mob_" + (mob.image || 2) + ".png\")";

                    if ( mobPos.textContent !== "") {
                        mobPos.textContent = "";
                    }
                    if (mobPos.style.backgroundImage !== imageToUse) {
                        mobPos.style.backgroundImage = imageToUse;
                    }
                    removeByReference(imgCoordsToDelete, mobPos);
                } else {
                    mobPos.textContent = mob.symbol;
                    options.OBJ_BG && (mobPos.classList[0] = "obj-bg");
                }
                mobPos.customProps.infoKeys.unshift(mob.name);
            }
        }
        for (let obj of customRenders) {
            if (renderedBuffer[obj.pos[0]][obj.pos[1]]) {
                areaBuffer[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
            }
        }
        for (const pos of imgCoordsToDelete) {
            pos.style.backgroundImage = "none";
        }
        // add walls last to check where to put them by what tiles are rendered
    
        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const levelTile = level[i][j];

                if (!isWall(levelTile) 
                    || (options.USE_BG_IMG 
                        && (levelTile === levelTiles.transparentBgWall || levelTile === levelTiles.seeThroughWall))
                ) {
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
                        && (renderedBuffer[p.i][p.j] || (options.SHOW_MEMORIZED && memorizedBuffer[p.i][p.j]))
                        && (!isWall(level[p.i][p.j]) 
                        || (blocksSight(levelTile) && !blocksSight(level[p.i][p.j])))
                    ) {
                        classes.push(p.side);
                    }
                }
                areaBuffer[i][j].classList.push(...classes);
            }
        }
        selectionPos && areaBuffer[selectionPos[0]][selectionPos[1]].classList.push("selected");

        // execute changes from buffer

        const resolve = await this.addToQueue();

        for (let i = 0; i < level.length; i++) {
            for (let j = 0; j < level[0].length; j++) {
                const areaPos = this.area[i][j];
                const overlayAreaPos = this.overlayArea[i][j];
                const checkPos = this.prevAreaBuffer[i][j];
                const buffer = areaBuffer[i][j];
                const newClassName = buffer.classList.reduce((old, val) => old + " " + val);
                if (checkPos.className !== newClassName) {
                    areaPos.className = newClassName;

                    // only apply if should hide or remove hiddenness of t-wall
                    if (level[i][j] === levelTiles.transparentBgWall
                        && (renderedBuffer[i][j] || !memorizedBuffer[i][j])
                    ) {
                        overlayAreaPos.className = newClassName;
                    }
                }
                if (!checkPos.customProps
                    || !checkPos.customProps.infoKeys
                    || !checkPos.customProps.infoKeys.every((item, i) => item === buffer.customProps.infoKeys[i])
                ) {
                    areaPos.customProps.infoKeys = buffer.customProps.infoKeys;
                }
                if (buffer.style.backgroundImage && checkPos.style.backgroundImage !== buffer.style.backgroundImage) {
                    areaPos.style.backgroundImage = buffer.style.backgroundImage;
                }
                if (checkPos.textContent !== buffer.textContent) areaPos.textContent = buffer.textContent;
                this.rendered[i][j] = renderedBuffer[i][j];
                memorized[i][j] = memorizedBuffer[i][j];
            }
        }
        this.prevAreaBuffer = areaBuffer;
        resolve();
    }

    async shotEffect(shotPos, player, levels, customRenders, skipIfExists) {
        if (skipIfExists) {
            for (const c of customRenders) {
                if (coordsEq(c.pos, shotPos) && c.symbol === "x"
                    || coordsEq(c.pos, [shotPos[0] - 1, shotPos[1] - 1]) && c.symbol === "\\"
                    || coordsEq(c.pos, [shotPos[0] - 1, shotPos[1] + 1]) && c.symbol === "/"
                    || coordsEq(c.pos, [shotPos[0] + 1, shotPos[1] + 1]) && c.symbol === "\\"
                    || coordsEq(c.pos, [shotPos[0] + 1, shotPos[1] - 1]) && c.symbol === "/"
                ) {
                    return;
                }
            }
        }
        const currLvl = levels.currentLvl;
        let obj, obj0, obj1, obj2, obj3;

        if (this.rendered[shotPos[0]][shotPos[1]]) {
            this.area[shotPos[0]][shotPos[1]].textContent = "x";
            this.prevAreaBuffer[shotPos[0]][shotPos[1]].textContent = "x";
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
            this.prevAreaBuffer[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
            obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
            customRenders.push(obj0);
        }
        if (this.area[shotPos[0] - 1] && this.area[shotPos[0] - 1][shotPos[1] + 1]
            && this.rendered[shotPos[0] - 1][shotPos[1] + 1]
        ) {
            this.area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
            this.prevAreaBuffer[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
            obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
            customRenders.push(obj1);
        }
        if (this.area[shotPos[0] + 1] && this.area[shotPos[0] + 1][shotPos[1] + 1]
            && this.rendered[shotPos[0] + 1][shotPos[1] + 1]
        ) {
            this.area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
            this.prevAreaBuffer[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
            obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
            customRenders.push(obj2);
        }
        if (this.area[shotPos[0] + 1] && this.area[shotPos[0] + 1][shotPos[1] - 1]
            && this.rendered[shotPos[0] + 1][shotPos[1] - 1]
        ) {
            this.area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
            this.prevAreaBuffer[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
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
