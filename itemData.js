
export const itemDefaultImage = "url(\"./itemImages/item.png\")";

export function addItems(levels) {
    levels["Guard house"].items.push({
        name: "chest",
        symbol: "(",
        blocksTravel: true,
        state: 0,
        pos: [11, 10]
    });
    levels["Start of uncharted"].items.push({
        name: "key",
        symbol: "\u00A3",
        hidden: true,
        pos: [17, 28]
    }, {
        name: "weird object",
        symbol: "?",
        usable: "true",
        pos: [8, 8]
    }, {
        name: "gate",
        symbol: "|",
        image: "url(\"./itemImages/gate.png\")",
        blocksTravel: true,
        pos: [11, 17]
    });
    levels["Secret room"].items.push({
        name: "strange device",
        symbol: "+",
        image: "url(\"./itemImages/device.png\")",
        blocksTravel: true,
        pos: [13, 16]
    });
    levels["Strange cavern"].items.push({
        name: "strange device",
        symbol: "+",
        image: "url(\"./itemImages/device.png\")",
        blocksTravel: true,
        pos: [12, 15]
    });
}
