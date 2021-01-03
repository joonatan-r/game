// level, levels, edges, area, rendered from level.js
// renderLine, isNextTo, coordsEq, movePosToDrc, movingAIs, removeByReference from util.js
// all coords are given as (y,x)

// TODO if not turn based, status stuff is pretty messed up
const TURN_BASED = true;
let turnInterval = null;

const info = document.getElementById("info");
const status = document.getElementById("status");
const timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 0;
let inventory = [];
let pos = [10, 13];
let mobs = [];
let items = [];
let customRenders = []; // for "animations" to not get erased

levels["Ukko's House"].mobs.push({
    name: "Ukko",
    symbol: "@",
    isHostile: false,
    pos: [11, 13],
    talk: () => "Yo man!",
    calcTarget: function() { movingAIs.random(this) }
});
levels["Wilderness"].items.push({
    name: "some money",
    symbol: "$",
    pos: [12, 27]
}, {
    name: "a weird object",
    symbol: "*",
    pos: [3, 8]
});

function trySpawnMob() {
    let spawnPos = null;
    let notRenderedNbr = 1;

    if (!levels[levels.currentLvl].spawnsHostiles) return;
    if (timeTracker.timer % 20 !== 0) return;

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

function renderAll() {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            area[i][j].innerHTML = "";
            // remove this to "remember" walls once seen
            // (won't work if something else, such as player's pos,
            // uses className)
            area[i][j].className = "";
        }
    }
    for (let coords of edges) {
        renderLine(pos[0], pos[1], coords[0], coords[1]);
    }
    for (let item of items) {
        if (rendered[item.pos[0]][item.pos[1]]) {
            area[item.pos[0]][item.pos[1]].innerHTML = item.symbol;
        }
    }
    area[pos[0]][pos[1]].innerHTML = "@";
    area[pos[0]][pos[1]].className = "player";

    for (let mob of mobs) {
        if (rendered[mob.pos[0]][mob.pos[1]]) {
            area[mob.pos[0]][mob.pos[1]].innerHTML = mob.symbol;
        }
    }
    for (let obj of customRenders) {
        area[obj.pos[0]][obj.pos[1]].innerHTML = obj.symbol;
    }

    // add walls last to check where to put them by what tiles are rendered

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            const td = area[i][j];

            if (rendered[i][j] && level[i][j] === "") {
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
    status.innerHTML = msg;
    !TURN_BASED && clearInterval(turnInterval);
    document.removeEventListener("keydown", keypressListener);
    customRenders.push({ symbol: level[pos[0]][pos[1]], pos: pos }); // erase player symbol
}

