import { levelTiles } from "./levelData.js";
import {
    inputToDrc, isWall, movePosToDrc, relativeCoordsToDrc, getPosInfo
} from "./util.js";
import options from "./options.js";
import { mobileFix } from "./mobileFix.js";
import GameManager from "./gameManager.js";
import BuiltinDialogs from "./builtinDialogs.js";

// TODO: improve show info, fix mob towards straight line to ignore see-through walls, 
//       take multiple pages into account in pickup dialog
// NOTE: all coords are given as (y,x)
// NOTE: save and load can handle member functions, currently not needed
// NOTE: all references within "levels", "player", or "timeTracker" to other objects included
//       in each other must be done with "refer()" for saving to work properly

const menu = document.getElementById("clickMenu");
const showInfoButton = document.getElementById("showInfoButton");
const travelButton = document.getElementById("travelButton");
const travelInDrcButton = document.getElementById("travelInDrcButton");
const actInDrcButton = document.getElementById("actInDrcButton");
const inventoryButton = document.getElementById("inventoryButton");
const pickupButton = document.getElementById("pickupButton");
const historyButton = document.getElementById("historyButton");
const mobileInput = document.createElement("textarea");
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const keyIntervals = {}; // for key repeats when holding key
const gm = new GameManager(removeListeners, addListeners, keyIntervals);
const defaultOptions = localStorage.getItem("gameDefaultOptions");
let infoForMobileFix = { // use object to pass reference to mobileFix
    listenersActive: false,
    action: action
};

if (defaultOptions) {
    const newOptions = JSON.parse(defaultOptions);

    for (let key of Object.keys(newOptions)) {
        options[key] = newOptions[key];
    }
    gm.render.changeOptions(options);
}
if (MOBILE) mobileFix(mobileInput, infoForMobileFix);

// listeners that won't be removed
document.addEventListener("keyup", function(e) {
    clearInterval(keyIntervals[e.key]);
    delete keyIntervals[e.key];
});
// document.addEventListener("mousemove", mouseStyleListener);

const bd = new BuiltinDialogs(gm, start, removeListeners, (MOBILE && mobileInput));
bd.showStartDialog();

function start() {
    document.addEventListener("contextmenu", menuListener);
    gm.updateInfo();
    gm.render.renderAll(gm.player, gm.levels, gm.customRenders);
    gm.render.setBg(gm.levels);
    !options.TURN_BASED && clearInterval(gm.turnInterval); // clear turnInterval in case it was already running
    !options.TURN_BASED && (gm.turnInterval = setInterval(() => gm.processTurn(), options.TURN_DELAY));
    gm.tryFireEvent("onStart");
}

function addListeners() {
    document.addEventListener("keydown", keypressListener);
    document.addEventListener("mousedown", clickListener);
    menuListener.allowExtraActions = true;
    infoForMobileFix.listenersActive = true;
}

function removeListeners() {
    document.removeEventListener("keydown", keypressListener);
    document.removeEventListener("mousedown", clickListener);
    infoForMobileFix.listenersActive = false;
    menuListener.allowExtraActions = false;

    // remove currently active key repeats to disable continuing moving
    for (let key of Object.keys(keyIntervals)) {
        clearInterval(keyIntervals[key]);
        delete keyIntervals[key];
    }
}

async function setKeyRepeat(e) {
    await new Promise(r => setTimeout(r, options.TRAVEL_REPEAT_START_DELAY));
    
    // check that the keypress hasn't been stopped already (keyIntervals values are deleted on keyup)
    if (keyIntervals[e.key] === "tempVal") {
        keyIntervals[e.key] = setInterval(() => action(e.key, e.ctrlKey), options.TRAVEL_REPEAT_DELAY);
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
        keyIntervals[e.key] = "tempVal";
        setKeyRepeat(e);
        gm.ui.showMsg("");
    }
    action(e.key, e.ctrlKey);
}

