import {
    bresenham, coordsEq, getCoordsNextTo, getSecondBestDirections, 
    getRandomInt, isWall, movePosToDrc, oppositeDrcs 
} from "./util.js";
import { hostileMobTypes } from "./mobData.js";

// NOTE: with current implementation, movingAIs towards* can't be directly used by a mob

export function createRandomMobSpawning() {
    if (Math.random() < 0.1) {
        return {
            rate: 0,
            distribution: {}
        };
    }
    const spawningMobs = [];
    const probs = [];
    const distribution = {};
    let probsSum = 0;

    for (const mob of hostileMobTypes) {
        if (Math.random() < 2 / hostileMobTypes.length) {
            const spawnProb = Math.random();
            spawningMobs.push(mob);
            probs.push(spawnProb);
            probsSum += spawnProb;
        }
    }
    for (let i = 0; i < spawningMobs.length; i++) {
        distribution[spawningMobs[i].name] = {
            mob: spawningMobs[i],
            prob: probs[i] / probsSum
        };
    }
    return {
        rate: spawningMobs.length === 0 ? 0 : Math.random() * 0.5,
        distribution: distribution
    };
}

export function trySpawnMob(levels, rendered) {
    let spawnPos = null;
    let notRenderedNbr = 1;
    const level = levels[levels.currentLvl].level;
    const spawnDistr = levels[levels.currentLvl].spawnDistribution;
    // linearily decrease chance based on currently existing mobs until 0 at 20 mobs
    const hostileMobsNbr = levels[levels.currentLvl].mobs.filter(mob => mob.isHostile).length;
    const spawnChance = levels[levels.currentLvl].spawnRate * (1 - (hostileMobsNbr / 20));

    if (spawnChance < Math.random()) return null;
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

function createMobOfType(mobType) {
    return {
        name: mobType.name,
        symbol: mobType.symbol,
        isHostile: mobType.isHostile,
        isShooter: mobType.isShooter,
        speedModulus: mobType.speedModulus,
        movingFunction: mobType.movingFunction
    };
}

// Functions set mob.target, which dictates where the mob will move next
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
        if (!mob.alreadyVisited) mob.alreadyVisited = [];
        // if already visited twice, moving will be stopped, else would just loop the same cycle
        if (!mob.alreadyVisitedTwice) mob.alreadyVisitedTwice = [];
        if (mob.prevTargetPos && !coordsEq(mob.prevTargetPos, targetPos)) {
            mob.alreadyVisited = [];
            mob.alreadyVisitedTwice = [];
        }
        mob.prevTargetPos = targetPos.slice();
        bresenham(mob.pos[0], mob.pos[1], targetPos[0], targetPos[1], (y, x) => {
            if (coordsEq([y, x], mob.pos)) {
                return "ok";
            }
            mob.target = [y, x];
            return "stop";
        });

        for (const coord of mob.alreadyVisited) {
            if (coordsEq(coord, mob.pos)) {
                mob.alreadyVisitedTwice.push(mob.pos);
            }
        }
        mob.alreadyVisited.push(mob.pos);

        if (!posIsValid(mob.target)) {
            const drcs = getCoordsNextTo(mob.pos);
            const drcQueue = [mob.target];
            // better ability to go around obstacles when not backtracking 
            // while blocked on consecutive turns
            let excluded = [...mob.alreadyVisited];
            let maxIters = 16;
            let currentDrc, newDrcs;

            while (maxIters--) {
                if (drcQueue.length === 0) {
                    // no other valid drcs, choose even if excluded
                    // put prev position to excluded to not just go back immediately
                    excluded = mob.prevPos ? [mob.prevPos] : [];
                } else {
                    currentDrc = drcQueue.shift();
                }
                newDrcs = getSecondBestDirections(drcs, currentDrc, excluded);
                
                for (let d of newDrcs) {
                    if (d.length === 0) continue;
                    if (!level[d[0]] || typeof level[d[0]][d[1]] === "undefined") continue;
                    if (posIsValid(d)) {
                        for (const coord of mob.alreadyVisitedTwice) {
                            if (coordsEq(coord, d)) {
                                mob.target = mob.pos;
                                return;
                            }
                        }
                        mob.target = d;
                        mob.prevPos = mob.pos;
                        return;
                    } else {
                        // push invalid drc to queue to later getSecondBestDirections based on it
                        drcQueue.push(d);
                        excluded.push(currentDrc);
                    }
                }
            }
        } else {
            for (const coord of mob.alreadyVisitedTwice) {
                if (coordsEq(coord, mob.target)) {
                    mob.target = mob.pos;
                    return;
                }
            }
            mob.prevPos = mob.pos;
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
