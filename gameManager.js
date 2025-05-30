import events from "./eventData.js";
import { levelTiles } from "./levelData.js";
import { createNewLvl } from "./levelGeneration.js";
import { mobDefaultImageBase } from "./mobData.js";
import { movingAIs, trySpawnMob } from "./mobs.js";
import options, { constants } from "./options.js";
import Renderer from "./render.js";
import UI from "./UI.js";
import {
    coordsEq, getPosInfo, initialize, isNextTo, movePosToDrc, 
    relativeCoordsToDrc, 
    projectileFromDrc, removeByReference, itemNameWithNumber, getClosestTravelPoint, dijkstra, 
    getMobTransition
} from "./util.js";

// NOTE: all references within "levels", "player", or "timeTracker" to other objects included
//       in each other must be done with "refer()" for saving to work properly

const playerVisual = document.getElementById("playerImg");
const tableHolder = document.getElementById("tableHolder");
const info = document.getElementById("info");
const Pauser = (function() {
    let pausePromise = Promise.resolve();
    let resolver;

    return class Pauser {
        pause() {
            pausePromise = pausePromise.then(() => {
                return new Promise(resolve => {
                    resolver = resolve;
                });
            });
        }

        unpause() {
            resolver();
        }

        waitForUnpause() {
            return pausePromise;
        }
    }
})();

export default class GameManager {
    constructor(removeListeners, addListeners, keyIntervals) {
        const initialized = initialize();
        this.keyIntervals = keyIntervals;
        this.removeListeners = removeListeners;
        this.addListeners = addListeners;
        this.area = initialized.area;
        this.rendered = initialized.rendered;
        this.levels = initialized.levels;
        this.pauser = new Pauser();
        this.render = new Renderer(this.area, this.rendered);
        // use a new pause function to preserve "this" properly
        this.ui = new UI(removeListeners, addListeners, this.pauser, val => this.setPause(val));
        this.level = this.levels[this.levels.currentLvl].level;
        this.mobs = this.levels[this.levels.currentLvl].mobs;
        this.items = this.levels[this.levels.currentLvl].items;
        this.turnInterval = null;
        this.timeTracker = {};
        this.timeTracker.timer = 0;
        this.timeTracker.turnsUntilShoot = 0;
        this.player = {};
        this.player.maxHealth = 5;
        this.player.health = this.player.maxHealth;
        this.player.inventory = [];
        this.player.noteEntries = [];
        this.player.pos = [9, 5];
        this.player.visualPos = this.player.pos.slice();
        this.player.visualPos[0] *= constants.CELL_SIZE;
        this.player.visualPos[1] *= constants.CELL_SIZE;
        this.player.imageBase = { start: "url(\"./playerImages/player_", end: ".png\")" };
        this.player.image = 2;
        this.player.moveCounter = 0;
        this.customRenders = []; // retain "animations", can also be damaging zones
        this.interruptAutoTravel = false;
        this.referenced = []; // for retaining object references when saving
        this.autoTravelStack = []; // used to cancel previous autoTravels when there is a new one
        this.actType = "shoot";
        this.inputType = null;
        this.mobsUsingVisualTimeout = []; // store mobs whose img should be updated after moving

        for (let obj = this; obj; obj = Object.getPrototypeOf(obj)){
            for (let name of Object.getOwnPropertyNames(obj)){
                if (typeof this[name] === 'function'){
                    this[name] = this[name].bind(this);
                }
            }
        }
    }

    tryFireEvent(type, entity) {
        if (typeof entity === "undefined" && events[type]) {
            events[type](this);
        } else if (typeof entity === "string" && events[type] && events[type][entity]) {
            events[type][entity](this);
        } else if (events[type] && events[type][entity.name]) {
            events[type][entity.name](entity, this);
        }
    }

    posIsValid(pos, disallowFakeWalls) {
        if (pos?.length !== 2) return false;
        for (let mob of this.mobs) {
            if (coordsEq(mob.pos, pos)) return false;
        }
        for (let item of this.items) {
            if (coordsEq(item.pos, pos) && item.blocksTravel) return false;
        }
        if (coordsEq(this.player.pos, pos) 
            || pos[0] > this.level.length - 1 
            || pos[1] > this.level[0].length - 1 
            || pos[0] < 0 
            || pos[1] < 0
            || this.level[pos[0]][pos[1]] === levelTiles.wall
            || this.level[pos[0]][pos[1]] === levelTiles.seeThroughWall
            || this.level[pos[0]][pos[1]] === levelTiles.transparentBgWall
            || (disallowFakeWalls && this.level[pos[0]][pos[1]] === levelTiles.fakeWall)
        ) {
            return false;
        }
        return true;
    }

