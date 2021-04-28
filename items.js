
function addItems(levels) {
    levels["Village"].items.push({
        name: "a chest",
        symbol: "(",
        blocksTravel: true,
        state: 0,
        pos: [9, 22],
        onInteract: function() {
            switch (this.state) {
                case 0:
                    showMsg("You try to loot " + this.name + ", but it's locked.");
                    break;
                case 1:
                    showMsg("You try to loot " + this.name + ", but it's empty.");
                    break;
            }
        }
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
