// Bresenham's algorithm, modified to work for all directions

function bresenham(y0, x0, y1, x1, onNewPos) {
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
    let y_temp, x_temp;

    while (x <= x1) {
        if (swapYX) {
            y_temp = mirrorY ? 2 * x0 - x : x;
            x_temp = mirrorX ? 2 * y0 - y : y;
        } else {
            y_temp = mirrorY ? 2 * y0 - y : y;
            x_temp = mirrorX ? 2 * x0 - x : x;
        }
        if (onNewPos(y_temp, x_temp) === "stop") {
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

makeTextFile.textFile = null;

function makeTextFile(text) {
    const data = new Blob([text], {type: "text/plain"});

    if (makeTextFile.textFile !== null) {
        window.URL.revokeObjectURL(makeTextFile.textFile);
    }
    makeTextFile.textFile = window.URL.createObjectURL(data);
    return makeTextFile.textFile;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function removeByReference(arr, obj) {
    let index = arr.indexOf(obj);

    if (index !== -1) {
        arr.splice(index, 1);
    }
}

function pixelCoordsToDrc(y, x) {
    if (x === 0) {
        if (y > 0) return "2"; // b
        else return "8"; // t
    } else {
        let val = y/x;

        if (val > -0.4142 && val < 0.4142) {
            if (x > 0) return "6"; // r
            else return "4"; // l
        } else if (val > -2.4142 && val < -0.4142) {
            if (x > 0) return "9"; // tr
            else return "1"; // bl
        } else if (val > 0.4142 && val < 2.4142) {
            if (x > 0) return "3"; // br
            else return "7"; // tl
        } else {
            if (y > 0) return "2"; // b
            else return "8"; // t
        }
    }
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

function movePosToDrc(posToMove, drc) {
    switch (drc) {
        case "4":
            posToMove[1]--;
            break;
        case "6":
            posToMove[1]++;
            break;
        case "8":
            posToMove[0]--;
            break;
        case "2":
            posToMove[0]++;
            break;
        case "7":
            posToMove[1]--;
            posToMove[0]--;
            break;
        case "1":
            posToMove[1]--;
            posToMove[0]++;
            break;
        case "9":
            posToMove[1]++;
            posToMove[0]--;
            break;
        case "3":
            posToMove[1]++;
            posToMove[0]++;
            break;
    }
}

const oppositeDrcs = {
    "1": "9",
    "2": "8",
    "3": "7",
    "4": "6",
    "6": "4",
    "7": "3",
    "8": "2",
    "9": "1",
};

function isWall(tile) {
    return tile === "*w" || tile === "*f" || tile === "*s";
}

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
