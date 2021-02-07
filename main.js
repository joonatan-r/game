// createLevels, initialize, infoTable from level.js
// bresenham, isNextTo, coordsEq, movePosToDrc, removeByReference, 
// pixelCoordsToDrc, makeTextFile from util.js
// trySpawnMob, addMobs from mobs.js
// showDialog from UI.js
// storyEvents from story.js

// all coords are given as (y,x)

const TURN_BASED = true;
let turnInterval = null;
!TURN_BASED && (turnInterval = setInterval(() => processTurn(), 500));

// "global" variables

const area = [];
const areaCache = [];
const rendered = [];
const edges = [];
let levels = createLevels();
let level = levels[levels.currentLvl].level;
let memorized = levels[levels.currentLvl].memorized;

// end "global" variables

const table = document.getElementById("table");
const info = document.getElementById("info");
const status = document.getElementById("status");
const menu = document.getElementById("clickMenu");
const msgHistory = [];
let timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 0;
let player = {};
player.inventory = [];
player.pos = [10, 13];
let mobs = levels[levels.currentLvl].mobs;
let items = levels[levels.currentLvl].items;
let customRenders = []; // for "animations" to not get erased
let referenced = []; // for retaining object references when saving
let interruptAutoTravel = false;
let blockAutoTravel = false;
showDialog.removeListeners = removeListeners; // initialize showDialog
showDialog.addListeners = addListeners;
showDialog.msgHistory = msgHistory;

initialize(table, levels, area, areaCache, rendered, edges);
addMobs(levels);
items.push({
    name: "a chest",
    symbol: "(",
    blocksTravel: true,
    state: 0,
    pos: [9, 22],
    onInteract: function() {
        switch (this.state) {
            case 0:
                showMsg("You try to loot " + this.name + ", but it's locked.");
                break;
            case 1:
                showMsg("You try to loot " + this.name + ", but it's empty.");
                break;
        }
    }
});
levels["Wilderness"].items.push({
    name: "a key",
    symbol: "\u00A3",
    pos: [12, 27]
}, {
    name: "a weird object",
    symbol: "?",
    hidden: true,
    pos: [3, 8]
});
addListeners(); // listeners that may get disabled at certain times
updateInfo();
renderAll(player, items, mobs, customRenders);

// listeners that won't be removed

document.addEventListener("mousemove", e => {
    if (clickListener.actionType === "chooseDrc") {
        const rect = area[player.pos[0]][player.pos[1]].getBoundingClientRect();
        const x = e.x - (rect.left + rect.width / 2);
        const y = e.y - (rect.top + rect.height / 2);
        const drc = pixelCoordsToDrc(y, x);
        document.body.style.cursor = {
            "1": "sw-resize",
            "2": "s-resize",
            "3": "se-resize",
            "4": "w-resize",
            "6": "e-resize",
            "7": "nw-resize",
            "8": "n-resize",
            "9": "ne-resize",
        }[drc];
    } else if (document.body.style.cursor !== "default") {
        document.body.style.cursor = "default";
    }
});
document.getElementById("save").addEventListener("click", () => {
    const link = document.createElement("a");
    const saveData = {
        levels: levels,
        player: player,
        timeTracker: timeTracker
    };
    link.setAttribute("download", "save.json");
    link.href = makeTextFile(JSON.stringify(saveData, (key, val) => {
            if (typeof val === "function") {
                return "" + val; // store functions as string
            }
            const idx = referenced.indexOf(val);

            if (idx !== -1) {
                return "refTo " + idx;
            }
            return val;
        })
            .slice(0, -1) + ",\"referenced\":" + JSON.stringify(referenced) + "}"
            // objects that have multiple references to them are stored in "referenced", no replacer here
    );
    document.body.appendChild(link);
    window.requestAnimationFrame(() => {
        link.dispatchEvent(new MouseEvent("click"));
        document.body.removeChild(link);
    });
});
document.getElementById("inputFile").addEventListener("change", function() {
    const fr = new FileReader();
    fr.onload = () => {
        const refs = [];
        const loadData = JSON.parse(fr.result, function(key, val) {
            if (typeof val === "string" && val.startsWith("function")) {
                // convert string representations of functions back to functions
                return eval("(" + val + ")");
            }
            if (typeof val === "string" && val.startsWith("refTo ")) {
                refs.push({ obj: this, key: key });
            }
            return val;
        });

        for (let ref of refs) {
            const idx = ref.obj[ref.key].split(" ")[1];
            ref.obj[ref.key] = loadData.referenced[idx]; // replace references with actual objects
        }
        levels = loadData.levels;
        level = levels[levels.currentLvl].level;
        mobs = levels[levels.currentLvl].mobs;
        items = levels[levels.currentLvl].items;
        memorized = levels[levels.currentLvl].memorized;
        player = loadData.player;
        timeTracker = loadData.timeTracker;
        updateInfo();
        renderAll(player, items, mobs, customRenders);
    };
    fr.readAsText(this.files[0]);
});

