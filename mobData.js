export function addMobs(levels) {
    levels["Start of uncharted"].mobs.push(Scared_Traveller);
}

export const mobDefaultImageBase = { start: "url(\"./mobImagesAlt/mob_", end: ".png\")" };

const Scared_Traveller = {
    name: "Scared Traveller",
    symbol: "@",
    // imageBase: { start: "url(\"./mobImages/mob_", end: ".png\")" },
    isHostile: false,
    stayStillForInteract: true,
    state: 0,
    pos: [18, 6],
    speedModulus: 1.2,
    movingFunction: "random"
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
