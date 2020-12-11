// level, levels, edges, area, rendered from level.js
// renderLine, isNextTo, movingAIs from util.js
// all coords are given as (y,x)

const info = document.getElementById("info");
const status = document.getElementById("status");
const timeTracker = {};
timeTracker.timer = 0;
timeTracker.turnsUntilShoot = 70;
let pos = [10, 13];
let mobs = [];
const make = {};
make.name = "Make";
make.symbol = "M";
make.pos = [7, 17];
make.target = [7, 17];
make.calcTarget = () => {
    if (rendered[make.pos[0]][make.pos[1]]) { // if player can see mob, mob can see player
        movingAIs.towardsPos(make, pos)
    } else {
        movingAIs.random(make);
    }
};
const pekka = {};
pekka.name = "Pekka";
pekka.symbol = "P";
pekka.pos = [7, 7];
pekka.target = [7, 7];
pekka.calcTarget = () => {
    if (rendered[pekka.pos[0]][pekka.pos[1]]) {
        movingAIs.towardsPos(pekka, pos)
    } else {
        movingAIs.random(pekka);
    }
};
const jorma = {};
jorma.name = "Jorma";
jorma.symbol = "J";
jorma.pos = [7, 7];
jorma.target = [7, 7];
jorma.calcTarget = () => movingAIs.random(jorma);
mobs.push(make);
mobs.push(pekka);
levels.test2.mobs.push(jorma);

function trySpawnMob() {
    let spawnPos = null;
    let notRenderedNbr = 1;

    if (timeTracker.timer % 50 !== 0) return;

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j]) notRenderedNbr++;
        }
    }

    for (let i = 0; i < level.length; i++) {
        if (spawnPos) break;

        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j] && Math.random() < (1 / notRenderedNbr)) {
                spawnPos = [i, j];
                break;
            }
        }
    }
    if (!spawnPos) return;

    const r = Math.random();
    const mob = {};
    mob.pos = spawnPos;
    mob.target = spawnPos;

    if (r < 0.1) {
        mob.name = "Make";
        mob.symbol = "M";
        mob.calcTarget = () => {
            if (rendered[mob.pos[0]][mob.pos[1]]) {
                movingAIs.towardsPos(mob, pos)
            } else {
                movingAIs.random(mob);
            }
        };
    } else if (r > 0.9) {
        mob.name = "Pekka";
        mob.symbol = "P";
        mob.calcTarget = () => {
            if (rendered[mob.pos[0]][mob.pos[1]]) {
                movingAIs.towardsPos(mob, pos)
            } else {
                movingAIs.random(mob);
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
    info.innerHTML += "\nTurn " + timeTracker.timer;
    status.innerHTML = "";

    for (let mob of mobs) {
        let mobInTheWay = false;

        for (let otherMob of mobs) {
            if (otherMob.pos[0] === mob.target[0] && otherMob.pos[1] === mob.target[1]) {
                mobInTheWay = true;
            }
        }

        if (isNextTo(pos, mob.pos)) {
            status.innerHTML = mob.name + " hits you! You die...";
            document.removeEventListener("keydown", keypressListener);
        } else if (!(pos[0] === mob.target[0] && pos[1] === mob.target[1]) 
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
        mob.calcTarget();
    }
    renderAll();
    trySpawnMob();
    timeTracker.timer++;
    if (timeTracker.turnsUntilShoot > 0) timeTracker.turnsUntilShoot--;
}

async function shoot(drc) {
    let bulletPos = pos.slice();
    document.removeEventListener("keydown", shootListener);

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
        }
        const prevSymbol = area[prevBulletPos[0]][prevBulletPos[1]].innerHTML;
        area[prevBulletPos[0]][prevBulletPos[1]].innerHTML = "o";
        await new Promise(r => setTimeout(r, 30));
        area[prevBulletPos[0]][prevBulletPos[1]].innerHTML = prevSymbol;

        for (let i = 0; i < mobs.length; i++) {
            if (bulletPos[0] === mobs[i].pos[0] && bulletPos[1] === mobs[i].pos[1]) {
                mobs.splice(i, 1);
                document.addEventListener("keydown", keypressListener);
                processTurn();
                area[bulletPos[0]][bulletPos[1]].innerHTML = "x";
                return;
            }
        }
    }
    document.addEventListener("keydown", keypressListener);
    processTurn();
}

const shootListener = e => shoot(e.key);
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
                    if (tps[lvl][0] === pos[0] && tps[lvl][1] === pos[1]) {
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
                timeTracker.turnsUntilShoot = 70;
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
        if (pos[0] === mob.pos[0] && pos[1] === mob.pos[1]) {
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