function clickListener(e) {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
    if (e.target.id === "status" || e.target.parentNode?.id === "clickMenu"
        || e.target.dataset.ignoreClick || e.button !== 0 || gm.inputType === "selectPos") return;
    // get cursor position in relation to the player symbol and convert to drc
    const rect = gm.area[gm.player.pos[0]][gm.player.pos[1]].getBoundingClientRect();
    const x = e.x - (rect.left + rect.width / 2);
    const y = e.y - (rect.top + rect.height / 2);
    const drc = relativeCoordsToDrc(y, x);
    let doAutoTravel = false;
    
    if (e.altKey) {
        switch (gm.actType) {
            case "shoot":
                if (gm.timeTracker.turnsUntilShoot === 0) {
                    gm.shoot(gm.player.pos, drc);
                }
                break;
            case "melee":
                gm.melee(drc);
                break;
            case "interact":
                gm.interact(drc);
                break;
        }
        return;
    }
    gm.ui.showMsg("");
    
    if ((options.CTRL_CLICK_AUTOTRAVEL && e.ctrlKey) 
        || (!options.CTRL_CLICK_AUTOTRAVEL && !e.ctrlKey)
    ) {
        doAutoTravel = true;
    }
    if (doAutoTravel) {
        if (e.target.tagName !== "TD") return;
        gm.autoTravel(e.target.customProps.coords);
    } else {
        const newPos = gm.player.pos.slice();
        movePosToDrc(newPos, drc);
        gm.movePlayer(newPos);
        gm.updateAfterAction();
    }
}

function menuListener(e) {
    e.preventDefault();
    if (e.target.tagName !== "TD") return;
    menu.style.left = e.x + "px";
    menu.style.top = e.y + "px";
    menu.style.display = "block";
    if (menuListener.allowExtraActions) {
        if (e.target.customProps.infoKeys?.indexOf("Player") !== -1) {
            inventoryButton.style.display = "block";
            pickupButton.style.display = "block";
            historyButton.style.display = "block";
            inventoryButton.onmousedown = () => {
                showInventory();
                menu.style.display = "none";
            };
            pickupButton.onmousedown = () => {
                gm.pickup();
                menu.style.display = "none";
            };
            historyButton.onmousedown = () => {
                gm.ui.showMsgHistory();
                menu.style.display = "none";
            };
            travelButton.style.display = "none";
            travelInDrcButton.style.display = "none";
            actInDrcButton.style.display = "none";
        } else {
            travelButton.style.display = "block";
            travelInDrcButton.style.display = "block";
            actInDrcButton.style.display = "block";
            travelButton.onmousedown = () => {
                gm.autoTravel(e.target.customProps.coords);
                menu.style.display = "none";
            };
            travelInDrcButton.onmousedown = () => {
                const clickPos = e.target.customProps.coords;
                const facing = relativeCoordsToDrc(clickPos[0] - gm.player.pos[0], clickPos[1] - gm.player.pos[1]);
                const newPos = gm.player.pos.slice();
                movePosToDrc(newPos, facing);
                gm.movePlayer(newPos);
                menu.style.display = "none";
            };
            actInDrcButton.onmousedown = () => {
                const clickPos = e.target.customProps.coords;
                const facing = relativeCoordsToDrc(clickPos[0] - gm.player.pos[0], clickPos[1] - gm.player.pos[1]);
                doActType(facing);
                menu.style.display = "none";
            };
            inventoryButton.style.display = "none";
            pickupButton.style.display = "none";
            historyButton.style.display = "none";
        }
    } else {
        travelButton.style.display = "none";
        travelInDrcButton.style.display = "none";
        actInDrcButton.style.display = "none";
        inventoryButton.style.display = "none";
        pickupButton.style.display = "none";
        historyButton.style.display = "none";
    }
    showInfoButton.onmousedown = () => {
        gm.ui.showMsg(getPosInfo(e.target.customProps.infoKeys));
        menu.style.display = "none";
    };
}

// function mouseStyleListener(e) {
//     if (clickListener.actionType === "chooseDrc") {
//         const rect = area[player.pos[0]][player.pos[1]].getBoundingClientRect();
//         const x = e.x - (rect.left + rect.width / 2);
//         const y = e.y - (rect.top + rect.height / 2);
//         const drc = relativeCoordsToDrc(y, x);
//         document.body.style.cursor = {
//             1: "sw-resize",
//             2: "s-resize",
//             3: "se-resize",
//             4: "w-resize",
//             6: "e-resize",
//             7: "nw-resize",
//             8: "n-resize",
//             9: "ne-resize",
//         }[drc];
//     } else if (document.body.style.cursor !== "default") {
//         document.body.style.cursor = "default";
//     }
// }

