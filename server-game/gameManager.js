import events from "./eventData.js";
import { levelTiles } from "./levelData.js";
import { createNewLvl } from "./levelGeneration.js";
import { movingAIs, trySpawnMob } from "./mobs.js";
import options from "./options.js";
import {
    coordsEq, getPosInfo, initialize, isNextTo, movePosToDrc, 
    relativeCoordsToDrc, 
    projectileFromDrc, removeByReference, itemNameWithNumber, getClosestTravelPoint, dijkstra 
} from "./util.js";

export default class GameManager {
    constructor(msgQueue) {
        this.msgQueue = msgQueue;
        const initialized = initialize();
        this.levels = initialized.levels;
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
        this.player.noteEntries = [];
        this.player.pos = [9, 5];
        this.player.image = 2;
        this.customRenders = []; // retain "animations", can also be damaging zones
        this.referenced = []; // for retaining object references when saving
        // this.mobsUsingVisualTimeout = []; // store mobs whose img should be updated after moving
        this.mobIdCounter = 0; // to identify mobs in clients

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

    createPlayer(id) {
        const newPlayer = {};
        newPlayer.id = id;
        newPlayer.maxHealth = 4;
        newPlayer.health = this.player.maxHealth;
        newPlayer.inventory = [];
        newPlayer.noteEntries = [];
        newPlayer.pos = [9, 5];
        newPlayer.image = 2;
        this.levels["Road's end"].players.push(newPlayer); // TODO improve
        return newPlayer;
    }

    posIsValid(levelInfo, pos, disallowFakeWalls) {
        if (pos?.length !== 2) return false;
        for (let mob of levelInfo.mobs) {
            if (coordsEq(mob.pos, pos)) return false;
        }
        for (let item of levelInfo.items) {
            if (coordsEq(item.pos, pos) && item.blocksTravel) return false;
        }
        for (let player of levelInfo.players) {
            if (coordsEq(player.pos, pos)) return false;
        }
        if (pos[0] > levelInfo.level.length - 1 
            || pos[1] > levelInfo.level[0].length - 1 
            || pos[0] < 0 
            || pos[1] < 0
            || levelInfo.level[pos[0]][pos[1]] === levelTiles.wall
            || levelInfo.level[pos[0]][pos[1]] === levelTiles.seeThroughWall
            || this.level[pos[0]][pos[1]] === levelTiles.transparentBgWall
            || (disallowFakeWalls && levelInfo.level[pos[0]][pos[1]] === levelTiles.fakeWall)
        ) {
            return false;
        }
        return true;
    }

    gameOver(msg) {
        // remove player, send msg to client
    }

    updateInfo() {
        // send new info?

        // const timeWord = options.TURN_BASED ? "\nTurn: " : "\nTime: ";
        // info.textContent = "Level: " + this.levels.currentLvl + timeWord + this.timeTracker.timer 
        //                    + "\nHealth: " + this.player.health + "\nSelected action: " + this.actType + "\n";
    
        // if (this.timeTracker.turnsUntilShoot > 0 && this.actType === "shoot") {
        //     info.textContent += "Cooldown: " + this.timeTracker.turnsUntilShoot;
        // }
    }

    processTick(clientInfos) {
        const msgs = [];
        const clientsByLevel = {};

        for (const clientInfo of clientInfos) {
            if (clientInfo.player.dead) continue;
            if (!clientsByLevel[clientInfo.currentLvl]) {
                clientsByLevel[clientInfo.currentLvl] = [];
            }
            clientsByLevel[clientInfo.currentLvl].push(clientInfo);
        }
        this.timeTracker.timer++;
        msgs.push({ type: "time", value: this.timeTracker.timer });

        for (const lvl of Object.keys(clientsByLevel)) {
            for (const mob of this.levels[lvl].mobs) {
                if (this.timeTracker.timer % mob.speedModulus < 1) {
                    continue;
                }
                if (mob.isHostile) {
                    let hit = false;

                    for (const client of clientsByLevel[lvl]) {
                        if (isNextTo(client.player.pos, mob.pos)) {
                            this.changePlayerHealth(client.player, -3);
                            hit = true;
                            break;
                        }
                    }
                    if (hit) continue;
                    if (!mob.huntingTarget
                        || !mob.huntingTarget.pos
                        || this.levels[lvl].players.indexOf(mob.huntingTarget) === -1
                    ) {
                        this.mobTryAcquireTarget(mob, clientsByLevel[lvl]);
                    }
                }
                
                // if (mob.isHostile && isNextTo(this.player.pos, mob.pos)) {
                //     this.render.shotEffect(this.player.pos, this.player, this.levels, this.customRenders, true);
                //     this.changePlayerHealth(-3);
                //     continue;
                // }
                // if (mob.stayStillForInteract && isNextTo(this.player.pos, mob.pos)) {
                //     continue;
                // }
                movingAIs[mob.movingFunction](mob, this.posIsValid, this.levels[lvl]/* , this.rendered */);

                if (mob.isShooter && mob.straightLineToTargetDrc) {
                    this.shoot(this.levels[lvl], mob.pos, mob.straightLineToTargetDrc);
                    msgs.push({
                        type: "shoot",
                        clientId: null,
                        level: lvl,
                        pos: mob.pos.slice(),
                        drc: mob.straightLineToTargetDrc
                    });
                } else {
                    // also works if new pos not next to current for some reason
                    // const facing = relativeCoordsToDrc(mob.target[0] - mob.pos[0], mob.target[1] - mob.pos[1]);
                    // const moveImage = facing + "_move";
                    // const baseImage = facing;
                    // const altMoveImage = facing + "_2_move";
            
                    // if (mob.image === moveImage || mob.image === altMoveImage) {
                    //     mob.image = baseImage;
                    // } else if (mob.prevMoveImage === altMoveImage) {
                    //     mob.image = moveImage;
                    //     mob.prevMoveImage = moveImage;
                    // } else {
                    //     mob.image = altMoveImage;
                    //     mob.prevMoveImage = altMoveImage;
                    // }
                    mob.pos = [mob.target[0], mob.target[1]];
                    msgs.push({ type: "mobMove", mobId: mob.id, level: lvl, pos: mob.target });
                    // this.mobsUsingVisualTimeout.push(mob);

                    for (let obj of this.levels[lvl].customRenders) {
                        if (coordsEq(mob.pos, obj.pos) && obj.damageMobs) {
                            this.mobDie(mob, this.levels[lvl]);
        
                            if (obj.disappearOnHit) {
                                this.hitCustomRenderEffect(obj);
                            }
                            break; // NOTE: if mob health implemented, remove this
                        }
                    }
                }
            }
            let mob = trySpawnMob(this.levels[lvl]/* , this.rendered */);

            if (mob !== null) {
                this.mobTryAcquireTarget(mob, clientsByLevel[lvl]);
                mob.id = this.mobIdCounter++;
                this.levels[lvl].mobs.push(mob);
                msgs.push({ type: "mobSpawn", mob: mob, level: lvl });
            }
        }
        return msgs;
    }

    mobTryAcquireTarget(mob, clientsInLevel) {
        if (!clientsInLevel?.length) return;
        // try to hunt the closest player
        let targetPlayer = clientsInLevel[0].player;
        let minDistance = (mob.pos[0] - targetPlayer.pos[0])*(mob.pos[0] - targetPlayer.pos[0]) + 
                          (mob.pos[1] - targetPlayer.pos[1])*(mob.pos[1] - targetPlayer.pos[1])
        
        for (const client of clientsInLevel) {
            // actually squared but doesn't matter
            const distanceToMob = (mob.pos[0] - targetPlayer.pos[0])*(mob.pos[0] - targetPlayer.pos[0]) + 
                                  (mob.pos[1] - targetPlayer.pos[1])*(mob.pos[1] - targetPlayer.pos[1]);
            
            if (distanceToMob < minDistance) {
                targetPlayer = client.player;
                minDistance = distanceToMob;
            }
        }
        mob.huntingTarget = this.refer(targetPlayer);
    }

    processTurn() {
        // this.timeTracker.timer++;
        // if (this.timeTracker.turnsUntilShoot > 0) this.timeTracker.turnsUntilShoot--;
        // this.updateInfo();
        // clearTimeout(this.mobVisualTimeout);
        // this.mobVisualTimeout = setTimeout(() => {
        //     for (let i = this.mobsUsingVisualTimeout.length - 1; i >= 0; i--) {
        //         const mob = this.mobsUsingVisualTimeout[i];

        //         if (mob.image && mob.image.length > 1) {
        //             if (mob.image.length < 8) {
        //                 mob.image = mob.image.slice(0, -5); // change from "_move" to normal
        //             } else {
        //                 mob.image = mob.image.slice(0, -7); // change from "_2_move" to normal
        //             }
        //         }
        //         this.mobsUsingVisualTimeout.splice(i, 1);
        //     }
        //     this.render.renderAll(this.player, this.levels, this.customRenders);
        // }, 0.7 * options.TURN_DELAY);
    
        // for (let mob of this.mobs) {
        //     if (!options.TURN_BASED && this.timeTracker.timer % mob.speedModulus < 1) {
        //         continue;
        //     }
        //     if (mob.isHostile && isNextTo(this.player.pos, mob.pos)) {
        //         this.render.shotEffect(this.player.pos, this.player, this.levels, this.customRenders, true);
        //         this.changePlayerHealth(-3);
        //         continue;
        //     }
        //     if (mob.stayStillForInteract && isNextTo(this.player.pos, mob.pos)) {
        //         continue;
        //     }
        //     movingAIs[mob.movingFunction](mob, this.posIsValid, this.level, this.rendered);
    
        //     if (mob.isShooter && mob.straightLineToTargetDrc) {
        //         this.shoot(mob.pos, mob.straightLineToTargetDrc, true);
        //     } else {
        //         // also works if new pos not next to current for some reason
        //         const facing = relativeCoordsToDrc(mob.target[0] - mob.pos[0], mob.target[1] - mob.pos[1]);
        //         const moveImage = facing + "_move";
        //         const baseImage = facing;
        //         const altMoveImage = facing + "_2_move";
        
        //         if (mob.image === moveImage || mob.image === altMoveImage) {
        //             mob.image = baseImage;
        //         } else if (mob.prevMoveImage === altMoveImage) {
        //             mob.image = moveImage;
        //             mob.prevMoveImage = moveImage;
        //         } else {
        //             mob.image = altMoveImage;
        //             mob.prevMoveImage = altMoveImage;
        //         }
        //         mob.pos = [mob.target[0], mob.target[1]];
        //         this.mobsUsingVisualTimeout.push(mob);
    
        //         for (let obj of this.customRenders) {
        //             if (coordsEq(mob.pos, obj.pos) && obj.damageMobs) {
        //                 this.mobDie(mob);
    
        //                 if (obj.disappearOnHit) {
        //                     this.hitCustomRenderEffect(obj);
        //                 }
        //                 break; // NOTE: if mob health implemented, remove this
        //             }
        //         }
        //     }
        // }
    
        // let mob = trySpawnMob(this.levels, this.rendered);
    
        // if (mob !== null) {
        //     mob.huntingTarget = this.refer(this.player);
        //     this.mobs.push(mob);
        // }
    }
    
    mobDie(mob, levelInfo) {
        const mobId = mob.id;
        this.tryFireEvent("onDeath", mob);
        // delete all properties of mob, so all references to it recognize deletion
        for (let prop in mob) if (mob.hasOwnProperty(prop)) delete mob[prop];
        removeByReference(levelInfo.mobs, mob);
        // TODO maybe improve
        const lvlName = Object.keys(this.levels).find(key => this.levels[key] === levelInfo);
        this.msgQueue.push({ type: "mobDeath", mobId: mobId, level: lvlName });
    }
    
    changePlayerHealth(player, amount) {
        let newHealth = player.health + amount;

        if (newHealth < 1) {
            player.dead = true;
        }
        if (newHealth > player.maxHealth) {
            newHealth = player.maxHealth;
        }
        if (amount < 0) {
            // this.ui.showMsg("You are hit!");
        } else if (amount > 0) {
            if (player.health !== player.maxHealth) {
                // this.ui.showMsg("You feel better.");
            }
        }
        player.health = newHealth;
    }

    refer(obj) {
        if (this.referenced.indexOf(obj) === -1) this.referenced.push(obj);
        return obj;
    }

    hitCustomRenderEffect(levelInfo, obj) {
        obj.deleted = true;
        removeByReference(levelInfo.customRenders, obj);
        // this.render.renderAll(this.player, this.levels, this.customRenders);
        // this.render.shotEffect(obj.pos, this.player, this.levels, this.customRenders);
    }
    
    async shoot(levelInfo, fromPos, drc, shootingPlayerId) {
        const icon = projectileFromDrc[drc];
        let bulletPos = fromPos.slice();
        let obj = {
            symbol: icon,
            pos: bulletPos.slice(),
            ignorePlayerId: shootingPlayerId,
            damageMobs: true,
            disappearOnHit: true
        };
        levelInfo.customRenders.push(obj);
        // !mobIsShooting && (this.timeTracker.turnsUntilShoot = 10);
    
        const checkHits = (checkPos) => {
            for (let player of levelInfo.players) {
                if (shootingPlayerId !== player.id && coordsEq(checkPos, player.pos)) {
                    this.changePlayerHealth(player, -1);
                    this.hitCustomRenderEffect(levelInfo, obj);
                    return true;
                }
            }
            for (let mob of levelInfo.mobs) {
                if (coordsEq(checkPos, mob.pos)) {
                    this.mobDie(mob, levelInfo);
                    this.hitCustomRenderEffect(levelInfo, obj);
                    // !mobIsShooting && this.processTurn(); // ?????
                    return true;
                }
            }
            for (const obj2 of levelInfo.customRenders) {
                if (obj2.blockShots && coordsEq(checkPos, obj2.pos)) {
                    this.hitCustomRenderEffect(levelInfo, obj);
                    return true;
                }
            }
            return false;
        };
        
        while (1) {
            // this.render.renderSymbolAtPos(obj.symbol, obj.pos, this.player, this.levels);
            // this.render.renderAll(this.player, this.levels, this.customRenders);
            movePosToDrc(bulletPos, drc);
    
            if (!levelInfo.level[bulletPos[0]] || typeof levelInfo.level[bulletPos[0]][bulletPos[1]] === "undefined" 
                || levelInfo.level[bulletPos[0]][bulletPos[1]] === levelTiles.wall
                || levelInfo.level[bulletPos[0]][bulletPos[1]] === levelTiles.transparentBgWall
            ) {
                removeByReference(levelInfo.customRenders, obj);

                // if (!options.TURN_BASED) {
                //     this.render.renderAll(this.player, this.levels, this.customRenders);
                // } else {
                //     !this.player.dead && this.addListeners();
                //     !mobIsShooting && this.processTurn();
                // }       
                return;
            }
            // if (this.rendered[bulletPos[0]][bulletPos[1]]) {
            //     this.area[bulletPos[0]][bulletPos[1]].textContent = icon;
            //     this.render.prevAreaBuffer[bulletPos[0]][bulletPos[1]].textContent = icon;
            // }
            obj.pos = bulletPos.slice();
            if (checkHits(bulletPos)) break;
            await new Promise(r => setTimeout(r, 30));
            // NOTE: obj can hit something either by it moving into player/mob, or them moving into it.
            // if something moves into it, they handle the extra effects themselves.
            if (obj.deleted) break;
        }
        removeByReference(levelInfo.customRenders, obj);
    }

    melee(drc) {
        if (options.TURN_BASED) {
            // this.meleeTurnBased(drc);
        } else {
            this.meleeRealTime(drc);
        }
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
        // this.render.renderSymbolAtPos(obj.symbol, obj.pos, this.player, this.levels);
        // this.render.renderAll(this.player, this.levels, this.customRenders);
    
        for (let mob of this.mobs) {
            if (coordsEq(meleePos, mob.pos)) {
                this.mobDie(mob);
                this.hitCustomRenderEffect(obj);
            }
        }
        await new Promise(r => setTimeout(r, 300));
        removeByReference(this.customRenders, obj);
        // this.render.renderAll(this.player, this.levels, this.customRenders);
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
        // this.processTurn(); // ??????
    }
    
    movePlayer(clientInfo, newPos, alternatives) {
        if (!this.posIsValid(this.levels[clientInfo.currentLvl], newPos)) {
            if (!alternatives || !alternatives.length) {
                return;
            } else {
                const firstAlternativePos = alternatives.shift();
                this.movePlayer(clientInfo, firstAlternativePos, alternatives);
                return;
            }
        }
        clientInfo.player.pos = newPos;
        this.tryFireEvent("onMove");
    
        // NOTE: detect by client requesting the new level
        // if (clientInfo.level[clientInfo.player.pos[0]][clientInfo.player.pos[1]] === levelTiles.doorWay) {
        //     this.tryChangeLvl(clientInfo);
        // }
        for (let obj of clientInfo.customRenders) {
            if (coordsEq(clientInfo.player.pos, obj.pos) && obj.ignorePlayerId !== clientInfo.player.id) {
                this.changePlayerHealth(clientInfo.player, -1);
    
                if (obj.disappearOnHit) {
                    this.hitCustomRenderEffect(this.levels[clientInfo.currentLvl], obj);
                }
            }
        }
        for (let i = 0; i < clientInfo.items.length; i++) {
            if (coordsEq(clientInfo.player.pos, clientInfo.items[i].pos)) {
                let msg = "";
                let severalItems = false;
    
                // NOTE: currently hidden items won't be found if there are other items "on top"
    
                if (clientInfo.items[i].hidden) {
                    msg += "You find an item! ";
                    clientInfo.items[i].hidden = false;
                }
                for (let j = 0; j < clientInfo.items.length; j++) {
                    if (coordsEq(clientInfo.items[i].pos, clientInfo.items[j].pos) 
                        && i !== j && !clientInfo.items[j].hidden
                    ) {
                        severalItems = true;
                        break;
                    }
                }
                if (severalItems) {
                    msg += "There are several items here.";
                } else {
                    msg += "There's \"" + itemNameWithNumber(clientInfo.items[i]) + "\" here.";
                }
                // this.ui.showMsg(msg);
                return;
            }
        }
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
                    // this.setPause(true);
                    // this.ui.showDialog("What do you want to pick up?", itemNames, idx => {
                    //     // only unpause if closing the dialog or picking up the last item,
                    //     // otherwise one update cycle would trigger before opening the dialog again
                    //     if (idx < 0 || itemsHere.length < 2) this.setPause(false);
                    //     if (idx < 0) return;
                    //     const removed = this.items.splice(itemIdxs[idx], 1)[0];
                    //     this.addToInventory(removed);
                    //     this.ui.showMsg("You pick up \"" + itemNameWithNumber(removed) + "\".");
                    //     this.pickup(true); // allow picking up several items from the "same" dialog
                    // }, true, true);
                } else {
                    const removed = this.items.splice(i, 1)[0];
                    this.addToInventory(removed);
                    // this.ui.showMsg("You pick up \"" + itemNameWithNumber(removed) + "\".");
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
    
    // tryChangeLvl(clientInfo) {
    //     const tps = this.levels[clientInfo.currentLvl].travelPoints;
    
    //     for (const lvl of Object.keys(tps)) {
    //         let idx = 0; // for tracking which point in lvl to travel to if several
    
    //         for (const coords of tps[lvl]) {
    //             if (coordsEq(coords, clientInfo.player.pos)) {
    //                 if (typeof this.levels[lvl] === "undefined") {
    //                     createNewLvl(lvl, this.levels, clientInfo.level, clientInfo.player);
    //                 }
    //                 if (typeof this.levels[lvl].travelPoints[clientInfo.currentLvl] === "undefined") {
    //                     // if no travelpoint to connect to this level, choose most appropriate placeholder
    //                     this.levels[lvl].travelPoints[clientInfo.currentLvl] = [
    //                         getClosestTravelPoint(this.levels[lvl].tempTravelPoints, clientInfo.player.pos, clientInfo.level)
    //                     ];
    //                 }
    //                 this.tryGenerateTravelPoints(lvl);
    //                 clientInfo.level = this.levels[lvl].level;
    //                 const newPos = this.levels[lvl].travelPoints[clientInfo.currentLvl][idx].slice();
    //                 clientInfo.player.pos = newPos;
    //                 clientInfo.mobs = this.levels[lvl].mobs;
    //                 clientInfo.items = this.levels[lvl].items;
    //                 clientInfo.currentLvl = lvl;
    //                 clientInfo.customRenders = this.levels[lvl].customRenders;
    //                 this.tryFireEvent("onEnterLevel");
    //                 return;
    //             }
    //             idx++;
    //         }
    //     }
    // }

    // NOTE: use params instead of clientInfo to make absolutely sure to use the latest info
    getLevelAndChange(clientInfo, name, currentLvl, pos) {
        let idx = 0;
        let travelPointIdx = 0;

        for (const coords of this.levels[currentLvl].travelPoints[name]) {
            if (coordsEq(coords, pos)) {
                travelPointIdx = idx;
                break;
            }
            idx++;
        }
        if (typeof this.levels[name] === "undefined") {
            // NOTE: dummy object since only pos from player needed
            createNewLvl(name, this.levels, this.levels[currentLvl].level, { pos: pos }, currentLvl);
        }
        if (typeof this.levels[name].travelPoints[currentLvl] === "undefined") {
            // if no travelpoint to connect to this level, choose most appropriate placeholder
            this.levels[name].travelPoints[currentLvl] = [
                getClosestTravelPoint(this.levels[name].tempTravelPoints, { pos: pos }, this.levels[currentLvl].level)
            ];
        }
        this.tryGenerateTravelPoints(name);
        clientInfo.level = this.levels[name].level;
        const newPos = this.levels[name].travelPoints[clientInfo.currentLvl][travelPointIdx].slice();
        clientInfo.player.pos = newPos;
        clientInfo.mobs = this.levels[name].mobs;
        clientInfo.items = this.levels[name].items;
        clientInfo.currentLvl = name;
        clientInfo.customRenders = this.levels[name].customRenders;
        this.levels[name].players.push(clientInfo.player);
        removeByReference(this.levels[currentLvl].players, clientInfo.player);
        this.tryFireEvent("onEnterLevel");
        return this.levels[name];
    }
}
