// table, level, levels, edges, area, rendered, infoTable from level.js
// bresenham, isNextTo, getCoordsNextTo, coordsEq, 
// movePosToDrc, movingAIs, removeByReference, pixelCoordsToDrc from util.js

// all coords are given as (y,x)

// TODO if not turn based, status stuff is pretty messed up
const TURN_BASED = true;
let turnInterval = null;

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
let interruptAutoMove = false;
let blockAutoTravel = false;

function showDialog(text, choices, onSelect) {
    removeListeners();
    dialog.style.left = table.left;
    dialog.style.top = table.top;
    dialog.style.display = "block";
    const p = document.createElement("p");
    p.textContent = text;
    dialog.appendChild(p);
    let idx = 0;

    for (let choice of choices) {
        const c = document.createElement("p");
        c.textContent = "[" + (idx + 1) + "]: " + choice;
        dialog.appendChild(c);
        c.onclick = e => {
            e.stopPropagation();
            onSelect(idx);
            dialog.style.display = "none";
            dialog.textContent = ""; // remove children
            addListeners();
        }
        idx++;
    }
}

levels["Ukko's House"].mobs.push({
    name: "Ukko",
    symbol: "@",
    isHostile: false,
    pos: [11, 13],
    talk: () => "Yo man!",
    calcTarget: function() { movingAIs.random(this) }
});
levels["Random House"].mobs.push({
    name: "Some guy",
    symbol: "@",
    isHostile: false,
    pos: [13, 18],
    talk: function() {
        showDialog("[" + this.name + "]: Hello there!", ["General Kenobi!", "[Don't answer]"], idx => {});
        return false;
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

function renderPos(posToRender) {
    if (!rendered[posToRender[0]][posToRender[1]]) {
        area[posToRender[0]][posToRender[1]].textContent = "";
        return;
    }

    area[posToRender[0]][posToRender[1]].textContent = level[posToRender[0]][posToRender[1]];
    area[posToRender[0]][posToRender[1]].customProps.infoKeys.unshift(level[posToRender[0]][posToRender[1]]);

    for (let item of items) {
        if (coordsEq(item.pos, posToRender) && !item.hidden) {
            area[item.pos[0]][item.pos[1]].textContent = item.symbol;
            area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
        }
    }
    if (coordsEq(pos, posToRender)) {
        area[pos[0]][pos[1]].textContent = "@";
        area[pos[0]][pos[1]].className = "player";
        area[pos[0]][pos[1]].customProps.infoKeys.unshift("Player");
    }
    for (let mob of mobs) {
        if (coordsEq(mob.pos, posToRender)) {
            area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
            area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
        }
    }
    for (let obj of customRenders) {
        if (coordsEq(obj.pos, posToRender)) {
            area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
        }
    }
}

function renderAll() {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            area[i][j].textContent = "";
            // remove this to "remember" walls once seen
            // (won't work if something else, such as player's pos,
            // uses className)
            area[i][j].className = "";
            area[i][j].customProps.infoKeys = [];
        }
    }
    for (let coords of edges) {
        bresenham(pos[0], pos[1], coords[0], coords[1], (y,x) => {
            if (rendered[y][x]) {
                return level[y][x] === "" ? "stop" : "ok"; // wall blocks sight
            }
            area[y][x].textContent = level[y][x];
            area[y][x].customProps.infoKeys.unshift(level[y][x]);
            rendered[y][x] = true;
            return level[y][x] === "" ? "stop" : "ok";
        });
    }
    for (let item of items) {
        if (rendered[item.pos[0]][item.pos[1]] && !item.hidden) {
            area[item.pos[0]][item.pos[1]].textContent = item.symbol;
            area[item.pos[0]][item.pos[1]].customProps.infoKeys.unshift(item.name);
        }
    }
    area[pos[0]][pos[1]].textContent = "@";
    area[pos[0]][pos[1]].className = "player";
    area[pos[0]][pos[1]].customProps.infoKeys.unshift("Player");

    for (let mob of mobs) {
        if (rendered[mob.pos[0]][mob.pos[1]]) {
            area[mob.pos[0]][mob.pos[1]].textContent = mob.symbol;
            area[mob.pos[0]][mob.pos[1]].customProps.infoKeys.unshift(mob.name);
        }
    }
    for (let obj of customRenders) {
        area[obj.pos[0]][obj.pos[1]].textContent = obj.symbol;
    }

    // add walls last to check where to put them by what tiles are rendered

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (level[i][j] !== "") {
                continue;
            }
            const td = area[i][j];
            let nextToRendered = false;

            for (let coord of getCoordsNextTo([i, j])) {
                if (rendered[coord[0]] && rendered[coord[0]][coord[1]]) {
                    nextToRendered = true;
                }
            }
            if (rendered[i][j] || nextToRendered) {
                const classes = ["wall"];
    
                if (i > 0 && j < level[0].length && rendered[i - 1][j] && level[i - 1][j] !== "") {
                    classes.push("t");
                }
                if (i + 1 < level.length && j < level[0].length && rendered[i + 1][j] && level[i + 1][j] !== "") {
                    classes.push("b");
                }
                if (i < level.length && j > 0 && rendered[i][j - 1] && level[i][j - 1] !== "") {
                    classes.push("l");
                }
                if (i < level.length && j + 1 < level[0].length && rendered[i][j + 1] && level[i][j + 1] !== "") {
                    classes.push("r");
                }
                td.classList.add(...classes);
            }
        }
    }
}

