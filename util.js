// Bresenham's algorithm, modified to work for all directions

function renderLine(y0, x0, y1, x1) {
    let swapYX = false;
    let mirrorY = false;
    let mirrorX = false;

    if (y0 > y1) {
        y1 = 2 * y0 - y1;
        mirrorY = true;
    }
    if (x0 > x1) {
        x1 = 2 * x0 - x1;
        mirrorX = true;
    }
    let dx = x1 - x0;
    let dy = y1 - y0;

    if (dy > dx) {
        const tempDy = dy;
        const tempY0 = y0;
        const tempY1 = y1;
        dy = dx;
        dx = tempDy;
        y0 = x0;
        x0 = tempY0;
        y1 = x1;
        x1 = tempY1;
        swapYX = true;
    }
    const incrE = 2 * dy;
    const incrNE = 2 * (dy - dx);
    let d = 2 * dy - dx;
    let x = x0;
    let y = y0;
    let val = "";

    while (x <= x1) {
        if (swapYX) {
            val = render(x, y, x0, y0, mirrorY, mirrorX);
        } else {
            val = render(y, x, y0, x0, mirrorY, mirrorX);
        }
        if (val === "stop") {
            return;
        }
        if (d <= 0) {
            d += incrE;
            x++;
        } else {
            d += incrNE;
            x++;
            y++;
        }
    }
}

function render(y, x, y0, x0, mirrorY, mirrorX) {
    if (mirrorY) {
        y = 2 * y0 - y;
    }
    if (mirrorX) {
        x = 2 * x0 - x;
    }
    area[y][x].innerHTML = level[y][x];
    rendered[y][x] = true;

    if (level[y][x] === "") { // wall blocks sight
        return "stop";
    }
    return "ok";
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCoordsNextTo(pos) {
    return [        
        [pos[0], pos[1] - 1], // l
        [pos[0] - 1, pos[1] - 1], // tl
        [pos[0] - 1, pos[1]], // t
        [pos[0] - 1, pos[1] + 1], // tr
        [pos[0], pos[1] + 1], // r
        [pos[0] + 1, pos[1] + 1], // br
        [pos[0] + 1, pos[1]], // b
        [pos[0] + 1, pos[1] - 1] // bl
    ];
}

function isNextTo(coord1, coord2, includeDiag) {
    includeDiag = (typeof includeDiag !== "undefined") ? includeDiag : true;

    if (coordsEq([coord1[0], coord1[1] - 1], coord2)
        || coordsEq([coord1[0], coord1[1] + 1], coord2)
        || coordsEq([coord1[0] - 1, coord1[1]], coord2)
        || coordsEq([coord1[0] + 1, coord1[1]], coord2)
        || includeDiag && (
           coordsEq([coord1[0] - 1, coord1[1] - 1], coord2)
        || coordsEq([coord1[0] + 1, coord1[1] - 1], coord2)
        || coordsEq([coord1[0] - 1, coord1[1] + 1], coord2)
        || coordsEq([coord1[0] + 1, coord1[1] + 1], coord2)
        )
    ) {
        return true;
    }
    return false;
}

function coordsEq(coord1, coord2) {
    if (coord1[0] === coord2[0] && coord1[1] === coord2[1]) return true;
    return false;
}

movingAIs = {
    random: mob => {
        let drc;
        mob.target = mob.pos.slice();
    
        while (1) {
            const prevTarget = mob.target.slice();
            drc = getRandomInt(1, 8);
    
            switch (drc) {
                case 1:
                    mob.target[1]--;
                    break;
                case 2:
                    mob.target[1]++;
                    break;
                case 3:
                    mob.target[0]--;
                    break;
                case 4:
                    mob.target[0]++;
                    break;
                case 5:
                    mob.target[1]--;
                    mob.target[0]--;
                    break;
                case 6:
                    mob.target[1]--;
                    mob.target[0]++;
                    break;
                case 7:
                    mob.target[1]++;
                    mob.target[0]--;
                    break;
                case 8:
                    mob.target[1]++;
                    mob.target[0]++;
                    break;
            }
            if (mob.target[0] > level.length - 1 || mob.target[1] > level[0].length - 1 
                || mob.target[0] < 0 || mob.target[1] < 0
                || level[mob.target[0]][mob.target[1]] === "") {
                    mob.target = prevTarget.slice();
                    continue;
            }
            break;
        }
    },
    towardsPos: (mob, targetPos) => {
        let y0 = mob.pos[0];
        let x0 = mob.pos[1];
        let y1 = targetPos[0];
        let x1 = targetPos[1];
        let swapYX = false;
        let mirrorY = false;
        let mirrorX = false;

        if (y0 > y1) {
            y1 = 2 * y0 - y1;
            mirrorY = true;
        }
        if (x0 > x1) {
            x1 = 2 * x0 - x1;
            mirrorX = true;
        }
        let dx = x1 - x0;
        let dy = y1 - y0;

        if (dy > dx) {
            const tempDy = dy;
            const tempY0 = y0;
            const tempY1 = y1;
            dy = dx;
            dx = tempDy;
            y0 = x0;
            x0 = tempY0;
            y1 = x1;
            x1 = tempY1;
            swapYX = true;
        }
        const incrE = 2 * dy;
        const incrNE = 2 * (dy - dx);
        let d = 2 * dy - dx;
        let x = x0;
        let y = y0;

        if (d <= 0) {
            d += incrE;
            x++;
        } else {
            d += incrNE;
            x++;
            y++;
        }
        if (swapYX) {
            if (mirrorY) {
                x = 2 * x0 - x;
            }
            if (mirrorX) {
                y = 2 * y0 - y;
            }
            mob.target = [x, y];
        } else {
            if (mirrorY) {
                y = 2 * y0 - y;
            }
            if (mirrorX) {
                x = 2 * x0 - x;
            }
            mob.target = [y, x];
        }

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
    }
};

function getSecondBestDirections(drcs, currentDrc, excluded) {
    const retDrcs = [];

    for (let d of drcs) {
        let skip = false;

        for (let coord of excluded) {
            if (coordsEq(d, coord)) {
                skip = true;
            }
        };
        if (!skip && isNextTo(d, currentDrc, false)) retDrcs.push(d);
    };
    return retDrcs;
}