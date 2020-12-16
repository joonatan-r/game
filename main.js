// level, levels, edges, area, rendered from level.js
// renderLine, isNextTo, coordsEq, movingAIs from util.js
// all coords are given as (y,x)

const info = document.getElementById("info");
const status = document.getElementById("status");
const timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 1;
let pos = [10, 13];
let mobs = [];

function trySpawnMob() {
    let spawnPos = null;
    let notRenderedNbr = 1;

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
        mob.calcTarget = () => movingAIs.random(mob);
    }
    mobs.push(mob);
}

function renderAll() {
    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            rendered[i][j] = false;
            const td = area[i][j];
            td.innerHTML = "";
            td.className = ""; // remove this to "remember" walls once seen
        }
    }
    for (let coords of edges) {
        renderLine(pos[0], pos[1], coords[0], coords[1]);
    }
    area[pos[0]][pos[1]].innerHTML = "@";

    for (let mob of mobs) {
        if (rendered[mob.pos[0]][mob.pos[1]]) {
            area[mob.pos[0]][mob.pos[1]].innerHTML = mob.symbol;
        }
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

function processTurn() {
    if (timeTracker.turnsUntilShoot > 0) {
        info.innerHTML = timeTracker.turnsUntilShoot + " turns until you can shoot";
    } else {
        info.innerHTML = "You can shoot";
    }
    info.innerHTML += "\nTurn " + timeTracker.timer + "\nLevel " + levels.currentLvl;
    status.innerHTML = "";

    for (let mob of mobs) {
        mob.calcTarget();
        let mobInTheWay = false;

        for (let otherMob of mobs) {
            if (coordsEq(otherMob.pos, mob.target)) {
                // this could be the mob itself, but then it won't be moving anyway
                mobInTheWay = true;
            }
        }
        if (isNextTo(pos, mob.pos)) {
            status.innerHTML = mob.name + " hits you! You die...";
            document.removeEventListener("keydown", keypressListener);
        } else if (mob.isShooter && mob.straightLineToPlayerDrc) {
            shoot(mob.pos, mob.straightLineToPlayerDrc, true);
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
    area[shotPos[0]][shotPos[1]].innerHTML = "x";
    await new Promise(r => setTimeout(r, 300));
    area[shotPos[0]][shotPos[1]].innerHTML = prevSymbol;
    const prevSymbols = [null, null, null, null];
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] - 1]
        && (prevSymbols[0] = area[shotPos[0] - 1][shotPos[1] - 1].innerHTML);
    area[shotPos[0] - 1] && area[shotPos[0] - 1][shotPos[1] + 1] 
        && (prevSymbols[1] = area[shotPos[0] - 1][shotPos[1] + 1].innerHTML);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] + 1] 
        && (prevSymbols[2] = area[shotPos[0] + 1][shotPos[1] + 1].innerHTML);
    area[shotPos[0] + 1] && area[shotPos[0] + 1][shotPos[1] - 1] 
        && (prevSymbols[3] = area[shotPos[0] + 1][shotPos[1] - 1].innerHTML);
    // also doesn't show on walls because then symbol is "" which becomes false
    prevSymbols[0] && (area[shotPos[0] - 1][shotPos[1] - 1].innerHTML = "\\");
    prevSymbols[1] && (area[shotPos[0] - 1][shotPos[1] + 1].innerHTML = "/");
    prevSymbols[2] && (area[shotPos[0] + 1][shotPos[1] + 1].innerHTML = "\\");
    prevSymbols[3] && (area[shotPos[0] + 1][shotPos[1] - 1].innerHTML = "/");
    await new Promise(r => setTimeout(r, 300));
    prevSymbols[0] && (area[shotPos[0] - 1][shotPos[1] - 1].innerHTML = prevSymbols[0]);
    prevSymbols[1] && (area[shotPos[0] - 1][shotPos[1] + 1].innerHTML = prevSymbols[1]);
    prevSymbols[2] && (area[shotPos[0] + 1][shotPos[1] + 1].innerHTML = prevSymbols[2]);
    prevSymbols[3] && (area[shotPos[0] + 1][shotPos[1] - 1].innerHTML = prevSymbols[3]);
}