    gameOver(msg) {
        this.ui.hideDialog(); // in case player was in a dialog
        this.ui.showMsg(msg);
        !options.TURN_BASED && clearInterval(this.turnInterval);
        this.pauser.pause();
        this.interruptAutoTravel = true;
        this.setPause.paused = true;
        this.removeListeners();
        this.player.dead = true;
        this.render.renderAll(this.player, this.levels, this.customRenders);
        this.render.shotEffect(this.player.pos, this.player, this.levels, this.customRenders);
    
        for (let key of Object.keys(this.keyIntervals)) {
            clearInterval(this.keyIntervals[key]);
            delete this.keyIntervals[key];
        }
        playerVisual.style.backgroundImage = "none";
    }

    updateInfo() {
        const timeWord = options.TURN_BASED ? "\nTurn: " : "\nTime: ";
        info.textContent = "Level: " + this.levels.currentLvl + timeWord + this.timeTracker.timer 
                           + "\nHealth: " + this.player.health + " / " + this.player.maxHealth
                           + "\nSelected action: " + this.actType + "\n";
    
        if (this.timeTracker.turnsUntilShoot > 0 && this.actType === "shoot") {
            info.textContent += "Cooldown: " + this.timeTracker.turnsUntilShoot;
        }
    }

    processTurn() {
        this.timeTracker.timer++;
        if (this.timeTracker.turnsUntilShoot > 0) this.timeTracker.turnsUntilShoot--;
        this.updateInfo();
        clearTimeout(this.mobVisualTimeout);
        this.mobVisualTimeout = setTimeout(() => {
            for (let i = this.mobsUsingVisualTimeout.length - 1; i >= 0; i--) {
                const mob = this.mobsUsingVisualTimeout[i];

                if (mob.image && mob.image.length > 1) {
                    if (mob.image.length < 8) {
                        mob.image = mob.image.slice(0, -5); // change from "_move" to normal
                    } else {
                        mob.image = mob.image.slice(0, -7); // change from "_2_move" to normal
                    }
                }
                if (mob.divElement) {
                    const imageBase = mob.imageBase || mobDefaultImageBase;
                    mob.divElement.style.backgroundImage = imageBase.start + (mob.image || 2) + imageBase.end;
                }
                this.mobsUsingVisualTimeout.splice(i, 1);
            }
            this.render.updateMobVisibilities(this.mobs);
        }, 0.7 * options.TURN_DELAY);
    
        for (let mob of this.mobs) {
            if (!options.TURN_BASED && this.timeTracker.timer % mob.speedModulus < 1) {
                continue;
            }
            if (mob.isHostile && isNextTo(this.player.pos, mob.pos)) {
                this.render.shotEffect(this.player.pos, this.player, this.levels, this.customRenders, true);
                this.changePlayerHealth(-3);
                continue;
            }
            if (mob.stayStillForInteract && isNextTo(this.player.pos, mob.pos)) {
                continue;
            }
            movingAIs[mob.movingFunction](mob, this.posIsValid, this.level, this.rendered);
    
            if (mob.isShooter && mob.straightLineToTargetDrc) {
                this.shoot(mob.pos, mob.straightLineToTargetDrc, true);
            } else {
                // also works if new pos not next to current for some reason
                const facing = relativeCoordsToDrc(mob.target[0] - mob.pos[0], mob.target[1] - mob.pos[1]);
                const moveImage = facing + "_move";
                const baseImage = facing;
                const altMoveImage = facing + "_2_move";
        
                if (mob.image === moveImage || mob.image === altMoveImage) {
                    mob.image = baseImage;
                } else if (mob.prevMoveImage === altMoveImage) {
                    mob.image = moveImage;
                    mob.prevMoveImage = moveImage;
                } else {
                    mob.image = altMoveImage;
                    mob.prevMoveImage = altMoveImage;
                }
                const pixelsY = constants.CELL_SIZE * (mob.target[0] - mob.pos[0]);
                const pixelsX = constants.CELL_SIZE * (mob.target[1] - mob.pos[1]);
                const imageBase = mob.imageBase || mobDefaultImageBase;
                mob.pos = [mob.target[0], mob.target[1]];
                mob.divElement.style.zIndex = mob.pos[0] + 1;
                mob.divElement.style.backgroundImage = imageBase.start + (mob.image || 2) + imageBase.end;
                const left = Number(mob.divElement.style.left.slice(0, -2));
                const top = Number(mob.divElement.style.top.slice(0, -2));
                mob.divElement.style.top = (top + pixelsY) + "px";
                mob.divElement.style.left = (left + pixelsX) + "px";
                this.mobsUsingVisualTimeout.push(mob);
    
                for (let obj of this.customRenders) {
                    if (coordsEq(mob.pos, obj.pos) && obj.damageMobs) {
                        this.mobDie(mob);
    
                        if (obj.disappearOnHit) {
                            this.hitCustomRenderEffect(obj);
                        }
                        break; // NOTE: if mob health implemented, remove this
                    }
                }
            }
        }
        this.render.renderAll(this.player, this.levels, this.customRenders);
    
        if (options.INTERRUPT_AUTOTRAVEL_IF_MOBS) {
            for (let mob of this.mobs) {
                if (mob.isHostile && this.rendered[mob.pos[0]][mob.pos[1]]) {
                    this.interruptAutoTravel = true;
                    break;
                }
            }
        }
        let mob = trySpawnMob(this.levels, this.rendered);
    
        if (mob !== null) {
            mob.huntingTarget = this.refer(this.player);
            this.mobs.push(mob);
            this.createMobDiv(mob);
        }
        if (this.setPause.pauseNext && !this.setPause.paused) {
            this.pauser.pause();
            this.interruptAutoTravel = true;
            this.setPause.paused = true;
            this.setPause.pauseNext = false;
            clearInterval(this.turnInterval);
        }
    }
    
