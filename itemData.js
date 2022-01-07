export function addItems(levels) {
    levels["Village"].items.push({
        name: "a chest",
        symbol: "(",
        blocksTravel: true,
        state: 0,
        pos: [9, 22]
    });
    levels["Wilderness"].items.push({
        name: "a key",
        symbol: "\u00A3",
        pos: [12, 27]
    }, {
        name: "a weird object",
        symbol: "?",
        hidden: true,
        pos: [3, 8]
    });
}
