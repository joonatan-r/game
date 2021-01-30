// level, levels, area, rendered, memorized, infoTable from level.js
// bresenham, isNextTo, coordsEq, movePosToDrc, removeByReference, pixelCoordsToDrc from util.js
// movingAIs, Ukko, Some_Guy, Shady_Guy, createMobOfType, Make, Pekka, Jorma from mobs.js

// all coords are given as (y,x)

const TURN_BASED = true;
let turnInterval = null;
!TURN_BASED && (turnInterval = setInterval(() => processTurn(), 500));

const info = document.getElementById("info");
const status = document.getElementById("status");
const menu = document.getElementById("clickMenu");
const dialog = document.getElementById("dialog");
const msgHistory = [];
const timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 0;
const player = {};
player.inventory = [];
player.pos = [10, 13];
let mobs = [];
let items = [];
let customRenders = []; // for "animations" to not get erased
let interruptAutoTravel = false;
let blockAutoTravel = false;

const story = {
    "Shady guy": {
        1: () => {
            items.push({
                name: "some money",
                symbol: "$",
                hidden: true,
                pos: [0, 4]
            });
        }
    }
};

mobs.push(Shady_Guy);
items.push({
    name: "a chest",
    symbol: "(",
    onInteract: function() {
        showMsg("You try to loot " + this.name + ".");
    },
    blocksTravel: true,
    pos: [9, 22]
});
levels["Ukko's House"].mobs.push(Ukko);
levels["Random House"].mobs.push(Some_Guy);
levels["Wilderness"].items.push({
    name: "some money",
    symbol: "$",
    pos: [12, 27]
}, {
    name: "a weird object",
    symbol: "?",
    hidden: true,
    pos: [3, 8]
});

function posIsValid(pos) {
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

function trySpawnMob() {
    let spawnPos = null;
    let notRenderedNbr = 1;

    if (!levels[levels.currentLvl].spawnsHostiles) return;
    if (timeTracker.timer % 10 !== 0) return;

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j] && level[i][j] !== "") notRenderedNbr++;
        }
    }
    for (let i = 0; i < level.length; i++) {
        if (spawnPos) break;

        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j] && level[i][j] !== "" && Math.random() < (1 / notRenderedNbr)) {
                spawnPos = [i, j];
                break;
            }
        }
    }
    if (!spawnPos) return;

    const r = Math.random();
    let mob;

    if (r < 0.2) {
        mob = createMobOfType(Make);
        mob.huntingTarget = player;
    } else if (r > 0.8) {
        mob = createMobOfType(Pekka);
        mob.huntingTarget = player;
    } else {
        mob = createMobOfType(Jorma);
    }
    mob.pos = spawnPos;
    mobs.push(mob);
}

function gameOver(msg) {
    showMsg(msg);
    !TURN_BASED && clearInterval(turnInterval);
    interruptAutoTravel = true;
    removeListeners();
    customRenders.push({ symbol: level[player.pos[0]][player.pos[1]], pos: player.pos }); // erase player symbol
}

function processTurn() {
    info.textContent = levels.currentLvl + "\nTurn " + timeTracker.timer + "\n";

    if (timeTracker.turnsUntilShoot > 0) {
        info.textContent += timeTracker.turnsUntilShoot + " turns until you can shoot";
    } else {
        info.textContent += "You can shoot";
    }
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
    renderAll(player.pos, items, mobs, customRenders);
    trySpawnMob();
    timeTracker.timer++;
    if (timeTracker.turnsUntilShoot > 0) timeTracker.turnsUntilShoot--;
}