function posIsValid(pos) {
    if (pos.length !== 2) return false;
    for (let mob of mobs) {
        if (coordsEq(mob.pos, pos)) return false;
    }
    for (let item of items) {
        if (coordsEq(item.pos, pos) && item.blocksTravel) return false;
    }
    if (coordsEq(player.pos, pos) 
        || pos[0] > level.length - 1 
        || pos[1] > level[0].length - 1 
        || pos[0] < 0 
        || pos[1] < 0
        || level[pos[0]][pos[1]] === ""
    ) {
        return false;
    }
    return true;
}

function tryFireStoryEvent(type, name, val) {
    storyEvents.items = items;
    storyEvents.mobs = mobs;
    storyEvents.levels = levels;
    storyEvents.level = level;
    storyEvents.player = player;

    if (storyEvents[type] && storyEvents[type][name]) {
        if (typeof val === "undefined") {
            storyEvents[type][name]();
        } else if (storyEvents[type][name][val]) {
            storyEvents[type][name][val]();
        }
    }
}

function onMobStateChange(mob) { tryFireStoryEvent("stateChange", mob.name, mob.state) }

function gameOver(msg) {
    showMsg(msg);
    !TURN_BASED && clearInterval(turnInterval);
    interruptAutoTravel = true;
    removeListeners();
    player.dead = true;
}

function updateInfo() {
    info.textContent = levels.currentLvl + "\nTurn " + timeTracker.timer + "\n";

    if (timeTracker.turnsUntilShoot > 0) {
        info.textContent += timeTracker.turnsUntilShoot + " turns until you can shoot";
    } else {
        info.textContent += "You can shoot";
    }
}

function processTurn() {
    timeTracker.timer++;
    if (timeTracker.turnsUntilShoot > 0) timeTracker.turnsUntilShoot--;
    updateInfo();

    for (let mob of mobs) {
        if (mob.isHostile && isNextTo(player.pos, mob.pos)) {
            gameOver(mob.name + " hits you! You die...");
            break;
        }
        mob.calcTarget(posIsValid);

        if (mob.isShooter && mob.straightLineToTargetDrc) {
            shoot(mob.pos, mob.straightLineToTargetDrc, true);
        } else {
            mob.pos = mob.target.slice();
        }
    }
    renderAll(player, items, mobs, customRenders);

    if (!levels[levels.currentLvl].spawnsHostiles) return;
    if (timeTracker.timer % 10 !== 0) return;

    let mob = trySpawnMob();

    if (mob !== null) {
        mob.huntingTarget = refer(player);
        mobs.push(mob);
    }
}

