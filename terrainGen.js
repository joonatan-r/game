import { getRandomInt } from "./util.js";

const SIZE_Y = 25;
const SIZE_X = 40;
const SIDE_X_MAX = SIZE_X / 8;
const SIDE_Y_MAX = SIZE_Y / 4;
let level = [];
let rects = [];
let visitedWalls = [0, 0, 0, 0];
let toBeFilledQueue = [];
let edgesToBeFilledQueue = [];
let filling = ".";

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i][j] = "w";
    }
}

// which side the rect expands to, after the start pos and dir are decided
// first means the first to be encountered when traversing the directions clockwise
const Sides = {
    first: 0,
    second: 1,
};
const Directions = {
    left: 0,
    up: 1,
    right: 2,
    down: 3,
};
const OppositeDrcs = {
    2: 0,
    3: 1,
    0: 2,
    1: 3,
};

class Rect {
    edges = [];

    constructor(height, width, pos, dir, side, version) {
        this.height = height;
        this.width = width;
        this.pos = pos; // corner, start pos for rect
        this.dir = dir;
        this.side = side;

        filling = ".";

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const coords = [];
                const coordsDirs = [];
                let isEdge = false;

                // calculate the table coordinates of this point in the rect
                switch (dir) {
                    case Directions.left:
                        coords[0] = side === Sides.first
                            ? pos[0] + i
                            : pos[0] - i;
                        coords[1] = pos[1] - j;
                        coordsDirs[0] = side === Sides.first
                            ? Directions.down
                            : Directions.up;
                        coordsDirs[1] = Directions.left;
                        break;
                    case Directions.up:
                        coords[0] = pos[0] - i;
                        coords[1] = side === Sides.first
                            ? pos[1] - j
                            : pos[1] + j;
                        coordsDirs[0] = Directions.up;
                        coordsDirs[1] = side === Sides.first
                            ? Directions.left
                            : Directions.right;
                        break;
                    case Directions.right:
                        coords[0] = side === Sides.first
                            ? pos[0] - i
                            : pos[0] + i;
                        coords[1] = pos[1] + j;
                        coordsDirs[0] = side === Sides.first
                            ? Directions.up
                            : Directions.down;
                        coordsDirs[1] = Directions.right;
                        break;
                    case Directions.down:
                        coords[0] = pos[0] + i;
                        coords[1] = side === Sides.first
                            ? pos[1] + j
                            : pos[1] - j;
                        coordsDirs[0] = Directions.down;
                        coordsDirs[1] = side === Sides.first
                            ? Directions.right
                            : Directions.left;
                        break;
                }
                if (coords[0] < 0 || coords[1] < 0 || coords[0] >= SIZE_Y || coords[1] >= SIZE_X) {
                    // NOTE: now this side won't have any edge points
                    continue;
                }
                if (i === 0 || j === 0 || i === height - 1 || j === width - 1) {
                    let edgeDir;

                    // decide edge's direction based on which axis is the limiting one

                    // TODO maybe add both directions to corners

                    if (i === height - 1) {
                        edgeDir = coordsDirs[0];
                    } else if (j === width - 1) {
                        edgeDir = coordsDirs[1];
                    } else if (i === 0) {
                        edgeDir = OppositeDrcs[coordsDirs[0]];
                    } else if (j === 0 ) {
                        edgeDir = OppositeDrcs[coordsDirs[1]];
                    }
                    this.edges.push({
                        pos: coords,
                        dir: edgeDir,
                    });
                    isEdge = true;
                }
                if (coords[0] === 0) {
                    visitedWalls[0] = 1;
                }
                if (coords[1] === 0) {
                    visitedWalls[1] = 1;
                }
                if (coords[0] === SIZE_Y - 1) {
                    visitedWalls[2] = 1;
                }
                if (coords[1] === SIZE_X - 1) {
                    visitedWalls[3] = 1;
                }
                if (i === height - 1 && j === width - 1
                    && level[coords[0]][coords[1]] === "."
                ) {
                    // if this rect would end up in another rect, 
                    // instead put wall there. edges will never add walls to prevent
                    // unreachable areas
                    filling = "w";
                }
                if (isEdge) {
                    edgesToBeFilledQueue.push(coords);
                } else {
                    toBeFilledQueue.push(coords);
                }
            }
        }
        if (version !== 0 || filling !== "w") {
            for (const coords of toBeFilledQueue) {
                level[coords[0]][coords[1]] = filling;
            }
        }
        // edges will always be open to prevent unreachable areas
        for (const coords of edgesToBeFilledQueue) {
            level[coords[0]][coords[1]] = ".";
        }
        toBeFilledQueue = [];
        edgesToBeFilledQueue = [];
    }
}

function tryGetStartPos(force, version) {
    const rect = rects[0]; // always uses the most recent rect as source
    const arr = version === 1
        ? rect.edges
        : rect.edges
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value); // shuffle

    for (const edge of arr) {
        if ((version === 0 && edge.dir === rect.dir)
            || Math.random() < 1 / rect.edges.length 
            || force
        ) {
            if (edge.dir === OppositeDrcs[rect.dir] && !force) {
                return null;
            }
            return {
                pos: edge.pos,
                dir: rect.dir,
                edgeDir: edge.dir,
            };
        }
    }
    return null;
}

function addRect(version) {
    let startInfo = null;
    // let dir = RI(0,3);
    let side = getRandomInt(0,1);
    let maxIters = 1000;

    while (startInfo === null) startInfo = tryGetStartPos(--maxIters < 1, version);
    // ensure new rect never goes opposite to its source rect's dir 
    // or the source edge's dir (i.e. inside the source rect)
    // while (dir === OppositeDrcs[startInfo.dir]
    //        || dir === OppositeDrcs[startInfo.edgeDir]) dir = RI(0,3);

    let dir = startInfo.edgeDir; // TODO clean this

    const rect = new Rect(
        getRandomInt(1, SIDE_Y_MAX),
        getRandomInt(1, SIDE_X_MAX),
        startInfo.pos,
        dir,
        side,
    );
    rects.unshift(rect);
}

export function generateLevel(startPoint) {
    level = [];
    rects = [];
    visitedWalls = [0, 0, 0, 0];
    toBeFilledQueue = [];
    edgesToBeFilledQueue = [];
    filling = ".";
    
    for (let i = 0; i < SIZE_Y; i++) {
        level.push([]);
      
        for (let j = 0; j < SIZE_X; j++) {
            level[i][j] = "w";
        }
    }
    let version = Math.random() < 0.7 ? 0 : 1;
    let startDir;
    console.log(version)

    if (startPoint[0] === 0) {
        startDir = Directions.down;
    } else if (startPoint[0] === SIZE_Y - 1) {
        startDir = Directions.up;
    } else if (startPoint[1] === 0) {
        startDir = Directions.right;
    } else if (startPoint[1] === SIZE_X - 1) {
        startDir = Directions.left;
    } else {
        startDir = getRandomInt(0, 3);
    }
    const startRect = new Rect(
        getRandomInt(1, SIDE_Y_MAX),
        getRandomInt(1, SIDE_X_MAX),
        startPoint,
        startDir,
        getRandomInt(0,1),
        version,
    );
    rects.unshift(startRect);
    let doLoop = true;

    while (doLoop) {
        addRect(version);

        let sum = 0;

        for (const wall of visitedWalls) {
            sum += wall;
        }
        if (sum > 3) {
            doLoop = false;
        }
    }
    return level;
}
