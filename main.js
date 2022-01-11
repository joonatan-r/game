import { infoTable } from "./levelData.js";
import { addMobs } from "./mobData.js";
import { addItems } from "./itemData.js";
import events from "./eventData.js";
import {
    initialize, bresenham, isNextTo, coordsEq, inputToDrc, isWall, movePosToDrc, removeByReference, 
    pixelCoordsToDrc, makeTextFile, projectileFromDrc
} from "./util.js";
import { createNewLvl } from "./levelGeneration.js";
import { trySpawnMob, movingAIs } from "./mobs.js";
import Renderer from "./render.js";
import UI from "./UI.js";
import options from "./options.js";
import { mobileFix } from "./mobileFix.js";

// NOTE: all coords are given as (y,x)
// NOTE: save and load can handle member functions, currently not needed

// TODO: improve show info, fix mob towards straight line to ignore see-through walls, 
//       take multiple pages into account in pickup dialog
// NOTE: now keypressListener actionTypes for shoot, melee, interact no longer used.

const table = document.getElementById("table");
const info = document.getElementById("info");
const menu = document.getElementById("clickMenu");
const travelButton = document.getElementById("travelButton");
const showInfoButton = document.getElementById("showInfoButton");
const mobileInput = document.createElement("textarea");
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

let turnInterval = null;
let infoForMobileFix = { // use object to pass reference to mobileFix
    listenersActive: false,
    handleKeypress: handleKeypress
};

if (MOBILE) mobileFix(mobileInput, infoForMobileFix);

const area = [];
const rendered = [];
const msgHistory = [];
const keyIntervals = {}; // for key repeats when holding key
let timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 0;
let player = {};
player.maxHealth = 4;
player.health = player.maxHealth;
player.inventory = [];
player.pos = [9, 5];
let levels = {};

initialize(levels, table, area, rendered);

// NOTE: all references within "levels", "player", or "timeTracker" to other objects included
//       in each other must be done with "refer()" for saving to work properly
let level = levels[levels.currentLvl].level;
let mobs = levels[levels.currentLvl].mobs;
let items = levels[levels.currentLvl].items;
let customRenders = []; // for "animations" to not get erased
let referenced = []; // for retaining object references when saving
let interruptAutoTravel = false;
let autoTravelStack = []; // used to cancel previous autoTravels when there is a new one
const render = new Renderer(area, rendered);
const ui = new UI(removeListeners, addListeners, msgHistory);

addListeners();
showStartDialog();

const defaultOptions = localStorage.getItem("gameDefaultOptions");

if (defaultOptions) {
    const newOptions = JSON.parse(defaultOptions);

    for (let key of Object.keys(newOptions)) {
        options[key] = newOptions[key];
    }
    render.changeRenderOptions(options);
}

// added separately because never removed
document.addEventListener("keyup", function(e) {
    clearInterval(keyIntervals[e.key]);
    delete keyIntervals[e.key];
});
document.getElementById("loadInputFile").addEventListener("change", function() {
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
        player = loadData.player;
        timeTracker = loadData.timeTracker;
        ui.hideDialog(); // loading from start menu keeps dialog open (in case user cancels), this ensures it's closed
        start();
    };
    fr.readAsText(this.files[0]);
    this.value = null;
});

function start() {
    menuListener.allowTravel = true;
    document.addEventListener("contextmenu", menuListener);
    updateInfo();
    render.renderAll(player, levels, customRenders);
    tryFireEvent("start");
    !options.TURN_BASED && clearInterval(turnInterval); // clear turnInterval in case it was already running
    !options.TURN_BASED && (turnInterval = setInterval(() => processTurn(), options.TURN_DELAY));

    if (options.USE_BG_IMG) {
        if (levels[levels.currentLvl].bg.startsWith("#")) {
            table.style.backgroundColor = levels[levels.currentLvl].bg;
        } else {
            table.style.backgroundImage = levels[levels.currentLvl].bg;
        }
    } else {
        table.style.backgroundColor = "#000";
    }
}

function showStartDialog() {
    ui.showDialog("Start", ["New game", "Load game", "Options", "Controls", "Save configs as default"], idx => {
        switch (idx) {
            case 0:
                addMobs(levels);
                addItems(levels);
                start();
                break;
            case 1:
                load();
                showStartDialog();
                break;
            case 2:
                showOptionsDialog();
                break;
            case 3:
                showControlsDialog();
                break;
            case 4:
                localStorage.setItem("gameDefaultOptions", JSON.stringify(options));
                ui.showMsg("Saved default options");
                showStartDialog();
                break;
        }
    }, false, true, 0);
}