function processTurn(keepStatus) {
    info.innerHTML = levels.currentLvl + "\nTurn " + timeTracker.timer + "\n";

    if (timeTracker.turnsUntilShoot > 0) {
        info.innerHTML += timeTracker.turnsUntilShoot + " turns until you can shoot";
    } else {
        info.innerHTML += "You can shoot";
    }
    !keepStatus && (status.innerHTML = "");

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
    const prevSymbol = area[shotPos[0]][shotPos[1]].innerHTML;
    const prevSymbols = [null, null, null, null];
    let obj, obj0, obj1, obj2, obj3;
    area[shotPos[0]][shotPos[1]].innerHTML = "x";
    obj = { symbol: "x", pos: [shotPos[0], shotPos[1]] };
    customRenders.push(obj);

    await new Promise(r => setTimeout(r, 300));
    
    removeByReference(customRenders, obj);
    area[shotPos[0]][shotPos[1]].innerHTML = prevSymbol;
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] - 1]
        && (prevSymbols[0] = area[shotPos[0] - 1][shotPos[1] - 1].innerHTML);
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] + 1] 
        && (prevSymbols[1] = area[shotPos[0] - 1][shotPos[1] + 1].innerHTML);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] + 1] 
        && (prevSymbols[2] = area[shotPos[0] + 1][shotPos[1] + 1].innerHTML);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] - 1] 
        && (prevSymbols[3] = area[shotPos[0] + 1][shotPos[1] - 1].innerHTML);
    
    // also doesn't show on walls because then symbol is "" which becomes false
    if (prevSymbols[0]) {
        area[shotPos[0] - 1][shotPos[1] - 1].innerHTML = "\\";
        obj0 = { symbol: "\\", pos: [shotPos[0] - 1, shotPos[1] - 1] };
        customRenders.push(obj0);
    }
    if (prevSymbols[1]) {
        area[shotPos[0] - 1][shotPos[1] + 1].innerHTML = "/";
        obj1 = { symbol: "/", pos: [shotPos[0] - 1, shotPos[1] + 1] };
        customRenders.push(obj1);
    }
    if (prevSymbols[2]) {
        area[shotPos[0] + 1][shotPos[1] + 1].innerHTML = "\\";
        obj2 = { symbol: "\\", pos: [shotPos[0] + 1, shotPos[1] + 1] };
        customRenders.push(obj2);
    }
    if (prevSymbols[3]) {
        area[shotPos[0] + 1][shotPos[1] - 1].innerHTML = "/";
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
    TURN_BASED && document.removeEventListener("keydown", keypressListener);
    keypressListener.actionType = null;

    while (1) {
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
                status.innerHTML = "";
                document.addEventListener("keydown", keypressListener);
                keypressListener.actionType = null;
                return;
            default:
                document.addEventListener("keydown", keypressListener);
                keypressListener.actionType = "shoot";
                return;
        }
        if (!(level[bulletPos[0]] && level[bulletPos[0]][bulletPos[1]] 
            && level[bulletPos[0]][bulletPos[1]] !== ""
        )) {
            break;
        }
        area[bulletPos[0]][bulletPos[1]].innerHTML = "o";
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
                document.addEventListener("keydown", keypressListener);
                keypressListener.actionType = null;
                processTurn();
                removeByReference(customRenders, obj);
                shotEffect(bulletPos);
                return;
            }
        }
        removeByReference(customRenders, obj);
        TURN_BASED && renderAll();
    }
    document.addEventListener("keydown", keypressListener);
    keypressListener.actionType = null;
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
            status.innerHTML = "";
            keypressListener.actionType = null;
            return;
        default:
            keypressListener.actionType = "talk";
            return;
    }
    for (let mob of mobs) {
        if (coordsEq(talkPos, mob.pos) && mob.talk) {
            status.innerHTML = mob.name + ": " + mob.talk();
            keepLine = true;
        }
    }
    keypressListener.actionType = null;
    processTurn(keepLine);
}

function action(key) {
    const prevPos = pos.slice();
    let moved = false;
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
            movePosToDrc(pos, key);
            moved = true;
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
                timeTracker.turnsUntilShoot = 60;
                status.innerHTML = "In what direction?";
                keypressListener.actionType = "shoot";
            }
            return;
        case "i":
            let contents = "";
            
            for (let item of inventory) contents += item.name + ", ";

            contents = contents.slice(0, -2);
            if (contents.length !== 0) {
                status.innerHTML = "Contents of your inventory:\n" + contents + ".";
            } else {
                status.innerHTML = "Your inventory is empty.";
            }
            return;
        case "t":
            status.innerHTML = "In what direction?";
            keypressListener.actionType = "talk";
            return;
        case ",":
            for (let i = 0; i < items.length; i++) {
                if (coordsEq(pos, items[i].pos)) {
                    const removed = items.splice(i, 1)[0];
                    inventory.push(removed);
                    status.innerHTML = "You pick up " + removed.name + ".";
                    keepStatus = true;
                    break;
                }
            }
            break;
        default:
            return;
    }
    if (moved) {
        let overlapMob = false;
    
        for (let mob of mobs) {
            if (coordsEq(pos, mob.pos)) {
                overlapMob = true;
                break;
            }
        }
        if (pos[0] > level.length - 1 || pos[1] > level[0].length - 1 || pos[0] < 0 || pos[1] < 0
            || level[pos[0]][pos[1]] === "" || overlapMob
        ) {
            pos = prevPos.slice();
            return;
        }
        area[prevPos[0]][prevPos[1]].innerHTML = level[prevPos[0]][prevPos[1]];
        
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
                status.innerHTML = "There's " + item.name + " here.";
                keepStatus = true;
            }
        }
    }
    if (TURN_BASED) {
        processTurn(keepStatus);
    } else {
        renderAll();
    }
}

const keypressListener = e => {
    switch (keypressListener.actionType) {
        case "shoot":
            shoot(pos, e.key);
            break;
        case "talk":
            talk(e.key);
            break;
        default:
            action(e.key);
    }
};
document.addEventListener("keydown", keypressListener);
processTurn();

!TURN_BASED && (turnInterval = setInterval(() => processTurn(), 500));