async function shoot(fromPos, drc, mobIsShooting) {
    let bulletPos = fromPos.slice();
    let obj;
    TURN_BASED && (interruptAutoTravel = true);
    TURN_BASED && removeListeners();
    keypressListener.actionType = null;
    clickListener.actionType = null;

    while (1) {
        renderPos(bulletPos, player.pos, items, mobs, customRenders);

        switch (drc) {
            case "4":
            case "6":
            case "8":
            case "2":
            case "7":
            case "1":
            case "9":
            case "3":
                movePosToDrc(bulletPos, drc);
                break;
            case "Escape":
                timeTracker.turnsUntilShoot = 0;
                showMsg("");
                addListeners();
                keypressListener.actionType = null;
                clickListener.actionType = null;
                return;
            default:
                addListeners();
                keypressListener.actionType = "shoot";
                clickListener.actionType = "chooseDrc";
                return;
        }
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
            renderPos(bulletPos, player.pos, items, mobs, customRenders);
            shotEffect(bulletPos, player.pos, items, mobs, customRenders);
            return;
        }
        for (let i = 0; i < mobs.length; i++) {
            if (coordsEq(bulletPos, mobs[i].pos)) {
                mobs.splice(i, 1);
                addListeners();
                keypressListener.actionType = null;
                clickListener.actionType = null;
                removeByReference(customRenders, obj);
                renderPos(bulletPos, player.pos, items, mobs, customRenders);
                shotEffect(bulletPos, player.pos, items, mobs, customRenders);
                !mobIsShooting && processTurn();
                return;
            }
        }
        removeByReference(customRenders, obj);
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
        if (coordsEq(interactPos, mob.pos) && mob.talk) {
            let mobState = mob.state;
            mob.talk(showDialog, showMsg);

            if (mobState !== mob.state && story[mob.name] && story[mob.name][mob.state]) {
                story[mob.name][mob.state]();
            }
        }
    }
    for (let item of items) {
        if (coordsEq(interactPos, item.pos) && item.onInteract) {
            item.onInteract();
        }
    }
    keypressListener.actionType = null;
    clickListener.actionType = null;
    processTurn();
}