function showOptionsDialog(startPage) {
    const optKeys = [...Object.keys(options)];
    removeByReference(optKeys, "CONTROLS");
    const optList = [...optKeys];
    
    for (let i = 0; i < optList.length; i++) {
        optList[i] += ": " + options[optList[i]];
    }
    ui.showDialog("Options", optList, idx => {
        let opt = options[optKeys[idx]];

        if (typeof opt === "number") {
            let input = "";
            const inputListener = e => {
                if (e.key === "Escape") {
                    input = "";
                    document.removeEventListener("keydown", inputListener);
                    addListeners();
                    ui.showMsg("");
                    showOptionsDialog(Math.ceil((idx+1) / 9) - 1); // refresh but show the same page again
                } else if (e.key === "Enter") {
                    const val = Number(input);

                    if (val > 10) {
                        options[optKeys[idx]] = val;
                    }
                    input = "";
                    document.removeEventListener("keydown", inputListener);
                    addListeners();
                    ui.showMsg("");
                    showOptionsDialog(Math.ceil((idx+1) / 9) - 1);
                } else {
                    input += e.key;
                    ui.showMsg("New value: " + input);
                }
            };
            removeListeners();
            document.addEventListener("keydown", inputListener);
            ui.showMsg("Type the new value. Enter to accept and escape to cancel.");
        } else if (typeof opt === "boolean") {
            options[optKeys[idx]] = !opt;
            showOptionsDialog(Math.ceil((idx+1) / 9) - 1);
        }
        render.changeRenderOptions(options);
    }, false, true, -1, startPage);
}

function showControlsDialog(startPage) {
    const optKeys = [...Object.keys(options.CONTROLS)];
    const optList = [...Object.keys(options.CONTROLS)];
    
    for (let i = 0; i < optList.length; i++) {
        optList[i] += ": \"" + options.CONTROLS[optList[i]] + "\"";
    }
    ui.showDialog("Controls", optList, idx => {
        const changeInput = e => {
            ui.showMsg("");

            for (let [key, val] of Object.entries(options.CONTROLS)) {
                if ((val === e.key && key !== optKeys[idx])) {
                    document.removeEventListener("keydown", changeInput);
                    addListeners();
                    ui.showMsg("Error, \"" + e.key + "\" is already in use");
                    showControlsDialog(Math.ceil((idx+1) / 9) - 1);
                    return;
                }
            }
            options.CONTROLS[optKeys[idx]] = e.key;
            document.removeEventListener("keydown", changeInput);
            addListeners();
            showControlsDialog(Math.ceil((idx+1) / 9) - 1);
        };
        const mobileChangeInput = () => {
            ui.showMsg("");

            for (let [key, val] of Object.entries(options.CONTROLS)) {
                if ((val === mobileInput.value && key !== optKeys[idx])) {
                    mobileInput.removeEventListener("input", mobileChangeInput);
                    addListeners();
                    ui.showMsg("Error, \"" + mobileInput.value + "\" is already in use");
                    mobileInput.value = "";
                    showControlsDialog(Math.ceil((idx+1) / 9) - 1);
                    return;
                }
            }
            options.CONTROLS[optKeys[idx]] = mobileInput.value.toLowerCase();
            mobileInput.removeEventListener("input", mobileChangeInput);
            addListeners();
            mobileInput.value = "";
            showControlsDialog(Math.ceil((idx+1) / 9) - 1);
        };
        removeListeners();

        if (MOBILE) {
            mobileInput.addEventListener("input", mobileChangeInput);
        } else {
            document.addEventListener("keydown", changeInput);
        }
        ui.showMsg("Press the new input for \"" + optKeys[idx] + "\"");
    }, false, true, -1, startPage);
}

function save() {
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
}

function load() {
    removeListeners(); // don't trigger click listener here
    document.getElementById("loadInputFile").click();
    addListeners();
}

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
        || level[pos[0]][pos[1]] === "*w"
        || level[pos[0]][pos[1]] === "*s"
        || level[pos[0]][pos[1]] === "*t"
    ) {
        return false;
    }
    return true;
}

