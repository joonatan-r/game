// level, levels, area, rendered, infoTable from level.js
// bresenham, isNextTo, coordsEq, movePosToDrc, movingAIs, 
// removeByReference, pixelCoordsToDrc from util.js

// all coords are given as (y,x)

// TODO if not turn based, status stuff is pretty messed up
const TURN_BASED = true;
let turnInterval = null;
!TURN_BASED && (turnInterval = setInterval(() => processTurn(), 500));

const info = document.getElementById("info");
const status = document.getElementById("status");
const menu = document.getElementById("clickMenu");
const dialog = document.getElementById("dialog");
const timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 0;
let inventory = [];
let pos = [10, 13];
let mobs = [];
let items = [];
let customRenders = []; // for "animations" to not get erased
let interruptAutoTravel = false;
let blockAutoTravel = false;

levels["Ukko's House"].mobs.push({
    name: "Ukko",
    symbol: "@",
    isHostile: false,
    state: 9001,
    pos: [11, 13],
    talk: function(outputElement) {

        if (this.state > 9000) {
            showDialog("[" + this.name + "]: Hi! I have over 9 options.\n\nYour answer:", 
                    ["option 1", "option 2", "option 3", "option 4", "option 5", "option 6", "option 7", "option 8", "option 9", "option 10", "option 11",
                     "option 12", "option 13", "option 14", "option 15", "option 16", "option 17", "option 18", "option 19", "option 20"], 
                    idx => {
                        outputElement.textContent = "You selected option " + (idx+1) + ".";
                    }
            );
            return false;
        }

        outputElement.textContent = "[" + this.name + "]: Yo man!";
        return true;
    },
    calcTarget: function() { movingAIs.random(this) }
});
levels["Random House"].mobs.push({
    name: "Some guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [13, 18],
    talk: function(outputElement) {
        switch (this.state) {
            case 0:
                showDialog("[" + this.name + "]: Hello there!\n\nYour answer:", 
                        ["Hi!", "General Kenobi!", "[Don't answer]"], 
                        idx => {
                            this.state = { 0: 1, 1: 2, 2: 0 }[idx];
                            if (this.state !== 0) this.talk(outputElement);
                        }
                );
                return false;
            case 1:
                outputElement.textContent = "[" + this.name + "]: So uncivilized!";
                return true;
            case 2:
                outputElement.textContent = "[" + this.name + "]: You are strong and wise and I'm very proud of you!";
                return true;
            default:
                return false;
        }
    },
    calcTarget: function() { this.target = this.pos.slice(); }
});
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
    const mob = {};
    mob.pos = spawnPos;

    if (r < 0.2) {
        mob.name = "Make";
        mob.symbol = "M";
        mob.isHostile = true;
        mob.calcTarget = () => {
            if (rendered[mob.pos[0]][mob.pos[1]]) { // if player can see mob, mob can see player
                movingAIs.towardsPos(mob, pos);
            } else {
                movingAIs.random(mob);
            }
        };
    } else if (r > 0.8) {
        mob.name = "Pekka";
        mob.symbol = "P";
        mob.isHostile = true;
        mob.isShooter = true;
        mob.calcTarget = () => {
            if (rendered[mob.pos[0]][mob.pos[1]]) {
                movingAIs.towardsStraightLineFromPos(mob, pos);
            } else {
                mob.target = mob.pos.slice();
            }
        };
    } else {
        mob.name = "Jorma";
        mob.symbol = "J";
        mob.isHostile = true;
        mob.calcTarget = () => movingAIs.random(mob);
    }
    mobs.push(mob);
}

function gameOver(msg) {
    status.textContent = msg;
    !TURN_BASED && clearInterval(turnInterval);
    interruptAutoTravel = true;
    removeListeners();
    customRenders.push({ symbol: level[pos[0]][pos[1]], pos: pos }); // erase player symbol
}