function movePlayer(newPos) {
    let overlapMob = false;
    let itemInTheWay = false;

    for (let mob of mobs) {
        if (coordsEq(newPos, mob.pos)) {
            overlapMob = true;
            break;
        }
    }
    for (let item of items) {
        if (coordsEq(newPos, item.pos) && item.blocksTravel) {
            itemInTheWay = true;
            break;
        }
    }
    if (newPos[0] > level.length - 1 || newPos[1] > level[0].length - 1 || newPos[0] < 0 || newPos[1] < 0
        || level[newPos[0]][newPos[1]] === "" || overlapMob || itemInTheWay
    ) {
        return;
    }
    player.pos = newPos;

    if (level[player.pos[0]][player.pos[1]] === "^") {
        const tps = levels[levels.currentLvl].travelPoints;

        for (let lvl of Object.keys(tps)) {
            let idx = 0;

            for (let coords of tps[lvl]) {
                if (coordsEq(coords, player.pos)) {
                    const retObj = changeLvl(levels.currentLvl, lvl, idx, mobs, items, memorized);
                    level = retObj.level;
                    player.pos = retObj.pos.slice();
                    mobs = retObj.mobs;
                    items = retObj.items;
                    memorized = retObj.memorized;
                    levels.currentLvl = lvl;
                    break;
                }
                idx++;
            }
        }
    }
    for (let i = 0; i < items.length; i++) {
        if (coordsEq(player.pos, items[i].pos)) {
            let msg = "";
            let severalItems = false;

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
                const tps = levels[levels.currentLvl].travelPoints;

                for (let lvl of Object.keys(tps)) {
                    let idx = 0; // for tracking which point in lvl to travel to if several
        
                    for (let coords of tps[lvl]) {
                        if (coordsEq(coords, player.pos)) {
                            const retObj = changeLvl(levels.currentLvl, lvl, idx, mobs, items, memorized);
                            level = retObj.level;
                            player.pos = retObj.pos.slice();
                            mobs = retObj.mobs;
                            items = retObj.items;
                            memorized = retObj.memorized;
                            levels.currentLvl = lvl;
                            break;
                        }
                        idx++;
                    }
                }
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
                showDialog("Contents of your inventory:", contentNames, idx => {
                    showDialog("What do you want to do with \"" + contentNames[idx] + "\"?", ["Drop"], idx => {
                        switch (idx) {
                            case 0:
                                let item = player.inventory.splice(idx, 1)[0];
                                item.pos = player.pos;
                                items.push(item);
                                showMsg("You drop \"" + contentNames[idx] + "\".");
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
                            itemsHere.push(items[j]);
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
        default:
            return;
    }
    if (TURN_BASED) {
        processTurn();
    } else {
        renderAll(player.pos, items, mobs, customRenders);
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
            renderAll(player.pos, items, mobs, customRenders);
        }
        await new Promise(r => setTimeout(r, 50));
    }
    keypressListener.actionType = null;
    blockAutoTravel = false;
}

function showDialog(text, choices, onSelect, allowEsc, skipLog) {
    let choiceGroupIdx = null;
    removeListeners();
    !skipLog && msgHistory.unshift(text.trim().replaceAll("\n", "\n\t"));

    // if there are over 9 possible choices, divide them into groups of 8 (last one being probably
    // shorter) and add an option 9 to go to the next "choice group" (last one has the option to go
    // back to start), this way number keys 1-9 can be still be used to select a choice

    if (choices.length > 9) {
        const choicesCopy = choices.slice();
        let currIdx = 0;
        choiceGroupIdx = 0;
        choices = [];

        while (choicesCopy.length) {
            choices.push([]);

            for (let i = 0; i < 8 && choicesCopy.length; i++) {
                choices[currIdx].push(choicesCopy.shift());
            }
            if (choicesCopy.length) {
                choices[currIdx].push("[Show more]");
            } else {
                choices[currIdx].push("[Back to start]");
            }
            currIdx++;
        }
    }
    let choiceGroup = choiceGroupIdx !== null ? choices[choiceGroupIdx] : choices;

    const repopulateDialog = noGroupUpdate => {
        if (!noGroupUpdate) {
            choiceGroupIdx = choiceGroupIdx < choices.length - 1 ? choiceGroupIdx + 1 : 0;
            choiceGroup = choices[choiceGroupIdx];
        }
        let idx = 0;
    
        while (dialog.children.length > 1) { // remove all but the first text element
            dialog.firstChild.onclick = null; // just to be safe
            dialog.removeChild(dialog.lastChild);
        }
        for (let choice of choiceGroup) {
            const choiceIdx = idx;
            const c = document.createElement("p");
            c.textContent = "[" + (idx + 1) + "]:\t" + choice;
            dialog.appendChild(c);
            c.onclick = e => {
                e.stopPropagation();
    
                if (choiceGroupIdx !== null && choiceIdx === choiceGroup.length - 1) {
                    repopulateDialog();
                } else {
                    let optionNumber = choiceIdx;
                    !skipLog && msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

                    if (choiceGroupIdx !== null) {
                        optionNumber += 8 * choiceGroupIdx;
                    }
                    hideDialog();
                    onSelect(optionNumber);
                }
            }
            idx++;
        }
    }
    dialogKeyListener = e => {
        if (allowEsc && e.key === "Escape") {
            hideDialog();
            return;
        }
        let pressedNumber = Number(e.key);

        if (isNaN(pressedNumber) || pressedNumber > choiceGroup.length || pressedNumber <= 0) {
            return;
        }
        if (choiceGroupIdx !== null && pressedNumber === choiceGroup.length) {
            repopulateDialog();
        } else {
            let optionNumber = pressedNumber - 1;
            !skipLog && msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

            if (choiceGroupIdx !== null) {
                optionNumber += 8 * choiceGroupIdx;
            }
            hideDialog();
            onSelect(optionNumber);
        }
    };
    document.addEventListener("keydown", dialogKeyListener);
    dialog.style.display = "block";
    const p = document.createElement("p");
    p.setAttribute("id", "dialogText");
    p.textContent = text;
    dialog.appendChild(p);
    repopulateDialog(true);
}

function hideDialog() {
    dialog.style.display = "none";
    document.removeEventListener("keydown", dialogKeyListener);
    addListeners();

    while (dialog.firstChild) {
        dialog.firstChild.onclick = null; // just to be safe
        dialog.removeChild(dialog.firstChild);
    }
};

function showMsg(msg) {
    status.textContent = msg;
    if (!msg) return; // empty string / null
    msg = msg.trim().replaceAll("\n", "\n\t"); // more readable in history
    msgHistory.unshift(msg);
}

const keypressListener = e => {
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
        default:
            action(e.key, e.ctrlKey);
    }
};
const clickListener = e => {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
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
                    renderAll(player.pos, items, mobs, customRenders);
                }
            }
    }
};
const menuListener = e => {
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
};
let dialogKeyListener;
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

addListeners();
processTurn();