function tryFireEvent(type, entity) {
    const currentState = {
        items: items,
        mobs: mobs,
        levels: levels,
        level: level,
        player: player,
        timeTracker: timeTracker,
        setPause: setPause
    };

    if (typeof entity === "undefined" && events[type]) {
        events[type](ui, currentState);
    } else if (events[type] && events[type][entity.name]) {
        events[type][entity.name](entity, ui, currentState);
    }
}

function changePlayerHealth(amount) {
    let newHealth = player.health + amount;
    if (newHealth < 1) {
        gameOver("You take a fatal hit. You die...");
        return;
    }
    if (newHealth > player.maxHealth) {
        newHealth = player.maxHealth;
    }
    if (amount < 0) {
        ui.showMsg("You are hit!");
    } else if (amount > 0) {
        if (player.health !== player.maxHealth) {
            ui.showMsg("You feel better.");
        }
    }
    player.health = newHealth;
}

function gameOver(msg) {
    ui.showMsg(msg);
    !options.TURN_BASED && clearInterval(turnInterval);
    interruptAutoTravel = true;
    removeListeners();
    player.dead = true;
    render.renderAll(player, levels, customRenders);

    for (let key of Object.keys(keyIntervals)) {
        clearInterval(keyIntervals[key]);
        delete keyIntervals[key];
    }
}

function showMsgHistory(startPage) {
    if (msgHistory.length) {
        ui.showDialog("Message history:", msgHistory, idx => {
            if (idx < 0) return;
            showMsgHistory(Math.ceil((idx+1) / 9) - 1); // simply shows the history again on the same page
        }, true, true, null, startPage);
    }
}

function updateInfo() {
    const timeWord = options.TURN_BASED ? "\nTurn: " : "\nTime: ";
    info.textContent = "Level: " + levels.currentLvl + timeWord + timeTracker.timer 
                       + "\nHealth: " + player.health + "\nSelected action: " + action.actType + "\n";

    if (timeTracker.turnsUntilShoot > 0 && action.actType === "shoot") {
        info.textContent += "Cooldown: " + timeTracker.turnsUntilShoot;
    }
}

function processTurn() {
    timeTracker.timer++;
    if (timeTracker.turnsUntilShoot > 0) timeTracker.turnsUntilShoot--;
    updateInfo();

    for (let mob of mobs) {
        if (!options.TURN_BASED && timeTracker.timer % mob.speedModulus < 1) {
            continue;
        }
        if (mob.isHostile && isNextTo(player.pos, mob.pos)) {
            changePlayerHealth(-3);
            continue;
        }
        movingAIs[mob.movingFunction](mob, posIsValid, level, rendered);

        if (mob.isShooter && mob.straightLineToTargetDrc) {
            shoot(mob.pos, mob.straightLineToTargetDrc, true);
        } else {
            mob.pos = [mob.target[0], mob.target[1]];
        }
    }
    render.renderAll(player, levels, customRenders);

    if (options.INTERRUPT_AUTOTRAVEL_IF_MOBS) {
        for (let mob of mobs) {
            if (mob.isHostile && rendered[mob.pos[0]][mob.pos[1]]) {
                interruptAutoTravel = true;
                break;
            }
        }
    }
    let mob = trySpawnMob(levels, rendered);

    if (mob !== null) {
        mob.huntingTarget = refer(player);
        mobs.push(mob);
    }
}

