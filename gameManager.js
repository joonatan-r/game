import events from "./eventData.js";
import { levelTiles } from "./levelData.js";
import { createNewLvl } from "./levelGeneration.js";
import { movingAIs, trySpawnMob } from "./mobs.js";
import options from "./options.js";
import Renderer from "./render.js";
import UI from "./UI.js";
import {
    coordsEq, getPosInfo, initialize, isNextTo, movePosToDrc, 
    relativeCoordsToDrc, 
    projectileFromDrc, removeByReference, itemNameWithNumber, getClosestTravelPoint 
} from "./util.js";

// NOTE: all references within "levels", "player", or "timeTracker" to other objects included
//       in each other must be done with "refer()" for saving to work properly

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
        this.ui = new UI(removeListeners, addListeners);
        this.level = this.levels[this.levels.currentLvl].level;
        this.mobs = this.levels[this.levels.currentLvl].mobs;
        this.items = this.levels[this.levels.currentLvl].items;
        this.turnInterval = null;
        this.timeTracker = {};
        this.timeTracker.timer = 0;
        this.timeTracker.turnsUntilShoot = 0;
        this.player = {};
        this.player.maxHealth = 4;
        this.player.health = this.player.maxHealth;
        this.player.inventory = [];
        this.player.pos = [9, 5];
        this.player.image = 2;
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
        info.onclick = () => {
            this.actType = { shoot: "melee", melee: "interact", interact: "shoot" }[this.actType];
            this.updateInfo();
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

    posIsValid(pos) {
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
        ) {
            return false;
        }
        return true;
    }

    gameOver(msg) {
        this.ui.showMsg(msg);
        !options.TURN_BASED && clearInterval(this.turnInterval);
        this.interruptAutoTravel = true;
        this.removeListeners();
        this.player.dead = true;
        this.render.renderAll(this.player, this.levels, this.customRenders);
        this.render.shotEffect(this.player.pos, this.player, this.levels, this.customRenders);
    
        for (let key of Object.keys(this.keyIntervals)) {
            clearInterval(this.keyIntervals[key]);
            delete this.keyIntervals[key];
        }
    }

    updateInfo() {
        const timeWord = options.TURN_BASED ? "\nTurn: " : "\nTime: ";
        info.textContent = "Level: " + this.levels.currentLvl + timeWord + this.timeTracker.timer 
                           + "\nHealth: " + this.player.health + "\nSelected action: " + this.actType + "\n";
    
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
                this.mobsUsingVisualTimeout.splice(i, 1);
            }
            this.render.renderAll(this.player, this.levels, this.customRenders);
        }, 0.7 * options.TURN_DELAY);
    
        for (let mob of this.mobs) {
            if (!options.TURN_BASED && this.timeTracker.timer % mob.speedModulus < 1) {
                continue;
            }
            if (mob.isHostile && isNextTo(this.player.pos, mob.pos)) {
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
                mob.pos = [mob.target[0], mob.target[1]];
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
        }
        if (this.setPause.pauseNext && !this.setPause.paused) {
            this.pauser.pause();
            this.interruptAutoTravel = true;
            this.setPause.paused = true;
            this.setPause.pauseNext = false;
            clearInterval(this.turnInterval);
        }
    }
    
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
        // delete all properties of mob, so all references to it recognize deletion
        for (let prop in mob) if (mob.hasOwnProperty(prop)) delete mob[prop];
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
        !mobIsShooting && (this.timeTracker.turnsUntilShoot = 10);
    
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
                    !this.player.dead && options.TURN_BASED && this.addListeners();
                    !mobIsShooting && this.processTurn();
                    return true;
                }
            }
            return false;
        };
        
        while (1) {
            this.render.renderAll(this.player, this.levels, this.customRenders);
            movePosToDrc(bulletPos, drc);
    
            if (!this.level[bulletPos[0]] || typeof this.level[bulletPos[0]][bulletPos[1]] === "undefined" 
                || this.level[bulletPos[0]][bulletPos[1]] === levelTiles.wall
                || this.level[bulletPos[0]][bulletPos[1]] === levelTiles.transparentBgWall
            ) {
                removeByReference(this.customRenders, obj);

                if (!options.TURN_BASED) {
                    this.render.renderAll(this.player, this.levels, this.customRenders);
                } else {
                    !this.player.dead && this.addListeners();
                    !mobIsShooting && this.processTurn();
                }       
                return;
            }
            if (this.rendered[bulletPos[0]][bulletPos[1]]) {
                this.area[bulletPos[0]][bulletPos[1]].textContent = icon;
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
            disappearOnHit: true
        };
        this.customRenders.push(obj);
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
        this.processTurn();
    }

    resetMoveVisual() {
        if (this.player.image.length > 1) {
            if (this.player.image.length < 8) {
                this.player.image = this.player.image.slice(0, -5); // change from "_move" to normal
            } else {
                this.player.image = this.player.image.slice(0, -7); // change from "_2_move" to normal
            }
        }
        this.render.renderAll(this.player, this.levels, this.customRenders);
    }
    
    movePlayer(newPos, alternatives) {
        if (!this.posIsValid(newPos)) {
            if (!alternatives || !alternatives.length) {
                return;
            } else {
                const firstAlternativePos = alternatives.shift();
                this.movePlayer(firstAlternativePos, alternatives);
                return;
            }
        }
        clearTimeout(this.player.moveVisualTimeout);
        this.player.moveVisualTimeout = setTimeout(this.resetMoveVisual, 100);
        // also works if new pos not next to current for some reason
        const facing = relativeCoordsToDrc(newPos[0] - this.player.pos[0], newPos[1] - this.player.pos[1]);
        const moveImage = facing + "_move";
        const baseImage = facing;
        const altMoveImage = facing + "_2_move";

        if (this.player.image === moveImage || this.player.image === altMoveImage) {
            this.player.image = baseImage;
        } else if (this.player.prevMoveImage === altMoveImage) {
            this.player.image = moveImage;
            this.player.prevMoveImage = moveImage;
        } else {
            this.player.image = altMoveImage;
            this.player.prevMoveImage = altMoveImage;
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
        const coordsList = [];
        const lvl = this.levels.currentLvl;
        const idx = this.autoTravelStack.length;
        this.autoTravelStack.push(true);
    
        for (let i = 0; i < idx; i++) {
            this.autoTravelStack[i] = false; // stop previous autoTravels
        }
        this.interruptAutoTravel = false;
        this.inputType = "autoMove";
        const placeHolderPlayer = { pos: this.player.pos.slice() };
        let currCoords = [];
        let maxIters = 50;
        
        while (!coordsEq(currCoords, coords) && maxIters--) {
            movingAIs["towardsPos"](placeHolderPlayer, coords, this.posIsValid, this.level);

            if (coordsEq(currCoords, placeHolderPlayer.target)) {
                break;
            }
            placeHolderPlayer.pos = placeHolderPlayer.target.slice();
            currCoords = placeHolderPlayer.target;
            coordsList.push(currCoords);
        }
        for (let coord of coordsList) {
            // new coord may not be next to player if e.g. a mob blocks the way
            if (!this.autoTravelStack[idx] || this.interruptAutoTravel || this.levels.currentLvl !== lvl || !isNextTo(this.player.pos, coord)) {
                this.inputType = null;
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
                    this.ui.showDialog("What do you want to pick up?", itemNames, idx => {
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
                    if (this.levels[lvl].tempTravelPoints) {
                        // if there are placeholder travelpoints, change them into actual travelpoints that
                        // point to new levels to be generated
                        for (const tpsToGenerate of this.levels[lvl].tempTravelPoints) {
                            this.levels[lvl].travelPoints[this.levels.generatedIdx + 1] = [tpsToGenerate];
                            this.levels.generatedIdx++;
                        }
                        delete this.levels[lvl].tempTravelPoints;
                    }
                    this.level = this.levels[lvl].level;
                    this.player.pos = this.levels[lvl].travelPoints[this.levels.currentLvl][idx].slice();
                    this.mobs = this.levels[lvl].mobs;
                    this.items = this.levels[lvl].items;
                    this.levels.currentLvl = lvl;
                    this.customRenders = [];
                    this.render.setBg(this.levels);
                    this.tryFireEvent("onEnterLevel", lvl);
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
                this.ui.showMsg("");
                this.area[prevPos[0]][prevPos[1]].classList.remove("selected");
                this.inputType = null;
                return;
        }
    }
}