    // NOTE: doesn't remove key listeners! (though always done when showing dialog)
    setPause(val) {
        if (options.TURN_BASED) return;
        if (val && !this.setPause.paused) {
            this.setPause.pauseNext = true; // pause at the end of next processTurn. done this way to prevent abuse
        } else if (!val && !this.setPause.paused) {
            this.setPause.pauseNext = false;
        } else if (!val && this.setPause.paused) {
            this.turnInterval = setInterval(() => this.processTurn(), options.TURN_DELAY);
            this.setPause.paused = false;
            this.pauser.unpause();
        }
    }
    
    updateAfterAction() {
        if (options.TURN_BASED) {
            this.processTurn();
        } else {
            this.render.renderAll(this.player, this.levels, this.customRenders);
        }
    }
    
    mobDie(mob) {
        this.tryFireEvent("onDeath", mob);
        tableHolder.removeChild(mob.divElement);
        // NOTE: no clue what the rationale for this was, seems bad so commented out for now
        // delete all properties of mob, so all references to it recognize deletion
        // for (let prop in mob) if (mob.hasOwnProperty(prop)) delete mob[prop];
        removeByReference(this.mobs, mob);
    }
    
    changePlayerHealth(amount) {
        let newHealth = this.player.health + amount;
        if (newHealth < 1) {
            this.gameOver("You take a fatal hit. You die...");
            return;
        }
        if (newHealth > this.player.maxHealth) {
            newHealth = this.player.maxHealth;
        }
        if (amount < 0) {
            this.ui.showMsg("You are hit!");
        } else if (amount > 0) {
            if (this.player.health !== this.player.maxHealth) {
                this.ui.showMsg("You feel better.");
            }
        }
        this.player.health = newHealth;
    }

    refer(obj) {
        if (this.referenced.indexOf(obj) === -1) this.referenced.push(obj);
        return obj;
    }

    hitCustomRenderEffect(obj) {
        obj.deleted = true;
        removeByReference(this.customRenders, obj);
        this.render.renderAll(this.player, this.levels, this.customRenders);
        this.render.shotEffect(obj.pos, this.player, this.levels, this.customRenders);
    }
    
    async shoot(fromPos, drc, mobIsShooting) {
        const currLvl = this.levels.currentLvl;
        const icon = projectileFromDrc[drc];
        let bulletPos = fromPos.slice();
        let obj = {
            symbol: icon,
            pos: bulletPos.slice(),
            damagePlayer: mobIsShooting,
            damageMobs: true,
            disappearOnHit: true
        };
        this.customRenders.push(obj);
        options.TURN_BASED && (this.interruptAutoTravel = true);
        options.TURN_BASED && this.removeListeners();
        !mobIsShooting && (this.timeTracker.turnsUntilShoot = 1);
    
        const checkHits = (checkPos) => {
            if (coordsEq(checkPos, this.player.pos) && mobIsShooting) {
                this.changePlayerHealth(-1);
                this.hitCustomRenderEffect(obj);
                return true;
            }
            for (let mob of this.mobs) {
                if (coordsEq(checkPos, mob.pos)) {
                    this.mobDie(mob);
                    this.hitCustomRenderEffect(obj);
                    if (options.TURN_BASED) {
                        !this.player.dead && this.addListeners();
                        !mobIsShooting && this.processTurn();
                    } else {
                        this.render.renderAll(this.player, this.levels, this.customRenders);
                    }
                    return true;
                }
            }
            for (const obj2 of this.customRenders) {
                if (obj2.blockShots && coordsEq(checkPos, obj2.pos)) {
                    this.hitCustomRenderEffect(obj);
                    // NOTE: no turn based handling as currently only used in realtime version
                    return true;
                }
            }
            return false;
        };
        
        while (1) {
            this.render.renderSymbolAtPos(obj.symbol, obj.pos, this.player, this.levels);
            this.render.renderAll(this.player, this.levels, this.customRenders);
            movePosToDrc(bulletPos, drc);
    
            if (!this.level[bulletPos[0]] || typeof this.level[bulletPos[0]][bulletPos[1]] === "undefined" 
                || this.level[bulletPos[0]][bulletPos[1]] === levelTiles.wall
                || this.level[bulletPos[0]][bulletPos[1]] === levelTiles.transparentBgWall
            ) {
                removeByReference(this.customRenders, obj);

                if (!options.TURN_BASED) {
                    await new Promise(r => setTimeout(r, 30));
                    this.render.renderAll(this.player, this.levels, this.customRenders);
                } else {
                    !this.player.dead && this.addListeners();
                    !mobIsShooting && this.processTurn();
                }       
                return;
            }
            if (this.rendered[bulletPos[0]][bulletPos[1]]) {
                this.area[bulletPos[0]][bulletPos[1]].textContent = icon;
                this.render.prevAreaBuffer[bulletPos[0]][bulletPos[1]].textContent = icon;
            }
            obj.pos = bulletPos.slice();
            if (checkHits(bulletPos)) break;
            await new Promise(r => setTimeout(r, 30));
            await this.pauser.waitForUnpause();
            if (this.levels.currentLvl !== currLvl) break;
            // NOTE: obj can hit something either by it moving into player/mob, or them moving into it.
            // if something moves into it, they handle the extra effects themselves.
            if (obj.deleted) break;
        }
        removeByReference(this.customRenders, obj);
    }