async function shoot(fromPos, drc, mobIsShooting) {
    const currLvl = levels.currentLvl;
    const icon = projectileFromDrc[drc];
    let bulletPos = fromPos.slice();
    let obj;
    options.TURN_BASED && (interruptAutoTravel = true);
    options.TURN_BASED && removeListeners();
    !mobIsShooting && (timeTracker.turnsUntilShoot = 10);

    const checkHits = (checkPos) => {
        if (coordsEq(checkPos, player.pos)) {
            changePlayerHealth(-1);
            removeByReference(customRenders, obj);
            render.renderAll(player, levels, customRenders);
            render.shotEffect(checkPos, player, levels, customRenders);
            return true;
        }
        for (let i = 0; i < mobs.length; i++) {
            if (coordsEq(checkPos, mobs[i].pos)) {
                // delete all properties of mob, so all references to it recognize deletion
                for (let prop in mobs[i]) if (mobs[i].hasOwnProperty(prop)) delete mobs[i][prop];
                mobs.splice(i, 1);
                removeByReference(customRenders, obj);
                render.renderAll(player, levels, customRenders);
                render.shotEffect(checkPos, player, levels, customRenders);
                !player.dead && options.TURN_BASED && addListeners();
                !mobIsShooting && processTurn();
                return true;
            }
        }
        return false;
    };
    
    while (1) {
        const prevPos = coordsEq(bulletPos, fromPos) ? [] : bulletPos.slice();
        render.renderAll(player, levels, customRenders);
        movePosToDrc(bulletPos, drc);

        if (!level[bulletPos[0]] || typeof level[bulletPos[0]][bulletPos[1]] === "undefined" 
            || level[bulletPos[0]][bulletPos[1]] === "*w"
        ) {
            if (options.TURN_BASED) {
                !player.dead && addListeners();
                !mobIsShooting && processTurn();
            }       
            return;
        }
        if (rendered[bulletPos[0]][bulletPos[1]]) {
            area[bulletPos[0]][bulletPos[1]].textContent = icon;
        }
        obj = { symbol: icon, pos: [bulletPos[0], bulletPos[1]] };
        customRenders.push(obj);
        
        await new Promise(r => setTimeout(r, 30));
        if (levels.currentLvl !== currLvl) return;
        
        // if not checking previous position, mobs can sometimes walk "through" bullets
        if (checkHits(bulletPos) || checkHits(prevPos)) return;
        removeByReference(customRenders, obj);
    }
}

function melee(drc) {
    let meleePos = player.pos.slice();
    movePosToDrc(meleePos, drc);
    processTurn(); // takes an extra turn
    
    if (player.dead) return;

    for (let i = 0; i < mobs.length; i++) {
        if (coordsEq(meleePos, mobs[i].pos)) {
            ui.showMsg("You hit " + mobs[i].name + "!");
            for (let prop in mobs[i]) if (mobs[i].hasOwnProperty(prop)) delete mobs[i][prop];
            mobs.splice(i, 1);
        }
    }
    processTurn();
}

function interact(drc) {
    let interactPos = player.pos.slice();
    movePosToDrc(interactPos, drc);

    for (let mob of mobs) {
        if (coordsEq(interactPos, mob.pos)) tryFireEvent("onInteract", mob);
    }
    for (let item of items) {
        if (coordsEq(interactPos, item.pos)) tryFireEvent("onInteract", item);
    }
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
            ui.showMsg(msg);
            return;
        }
    }
}

function pickup(alwaysDialog) {
    for (let i = 0; i < items.length; i++) {
        if (coordsEq(player.pos, items[i].pos)) {
            let itemsHere = [];
            let itemNames = [];
            let itemIdxs = [];

            for (let j = 0; j < items.length; j++) {
                if (coordsEq(items[i].pos, items[j].pos) && !items[j].hidden) {
                    itemsHere.push(items[j]); // i is also included here
                    itemNames.push(items[j].name);
                    itemIdxs.push(j);
                }
            }
            if (itemsHere.length > 1 || alwaysDialog) {
                ui.showDialog("What do you want to pick up?", itemNames, idx => {
                    if (idx < 0) return;
                    const removed = items.splice(itemIdxs[idx], 1)[0];
                    player.inventory.push(removed);
                    ui.showMsg("You pick up " + removed.name + ".");
                    pickup(true); // allow picking up several items from the "same" dialog
                }, true, true);
            } else {
                const removed = items.splice(i, 1)[0];
                player.inventory.push(removed);
                ui.showMsg("You pick up " + removed.name + ".");
            }
            break;
        }
    }
}

function tryChangeLvl() {
    const tps = levels[levels.currentLvl].travelPoints;

    for (let lvl of Object.keys(tps)) {
        let idx = 0; // for tracking which point in lvl to travel to if several

        for (let coords of tps[lvl]) {
            if (coordsEq(coords, player.pos)) {
                if (typeof levels[lvl] === "undefined") {
                    createNewLvl(levels, level, player);
                }
                level = levels[lvl].level;
                player.pos = levels[lvl].travelPoints[levels.currentLvl][idx].slice();
                mobs = levels[lvl].mobs;
                items = levels[lvl].items;
                levels.currentLvl = lvl;
                customRenders = [];

                if (options.USE_BG_IMG) {
                    if (levels[levels.currentLvl].bg.startsWith("#")) {
                        table.style.backgroundColor = levels[levels.currentLvl].bg;
                        table.style.backgroundImage = "";
                    } else {
                        table.style.backgroundImage = levels[levels.currentLvl].bg;
                    }
                } else {
                    table.style.backgroundColor = "#000";
                }
                return;
            }
            idx++;
        }
    }
}

