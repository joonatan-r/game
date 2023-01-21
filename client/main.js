import { levelTiles } from "./levelData.js";
import {
    inputToDrc, isWall, movePosToDrc, relativeCoordsToDrc, getPosInfo, getAdjacentOrthogonalDirections, itemNameWithNumber, coordsEq, addOrReplaceCss, loadFromText
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

const KEY_IS_PRESSED = "keyIsPressed";

const playerVisual = document.getElementById("playerImg");
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
const onNextKeyIntervals = {};
const mergedKeys = {}; // for replacing two orthogonal inputs with the diagonal
const pressedKeys = {};
const drcPressTimes = {}; // for keeping track of when directions were last pressed
const gm = new GameManager(removeListeners, addListeners, keyIntervals);
const defaultOptions = localStorage.getItem("gameDefaultOptions");
let infoForMobileFix = { // use object to pass reference to mobileFix
    listenersActive: false,
    action: action
};
let isFirstMove = true;
let prevPlayerPos = gm.player.pos.slice();

if (defaultOptions) {
    const newOptions = JSON.parse(defaultOptions);

    for (let key of Object.keys(newOptions)) {
        options[key] = newOptions[key];
    }
    gm.render.changeOptions(options);
    // use the more specific "body p" to override "p" font size but retain its other attributes
    addOrReplaceCss("body p", "body p {font-size:" + options.FONT_SIZE + "px;}");
}
if (MOBILE) mobileFix(mobileInput, infoForMobileFix);

// listeners that won't be removed
document.addEventListener("keyup", function(e) {
    clearKeyRepeat(e.key);
    delete keyIntervals[e.key];
    delete pressedKeys[e.key];

    if (Object.keys(mergedKeys).indexOf(e.key) !== -1) {
        const merged = mergedKeys[e.key].merged;
        const other = mergedKeys[e.key].other;
        // shouldn't need this but without it a bug can happen where
        // an interval gets stuck without being cleared
        clearKeyRepeat(other);
        delete keyIntervals[other];
        delete mergedKeys[e.key];
        // if other already added as part of another merge, ignore rest
        if (mergedKeys[other].other !== e.key) return;
        delete mergedKeys[other];
        if (Object.keys(pressedKeys).indexOf(other) !== -1
            && infoForMobileFix.listenersActive // TODO: refactor a more suitable variable
        ) {
            onNextKeyIntervals[merged] = () => {
                delete onNextKeyIntervals[merged];
                clearKeyRepeat(merged);
                delete keyIntervals[merged];
                // only start interval if still pressed and listeners active
                if (Object.keys(pressedKeys).indexOf(other) !== -1
                    && infoForMobileFix.listenersActive // TODO: refactor a more suitable variable
                ) {
                    action(other, false);
                    setKeyRepeatImmediate(other, false);
                }
            };
        }
    }
});
// document.addEventListener("mousemove", mouseStyleListener);

// const bd = new BuiltinDialogs(gm, start, removeListeners, (MOBILE && mobileInput));
// bd.showStartDialog();

// ----------------------------------------------------------

const socket = new WebSocket('ws://' + window.location.host);

// wait until connected

await new Promise(resolve => {
    socket.addEventListener('open', (event) => {
        resolve();
    });
    socket.addEventListener('message', (event) => {
        console.log('Message from server ', event.data);
    });
});

// TODO: add customRenders to load? what about "referenced", "mobsUsingVisualTimeout"?

fetch(window.location.origin + "/world")
    .then(r => r.text())
    .then(r => {
        loadFromText(r, (loadData) => {
            gm.levels = loadData.levels;
            gm.level = gm.levels[gm.levels.currentLvl].level;
            gm.mobs = gm.levels[gm.levels.currentLvl].mobs;
            gm.items = gm.levels[gm.levels.currentLvl].items;
            gm.player = loadData.player;
            gm.timeTracker = loadData.timeTracker;
            start();
        });
        socket.send(JSON.stringify({ type: "loaded" }));
    });

// simulate delay
// await new Promise(r => setTimeout(r, 5000));
// socket.send(JSON.stringify({ type: "loaded" }));

// ----------------------------------------------------------

function start() {
    document.addEventListener("contextmenu", menuListener);
    gm.updateInfo();
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    let posAtScreenCenter;
    let tdRectAtScreenCenter;

    for (let i = 0; i < gm.level.length; i++) {
        for (let j = 0; j < gm.level[0].length; j++) {
            const td = gm.area[i][j];
            const rect = td.getBoundingClientRect();
            if (rect.x < screenCenterX && rect.x + rect.width > screenCenterX
                && rect.y < screenCenterY && rect.y + rect.height > screenCenterY
            ) {
                posAtScreenCenter = td.customProps.coords.slice();
                tdRectAtScreenCenter = td.getBoundingClientRect();
                break;
            }
        }
    }
    if (!posAtScreenCenter || !tdRectAtScreenCenter) {
        // use level center if no pos at screen center
        posAtScreenCenter = [Math.floor(gm.level.length / 2), Math.floor(gm.level[0].length / 2)];
        tdRectAtScreenCenter = Array.from(
            document.getElementsByTagName("TD")).filter(
                td => coordsEq(td.customProps.coords, posAtScreenCenter)
            )[0]
                .getBoundingClientRect();
    }
    if (options.OBJ_IMG) {
        playerVisual.style.top = tdRectAtScreenCenter.top + "px";
        playerVisual.style.left = tdRectAtScreenCenter.left + "px";
        playerVisual.style.backgroundImage = "url(\"./playerImages/player_" + gm.player.image + ".png\")";
    }
    if (options.KEEP_PLAYER_CENTERED) {
        gm.centerPlayer(posAtScreenCenter, gm.player.pos, true);
    } else {
        gm.movePlayerVisual(posAtScreenCenter, gm.player.pos, true);
    }
    gm.render.renderAll(gm.player, gm.levels, gm.customRenders);
    gm.render.setBg(gm.levels);
    // !options.TURN_BASED && clearInterval(gm.turnInterval); // clear turnInterval in case it was already running
    // !options.TURN_BASED && (gm.turnInterval = setInterval(() => gm.processTurn(), options.TURN_DELAY));
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
        // NOTE: not using clearKeyRepeat to not execute any callbacks
        clearInterval(keyIntervals[key]);
        delete keyIntervals[key];
    }
}