async function shoot(fromPos, drc, mobIsShooting) {
    let bulletPos = fromPos.slice();
    let obj;
    TURN_BASED && (interruptAutoTravel = true);
    TURN_BASED && removeListeners();
    keypressListener.actionType = null;
    clickListener.actionType = null;

    switch (drc) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            while (1) {
                renderPos(bulletPos, player, items, mobs, customRenders);
                movePosToDrc(bulletPos, drc);

                if (!level[bulletPos[0]] || !level[bulletPos[0]][bulletPos[1]] 
                    || level[bulletPos[0]][bulletPos[1]] === ""
                ) {
                    break;
                }
                if (rendered[bulletPos[0]][bulletPos[1]]) area[bulletPos[0]][bulletPos[1]].textContent = "o";
                obj = { symbol: "o", pos: [bulletPos[0], bulletPos[1]] };
                customRenders.push(obj);
        
                await new Promise(r => setTimeout(r, 30));
                
                if (coordsEq(bulletPos, player.pos)) {
                    gameOver("A bullet hits you! You die...");
                    removeByReference(customRenders, obj);
                    renderPos(bulletPos, player, items, mobs, customRenders);
                    shotEffect(bulletPos, player, items, mobs, customRenders);
                    return;
                }
                for (let i = 0; i < mobs.length; i++) {
                    if (coordsEq(bulletPos, mobs[i].pos)) {
                        mobs.splice(i, 1);
                        TURN_BASED && addListeners();
                        keypressListener.actionType = null;
                        clickListener.actionType = null;
                        removeByReference(customRenders, obj);
                        renderPos(bulletPos, player, items, mobs, customRenders);
                        shotEffect(bulletPos, player, items, mobs, customRenders);
                        !mobIsShooting && processTurn();
                        return;
                    }
                }
                removeByReference(customRenders, obj);
            }
            break;
        case "Escape":
            timeTracker.turnsUntilShoot = 0;
            showMsg("");
            TURN_BASED && addListeners();
            keypressListener.actionType = null;
            clickListener.actionType = null;
            return;
        default:
            TURN_BASED && addListeners();
            keypressListener.actionType = "shoot";
            clickListener.actionType = "chooseDrc";
            return;
    }
    TURN_BASED && addListeners();
    keypressListener.actionType = null;
    clickListener.actionType = null;
    !mobIsShooting && processTurn();
}

function interact(drc) {
    let interactPos = player.pos.slice();

    switch (drc) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            movePosToDrc(interactPos, drc);
            break;
        case "Escape":
            showMsg("");
            keypressListener.actionType = null;
            clickListener.actionType = null;
            return;
        default:
            keypressListener.actionType = "interact";
            clickListener.actionType = "chooseDrc";
            return;
    }
    for (let mob of mobs) {
        if (coordsEq(interactPos, mob.pos) && mob.talk) mob.talk(showDialog, showMsg, onMobStateChange);
    }
    for (let item of items) {
        if (coordsEq(interactPos, item.pos) && item.onInteract) {
            tryFireStoryEvent("beforeInteract", item.name);
            item.onInteract();
        }
    }
    keypressListener.actionType = null;
    clickListener.actionType = null;
    processTurn();
}

function movePlayer(newPos) {
    if (!posIsValid(newPos)) return;
    
    player.pos = newPos;

    if (level[player.pos[0]][player.pos[1]] === "^") {
        tryChangeLvl();
    }
    for (let i = 0; i < items.length; i++) {
        if (coordsEq(player.pos, items[i].pos)) {
            let msg = "";
            let severalItems = false;

            // NOTE: currently hidden items won't be found if there are other items "on top"

            if (items[i].hidden) {
                msg += "You find an item! ";
                items[i].hidden = false;
            }
            for (let j = 0; j < items.length; j++) {
                if (coordsEq(items[i].pos, items[j].pos) 
                    && i !== j && !items[j].hidden
                ) {
                    severalItems = true;
                    break;
                }
            }
            if (severalItems) {
                msg += "There are several items here.";
            } else {
                msg += "There's " + items[i].name + " here.";
            }
            showMsg(msg);
            return;
        }
    }
}

function tryChangeLvl() {
    const tps = levels[levels.currentLvl].travelPoints;

    for (let lvl of Object.keys(tps)) {
        let idx = 0; // for tracking which point in lvl to travel to if several

        for (let coords of tps[lvl]) {
            if (coordsEq(coords, player.pos)) {
                level = levels[lvl].level;
                player.pos = levels[lvl].travelPoints[levels.currentLvl][idx].slice();
                mobs = levels[lvl].mobs;
                items = levels[lvl].items;
                memorized = levels[lvl].memorized;
                levels.currentLvl = lvl;
                return;
            }
            idx++;
        }
    }
}