function showPauseMenu() {
    setPause(true);
    ui.showDialog("Pause Menu", ["Save", "Load"], idx => {
        switch (idx) {
            case 0:
                save();
                break;
            case 1:
                load();
                break;
        }
        setPause(false);
    }, true, true);
}

action.actType = "shoot";

function action(key, ctrl) {
    switch (key) {
        case options.CONTROLS.BOTTOM_LEFT:
        case options.CONTROLS.BOTTOM:
        case options.CONTROLS.BOTTOM_RIGHT:
        case options.CONTROLS.LEFT:
        case options.CONTROLS.RIGHT:
        case options.CONTROLS.TOP_LEFT:
        case options.CONTROLS.TOP:
        case options.CONTROLS.TOP_RIGHT:
            const drc = inputToDrc(key, options);
            let newPos = player.pos.slice();
            let prevPos = null;

            if (ctrl) {
                while (level[newPos[0]] && typeof level[newPos[0]][newPos[1]] !== "undefined"
                        && (!isWall(level[newPos[0]][newPos[1]]) || level[newPos[0]][newPos[1]] === "*f")
                ) {
                    prevPos = newPos.slice();
                    movePosToDrc(newPos, drc);
                }
                prevPos && autoTravel(prevPos); // last ok position
            } else {
                movePosToDrc(newPos, drc);
                movePlayer(newPos);
            }
            break;
        case options.CONTROLS.ACT_BOTTOM_LEFT:
        case options.CONTROLS.ACT_BOTTOM:
        case options.CONTROLS.ACT_BOTTOM_RIGHT:
        case options.CONTROLS.ACT_LEFT:
        case options.CONTROLS.ACT_RIGHT:
        case options.CONTROLS.ACT_TOP_LEFT:
        case options.CONTROLS.ACT_TOP:
        case options.CONTROLS.ACT_TOP_RIGHT:
            const actDrc = inputToDrc(key, options);

            switch (action.actType) {
                case "shoot":
                    if (timeTracker.turnsUntilShoot === 0) {
                        shoot(player.pos, actDrc);
                    }
                    break;
                case "melee":
                    melee(actDrc);
                    break;
                case "interact":
                    interact(actDrc);
                    break;
            }
            return;
        case options.CONTROLS.ENTER:
            if (level[player.pos[0]][player.pos[1]] === ">" || level[player.pos[0]][player.pos[1]] === "<") {
                tryChangeLvl();
            } else {
                return;
            }
            break;
        case options.CONTROLS.ESC:
            showPauseMenu();
            return;
        case options.CONTROLS.SHOOT:
            action.actType = "shoot";
            updateInfo();
            ui.showMsg("Action type set to shoot.");
            return;
        case options.CONTROLS.HISTORY:
            showMsgHistory();
            return;
        case options.CONTROLS.INVENTORY:
            let contentNames = [];
            
            for (let item of player.inventory) contentNames.push(item.name);

            if (contentNames.length !== 0) {
                ui.showDialog("Contents of your inventory:", contentNames, itemIdx => {
                    if (itemIdx < 0) return;
                    ui.showDialog("What do you want to do with \"" + contentNames[itemIdx] + "\"?", 
                               ["Drop"], actionIdx => {
                        switch (actionIdx) {
                            case 0:
                                let item = player.inventory.splice(itemIdx, 1)[0];
                                item.pos = player.pos.slice();
                                items.push(item);
                                ui.showMsg("You drop \"" + contentNames[itemIdx] + "\".");
                                processTurn();
                                break;
                        }
                    }, true, true, 1);
                }, true, true, 0);
            } else {
                ui.showMsg("Your inventory is empty.");
            }
            return;
        case options.CONTROLS.MELEE:
            action.actType = "melee";
            updateInfo();
            ui.showMsg("Action type set to melee.");
            return;
        case options.CONTROLS.INTERACT:
            action.actType = "interact";
            updateInfo();
            ui.showMsg("Action type set to interact.");
            return;
        case options.CONTROLS.PICKUP:
            pickup();
            break;
        case options.CONTROLS.INSPECT:
            ui.showMsg("Move to a location to inspect. Use enter to select and esc to leave.");
            keypressListener.actionType = "selectPos";
            clickListener.actionType = "ignore";
            selectPos.currentPos = player.pos.slice();
            break;
        default:
            return;
    }
    if (options.TURN_BASED) {
        processTurn();
    } else {
        render.renderAll(player, levels, customRenders);
    }
}