function bothMergeKeysPressed(key) {
    switch (key) {
        case options.CONTROLS.BOTTOM_LEFT:
            if (Object.keys(pressedKeys).indexOf(options.CONTROLS.BOTTOM) !== -1 
                && Object.keys(pressedKeys).indexOf(options.CONTROLS.LEFT) !== -1) return true;
            break;
        case options.CONTROLS.BOTTOM_RIGHT:
            if (Object.keys(pressedKeys).indexOf(options.CONTROLS.BOTTOM) !== -1 
                && Object.keys(pressedKeys).indexOf(options.CONTROLS.RIGHT) !== -1) return true;
            break;
        case options.CONTROLS.TOP_LEFT:
            if (Object.keys(pressedKeys).indexOf(options.CONTROLS.TOP) !== -1 
                && Object.keys(pressedKeys).indexOf(options.CONTROLS.LEFT) !== -1) return true;
            break;
        case options.CONTROLS.TOP_RIGHT:
            if (Object.keys(pressedKeys).indexOf(options.CONTROLS.TOP) !== -1 
                && Object.keys(pressedKeys).indexOf(options.CONTROLS.RIGHT) !== -1) return true;
            break;
    }
    return false;
}

function mergeIfOrthogonalKeysPressed(e) {
    if (!options.CONVERT_ORTHOG_INPUTS_TO_DIAG) {
        return false;
    }
    const mergeKeys = (key, other, merged) => {
        if (options.IMMEDIATE_DIAG_MOVE_WHEN_CONVERTING_ORTHOG || isFirstMove) {
            // If it is the first move, player started movement by pressing the orthogonal
            // keys almost at the same time. The movement from the first has already happened,
            // so the first move here should be to the other direction to preserve consistent motion.
            // However, if the first move was blocked (player didn't move), the move should also be diagonal.
            if (isFirstMove 
                && (gm.player.pos[0] - prevPlayerPos[0] !== 0 || gm.player.pos[1] - prevPlayerPos[1] !== 0)
            ) {
                action(key, e.ctrlKey);
            } else {
                action(merged, e.ctrlKey);
            }
            if (Object.keys(mergedKeys).indexOf(other) !== -1) { // if still part of previous merge, clear it
                const prevMerged = mergedKeys[other].merged;
                const prevOther = mergedKeys[other].other;
                clearKeyRepeat(prevMerged);
                delete keyIntervals[prevMerged];
                clearKeyRepeat(prevOther);
                delete keyIntervals[prevOther];
                delete mergedKeys[other];
                delete mergedKeys[prevOther];
            }
            clearKeyRepeat(other);
            delete keyIntervals[other];
            setKeyRepeatImmediate(merged, e.ctrlKey);
            mergedKeys[key] = {
                other,
                merged
            }
            mergedKeys[other] = {
                other: key,
                merged
            }
        } else {
            onNextKeyIntervals[other] = () => {
                delete onNextKeyIntervals[other];
                action(merged, e.ctrlKey);
                // only start interval if still pressed and listeners active
                if (bothMergeKeysPressed(merged)
                    && infoForMobileFix.listenersActive // TODO: refactor a more suitable variable
                ) {
                    if (Object.keys(mergedKeys).indexOf(other) !== -1) {
                        const prevMerged = mergedKeys[other].merged;
                        const prevOther = mergedKeys[other].other;
                        clearKeyRepeat(prevMerged);
                        delete keyIntervals[prevMerged];
                        clearKeyRepeat(prevOther);
                        delete keyIntervals[prevOther];
                        delete mergedKeys[other];
                        delete mergedKeys[prevOther];
                    }
                    clearKeyRepeat(other);
                    delete keyIntervals[other];
                    setKeyRepeatImmediate(merged, e.ctrlKey);
                    mergedKeys[key] = {
                        other,
                        merged
                    }
                    mergedKeys[other] = {
                        other: key,
                        merged
                    }
                }
            };
        }
    };
    const checkForMerge = (key, firstKeyToCheck, secondKeyToCheck, firstMerge, secondMerge) => {
        if (Object.keys(pressedKeys).indexOf(firstKeyToCheck) !== -1) {
            mergeKeys(key, firstKeyToCheck, firstMerge);
            return true;
        } else if (Object.keys(pressedKeys).indexOf(secondKeyToCheck) !== -1) {
            mergeKeys(key, secondKeyToCheck, secondMerge);
            return true;
        }
        return false;
    };
    switch (e.key) {
        case options.CONTROLS.BOTTOM:
            return checkForMerge(
                options.CONTROLS.BOTTOM,
                options.CONTROLS.LEFT,
                options.CONTROLS.RIGHT,
                options.CONTROLS.BOTTOM_LEFT,
                options.CONTROLS.BOTTOM_RIGHT
            );
        case options.CONTROLS.LEFT:
            return checkForMerge(
                options.CONTROLS.LEFT,
                options.CONTROLS.BOTTOM,
                options.CONTROLS.TOP,
                options.CONTROLS.BOTTOM_LEFT,
                options.CONTROLS.TOP_LEFT
            );
        case options.CONTROLS.TOP:
            return checkForMerge(
                options.CONTROLS.TOP,
                options.CONTROLS.LEFT,
                options.CONTROLS.RIGHT,
                options.CONTROLS.TOP_LEFT,
                options.CONTROLS.TOP_RIGHT
            );
        case options.CONTROLS.RIGHT:
            return checkForMerge(
                options.CONTROLS.RIGHT,
                options.CONTROLS.BOTTOM,
                options.CONTROLS.TOP,
                options.CONTROLS.BOTTOM_RIGHT,
                options.CONTROLS.TOP_RIGHT
            );
    }
    return false;
}