    melee(drc) {
        if (options.TURN_BASED) {
            this.meleeTurnBased(drc);
        } else {
            this.meleeRealTime(drc);
        }
    }
    
    meleeTurnBased(drc) {
        let meleePos = this.player.pos.slice();
        movePosToDrc(meleePos, drc);
        this.processTurn(); // takes an extra turn
        if (this.player.dead) return;
    
        for (let mob of this.mobs) {
            if (coordsEq(meleePos, mob.pos)) {
                this.ui.showMsg("You hit " + mob.name + "!");
                this.render.shotEffect(mob.pos, this.player, this.levels, this.customRenders);
                this.mobDie(mob);
                break;
            }
        }
        this.processTurn();
    }
    
    async meleeRealTime(drc) {
        await new Promise(r => setTimeout(r, options.TURN_DELAY));
        if (this.player.dead) return;
        let meleePos = this.player.pos.slice();
        movePosToDrc(meleePos, drc);
        const obj = {
            symbol: projectileFromDrc[drc],
            pos: meleePos,
            damageMobs: true,
            disappearOnHit: true,
            blockShots: true
        };
        this.customRenders.push(obj);
        this.render.renderSymbolAtPos(obj.symbol, obj.pos, this.player, this.levels);
        this.render.renderAll(this.player, this.levels, this.customRenders);
    
        for (let mob of this.mobs) {
            if (coordsEq(meleePos, mob.pos)) {
                this.ui.showMsg("You hit " + mob.name + "!");
                this.mobDie(mob);
                this.hitCustomRenderEffect(obj);
            }
        }
        await new Promise(r => setTimeout(r, 300));
        removeByReference(this.customRenders, obj);
        this.render.renderAll(this.player, this.levels, this.customRenders);
    }
    
    interact(drc) {
        let interactPos = this.player.pos.slice();
        movePosToDrc(interactPos, drc);
    
        for (let mob of this.mobs) {
            if (coordsEq(interactPos, mob.pos)) this.tryFireEvent("onInteract", mob);
        }
        for (let item of this.items) {
            if (coordsEq(interactPos, item.pos)) this.tryFireEvent("onInteract", item);
        }
        this.updateAfterAction();
    }

    // NOTE: no smooth animation if using text symbol for player

    async centerPlayer(startPos, newPos, noTransition, isFirst) {
        let newTransition = "";

        if (noTransition || !options.OBJ_IMG) {
            newTransition = "none";
        } else {
            if (this.autoTravelStack.indexOf(true) !== -1) {
                newTransition = "all " + options.AUTOTRAVEL_REPEAT_DELAY + "ms linear";
            } else if (isFirst) {
                newTransition = "all " + options.TRAVEL_REPEAT_START_DELAY + "ms linear";
            } else {
                newTransition = "all " + options.TRAVEL_REPEAT_DELAY + "ms linear";
            }
        }
        if (this.prevTransition !== newTransition) {
            tableHolder.style.transition = newTransition;
            this.prevTransition = newTransition;
        }
        const left = Number(tableHolder.style.left.slice(0, -2));
        const top = Number(tableHolder.style.top.slice(0, -2));
        const pixelsY = constants.CELL_SIZE * (newPos[0] - startPos[0]);
        const pixelsX = constants.CELL_SIZE * (newPos[1] - startPos[1]);
        tableHolder.style.top = (top - pixelsY) + "px";
        tableHolder.style.left = (left - pixelsX) + "px";
        playerVisual.style.transition = newTransition;
    }