async function autoTravel(coords) {
    const coordsList = [];
    const lvl = levels.currentLvl;
    const idx = autoTravelStack.length;
    autoTravelStack.push(true);

    for (let i = 0; i < idx; i++) {
        autoTravelStack[i] = false; // stop previous autoTravels
    }
    interruptAutoTravel = false;
    keypressListener.actionType = "autoMove";
    bresenham(player.pos[0], player.pos[1], coords[0], coords[1], 
            (y, x) => {
                if (level[y] && isWall(level[y][x]) && level[y][x] !== "*f") {
                    return "stop";
                }
                coordsList.push([y, x]);
                return "ok";
            }
    );
    coordsList.shift(); // first element is the player's start position

    for (let coord of coordsList) {
        // new coord may not be next to player if e.g. a mob blocks the way
        if (!autoTravelStack[idx] || interruptAutoTravel || levels.currentLvl !== lvl || !isNextTo(player.pos, coord)) {
            keypressListener.actionType = null;
            return;
        }
        movePlayer(coord);
        
        if (options.TURN_BASED) {
            processTurn();
        } else {
            render.renderAll(player, levels, customRenders);
        }
        await new Promise(r => setTimeout(r, options.AUTOTRAVEL_REPEAT_DELAY));
    }
    keypressListener.actionType = null;
    autoTravelStack = [];
}

function showPosInfo(infoKeys) {
    let msg = "";

    if (!infoKeys.length) {
        msg += "[ ]: An unseen area\n";
    }
    for (let key of infoKeys) {
        if (key === ".") continue; // ignore floor
        if (typeof infoTable[key] !== "undefined") {
            msg += infoTable[key] + "\n";
        } else {
            msg += "No info\n";
        }
    }
    if (msg === "") msg = "No info";
    ui.showMsg(msg);
}

function selectPos(drc) {
    let prevPos = selectPos.currentPos.slice();

    switch (drc) {
        case 4:
        case 6:
        case 8:
        case 2:
        case 7:
        case 1:
        case 9:
        case 3:
            movePosToDrc(selectPos.currentPos, drc);

            if (!level[selectPos.currentPos[0]] 
                || typeof level[selectPos.currentPos[0]][selectPos.currentPos[1]] === "undefined"
            ) {
                selectPos.currentPos = prevPos;
            }
            area[prevPos[0]][prevPos[1]].classList.remove("selected");
            area[selectPos.currentPos[0]][selectPos.currentPos[1]].classList.add("selected");
            break;
        case options.CONTROLS.ENTER:
            showPosInfo(area[selectPos.currentPos[0]][selectPos.currentPos[1]].customProps.infoKeys);
            break;
        case options.CONTROLS.ESC:
            ui.showMsg("");
            area[prevPos[0]][prevPos[1]].classList.remove("selected");
            keypressListener.actionType = null;
            clickListener.actionType = null;
            return;
    }
}

function handleKeypress(key, ctrl) {
    switch (keypressListener.actionType) {
        case "shoot":
            shoot(player.pos, inputToDrc(key, options));
            break;
        case "melee":
            melee(inputToDrc(key, options));
            break;
        case "interact":
            interact(inputToDrc(key, options));
            break;
        case "autoMove":
            if (key === options.CONTROLS.ESC) interruptAutoTravel = true;
            break;
        case "selectPos":
            selectPos(inputToDrc(key, options));
            break;
        default:
            action(key, ctrl);
    }
}

async function setKeyRepeat(e) {
    await new Promise(r => setTimeout(r, options.TRAVEL_REPEAT_START_DELAY));
    
    // check that the keypress hasn't been stopped already (keyIntervals values are deleted on keyup)
    if (keyIntervals[e.key] === "tempVal") {
        keyIntervals[e.key] = setInterval(() => handleKeypress(e.key, e.ctrlKey), options.TRAVEL_REPEAT_DELAY);
    }
}