function processTurn(keepStatus) {
    info.textContent = levels.currentLvl + "\nTurn " + timeTracker.timer + "\n";

    if (timeTracker.turnsUntilShoot > 0) {
        info.textContent += timeTracker.turnsUntilShoot + " turns until you can shoot";
    } else {
        info.textContent += "You can shoot";
    }
    !keepStatus && (status.textContent = "");

    for (let mob of mobs) {
        if (mob.isHostile && isNextTo(pos, mob.pos)) {
            gameOver(mob.name + " hits you! You die...");
            break;
        }
        mob.calcTarget();
        let mobInTheWay = false;

        for (let otherMob of mobs) {
            if (coordsEq(otherMob.pos, mob.target)) {
                // this could be the mob itself, but then it won't be moving anyway
                mobInTheWay = true;
            }
        }
        if (mob.isShooter && mob.straightLineToTargetDrc) {
            shoot(mob.pos, mob.straightLineToTargetDrc, true);
        } else if (!coordsEq(pos, mob.target) 
            && !mobInTheWay
            && !(
                mob.target[0] > level.length - 1 
                || mob.target[1] > level[0].length - 1 
                || mob.target[0] < 0 || mob.target[1] < 0
                || level[mob.target[0]][mob.target[1]] === ""
            )
        ) {
            mob.pos = mob.target.slice();
        }
    }
    renderAll(pos, items, mobs, customRenders);
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
        renderPos(bulletPos, pos, items, mobs, customRenders);

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
                status.textContent = "";
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
        if (!(level[bulletPos[0]] && level[bulletPos[0]][bulletPos[1]] 
            && level[bulletPos[0]][bulletPos[1]] !== ""
        )) {
            break;
        }
        if (rendered[bulletPos[0]][bulletPos[1]]) area[bulletPos[0]][bulletPos[1]].textContent = "o";
        obj = { symbol: "o", pos: [bulletPos[0], bulletPos[1]] };
        customRenders.push(obj);

        await new Promise(r => setTimeout(r, 30));
        
        if (coordsEq(bulletPos, pos)) {
            gameOver("A bullet hits you! You die...");
            removeByReference(customRenders, obj);
            shotEffect(bulletPos, pos, items, mobs, customRenders);
            return;
        }
        for (let i = 0; i < mobs.length; i++) {
            if (coordsEq(bulletPos, mobs[i].pos)) {
                mobs.splice(i, 1);
                addListeners();
                keypressListener.actionType = null;
                clickListener.actionType = null;
                removeByReference(customRenders, obj);
                shotEffect(bulletPos, pos, items, mobs, customRenders);
                !mobIsShooting && processTurn();
                return;
            }
        }
        removeByReference(customRenders, obj);
    }
    addListeners();
    keypressListener.actionType = null;
    clickListener.actionType = null;
    !mobIsShooting && processTurn();
}

function talk(drc) {
    let talkPos = pos.slice();
    let keepStatus = false;

    switch (drc) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            movePosToDrc(talkPos, drc);
            break;
        case "Escape":
            status.textContent = "";
            keypressListener.actionType = null;
            clickListener.actionType = null;
            return;
        default:
            keypressListener.actionType = "talk";
            clickListener.actionType = "chooseDrc";
            return;
    }
    for (let mob of mobs) {
        if (coordsEq(talkPos, mob.pos) && mob.talk) {
            keepStatus = mob.talk(status);
        }
    }
    keypressListener.actionType = null;
    clickListener.actionType = null;
    processTurn(keepStatus);
}

function movePlayer(newPos) {
    let overlapMob = false;

    for (let mob of mobs) {
        if (coordsEq(newPos, mob.pos)) {
            overlapMob = true;
            break;
        }
    }
    if (newPos[0] > level.length - 1 || newPos[1] > level[0].length - 1 || newPos[0] < 0 || newPos[1] < 0
        || level[newPos[0]][newPos[1]] === "" || overlapMob
    ) {
        return false;
    }
    pos = newPos;

    if (level[pos[0]][pos[1]] === "^") {
        const tps = levels[levels.currentLvl].travelPoints;

        for (let lvl of Object.keys(tps)) {
            let idx = 0;

            for (let coords of tps[lvl]) {
                if (coordsEq(coords, pos)) {
                    const retObj = changeLvl(levels.currentLvl, lvl, idx, mobs, items);
                    level = retObj.level;
                    pos = retObj.pos.slice();
                    mobs = retObj.mobs;
                    items = retObj.items;
                    levels.currentLvl = lvl;
                    break;
                }
                idx++;
            }
        }
    }
    for (let item of items) {
        if (coordsEq(pos, item.pos)) {
            status.textContent = "";

            if (item.hidden) {
                status.textContent += "You find an item! ";
                item.hidden = false;
            }
            status.textContent += "There's " + item.name + " here.";
            return true;
        }
    }
    return false;
}

