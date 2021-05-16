const events = {
    items: [], // these have to be up to date every time an event is executed
    mobs: [],
    levels: {},
    level: [],
    player: {},
    stateChange: {
        "Shady guy": function(mob) {
            switch(mob.state) {
                case 1:
                    events.items.push({
                        name: "some money",
                        symbol: "$",
                        hidden: true,
                        pos: [0, 4]
                    });
                    break;
            }
        },
        "Some guy": function(mob) {
            // TODO: should state change story event be fired when it's changed here in an event?
            switch (mob.state) {
                case 1:
                case 2:
                    for (let mob of events.levels["Ukko's House"].mobs) {
                        if (mob.name === "Ukko") {
                            mob.state = 0;
                            break;
                        }
                    }
                    break;
            }
        }
    },
    onInteract: {
        "a chest": function(item) {
            let playerHasKey = false;

            for (let item of events.player.inventory) {
                if (item.name === "a key") {
                    playerHasKey = true;
                    break;
                }
            }
            if (playerHasKey) {
                item.state = 1;
            }
        }
    }
};