    async centerPlayerPixels(startPos, newPos, noTransition, isFirst) {
        let newTransition = "";

        if (noTransition || !options.OBJ_IMG) {
            newTransition = "none";
        } else {
            if (this.autoTravelStack.indexOf(true) !== -1) {
                newTransition = "all " + options.AUTOTRAVEL_REPEAT_DELAY + "ms linear";
            } else if (isFirst) {
                newTransition = "all " + options.TRAVEL_REPEAT_START_DELAY + "ms linear";
            } else {
                newTransition = "all " + options.TRAVEL_REPEAT_DELAY + "ms linear";
            }
        }
        if (this.prevTransition !== newTransition) {
            tableHolder.style.transition = newTransition;
            this.prevTransition = newTransition;
        }
        const left = Number(tableHolder.style.left.slice(0, -2));
        const top = Number(tableHolder.style.top.slice(0, -2));
        const pixelsY = newPos[0] - startPos[0];
        const pixelsX = newPos[1] - startPos[1];
        tableHolder.style.top = (top - pixelsY) + "px";
        tableHolder.style.left = (left - pixelsX) + "px";
        playerVisual.style.transition = newTransition;
    }

    async centerPlayerInitial() {
        const newTransition = "none";
        if (this.prevTransition !== newTransition) {
            tableHolder.style.transition = newTransition;
            this.prevTransition = newTransition;
        }
        let pixelsY = 0;
        let pixelsX = 0;
        const screenX = window.innerWidth / 2;
        const screenY = window.innerHeight / 2;
        for (let i = 0; i < this.level.length; i++) {
            for (let j = 0; j < this.level[0].length; j++) {
                const td = this.area[i][j];
                if (coordsEq([i, j], this.player.pos)) {
                    tableHolder.style.top = "0px";
                    tableHolder.style.left = "0px";
                    const rect = td.getBoundingClientRect();
                    pixelsY = rect.top - constants.CELL_SIZE;
                    pixelsX = rect.left - 12; // offset for "perspective"
                    break;
                }
            }
        }
        tableHolder.style.top = (screenY - pixelsY) + "px";
        tableHolder.style.left = (screenX - pixelsX) + "px";
        playerVisual.style.transition = newTransition;
        playerVisual.style.top = screenY + "px";
        playerVisual.style.left = screenX + "px";
    }

    movePlayerVisual(startPos, newPos, noTransition, isFirst) {
        if (!options.OBJ_IMG) return; // handled in render instead

        let newTransition = "";

        if (noTransition) {
            newTransition = "none";
        } else {
            if (this.autoTravelStack.indexOf(true) !== -1) {
                newTransition = "all " + options.AUTOTRAVEL_REPEAT_DELAY + "ms linear";
            } else if (isFirst) {
                newTransition = "all " + options.TRAVEL_REPEAT_START_DELAY + "ms linear";
            } else {
                newTransition = "all " + options.TRAVEL_REPEAT_DELAY + "ms linear";
            }
        }
        if (this.prevTransition !== newTransition) {
            playerVisual.style.transition = newTransition;
            this.prevTransition = newTransition;
        }
        const left = Number(playerVisual.style.left.slice(0, -2));
        const top = Number(playerVisual.style.top.slice(0, -2));
        const pixelsY = constants.CELL_SIZE * (newPos[0] - startPos[0]);
        const pixelsX = constants.CELL_SIZE * (newPos[1] - startPos[1]);
        playerVisual.style.top = (top + pixelsY) + "px";
        playerVisual.style.left = (left + pixelsX) + "px";
    }

    movePlayerVisualInitial() {
        if (!options.OBJ_IMG) return; // handled in render instead

        let newTransition = "none";
        if (this.prevTransition !== newTransition) {
            playerVisual.style.transition = newTransition;
            this.prevTransition = newTransition;
        }
        let pixelsY = 0;
        let pixelsX = 0;
        for (let i = 0; i < this.level.length; i++) {
            for (let j = 0; j < this.level[0].length; j++) {
                const td = this.area[i][j];
                if (coordsEq([i, j], this.player.pos)) {
                    const rect = td.getBoundingClientRect();
                    pixelsY = rect.top - constants.CELL_SIZE;
                    pixelsX = rect.left - 12; // offset for "perspective"
                    break;
                }
            }
        }
        playerVisual.style.top = pixelsY + "px";
        playerVisual.style.left = pixelsX + "px";
    }

    resetMoveVisual() {
        if (this.player.image.length > 1) {
            if (this.player.image.length < 8) {
                this.player.image = this.player.image.slice(0, -5); // change from "_move" to normal
            } else {
                this.player.image = this.player.image.slice(0, -7); // change from "_2_move" to normal
            }
        }
        if (options.OBJ_IMG && !this.player.dead) {
            playerVisual.style.backgroundImage =
                this.player.imageBase.start + this.player.image + this.player.imageBase.end;
        }
        this.player.prevMoveDrc = null;
    }

