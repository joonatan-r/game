// bresenham, coordsEq, getCoordsNextTo, getSecondBestDirections, isWall, movePosToDrc, oppositeDrcs from util.js

function createMobOfType(mobType) {
    return {
        name: mobType.name,
        symbol: mobType.symbol,
        isHostile: mobType.isHostile,
        isShooter: mobType.isShooter,
        talk: mobType.talk,
        calcTarget: mobType.calcTarget
    };
}

function addMobs(levels) {
    levels["Village"].mobs.push(Shady_Guy);
    levels["Ukko's House"].mobs.push(Ukko);
    levels["Random House"].mobs.push(Some_Guy);
    levels["Wilderness"].spawnDistribution = {
        "Make": { mob: Make, prob: 0.2 },
        "Pekka": { mob: Pekka, prob: 0.2 },
        "Jorma": { mob: Jorma, prob: 0.6 }
    };
}

function trySpawnMob(levels, rendered) {
    let spawnPos = null;
    let notRenderedNbr = 1;
    let level = levels[levels.currentLvl].level;
    let spawnDistr = levels[levels.currentLvl].spawnDistribution;

    if (Object.keys(spawnDistr).length === 0) return null;

    for (let i = 0; i < level.length; i++) {
        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j] && !isWall(level[i][j])) notRenderedNbr++;
        }
    }
    for (let i = 0; i < level.length; i++) {
        if (spawnPos) break;

        for (let j = 0; j < level[0].length; j++) {
            if (!rendered[i][j] && !isWall(level[i][j]) && Math.random() < (1 / notRenderedNbr)) {
                spawnPos = [i, j];
                break;
            }
        }
    }
    if (!spawnPos) return null;

    const r = Math.random();
    let mob;
    let cumulativeProb = 0;

    for (let key of Object.keys(spawnDistr)) {
        cumulativeProb += spawnDistr[key].prob;

        if (r < cumulativeProb) {
            mob = createMobOfType(spawnDistr[key].mob);
            break;
        }  
    }
    mob.pos = spawnPos;
    return mob;
}

