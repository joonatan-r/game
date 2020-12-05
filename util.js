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

    while(x <= x1) {
        if (swapYX) {
            const val = render(x, y, x0, y0, mirrorY, mirrorX);

            if (val === "stop") return;
        } else {
            const val = render(y, x, y0, x0, mirrorY, mirrorX);

            if (val === "stop") return;
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