function keypressListener(e) {
    if (Object.keys(keyIntervals).indexOf(e.key) !== -1) {
        return;
    }
    const moveKeyList = [options.CONTROLS.BOTTOM_LEFT, options.CONTROLS.BOTTOM, options.CONTROLS.BOTTOM_RIGHT,
                         options.CONTROLS.LEFT, options.CONTROLS.RIGHT, options.CONTROLS.TOP_LEFT, 
                         options.CONTROLS.TOP, options.CONTROLS.TOP_RIGHT];

    if (moveKeyList.indexOf(e.key) !== -1) {
        // enable key repeating only for moving
        if (!keypressListener.actionType) {
            keyIntervals[e.key] = "tempVal";
            setKeyRepeat(e);
        }
        ui.showMsg("");
    }
    handleKeypress(e.key, e.ctrlKey);
}

function clickListener(e) {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
    if (e.target.id === "status" || e.target.id === "showInfoButton" || e.target.id === "travelButton" 
        || e.target.dataset.ignoreClick || e.button !== 0) return;
    ui.showMsg("");
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
                case "melee":
                    melee(drc);
                    break;
                case "interact":
                    interact(drc);
                    break;
            }
            break;
        case "ignore":
            return;
        default:
            let doAutoTravel = false;
            
            if ((options.CTRL_CLICK_AUTOTRAVEL && e.ctrlKey) 
                || (!options.CTRL_CLICK_AUTOTRAVEL && !e.ctrlKey)
            ) {
                doAutoTravel = true;
            }
            if (doAutoTravel) {
                if (e.target.tagName !== "TD") return;
                autoTravel(e.target.customProps.coords);
            } else {
                const newPos = player.pos.slice();
                movePosToDrc(newPos, drc);
                movePlayer(newPos);
                
                if (options.TURN_BASED) {
                    processTurn();
                } else {
                    render.renderAll(player, levels, customRenders);
                }
            }
    }
}

function setPause(val) {
    if (options.TURN_BASED) return;
    if (val && !setPause.paused) {
        // wait a turn first so no abuse
        setTimeout(() => {
            clearInterval(turnInterval);
            setPause.paused = true;
            interruptAutoTravel = true;
        }, options.TURN_DELAY);
    } else if (setPause.paused) {
        turnInterval = setInterval(() => processTurn(), options.TURN_DELAY);
        setPause.paused = false;
    }
}

function menuListener(e) {
    e.preventDefault();
    if (e.target.tagName !== "TD") return;
    menu.style.left = e.x + "px";
    menu.style.top = e.y + "px";
    menu.style.display = "block";
    if (menuListener.allowTravel) {
        travelButton.style.display = "block";
        travelButton.onmousedown = () => {
            autoTravel(e.target.customProps.coords);
            menu.style.display = "none";
        };
    } else {
        travelButton.style.display = "none";
    }
    showInfoButton.onmousedown = () => {
        showPosInfo(e.target.customProps.infoKeys);
        menu.style.display = "none";
    };
}

function mouseStyleListener(e) {
    if (clickListener.actionType === "chooseDrc") {
        const rect = area[player.pos[0]][player.pos[1]].getBoundingClientRect();
        const x = e.x - (rect.left + rect.width / 2);
        const y = e.y - (rect.top + rect.height / 2);
        const drc = pixelCoordsToDrc(y, x);
        document.body.style.cursor = {
            1: "sw-resize",
            2: "s-resize",
            3: "se-resize",
            4: "w-resize",
            6: "e-resize",
            7: "nw-resize",
            8: "n-resize",
            9: "ne-resize",
        }[drc];
    } else if (document.body.style.cursor !== "default") {
        document.body.style.cursor = "default";
    }
}

function addListeners() {
    document.addEventListener("keydown", keypressListener);
    document.addEventListener("mousedown", clickListener);
    document.addEventListener("mousemove", mouseStyleListener);
    menuListener.allowTravel = true;
    infoForMobileFix.listenersActive = true;
}

function removeListeners() {
    document.removeEventListener("keydown", keypressListener);
    document.removeEventListener("mousedown", clickListener);
    document.removeEventListener("mousemove", mouseStyleListener);
    infoForMobileFix.listenersActive = false;
    menuListener.allowTravel = false;

    // remove currently active key repeats to disable continuing moving
    for (let key of Object.keys(keyIntervals)) {
        clearInterval(keyIntervals[key]);
        delete keyIntervals[key];
    }
}

function refer(obj) {
    if (referenced.indexOf(obj) === -1) referenced.push(obj);
    return obj;
}