async function shoot(fromPos, drc, mobIsShooting) {
    let bulletPos = fromPos.slice();
    document.removeEventListener("keydown", shootListener);
    mobIsShooting && document.removeEventListener("keydown", keypressListener);

    while (level[bulletPos[0]] && level[bulletPos[0]][bulletPos[1]] 
           && level[bulletPos[0]][bulletPos[1]] !== ""
    ) {
        const prevBulletPos = bulletPos.slice();

        switch (drc) {
            case "4":
                bulletPos[1]--;
                break;
            case "6":
                bulletPos[1]++;
                break;
            case "8":
                bulletPos[0]--;
                break;
            case "2":
                bulletPos[0]++;
                break;
            case "7":
                bulletPos[1]--;
                bulletPos[0]--;
                break;
            case "1":
                bulletPos[1]--;
                bulletPos[0]++;
                break;
            case "9":
                bulletPos[1]++;
                bulletPos[0]--;
                break;
            case "3":
                bulletPos[1]++;
                bulletPos[0]++;
                break;
            case "Escape":
                timeTracker.turnsUntilShoot = 0;
                status.innerHTML = "";
                document.addEventListener("keydown", keypressListener);
                return;
            default:
                document.addEventListener("keydown", shootListener);
                return;
        }
        const prevSymbol = area[prevBulletPos[0]][prevBulletPos[1]].innerHTML;
        area[prevBulletPos[0]][prevBulletPos[1]].innerHTML = "o";
        await new Promise(r => setTimeout(r, 30));
        area[prevBulletPos[0]][prevBulletPos[1]].innerHTML = prevSymbol;

        if (coordsEq(bulletPos, pos)) {
            status.innerHTML = "A bullet hits you! You die...";
            shotEffect(bulletPos);
            return;
        }
        for (let i = 0; i < mobs.length; i++) {
            if (coordsEq(bulletPos, mobs[i].pos)) {
                mobs.splice(i, 1);
                document.addEventListener("keydown", keypressListener);
                processTurn();
                shotEffect(bulletPos);
                return;
            }
        }
    }
    document.addEventListener("keydown", keypressListener);
    processTurn();
}

const shootListener = e => shoot(pos, e.key);
const keypressListener = e => {
    const prevPos = pos.slice();

    switch (e.key) {
        case "4":
            pos[1]--;
            break;
        case "6":
            pos[1]++;
            break;
        case "8":
            pos[0]--;
            break;
        case "2":
            pos[0]++;
            break;
        case "7":
            pos[1]--;
            pos[0]--;
            break;
        case "1":
            pos[1]--;
            pos[0]++;
            break;
        case "9":
            pos[1]++;
            pos[0]--;
            break;
        case "3":
            pos[1]++;
            pos[0]++;
            break;
        case "Enter":
            if (level[pos[0]][pos[1]] === ">") {
                const tps = levels[levels.currentLvl].travelPoints;

                for (let lvl of Object.keys(tps)) {
                    if (coordsEq(tps[lvl], pos)) {
                        const retObj = changeLvl(levels.currentLvl, lvl, mobs);
                        level = retObj.level;
                        pos = retObj.pos.slice();
                        mobs = retObj.mobs;
                        levels.currentLvl = lvl;
                        break;
                    }
                }
            } else {
                return;
            }
            break;
        case "f":
            if (timeTracker.turnsUntilShoot === 0) {
                timeTracker.turnsUntilShoot = 60;
                document.removeEventListener("keydown", keypressListener);
                status.innerHTML = "In what direction?";
                document.addEventListener("keydown", shootListener);
            }
            return;
        default:
            return;
    }
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
    processTurn();
}
document.addEventListener("keydown", keypressListener);
processTurn();