function gameOver(msg) {
    status.textContent = msg;
    !TURN_BASED && clearInterval(turnInterval);
    interruptAutoMove = true;
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
    renderAll();
    trySpawnMob();
    timeTracker.timer++;
    if (timeTracker.turnsUntilShoot > 0) timeTracker.turnsUntilShoot--;
}

async function shotEffect(shotPos) {
    const prevSymbol = area[shotPos[0]][shotPos[1]].textContent;
    const prevSymbols = [null, null, null, null];
    let obj, obj0, obj1, obj2, obj3;
    area[shotPos[0]][shotPos[1]].textContent = "x";
    obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
    customRenders.push(obj);

    await new Promise(r => setTimeout(r, 300));
    
    removeByReference(customRenders, obj);
    area[shotPos[0]][shotPos[1]].textContent = prevSymbol;
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] - 1]
        && (prevSymbols[0] = area[shotPos[0] - 1][shotPos[1] - 1].textContent);
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] + 1] 
        && (prevSymbols[1] = area[shotPos[0] - 1][shotPos[1] + 1].textContent);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] + 1] 
        && (prevSymbols[2] = area[shotPos[0] + 1][shotPos[1] + 1].textContent);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] - 1] 
        && (prevSymbols[3] = area[shotPos[0] + 1][shotPos[1] - 1].textContent);
    
    // also doesn't show on walls because then symbol is "" which becomes false
    if (prevSymbols[0]) {
        area[shotPos[0] - 1][shotPos[1] - 1].textContent = "\\";
        obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
        customRenders.push(obj0);
    }
    if (prevSymbols[1]) {
        area[shotPos[0] - 1][shotPos[1] + 1].textContent = "/";
        obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
        customRenders.push(obj1);
    }
    if (prevSymbols[2]) {
        area[shotPos[0] + 1][shotPos[1] + 1].textContent = "\\";
        obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
        customRenders.push(obj2);
    }
    if (prevSymbols[3]) {
        area[shotPos[0] + 1][shotPos[1] - 1].textContent = "/";
        obj3 = { symbol: "/", pos: [shotPos[0] + 1, shotPos[1] - 1] };
        customRenders.push(obj3);
    }
    await new Promise(r => setTimeout(r, 300));

    prevSymbols[0] && removeByReference(customRenders, obj0);
    prevSymbols[1] && removeByReference(customRenders, obj1);
    prevSymbols[2] && removeByReference(customRenders, obj2);
    prevSymbols[3] && removeByReference(customRenders, obj3);
    renderAll();
}

async function shoot(fromPos, drc, mobIsShooting) {
    let bulletPos = fromPos.slice();
    let obj;
    TURN_BASED && (interruptAutoMove = true);
    TURN_BASED && removeListeners();
    keypressListener.actionType = null;
    clickListener.actionType = null;

    while (1) {
        renderPos(bulletPos);

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
            shotEffect(bulletPos);
            return;
        }
        for (let i = 0; i < mobs.length; i++) {
            if (coordsEq(bulletPos, mobs[i].pos)) {
                mobs.splice(i, 1);
                addListeners();
                keypressListener.actionType = null;
                clickListener.actionType = null;
                removeByReference(customRenders, obj);
                shotEffect(bulletPos);
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
    let keepLine = false;

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
            const line = mob.talk();

            if (line) {
                status.textContent = "[" + mob.name + "]: " + line;
                keepLine = true;
            }
        }
    }
    keypressListener.actionType = null;
    clickListener.actionType = null;
    processTurn(keepLine);
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
        renderAll();
    }
}

async function autoTravel(coords) {
    if (blockAutoTravel) return;

    const coordsList = [];
    const lvl = levels.currentLvl;
    blockAutoTravel = true;
    interruptAutoMove = false;
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
        if (interruptAutoMove || levels.currentLvl !== lvl || !isNextTo(pos, coord)) {
            keypressListener.actionType = null;
            blockAutoTravel = false;
            return;
        }
        let keepStatus = movePlayer(coord);
        
        if (TURN_BASED) {
            processTurn(keepStatus);
        } else {
            renderAll();
        }
        await new Promise(r => setTimeout(r, 50));
    }
    keypressListener.actionType = null;
    blockAutoTravel = false;
}

const keypressListener = e => {
    switch (keypressListener.actionType) {
        case "shoot":
            shoot(pos, e.key);
            break;
        case "talk":
            talk(e.key);
            break;
        case "autoMove":
            if (e.key === "Escape") interruptAutoMove = true;
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
                    renderAll();
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

!TURN_BASED && (turnInterval = setInterval(() => processTurn(), 500));