    createMobDiv(mob) {
        const mobDiv = document.createElement("div");
        const pixelsY = constants.CELL_SIZE * (mob.pos[0] - 1);
        const pixelsX = constants.CELL_SIZE * (mob.pos[1] - 0.5);
        const imageBase = mob.imageBase || mobDefaultImageBase;
        mobDiv.style.width = "50px";
        mobDiv.style.height = "50px";
        mobDiv.style.position = "absolute";
        mobDiv.style.backgroundImage = imageBase.start + (mob.image || 2) + imageBase.end;
        mobDiv.style.backgroundSize = "50px 50px";
        mobDiv.style.transition = getMobTransition(options, mob);
        mobDiv.style.zIndex = mob.pos[0] + 1;
        mobDiv.style.top = pixelsY + "px";
        mobDiv.style.left = pixelsX + "px";
        tableHolder.appendChild(mobDiv);
        mob.divElement = mobDiv;
    }

    moveCounterTimer() {
        this.player.moveCounter = 1;
    }

    getChangedPosition(visualPos) {
        const pos = visualPos.slice();
        pos[0] /= constants.CELL_SIZE;
        pos[0] += 0.8;
        pos[0] = Math.floor(pos[0]);
        pos[1] /= constants.CELL_SIZE;
        pos[1] += 0.5;
        pos[1] = Math.floor(pos[1]);
        return pos;
    }

    moveVisual(drc, altDrcs) {
        const newVisualPos = this.player.visualPos.slice();
        movePosToDrc(newVisualPos, drc, options.TRAVEL_MOVE_PIXELS);
        let newPos = this.getChangedPosition(newVisualPos);
        const originalNewPos = newPos.slice();
        // only move actual position diagonally if moving visually diagonally, prefents visual flicker
        if (!coordsEq(newPos, this.player.pos) && [1, 3, 7, 9].includes(this.player.prevMoveDrc)) {
            const preferredPos = this.player.pos.slice();
            movePosToDrc(preferredPos, this.player.prevMoveDrc);
            const prefPosToVisual = [preferredPos[0] * constants.CELL_SIZE, preferredPos[1] * constants.CELL_SIZE];
            const playerPosToVisual = [this.player.pos[0] * constants.CELL_SIZE, this.player.pos[1] * constants.CELL_SIZE];
            const distanceToPref = (this.player.visualPos[0] - prefPosToVisual[0])*(this.player.visualPos[0] - prefPosToVisual[0]) + 
                                        (this.player.visualPos[1] - prefPosToVisual[1])*(this.player.visualPos[1] - prefPosToVisual[1]);
            const distanceToCurrent = (this.player.visualPos[0] - playerPosToVisual[0])*(this.player.visualPos[0] - playerPosToVisual[0]) + 
                                        (this.player.visualPos[1] - playerPosToVisual[1])*(this.player.visualPos[1] - playerPosToVisual[1]);
            if (distanceToPref < distanceToCurrent) {
                if (this.posIsValid(preferredPos)) {
                    newPos = preferredPos
                }
            } else {
                newPos = this.player.pos;
            }
        }
        // need to check against the original new pos, else could get stuck in walls
        if (!this.posIsValid(originalNewPos) && !coordsEq(originalNewPos, this.player.pos)) {
            if (!altDrcs || !altDrcs.length) {
                return this.player.pos.slice();
            } else {
                const firstAlternativeDrc = altDrcs.shift();
                return this.moveVisual(firstAlternativeDrc, altDrcs);
            }
        }
        this.centerPlayerPixels(this.player.visualPos, newVisualPos, false, false);
        playerVisual.style.zIndex = newPos[0] + 1;
        clearTimeout(this.player.moveVisualResetTimeout);
        this.player.moveVisualResetTimeout = setTimeout(this.resetMoveVisual, constants.MOVE_VISUAL_DELAY * 2);
        // also works if new pos not next to current for some reason
        const facing = relativeCoordsToDrc(
            newVisualPos[0] - this.player.visualPos[0],
            newVisualPos[1] - this.player.visualPos[1],
        );
        const moveImage = facing + "_move";
        const baseImage = facing;
        const altMoveImage = facing + "_2_move";

        if (this.player.prevMoveDrc !== facing || this.player.moveCounter > 0) {
            if (this.player.image === moveImage || this.player.image === altMoveImage) {
                this.player.image = baseImage;
            } else if (this.player.prevMoveImage === altMoveImage) {
                this.player.image = moveImage;
                this.player.prevMoveImage = moveImage;
            } else {
                this.player.image = altMoveImage;
                this.player.prevMoveImage = altMoveImage;
            }
            this.player.moveCounter = 0;
            clearTimeout(this.player.moveVisualTimeout);
            this.player.moveVisualTimeout = setTimeout(this.moveCounterTimer, constants.MOVE_VISUAL_DELAY);
        }
        if (options.OBJ_IMG) {
            playerVisual.style.backgroundImage =
                this.player.imageBase.start + this.player.image + this.player.imageBase.end;
        }
        this.player.prevMoveDrc = facing;
        this.player.visualPos = newVisualPos;

        return newPos;
    }
    