const Shady_Guy = {
    name: "Shady guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [23, 30],
    talk: function(showDialog, showMsg, onStateChange) {
        switch (this.state) {
            case 0:
                showMsg("[" + this.name + "]: Hey man, I heard there's some money hidden behind Ukko's house!");
                this.state = 1;
                onStateChange(this);
                break;
            case 1:
                showMsg("[" + this.name + "]: Did you check the place?");
                break;
        }
    },
    calcTarget: function() { movingAIs.static(this) }
};
const Ukko = {
    name: "Ukko",
    symbol: "@",
    isHostile: false,
    state: 9001,
    pos: [11, 13],
    talk: function(showDialog, showMsg) {
        switch (this.state) {
            case 0:
                showMsg("[" + this.name + "]: I heard that you talked to that guy in the random house.");
                break;
            case 9001:
                showDialog("[" + this.name + "]: Hi! I have over 9 options.\n\nYour answer:", 
                        ["option 1", "option 2", "option 3", "option 4", "option 5", "option 6", "option 7", 
                         "option 8", "option 9", "option 10", "option 11", "option 12", "option 13", "option 14", 
                         "option 15", "option 16", "option 17", "option 18", "option 19", "option 20"], 
                        idx => showMsg("You selected option " + (idx+1) + ".")
                );
                break;
        }
    },
    calcTarget: function(posIsValid) {
        if (Math.random() < 0.5) {
            movingAIs.random(this, posIsValid);
        } else {
            movingAIs.static(this);
        }
    }
};
const Some_Guy = {
    name: "Some guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [13, 18],
    talk: function(showDialog, showMsg, onStateChange) {
        switch (this.state) {
            case 0:
                showDialog("[" + this.name + "]: Hello there!\n\nYour answer:", 
                        ["Hi!", "General Kenobi!", "[Don't answer]"], 
                        idx => {
                            this.state = { 0: 1, 1: 2, 2: 0 }[idx];

                            if (this.state !== 0) {
                                onStateChange(this);
                                this.talk(showDialog, showMsg);
                            }
                        }
                );
                break;
            case 1:
                showMsg("[" + this.name + "]: So uncivilized!");
                break;
            case 2:
                showMsg("[" + this.name + "]: You are strong and wise, and I'm very proud of you!");
                break;
        }
    },
    calcTarget: function() { movingAIs.static(this) }
};
const Make = {
    name: "Make",
    symbol: "M",
    isHostile: true,
    calcTarget: function(posIsValid, level, rendered) {
        if (rendered[this.pos[0]][this.pos[1]] && this.huntingTarget) { // if player can see mob, mob can see player
            movingAIs.towardsPos(this, this.huntingTarget.pos, posIsValid, level);
        } else {
            movingAIs.random(this, posIsValid);
        }
    }
};
const Pekka = {
    name: "Pekka",
    symbol: "P",
    isHostile: true,
    isShooter: true,
    calcTarget: function(posIsValid, level, rendered) {
        if (rendered[this.pos[0]][this.pos[1]] && this.huntingTarget) {
            movingAIs.towardsStraightLineFromPos(this, this.huntingTarget.pos, posIsValid, level);
        } else {
            movingAIs.static(this);
        }
    }
};
const Jorma = {
    name: "Jorma",
    symbol: "J",
    isHostile: true,
    calcTarget: function(posIsValid) { movingAIs.random(this, posIsValid) }
};
const movingAIs = {
    static: mob => {
        mob.target = mob.pos.slice();
    },
    random: (mob, posIsValid) => {
        let drc;
        mob.target = mob.pos.slice();
    
        while (1) {
            const prevTarget = mob.target.slice();
            drc = getRandomInt(1, 8);

            if (drc === 5) drc = 9;

            movePosToDrc(mob.target, "" + drc);

            if (!posIsValid(mob.target)) {
                mob.target = prevTarget.slice();
                continue;
            }
            break;
        }
    },
    towardsPos: (mob, targetPos, posIsValid, level) => {
        bresenham(mob.pos[0], mob.pos[1], targetPos[0], targetPos[1], (y, x) => {
            if (coordsEq([y, x], mob.pos)) {
                return "ok";
            }
            mob.target = [y, x];
            return "stop";
        });
        const drcs = getCoordsNextTo(mob.pos);
        const drcQueue = [mob.target];
        let excluded = [];
        let maxIters = 8;
        let currentDrc, newDrcs;

        if (!posIsValid(mob.target)) {
            if (!mob.alreadyVisited) mob.alreadyVisited = [];

            // better ability to go around obstacles when not backtracking 
            // while blocked on consecutive turns
            mob.alreadyVisited.push(mob.pos);
            excluded.push(...mob.alreadyVisited);

            while (maxIters--) {
                if (drcQueue.length === 0) {
                    // no other valid drcs, choose even if excluded
                    excluded = [];
                    mob.alreadyVisited = [];
                    newDrcs = getSecondBestDirections(drcs, currentDrc, excluded);
                } else {
                    currentDrc = drcQueue.shift();
                    newDrcs = getSecondBestDirections(drcs, currentDrc, excluded);
                }
                for (let d of newDrcs) {
                    if (d.length === 0) continue;
                    if (!level[d[0]] || typeof level[d[0]][d[1]] === "undefined") continue;
                    if (posIsValid(d)) {
                        mob.target = d;
                        return;
                    } else {
                        // push invalid drc to queue to later getSecondBestDirections based on it
                        drcQueue.push(d);
                        excluded.push(currentDrc);
                    }
                }
            }
        } else {
            mob.alreadyVisited = [];
        }
    },
    towardsStraightLineFromPos: (mob, fromPos, posIsValid, level) => {
        let min = { pos: null, dist: null };
        mob.straightLineToTargetDrc = null;

        // find closest pos where straight line to target

        for (let drc of "12346789") {
            const lineDrawPos = fromPos.slice();
            let distanceToMob = null;
            let prevDistance = null;

            while (1) {
                movePosToDrc(lineDrawPos, drc);

                if (!level[lineDrawPos[0]] || typeof level[lineDrawPos[0]][lineDrawPos[1]] === "undefined"
                    || isWall(level[lineDrawPos[0]][lineDrawPos[1]])) break;
                if (distanceToMob) prevDistance = distanceToMob;

                // actually squared but doesn't matter
                distanceToMob = (mob.pos[0] - lineDrawPos[0])*(mob.pos[0] - lineDrawPos[0]) + 
                                    (mob.pos[1] - lineDrawPos[1])*(mob.pos[1] - lineDrawPos[1]);
                
                // moving farther, no point checking line to end
                if (prevDistance && distanceToMob >= prevDistance) break;
                if (distanceToMob === 0) mob.straightLineToTargetDrc = oppositeDrcs[drc]; 
                if (!min.dist || distanceToMob < min.dist) {
                    min.dist = distanceToMob;
                    min.pos = lineDrawPos.slice();
                }
            }
        }
        if (min.pos && !coordsEq(mob.pos, min.pos)) {
            movingAIs.towardsPos(mob, min.pos, posIsValid, level);
        } else {
            mob.target = mob.pos.slice();
        }
    }
};
