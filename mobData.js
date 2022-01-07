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
    speedModulus: 2,
    movingFunction: "Pekka"
};
const Jorma = {
    name: "Jorma",
    symbol: "J",
    isHostile: true,
    speedModulus: 2,
    movingFunction: "random"
};

export const hostileMobTypes = [Make, Pekka, Jorma];