function addToKeyIntervals(key, ctrlKey) {
    keyIntervals[key] = setInterval(() => {
        if (onNextKeyIntervals[key]) {
            onNextKeyIntervals[key]();
        } else {
            isFirstMove = false;
            action(key, ctrlKey);
        }
    }, options.TRAVEL_REPEAT_DELAY);
}

function clearKeyRepeat(key) {
    if (onNextKeyIntervals[key]) {
        onNextKeyIntervals[key]();
    }
    clearInterval(keyIntervals[key]);
}

async function setKeyRepeat(key, ctrlKey) {
    clearInterval(keyIntervals[key]); // just to make sure nothing gets left on
    keyIntervals[key] = KEY_IS_PRESSED;
    await new Promise(r => setTimeout(r, options.TRAVEL_REPEAT_START_DELAY));

    // check that the keypress hasn't been stopped already (keyIntervals values are deleted on keyup)
    if (keyIntervals[key] === KEY_IS_PRESSED) {
        action(key, ctrlKey);
        addToKeyIntervals(key, ctrlKey);
    }
}

function setKeyRepeatImmediate(key, ctrlKey) {
    clearInterval(keyIntervals[key]); // just to make sure nothing gets left on
    addToKeyIntervals(key, ctrlKey);
}

function keypressListener(e) {
    if (Object.keys(pressedKeys).indexOf(e.key) !== -1) {
        return;
    }
    e.preventDefault();
    pressedKeys[e.key] = true;
    const moveKeyList = [
        options.CONTROLS.BOTTOM_LEFT, options.CONTROLS.BOTTOM, options.CONTROLS.BOTTOM_RIGHT,
        options.CONTROLS.LEFT, options.CONTROLS.RIGHT, options.CONTROLS.TOP_LEFT, 
        options.CONTROLS.TOP, options.CONTROLS.TOP_RIGHT
    ];
    const isFirst = !Object.keys(keyIntervals).length;

    if (moveKeyList.indexOf(e.key) !== -1) {
        drcPressTimes[inputToDrc(e.key, options)] = performance.now();
        if (mergeIfOrthogonalKeysPressed(e)) {
            return;
        }
        isFirstMove = isFirst; // still use previous value for checking merges
        prevPlayerPos = gm.player.pos.slice();
        setKeyRepeat(e.key, e.ctrlKey);
    }
    action(e.key, e.ctrlKey, isFirst);
}

