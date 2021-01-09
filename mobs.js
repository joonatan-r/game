// level, rendered from level.js
// bresenham, coordsEq, getCoordsNextTo, getSecondBestDirections, movePosToDrc, 
// oppositeDrcs from util.js

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

const Shady_Guy = {
    name: "Shady guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [23, 30],
    talk: function(showDialog, outputElement) {
        switch (this.state) {
            case 0:
                outputElement.textContent = "[" + this.name + "]: Hey man, I heard there's some money hidden behind Ukko's house!";
                this.state = 1;
                return true;
            case 1:
                outputElement.textContent = "[" + this.name + "]: Did you check the place?";
                return true;
            default:
                return false;
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
    talk: function(showDialog, outputElement) {
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
};
const Some_Guy = {
    name: "Some guy",
    symbol: "@",
    isHostile: false,
    state: 0,
    pos: [13, 18],
    talk: function(showDialog, outputElement) {
        switch (this.state) {
            case 0:
                showDialog("[" + this.name + "]: Hello there!\n\nYour answer:", 
                        ["Hi!", "General Kenobi!", "[Don't answer]"], 
                        idx => {
                            this.state = { 0: 1, 1: 2, 2: 0 }[idx];
                            if (this.state !== 0) this.talk(showDialog, outputElement);
                        }
                );
                return false;
            case 1:
                outputElement.textContent = "[" + this.name + "]: So uncivilized!";
                return true;
            case 2:
                outputElement.textContent = "[" + this.name + "]: You are strong and wise, and I'm very proud of you!";
                return true;
            default:
                return false;
        }
    },
    calcTarget: function() { movingAIs.static(this) }
};
const Make = {
    name: "Make",
    symbol: "M",
    isHostile: true,
    calcTarget: function() {
        if (rendered[this.pos[0]][this.pos[1]] && this.huntingTarget) { // if player can see mob, mob can see player
            movingAIs.towardsPos(this, this.huntingTarget.pos);
        } else {
            movingAIs.random(this);
        }
    }
};
const Pekka = {
    name: "Pekka",
    symbol: "P",
    isHostile: true,
    isShooter: true,
    calcTarget: function() {
        if (rendered[this.pos[0]][this.pos[1]] && this.huntingTarget) {
            movingAIs.towardsStraightLineFromPos(this, this.huntingTarget.pos);
        } else {
            movingAIs.static(this);
        }
    }
};
const Jorma = {
    name: "Jorma",
    symbol: "J",
    isHostile: true,
    calcTarget: function() { movingAIs.random(this) }
};
const movingAIs = {
    static: mob => {
        mob.target = mob.pos.slice();
    },
    random: mob => {
        let drc;
        mob.target = mob.pos.slice();
    
        while (1) {
            const prevTarget = mob.target.slice();
            drc = getRandomInt(1, 8);

            if (drc === 5) drc = 9;

            movePosToDrc(mob.target, "" + drc);

            if (mob.target[0] > level.length - 1 || mob.target[1] > level[0].length - 1 
                || mob.target[0] < 0 || mob.target[1] < 0
                || level[mob.target[0]][mob.target[1]] === ""
            ) {
                    mob.target = prevTarget.slice();
                    continue;
            }
            break;
        }
    },
    towardsPos: (mob, targetPos) => {
        bresenham(mob.pos[0], mob.pos[1], targetPos[0], targetPos[1], (y, x) => {
            if (coordsEq([y, x], mob.pos)) {
                return "ok";
            }
            mob.target = [y, x];
            return "stop";
        });
        const drcs = getCoordsNextTo(mob.pos);
        const excluded = [];
        const drcQueue = [mob.target];

        if (level[mob.target[0]][mob.target[1]] === "") {
            if (!mob.alreadyTried) mob.alreadyTried = [];

            // better ability to go around walls when not backtracking 
            // while blocked on consecutive turns
            mob.alreadyTried.push(mob.pos);
            excluded.push(...mob.alreadyTried);

            while (1) {
                const currentDrc = drcQueue.shift();
                const newDrcs = getSecondBestDirections(drcs, currentDrc, excluded);

                for (let d of newDrcs) {
                    if (d.length === 0) continue;
                    if (!level[d[0]] || typeof level[d[0]][d[1]] === "undefined") continue;
                    if (level[d[0]][d[1]] !== "") {
                        mob.target = d;
                        return;
                    } else {
                        drcQueue.push(d);
                        excluded.push(currentDrc);
                    }
                }
            }
        } else {
            mob.alreadyTried = [];
        }
    },
    towardsStraightLineFromPos: (mob, fromPos) => {
        let min = { pos: null, dist: null };
        mob.straightLineToTargetDrc = null;

        // find closest pos where straight line to target

        for (let drc of "12346789") {
            const lineDrawPos = fromPos.slice();
            let distanceToMob = null;
            let prevDistance = null;

            while (1) {
                movePosToDrc(lineDrawPos, drc);

                if (!level[lineDrawPos[0]] || !level[lineDrawPos[0]][lineDrawPos[1]]
                    || level[lineDrawPos[0]][lineDrawPos[1]] === "") break;
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
            movingAIs.towardsPos(mob, min.pos);
        } else {
            mob.target = mob.pos.slice();
        }
    }
};