    movePlayer(newPos, alternatives, isFirst) {
        if (!this.posIsValid(newPos)) {
            if (!alternatives || !alternatives.length) {
                return;
            } else {
                const firstAlternativePos = alternatives.shift();
                this.movePlayer(firstAlternativePos, alternatives);
                return;
            }
        }
        if (!options.KEEP_PLAYER_CENTERED) {
            playerVisual.style.zIndex = newPos[0] + 1;
            clearTimeout(this.player.moveVisualResetTimeout);
            this.player.moveVisualResetTimeout = setTimeout(this.resetMoveVisual, options.TRAVEL_REPEAT_DELAY * 3);
            // also works if new pos not next to current for some reason
            const facing = relativeCoordsToDrc(newPos[0] - this.player.pos[0], newPos[1] - this.player.pos[1]);
            const moveImage = facing + "_move";
            const baseImage = facing;
            const altMoveImage = facing + "_2_move";

            if (this.player.prevMoveDrc !== facing || this.player.moveCounter > 0) {
                if (this.player.image === moveImage || this.player.image === altMoveImage) {
                    this.player.image = baseImage;
                } else if (this.player.prevMoveImage === altMoveImage) {
                    this.player.image = moveImage;
                    this.player.prevMoveImage = moveImage;
                } else {
                    this.player.image = altMoveImage;
                    this.player.prevMoveImage = altMoveImage;
                }
                this.player.moveCounter = 0;
                clearTimeout(this.player.moveVisualTimeout);
                this.player.moveVisualTimeout = setTimeout(this.moveCounterTimer, MOVE_VISUAL_constants.MOVE_VISUAL_DELAYDELAY);
            }
            this.movePlayerVisual(this.player.pos, newPos, false, isFirst);

            if (options.OBJ_IMG) {
                playerVisual.style.backgroundImage =
                    this.player.imageBase.start + this.player.image + this.player.imageBase.end;
            }
            this.player.prevMoveDrc = facing;
        }
        this.player.pos = newPos;
        this.tryFireEvent("onMove");
    
        if (this.level[this.player.pos[0]][this.player.pos[1]] === levelTiles.doorWay) {
            this.tryChangeLvl();
        }
        for (let obj of this.customRenders) {
            if (coordsEq(this.player.pos, obj.pos) && obj.damagePlayer) {
                this.changePlayerHealth(-1);
    
                if (obj.disappearOnHit) {
                    this.hitCustomRenderEffect(obj);
                }
            }
        }
        for (let i = 0; i < this.items.length; i++) {
            if (coordsEq(this.player.pos, this.items[i].pos)) {
                let msg = "";
                let severalItems = false;
    
                // NOTE: currently hidden items won't be found if there are other items "on top"
    
                if (this.items[i].hidden) {
                    msg += "You find an item! ";
                    this.items[i].hidden = false;
                }
                for (let j = 0; j < this.items.length; j++) {
                    if (coordsEq(this.items[i].pos, this.items[j].pos) 
                        && i !== j && !this.items[j].hidden
                    ) {
                        severalItems = true;
                        break;
                    }
                }
                if (severalItems) {
                    msg += "There are several items here.";
                } else {
                    msg += "There's \"" + itemNameWithNumber(this.items[i]) + "\" here.";
                }
                this.ui.showMsg(msg);
                return;
            }
        }
    }
    
    async autoTravel(coords) {
        if (coordsEq(coords, this.player.pos)) return;
        const coordsList = dijkstra(this.player.pos, coords, this.level, this.posIsValid);
        coordsList.shift(); // first element is player pos
        const lvl = this.levels.currentLvl;
        const idx = this.autoTravelStack.length;
        this.autoTravelStack.push(true);
    
        for (let i = 0; i < idx; i++) {
            this.autoTravelStack[i] = false; // stop previous autoTravels
        }
        this.interruptAutoTravel = false;
        this.inputType = "autoMove";

        for (let coord of coordsList) {
            // new coord may not be next to player if e.g. a mob blocks the way
            if (!this.autoTravelStack[idx] || this.interruptAutoTravel || this.levels.currentLvl !== lvl || !isNextTo(this.player.pos, coord)) {
                this.inputType = null;
                this.autoTravelStack[idx] = false;
                return;
            }
            this.movePlayer(coord);
            this.updateAfterAction();
            await new Promise(r => setTimeout(r, options.AUTOTRAVEL_REPEAT_DELAY));
        }
        this.inputType = null;
        this.autoTravelStack = [];
    }

    addToInventory(item) {
        let playerHasItem = false;
        let oldItem = null;

        for (const invItem of this.player.inventory) {
            if (invItem.name === item.name) {
                playerHasItem = true;
                oldItem = invItem;
                break;
            }
        }
        if (playerHasItem) {
            oldItem.number = (oldItem.number || 1) + (item.number || 1);
        } else {
            this.player.inventory.push(item);
        }
    }
    