function clickListener(e) {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
    if (e.target.id === "status" || e.target.id === "info" || e.target.parentNode?.id === "clickMenu"
        || e.target.dataset.ignoreClick || e.button !== 0 || gm.inputType === "selectPos") return;
    // get cursor position in relation to the player symbol and convert to drc
    const rect = gm.area[gm.player.pos[0]][gm.player.pos[1]].getBoundingClientRect();
    const x = e.x - (rect.left + rect.width / 2);
    const y = e.y - (rect.top + rect.height / 2);
    const drc = relativeCoordsToDrc(y, x);
    const noModifier = !e.altKey && !e.ctrlKey && !e.shiftKey;
    
    if ((options.CONTROLS.ACTION_MOD === "Alt" && e.altKey)
        || (options.CONTROLS.ACTION_MOD === "Control" && e.ctrlKey)
        || (options.CONTROLS.ACTION_MOD === "Shift" && e.shiftKey)
        || (options.CONTROLS.ACTION_MOD === "None" && noModifier)
    ) {
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
    if ((options.CONTROLS.AUTOMOVE_MOD === "Alt" && e.altKey)
        || (options.CONTROLS.AUTOMOVE_MOD === "Control" && e.ctrlKey)
        || (options.CONTROLS.AUTOMOVE_MOD === "Shift" && e.shiftKey)
        || (options.CONTROLS.AUTOMOVE_MOD === "None" && noModifier)
    ) {
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
    const clickOnValidPos = e.target.tagName === "TD";
    if (!clickOnValidPos && !menuListener.allowExtraActions) return;
    menu.style.left = e.x + "px";
    menu.style.top = e.y + "px";
    menu.style.display = "block";

    if (menuListener.allowExtraActions && !clickOnValidPos) {
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
    } else if (menuListener.allowExtraActions) {
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
    if (clickOnValidPos) {
        showInfoButton.style.display = "block";
        showInfoButton.onmousedown = () => {
            gm.ui.showMsg(getPosInfo(e.target.customProps.infoKeys));
            menu.style.display = "none";
        };
    } else {
        showInfoButton.style.display = "none";
    }
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
    const contentNames = [];
    
    for (const item of gm.player.inventory) {
        contentNames.push(itemNameWithNumber(item));
    }
    if (contentNames.length !== 0) {
        gm.ui.showDialog("Contents of your inventory:", contentNames, itemIdx => {
            if (itemIdx < 0) {
                return;
            }
            const actionOptions = gm.player.inventory[itemIdx].usable ? ["Drop", "Use"] : ["Drop"];
            gm.ui.showDialog("What do you want to do with \"" + contentNames[itemIdx] + "\"?", 
                             actionOptions, actionIdx => {
                switch (actionIdx) {
                    case 0:
                        let item = gm.player.inventory.splice(itemIdx, 1)[0];
                        item.pos = gm.player.pos.slice();
                        gm.items.push(item);
                        gm.ui.showMsg("You drop \"" + contentNames[itemIdx] + "\".");
                        // gm.processTurn();
                        break;
                    case 1:
                        gm.tryFireEvent("onUse", gm.player.inventory[itemIdx]);
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

function action(key, ctrl, isFirst) {
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
                // "slide" along walls if moving diagonally against them
                const altInfo = getAdjacentOrthogonalDirections(gm.player.pos, drc);

                // prioritize alternatives based on what direction was more recently pressed, more intuitive
                // in case of moving against a corner where there are two valid options
                if (altInfo.drcs && drcPressTimes[altInfo.drcs[1]] > drcPressTimes[altInfo.drcs[0]]) {
                    const temp = altInfo.alternatives[1];
                    altInfo.alternatives[1] = altInfo.alternatives[0];
                    altInfo.alternatives[0] = temp;
                }
                movePosToDrc(newPos, drc);
                const msgInfo = {
                    type: "move",
                    args: [newPos, altInfo.alternatives]
                };
                socket.send(JSON.stringify(msgInfo));
                gm.movePlayer(newPos, altInfo.alternatives, isFirst);
            }
            break;
        default:
            return;
    }
    gm.updateAfterAction();
}

/*
function action(key, ctrl, isFirst) {
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
                // "slide" along walls if moving diagonally against them
                const altInfo = getAdjacentOrthogonalDirections(gm.player.pos, drc);

                // prioritize alternatives based on what direction was more recently pressed, more intuitive
                // in case of moving against a corner where there are two valid options
                if (altInfo.drcs && drcPressTimes[altInfo.drcs[1]] > drcPressTimes[altInfo.drcs[0]]) {
                    const temp = altInfo.alternatives[1];
                    altInfo.alternatives[1] = altInfo.alternatives[0];
                    altInfo.alternatives[0] = temp;
                }
                movePosToDrc(newPos, drc);
                gm.movePlayer(newPos, altInfo.alternatives, isFirst);
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
*/