function action(key, ctrl) {
    switch (key) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            let newPos = player.pos.slice();
            let prevPos;

            if (ctrl) {
                while (level[newPos[0]] && level[newPos[0]][newPos[1]] 
                        && level[newPos[0]][newPos[1]] !== ""
                ) {
                    prevPos = newPos.slice();
                    movePosToDrc(newPos, key);
                }
                autoTravel(prevPos); // last ok position
            } else {
                movePosToDrc(newPos, key);
                movePlayer(newPos);
            }
            break;
        case "Enter":
            if (level[player.pos[0]][player.pos[1]] === ">" || level[player.pos[0]][player.pos[1]] === "<") {
                tryChangeLvl();
            } else {
                return;
            }
            break;
        case "f":
            if (timeTracker.turnsUntilShoot === 0) {
                timeTracker.turnsUntilShoot = 10;
                showMsg("In what direction?");
                keypressListener.actionType = "shoot";
                clickListener.actionType = "chooseDrc";
            }
            return;
        case "h":
            if (msgHistory.length) showDialog("Message history:", msgHistory, ()=>{}, true, true);
            return;
        case "i":
            let contentNames = [];
            
            for (let item of player.inventory) contentNames.push(item.name);

            if (contentNames.length !== 0) {
                showDialog("Contents of your inventory:", contentNames, itemIdx => {
                    showDialog("What do you want to do with \"" + contentNames[itemIdx] + "\"?", 
                               ["Drop"], actionIdx => {
                        switch (actionIdx) {
                            case 0:
                                let item = player.inventory.splice(itemIdx, 1)[0];
                                item.pos = player.pos.slice();
                                items.push(item);
                                showMsg("You drop \"" + contentNames[itemIdx] + "\".");
                                processTurn();
                                break;
                        }
                    }, true, true);
                }, true, true);
            } else {
                showMsg("Your inventory is empty.");
            }
            return;
        case "t":
            showMsg("In what direction?");
            keypressListener.actionType = "interact";
            clickListener.actionType = "chooseDrc";
            return;
        case ",":
            for (let i = 0; i < items.length; i++) {
                if (coordsEq(player.pos, items[i].pos)) {
                    let itemsHere = [];
                    let itemNames = [];
                    let itemIdxs = [];

                    for (let j = 0; j < items.length; j++) {
                        if (coordsEq(items[i].pos, items[j].pos) && !items[j].hidden) {
                            itemsHere.push(items[j]); // i is included here
                            itemNames.push(items[j].name);
                            itemIdxs.push(j);
                        }
                    }
                    if (itemsHere.length > 1) {
                        showDialog("What do you want to pick up?", itemNames, idx => {
                            const removed = items.splice(itemIdxs[idx], 1)[0];
                            player.inventory.push(removed);
                            showMsg("You pick up " + removed.name + ".");
                        }, true, true);
                    } else {
                        const removed = items.splice(i, 1)[0];
                        player.inventory.push(removed);
                        showMsg("You pick up " + removed.name + ".");
                    }
                    break;
                }
            }
            break;
        case ";":
            showMsg("Move to select a location. Use enter to select and esc to leave.");
            keypressListener.actionType = "selectPos";
            clickListener.actionType = "ignore";
            selectPos.currentPos = player.pos.slice();
            break;
        default:
            return;
    }
    if (TURN_BASED) {
        processTurn();
    } else {
        renderAll(player, items, mobs, customRenders);
    }
}

async function autoTravel(coords) {
    if (blockAutoTravel) return;

    const coordsList = [];
    const lvl = levels.currentLvl;
    blockAutoTravel = true;
    interruptAutoTravel = false;
    keypressListener.actionType = "autoMove";
    bresenham(player.pos[0], player.pos[1], coords[0], coords[1], 
            (y, x) => {
                coordsList.push([y, x]);
                return level[y][x] === "" ? "stop" : "ok";
            }
    );
    coordsList.shift(); // first element is the player's start position

    for (let coord of coordsList) {
        // new coord may not be next to player if e.g. a mob blocks the way
        if (interruptAutoTravel || levels.currentLvl !== lvl || !isNextTo(player.pos, coord)) {
            keypressListener.actionType = null;
            blockAutoTravel = false;
            return;
        }
        movePlayer(coord);
        
        if (TURN_BASED) {
            processTurn();
        } else {
            renderAll(player, items, mobs, customRenders);
        }
        await new Promise(r => setTimeout(r, 50));
    }
    keypressListener.actionType = null;
    blockAutoTravel = false;
}

