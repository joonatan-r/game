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

movingAIs = {
    random: mob => {
        let dir;
        mob.target = mob.pos.slice();
    
        while (1) {
            const prevTarget = mob.target.slice();
            dir = getRandomInt(1, 8);
    
            switch (dir) {
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
    }
};