function showInventory() {
    let contentNames = [];
    
    for (let item of gm.player.inventory) contentNames.push(item.name);

    if (contentNames.length !== 0) {
        gm.ui.showDialog("Contents of your inventory:", contentNames, itemIdx => {
            if (itemIdx < 0) return;
            gm.ui.showDialog("What do you want to do with \"" + contentNames[itemIdx] + "\"?", 
                       ["Drop"], actionIdx => {
                switch (actionIdx) {
                    case 0:
                        let item = gm.player.inventory.splice(itemIdx, 1)[0];
                        item.pos = gm.player.pos.slice();
                        gm.items.push(item);
                        gm.ui.showMsg("You drop \"" + contentNames[itemIdx] + "\".");
                        gm.processTurn();
                        break;
                }
            }, true, true, 1);
        }, true, true, 0);
    } else {
        gm.ui.showMsg("Your inventory is empty.");
    }
}

function doActType(actDrc) {
    switch (gm.actType) {
        case "shoot":
            if (gm.timeTracker.turnsUntilShoot === 0) {
                gm.shoot(gm.player.pos, actDrc);
            }
            break;
        case "melee":
            gm.melee(actDrc);
            break;
        case "interact":
            gm.interact(actDrc);
            break;
    }
}

function action(key, ctrl) {
    switch(gm.inputType) {
        case "autoMove":
            if (key === options.CONTROLS.ESC) gm.interruptAutoTravel = true;
            return;
        case "selectPos":
            gm.selectPos(inputToDrc(key, options));
            return;
    }
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
            let newPos = gm.player.pos.slice();
            let prevPos = null;

            if (ctrl) {
                while (gm.level[newPos[0]] && typeof gm.level[newPos[0]][newPos[1]] !== "undefined"
                        && (!isWall(gm.level[newPos[0]][newPos[1]]) || gm.level[newPos[0]][newPos[1]] === levelTiles.fakeWall)
                ) {
                    prevPos = newPos.slice();
                    movePosToDrc(newPos, drc);
                }
                prevPos && gm.autoTravel(prevPos); // last ok position
            } else {
                movePosToDrc(newPos, drc);
                gm.movePlayer(newPos);
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
            doActType(inputToDrc(key, options));
            return;
        case options.CONTROLS.ENTER:
            if (gm.level[gm.player.pos[0]][gm.player.pos[1]] === levelTiles.stairsDown 
                || gm.level[gm.player.pos[0]][gm.player.pos[1]] === levelTiles.stairsUp
            ) {
                gm.tryChangeLvl();
            } else {
                return;
            }
            break;
        case options.CONTROLS.ESC:
            bd.showPauseMenu();
            return;
        case options.CONTROLS.SHOOT:
            gm.actType = "shoot";
            gm.updateInfo();
            gm.ui.showMsg("Action type set to shoot.");
            return;
        case options.CONTROLS.HISTORY:
            gm.ui.showMsgHistory();
            return;
        case options.CONTROLS.INVENTORY:
            showInventory();
            return;
        case options.CONTROLS.MELEE:
            gm.actType = "melee";
            gm.updateInfo();
            gm.ui.showMsg("Action type set to melee.");
            return;
        case options.CONTROLS.INTERACT:
            gm.actType = "interact";
            gm.updateInfo();
            gm.ui.showMsg("Action type set to interact.");
            return;
        case options.CONTROLS.PICKUP:
            gm.pickup();
            break;
        case options.CONTROLS.INSPECT:
            gm.ui.showMsg("Move to a location to inspect. Use enter to select and esc to leave.");
            gm.inputType = "selectPos";
            gm.selectPos.currentPos = gm.player.pos.slice();
            break;
        default:
            return;
    }
    gm.updateAfterAction();
}