function action(key) {
    let keepStatus = false;

    switch (key) {
        case "4":
        case "6":
        case "8":
        case "2":
        case "7":
        case "1":
        case "9":
        case "3":
            const newPos = pos.slice();
            movePosToDrc(newPos, key);
            keepStatus = movePlayer(newPos);
            break;
        case "Enter":
            if (level[pos[0]][pos[1]] === ">" || level[pos[0]][pos[1]] === "<") {
                const tps = levels[levels.currentLvl].travelPoints;

                for (let lvl of Object.keys(tps)) {
                    let idx = 0; // for tracking which point in lvl to travel to if several
        
                    for (let coords of tps[lvl]) {
                        if (coordsEq(coords, pos)) {
                            const retObj = changeLvl(levels.currentLvl, lvl, idx, mobs, items);
                            level = retObj.level;
                            pos = retObj.pos.slice();
                            mobs = retObj.mobs;
                            items = retObj.items;
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
                status.textContent = "In what direction?";
                keypressListener.actionType = "shoot";
                clickListener.actionType = "chooseDrc";
            }
            return;
        case "i":
            let contents = "";
            
            for (let item of inventory) contents += item.name + ", ";

            contents = contents.slice(0, -2);
            if (contents.length !== 0) {
                status.textContent = "Contents of your inventory:\n" + contents + ".";
            } else {
                status.textContent = "Your inventory is empty.";
            }
            return;
        case "t":
            status.textContent = "In what direction?";
            keypressListener.actionType = "talk";
            clickListener.actionType = "chooseDrc";
            return;
        case ",":
            for (let i = 0; i < items.length; i++) {
                if (coordsEq(pos, items[i].pos)) {
                    const removed = items.splice(i, 1)[0];
                    inventory.push(removed);
                    status.textContent = "You pick up " + removed.name + ".";
                    keepStatus = true;
                    break;
                }
            }
            break;
        default:
            return;
    }
    if (TURN_BASED) {
        processTurn(keepStatus);
    } else {
        renderAll(pos, items, mobs, customRenders);
    }
}

async function autoTravel(coords) {
    if (blockAutoTravel) return;

    const coordsList = [];
    const lvl = levels.currentLvl;
    blockAutoTravel = true;
    interruptAutoTravel = false;
    keypressListener.actionType = "autoMove";
    bresenham(pos[0], pos[1], coords[0], coords[1], 
            (y, x) => {
                coordsList.push([y, x]);
                return level[y][x] === "" ? "stop" : "ok";
            }
    );
    coordsList.shift(); // first element is the player's start position

    for (let coord of coordsList) {
        // new coord may not be next to player if e.g. a mob blocks the way
        if (interruptAutoTravel || levels.currentLvl !== lvl || !isNextTo(pos, coord)) {
            keypressListener.actionType = null;
            blockAutoTravel = false;
            return;
        }
        let keepStatus = movePlayer(coord);
        
        if (TURN_BASED) {
            processTurn(keepStatus);
        } else {
            renderAll(pos, items, mobs, customRenders);
        }
        await new Promise(r => setTimeout(r, 50));
    }
    keypressListener.actionType = null;
    blockAutoTravel = false;
}

function showDialog(text, choices, onSelect) {
    let choiceGroupIdx = null;
    removeListeners();

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
            c.textContent = "[" + (idx + 1) + "]: " + choice;
            dialog.appendChild(c);
            c.onclick = e => {
                e.stopPropagation();
    
                if (choiceGroupIdx !== null && choiceIdx === choiceGroup.length - 1) {
                    repopulateDialog();
                } else {
                    let optionNumber = choiceIdx;

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
        let pressedNumber = Number(e.key);
        if (isNaN(pressedNumber) || pressedNumber > choiceGroup.length) return;
        if (choiceGroupIdx !== null && pressedNumber === choiceGroup.length) {
            repopulateDialog();
        } else {
            let optionNumber = pressedNumber - 1;

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

const keypressListener = e => {
    switch (keypressListener.actionType) {
        case "shoot":
            shoot(pos, e.key);
            break;
        case "talk":
            talk(e.key);
            break;
        case "autoMove":
            if (e.key === "Escape") interruptAutoTravel = true;
            break;
        default:
            action(e.key);
    }
};
const clickListener = e => {
    if (menu.style.display !== "none" && menu.style.display.length !== 0) {
        menu.style.display = "none";
        return;
    }
    // get cursor position in relation to the player symbol and convert to drc
    const rect = area[pos[0]][pos[1]].getBoundingClientRect();
    const x = e.x - (rect.left + rect.width / 2);
    const y = e.y - (rect.top + rect.height / 2);
    const drc = pixelCoordsToDrc(y, x);

    switch (clickListener.actionType) {
        case "chooseDrc":
            switch (keypressListener.actionType) {
                case "shoot":
                    shoot(pos, drc);
                    break;
                case "talk":
                    talk(drc);
                    break;
            }
            break;
        default:
            if (e.ctrlKey) {
                if (e.target.tagName !== "TD") return;
                autoTravel(e.target.customProps.coords);
            } else {
                const newPos = pos.slice();
                movePosToDrc(newPos, drc);
                let keepStatus = movePlayer(newPos);
                
                if (TURN_BASED) {
                    processTurn(keepStatus);
                } else {
                    renderAll(pos, items, mobs, customRenders);
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
        status.textContent = "";

        if (!e.target.customProps.infoKeys.length) {
            status.textContent += "[ ]: An unseen area\n";
        }
        for (let key of e.target.customProps.infoKeys) {
            status.textContent += infoTable[key] + "\n";
        }
    };
};
let dialogKeyListener;

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
