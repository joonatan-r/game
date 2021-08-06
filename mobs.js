import {
    bresenham, coordsEq, getCoordsNextTo, getSecondBestDirections, 
    getRandomInt, isWall, movePosToDrc, oppositeDrcs 
} from "./util.js";

// NOTE: with current implementation, movingAIs towards* can't be directly used by a mob

function createMobOfType(mobType) {
    return {
        name: mobType.name,
        symbol: mobType.symbol,
        isHostile: mobType.isHostile,
        isShooter: mobType.isShooter,
        movingFunction: mobType.movingFunction
    };
}

export function addMobs(levels) {
    levels["Village"].mobs.push(Shady_Guy);
    levels["Ukko's House"].mobs.push(Ukko);
    levels["Random House"].mobs.push(Some_Guy);
    levels["Wilderness"].spawnRate = 0.1;
    levels["Wilderness"].spawnDistribution = {
        "Make": { mob: Make, prob: 0.2 },
        "Pekka": { mob: Pekka, prob: 0.2 },
        "Jorma": { mob: Jorma, prob: 0.6 }
    };
}

export function trySpawnMob(levels, rendered) {
    let spawnPos = null;
    let notRenderedNbr = 1;
    let level = levels[levels.currentLvl].level;
    let spawnDistr = levels[levels.currentLvl].spawnDistribution;

    if (levels[levels.currentLvl].spawnRate < Math.random()) return null;
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
    movingFunction: "static"
};
const Ukko = {
    name: "Ukko",
    symbol: "@",
    isHostile: false,
    state: 9001,
    pos: [11, 13],
    movingFunction: "Ukko"
};
const Some_Guy = {
    name: "Some guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [13, 18],
    movingFunction: "static"
};
const Make = {
    name: "Make",
    symbol: "M",
    isHostile: true,
    movingFunction: "Make"
};
const Pekka = {
    name: "Pekka",
    symbol: "P",
    isHostile: true,
    isShooter: true,
    movingFunction: "Pekka"
};
const Jorma = {
    name: "Jorma",
    symbol: "J",
    isHostile: true,
    movingFunction: "random"
};
export const movingAIs = {
    Ukko: (mob, posIsValid) => {
        if (Math.random() < 0.5) {
            movingAIs.random(mob, posIsValid);
        } else {
            movingAIs.static(mob);
        }
    },
    Make: (mob, posIsValid, level, rendered) => {
        if (rendered[mob.pos[0]][mob.pos[1]] && mob.huntingTarget && mob.huntingTarget.pos) { // if player can see mob, mob can see player
            movingAIs.towardsPos(mob, mob.huntingTarget.pos, posIsValid, level);
        } else {
            movingAIs.random(mob, posIsValid);
        }
    },
    Pekka: (mob, posIsValid, level, rendered) => {
        mob.straightLineToTargetDrc = null;

        if (rendered[mob.pos[0]][mob.pos[1]] && mob.huntingTarget && mob.huntingTarget.pos) {
            movingAIs.towardsStraightLineFromPos(mob, mob.huntingTarget.pos, posIsValid, level);
        } else {
            movingAIs.static(mob);
        }
    },
    static: mob => {
        mob.target = [mob.pos[0], mob.pos[1]];
    },
    random: (mob, posIsValid) => {
        let drc;
        let maxIters = 50;
        mob.target = [mob.pos[0], mob.pos[1]];


        while (maxIters--) {
            const prevTarget = [mob.target[0], mob.target[1]];
            drc = getRandomInt(1, 8);

            if (drc === 5) drc = 9;

            movePosToDrc(mob.target, drc);

            if (!posIsValid(mob.target)) {
                mob.target = [prevTarget[0], prevTarget[1]];
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

        for (let drc of [1, 2, 3, 4, 6, 7, 8, 9]) {
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
            mob.target = [mob.pos[0], mob.pos[1]];
        }
    }
};
