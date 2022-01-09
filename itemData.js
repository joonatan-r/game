export function addItems(levels) {
    levels["Guard house"].items.push({
        name: "a chest",
        symbol: "(",
        blocksTravel: true,
        state: 0,
        pos: [11, 10]
    });
    levels["Start of uncharted"].items.push({
        name: "a key",
        symbol: "\u00A3",
        hidden: true,
        pos: [17, 28]
    }, {
        name: "a weird object",
        symbol: "?",
        pos: [8, 8]
    }, {
        name: "a gate",
        symbol: "|",
        blocksTravel: true,
        pos: [11, 17]
    });
    levels["Secret room"].items.push({
        name: "a strange device",
        symbol: "+",
        blocksTravel: true,
        pos: [13, 16]
    });
}