function selectPos(drc) {
    let prevPos = selectPos.currentPos.slice();

    switch (drc) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            movePosToDrc(selectPos.currentPos, drc);

            if (!level[selectPos.currentPos[0]] 
                || level[selectPos.currentPos[0]][selectPos.currentPos[1]] === undefined
            ) {
                selectPos.currentPos = prevPos;
            }
            area[prevPos[0]][prevPos[1]].classList.toggle("selected");
            area[selectPos.currentPos[0]][selectPos.currentPos[1]].classList.toggle("selected");
            break;
        case "Enter":
            let msg = "";
            let infoKeys = area[selectPos.currentPos[0]][selectPos.currentPos[1]].customProps.infoKeys;
    
            if (!infoKeys.length) {
                msg += "[ ]: An unseen area\n";
            }
            for (let key of infoKeys) {
                msg += infoTable[key] + "\n";
            }
            showMsg(msg);
            break;
        case "Escape":
            showMsg("");
            area[prevPos[0]][prevPos[1]].classList.toggle("selected");
            keypressListener.actionType = null;
            clickListener.actionType = null;
            return;
        default:
            keypressListener.actionType = "selectPos";
            clickListener.actionType = "ignore";
            return;
    }
}

function showMsg(msg) {
    status.textContent = msg;
    if (!msg) return; // empty string / null
    msg = msg.trim().replaceAll("\n", "\n\t"); // more readable in history
    msgHistory.unshift(msg);
}

function keypressListener(e) {
    if ("12346789fhit,".indexOf(e.key) !== -1) showMsg("");

    switch (keypressListener.actionType) {
        case "shoot":
            shoot(player.pos, e.key);
            break;
        case "interact":
            interact(e.key);
            break;
        case "autoMove":
            if (e.key === "Escape") interruptAutoTravel = true;
            break;
        case "selectPos":
            selectPos(e.key);
            break;
        default:
            action(e.key, e.ctrlKey);
    }
}

function clickListener(e) {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
    if (!table.contains(e.target)) return;
    showMsg("");
    // get cursor position in relation to the player symbol and convert to drc
    const rect = area[player.pos[0]][player.pos[1]].getBoundingClientRect();
    const x = e.x - (rect.left + rect.width / 2);
    const y = e.y - (rect.top + rect.height / 2);
    const drc = pixelCoordsToDrc(y, x);

    switch (clickListener.actionType) {
        case "chooseDrc":
            switch (keypressListener.actionType) {
                case "shoot":
                    shoot(player.pos, drc);
                    break;
                case "interact":
                    interact(drc);
                    break;
            }
            break;
        case "ignore":
            return;
        default:
            if (e.ctrlKey) {
                if (e.target.tagName !== "TD") return;
                autoTravel(e.target.customProps.coords);
            } else {
                const newPos = player.pos.slice();
                movePosToDrc(newPos, drc);
                movePlayer(newPos);
                
                if (TURN_BASED) {
                    processTurn();
                } else {
                    renderAll(player, items, mobs, customRenders);
                }
            }
    }
}

function menuListener(e) {
    e.preventDefault();
    if (e.target.tagName !== "TD") return;
    menu.style.left = e.x + "px";
    menu.style.top = e.y + "px";
    menu.style.display = "block";

    const travelButton = document.getElementById("travelButton");
    const showInfoButton = document.getElementById("showInfoButton");
    travelButton.onclick = () => autoTravel(e.target.customProps.coords);
    showInfoButton.onclick = () => {
        let msg = "";

        if (!e.target.customProps.infoKeys.length) {
            msg += "[ ]: An unseen area\n";
        }
        for (let key of e.target.customProps.infoKeys) {
            msg += infoTable[key] + "\n";
        }
        showMsg(msg);
    };
}

function addListeners() {
    document.addEventListener("keydown", keypressListener);
    document.addEventListener("click", clickListener);
    document.addEventListener("contextmenu", menuListener);
}

function removeListeners() {
    document.removeEventListener("keydown", keypressListener);
    document.removeEventListener("click", clickListener);
    document.removeEventListener("contextmenu", menuListener);
}

function refer(obj) {
    if (referenced.indexOf(obj) === -1) referenced.push(obj);
    return obj;
}
