const storyEvents = {
    items: [], // these have to be up to date every time an event is executed
    mobs: [],
    levels: {},
    level: [],
    player: {},
    stateChange: {
        "Shady guy": {
            1: function() {
                storyEvents.items.push({
                    name: "some money",
                    symbol: "$",
                    hidden: true,
                    pos: [0, 4]
                });
            }
        },
        "Some guy": {
            1: function() {
    
                // TODO: should state change story event be fired when it's changed here in an event?
    
                for (let mob of storyEvents.levels["Ukko's House"].mobs) {
                    if (mob.name === "Ukko") {
                        mob.state = 0;
                        break;
                    }
                }
            },
            2: function() {
                for (let mob of storyEvents.levels["Ukko's House"].mobs) {
                    if (mob.name === "Ukko") {
                        mob.state = 0;
                        break;
                    }
                }
            }
        }
    },
    beforeInteract: {
        "a chest": function() {
            let playerHasKey = false;

            for (let item of storyEvents.player.inventory) {
                if (item.name === "a key") {
                    playerHasKey = true;
                    break;
                }
            }
            if (playerHasKey) {
                for (let item of storyEvents.items) {
                    if (item.name === "a chest") {
                        item.state = 1;
                        break;
                    }
                }
            }
        }
    }
};
