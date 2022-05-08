import { levelCharMap, levelTiles, levelTilesRaw } from "./levelData.js";
import { bresenham, coordsEq, getClosestSide, getRandomInt } from "./util.js";
import { createRandomMobSpawning } from "./mobs.js";

const SIZE_Y = 23;
const SIZE_X = 38;
const SIDE_X_MAX = SIZE_X / 6;
const SIDE_Y_MAX = SIZE_Y / 10;
let level = [];
let rects = [];
let visitedWalls = [0, 0, 0, 0];
let toBeFilledQueue = [];
let edgesToBeFilledQueue = [];
let filling = levelTilesRaw.floor;

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i][j] = levelTilesRaw.wall;
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

        filling = levelTilesRaw.floor;

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
                    && level[coords[0]][coords[1]] === levelTilesRaw.floor
                    && version === 1
                ) {
                    // if this rect would end up in another rect, 
                    // instead put wall there. edges will never add walls to prevent
                    // unreachable areas
                    filling = levelTilesRaw.wall;
                }
                if (isEdge) {
                    edgesToBeFilledQueue.push(coords);
                } else {
                    toBeFilledQueue.push(coords);
                }
            }
        }
        if (version !== 0 || filling !== levelTilesRaw.wall) {
            for (const coords of toBeFilledQueue) {
                level[coords[0]][coords[1]] = filling;
            }
        }
        // edges will always be open to prevent unreachable areas
        for (const coords of edgesToBeFilledQueue) {
            level[coords[0]][coords[1]] = levelTilesRaw.floor;
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

function generateLevel(startPoint) {
    let genStartPoint = startPoint.slice();
    level = [];
    rects = [];
    visitedWalls = [0, 0, 0, 0];
    toBeFilledQueue = [];
    edgesToBeFilledQueue = [];
    filling = levelTilesRaw.floor;
    
    for (let i = 0; i < SIZE_Y; i++) {
        level.push([]);
      
        for (let j = 0; j < SIZE_X; j++) {
            level[i][j] = levelTilesRaw.wall;
        }
    }
    let version = Math.random() < 0.7 ? 0 : 1;
    let startDir;
    // console.log(version)

    if (genStartPoint[0] > SIZE_Y - 1) {
        genStartPoint[0] = SIZE_Y - 1
    }
    if (genStartPoint[1] > SIZE_X - 1) {
        genStartPoint[1] = SIZE_X - 1
    }
    if (genStartPoint[0] === 0) {
        startDir = Directions.down;
    } else if (genStartPoint[0] === SIZE_Y - 1) {
        startDir = Directions.up;
    } else if (genStartPoint[1] === 0) {
        startDir = Directions.right;
    } else if (genStartPoint[1] === SIZE_X - 1) {
        startDir = Directions.left;
    } else {
        startDir = getRandomInt(0, 3);
    }
    const startRect = new Rect(
        getRandomInt(1, SIDE_Y_MAX),
        getRandomInt(1, SIDE_X_MAX),
        genStartPoint,
        startDir,
        getRandomInt(0,1),
        version,
    );
    rects.unshift(startRect);
    let wallNbr = 0;
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
    for (let i = 0; i < SIZE_Y; i++) {
        for (let j = 0; j < SIZE_X; j++) {
            if (level[i][j] === levelTilesRaw.wall) {
                wallNbr++;
            }
        }
    }
    // too open level, retry (NOTE: a bit inefficient)
    if (wallNbr < 0.4*SIZE_Y*SIZE_X) {
        return generateLevel(startPoint);
    }
    // generation uses a smaller level rectangle, now add walls around
    // (travel points will be inside the encasing walls) 
    const levelTop = [];
    const levelBottom = [];

    for (let j = 0; j < SIZE_X; j++) {
        levelTop.push(levelTilesRaw.wall);
        levelBottom.push(levelTilesRaw.wall);
    }
    level.unshift(levelTop);
    level.push(levelBottom);

    for (let i = 0; i < SIZE_Y + 2; i++) {
        level[i].unshift(levelTilesRaw.wall);
        level[i].push(levelTilesRaw.wall);
    }
    return level;
}

export function createNewLvl(name, levels, level, player) {
    const startPos = [];
    const frontOfStartPos = [];
    let newTravelPos = null;
    let extraTravelPos = null;
    const closestSide = getClosestSide(player.pos, level);

    switch (closestSide) {
        case "top":
            startPos[0] = level.length - 1;
            startPos[1] = player.pos[1];
            frontOfStartPos[0] = level.length - 2;
            frontOfStartPos[1] = player.pos[1];
            break;
        case "bottom":
            startPos[0] = 0;
            startPos[1] = player.pos[1];
            frontOfStartPos[0] = 1
            frontOfStartPos[1] = player.pos[1];
            break;
        case "left":
            startPos[0] = player.pos[0];
            startPos[1] = level[0].length - 1;
            frontOfStartPos[0] = player.pos[0];
            frontOfStartPos[1] = level[0].length - 2;
            break;
        case "right":
            startPos[0] = player.pos[0];
            startPos[1] = 0;
            frontOfStartPos[0] = player.pos[0];
            frontOfStartPos[1] = 1;
            break;
    }
    const generatedLvl = generateLevel(startPos);
    generatedLvl[startPos[0]][startPos[1]] = levelTilesRaw.doorWay;
    const newMemorized = [];
    const travelPoints = {};
    const openEdges = [];
    travelPoints[levels.currentLvl] = [startPos];

    for (let i = 0; i < level.length; i++) {
        newMemorized.push([]);

        for (let j = 0; j < level[0].length; j++) {
            newMemorized[i][j] = "";

            if (Object.keys(levelCharMap).indexOf(generatedLvl[i][j]) !== -1) {
                generatedLvl[i][j] = levelCharMap[generatedLvl[i][j]];
            }
            if (i === 1 && generatedLvl[i][j] === levelTiles.floor) {
                openEdges.push([0, j]);
            }
            if (j === 1 && generatedLvl[i][j] === levelTiles.floor) {
                openEdges.push([i, 0]);
            }
            if (i === level.length - 2 && generatedLvl[i][j] === levelTiles.floor) {
                openEdges.push([level.length - 1, j]);
            }
            if (j === level[0].length - 2 && generatedLvl[i][j] === levelTiles.floor) {
                openEdges.push([i, level[0].length - 1]);
            }
        }
    }
    // travel point to next to-be-generated lvl
    while (newTravelPos === null) newTravelPos = tryAddTravelPoint(openEdges, startPos);

    // random chance to connect to this level if not yet existing, instead of a new generated one
    if (levels["Crossroads"].tempTravelPoints && Math.random() < 0.2) {
        travelPoints["Crossroads"] = [[newTravelPos[0], newTravelPos[1]]];
    } else {
        travelPoints[levels.generatedIdx + 1] = [[newTravelPos[0], newTravelPos[1]]];
    }
    // after that, random chance to also connect here
    if (!levels["Strange cavern"].accessible
        && !levels["Crossroads"].tempTravelPoints
        && Math.random() < 0.2
    ) {
        const candidates = [];
        
        // TODO refactor for reusability
        for (let i = 0; i < level.length; i++) {
            candidates.push([i, 0]);
        }
        while (extraTravelPos === null) extraTravelPos = tryAddExtraTravelPoint(candidates, startPos, newTravelPos);

        travelPoints["Strange cavern"] = [[extraTravelPos[0], extraTravelPos[1]]];
        generatedLvl[extraTravelPos[0]][extraTravelPos[1]] = levelTiles.doorWay;
        levels["Strange cavern"].accessible = true;
        const frontOfTravelPos = [extraTravelPos[0], 1];
        bresenham(frontOfTravelPos[0], frontOfTravelPos[1], frontOfStartPos[0], frontOfStartPos[1], (y, x) => {
            if (generatedLvl[y][x] === levelTiles.floor) { // add corridor to make sure accessible
                return "stop";
            }
            generatedLvl[y][x] = levelTiles.floor;
            generatedLvl[y + 1] && (generatedLvl[y + 1][x] = levelTiles.floor);
            return "ok";
        });
    }
    generatedLvl[newTravelPos[0]][newTravelPos[1]] = levelTiles.doorWay;
    // because generation uses smaller level rectangle, start pos is shifted, this just ensures
    // the player doesn't need to move diagonally out of the start point
    generatedLvl[frontOfStartPos[0]][frontOfStartPos[1]] = levelTiles.floor;

    const spawns = createRandomMobSpawning();
    levels[name] = {
        level: generatedLvl,
        bg: "#282828",
        mobs: [],
        items: [],
        memorized: newMemorized,
        spawnRate: spawns.rate,
        spawnDistribution: spawns.distribution,
        travelPoints: travelPoints
    };
    levels.generatedIdx++;
}

function tryAddTravelPoint(openEdges, startPos) {
    for (const pos of openEdges) {
        if (pos[0] !== startPos[0] && pos[1] !== startPos[1] && Math.random() < 1 / openEdges.length) {
            return pos;
        }
    }
    return null;
}

function tryAddExtraTravelPoint(candidates, startPos, exitPos) {
    for (const pos of candidates) {
        if (!coordsEq(pos, startPos) && !coordsEq(pos, exitPos) && Math.random() < 1 / candidates.length) {
            return pos;
        }
    }
    return null;
}