    pickup(alwaysDialog) {
        for (let i = 0; i < this.items.length; i++) {
            if (coordsEq(this.player.pos, this.items[i].pos)) {
                let itemsHere = [];
                let itemNames = [];
                let itemIdxs = [];
    
                for (let j = 0; j < this.items.length; j++) {
                    if (coordsEq(this.items[i].pos, this.items[j].pos) && !this.items[j].hidden) {
                        itemsHere.push(this.items[j]); // i is also included here
                        itemNames.push(itemNameWithNumber(this.items[j]));
                        itemIdxs.push(j);
                    }
                }
                if (itemsHere.length > 1 || alwaysDialog) {
                    this.setPause(true);
                    this.ui.showDialog("What do you want to pick up?", itemNames, idx => {
                        // only unpause if closing the dialog or picking up the last item,
                        // otherwise one update cycle would trigger before opening the dialog again
                        if (idx < 0 || itemsHere.length < 2) this.setPause(false);
                        if (idx < 0) return;
                        const removed = this.items.splice(itemIdxs[idx], 1)[0];
                        this.addToInventory(removed);
                        this.ui.showMsg("You pick up \"" + itemNameWithNumber(removed) + "\".");
                        this.pickup(true); // allow picking up several items from the "same" dialog
                    }, true, true);
                } else {
                    const removed = this.items.splice(i, 1)[0];
                    this.addToInventory(removed);
                    this.ui.showMsg("You pick up \"" + itemNameWithNumber(removed) + "\".");
                }
                break;
            }
        }
    }

    tryGenerateTravelPoints(lvl) {
        if (this.levels[lvl].tempTravelPoints) {
            // if there are placeholder travelpoints, change them into actual travelpoints that
            // point to new levels to be generated
            for (const tpsToGenerate of this.levels[lvl].tempTravelPoints) {
                this.levels[lvl].travelPoints[this.levels.generatedIdx + 1] = [tpsToGenerate];
                this.levels.generatedIdx++;
            }
            delete this.levels[lvl].tempTravelPoints;
        }
    }
    
    tryChangeLvl() {
        const tps = this.levels[this.levels.currentLvl].travelPoints;
    
        for (const lvl of Object.keys(tps)) {
            let idx = 0; // for tracking which point in lvl to travel to if several
    
            for (const coords of tps[lvl]) {
                if (coordsEq(coords, this.player.pos)) {
                    if (typeof this.levels[lvl] === "undefined") {
                        createNewLvl(lvl, this.levels, this.level, this.player);
                    }
                    if (typeof this.levels[lvl].travelPoints[this.levels.currentLvl] === "undefined") {
                        // if no travelpoint to connect to this level, choose most appropriate placeholder
                        this.levels[lvl].travelPoints[this.levels.currentLvl] = [
                            getClosestTravelPoint(this.levels[lvl].tempTravelPoints, this.player.pos, this.level)
                        ];
                    }
                    this.tryGenerateTravelPoints(lvl);
                    this.level = this.levels[lvl].level;
                    const newPos = this.levels[lvl].travelPoints[this.levels.currentLvl][idx].slice();
                    const newVisualPos = newPos.slice();
                    newVisualPos[0] *= constants.CELL_SIZE;
                    newVisualPos[1] *= constants.CELL_SIZE;

                    if (options.KEEP_PLAYER_CENTERED) {
                        this.centerPlayerPixels(this.player.visualPos, newVisualPos, true);
                    } else {
                        this.movePlayerVisual(this.player.pos, newPos, true);
                    }
                    this.player.pos = newPos;
                    this.player.visualPos = newVisualPos;
                    for (const mob of this.mobs) { tableHolder.removeChild(mob.divElement); }
                    this.mobs = this.levels[lvl].mobs;
                    for (const mob of this.mobs) { this.createMobDiv(mob); }
                    this.items = this.levels[lvl].items;
                    this.levels.currentLvl = lvl;
                    this.customRenders = [];
                    this.render.setBg(this.levels);
                    this.tryFireEvent("onEnterLevel");
                    return;
                }
                idx++;
            }
        }
    }
    
    selectPos(drc) {
        let prevPos = this.selectPos.currentPos.slice();
    
        switch (drc) {
            case 4:
            case 6:
            case 8:
            case 2:
            case 7:
            case 1:
            case 9:
            case 3:
                movePosToDrc(this.selectPos.currentPos, drc);
    
                if (!this.level[this.selectPos.currentPos[0]] 
                    || typeof this.level[this.selectPos.currentPos[0]][this.selectPos.currentPos[1]] === "undefined"
                ) {
                    this.selectPos.currentPos = prevPos;
                }
                this.area[prevPos[0]][prevPos[1]].classList.remove("selected");
                this.area[this.selectPos.currentPos[0]][this.selectPos.currentPos[1]].classList.add("selected");
                break;
            case options.CONTROLS.ENTER:
                this.ui.showMsg(getPosInfo(this.area[this.selectPos.currentPos[0]][this.selectPos.currentPos[1]].customProps.infoKeys));
                break;
            case options.CONTROLS.ESC:
                this.ui.hideMsgs();
                this.area[prevPos[0]][prevPos[1]].classList.remove("selected");
                this.inputType = null;
                return;
        }
    }
}
