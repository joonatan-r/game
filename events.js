const events = {
    items: [], // { these have to be up to date every time an event is executed
    mobs: [],
    levels: {},
    level: [],
    player: {}, // }
    onInteract: {
        "Ukko": function(mob, showMsg, showDialog) {
            switch (mob.state) {
                case 0:
                    showMsg("[" + mob.name + "]: I heard that you talked to that guy in the random house.");
                    break;
                case 9001:
                    showDialog("[" + mob.name + "]: Hi! I have over 9 options.\n\nYour answer:", 
                            ["option 1", "option 2", "option 3", "option 4", "option 5", "option 6", "option 7", 
                             "option 8", "option 9", "option 10", "option 11", "option 12", "option 13", "option 14", 
                             "option 15", "option 16", "option 17", "option 18", "option 19", "option 20"], 
                            idx => showMsg("You selected option " + (idx + 1) + ".")
                    );
                    break;
            }
        },
        "Shady guy": function(mob, showMsg, showDialog) {
            switch (mob.state) {
                case 0:
                    showMsg("[" + mob.name + "]: Hey man, I heard there's some money hidden behind Ukko's house!");
                    mob.state = 1;
                    events.items.push({
                        name: "some money",
                        symbol: "$",
                        hidden: true,
                        pos: [0, 4]
                    });
                    break;
                case 1:
                    showMsg("[" + mob.name + "]: Did you check the place?");
                    break;
            }
        },
        "Some guy": function(mob, showMsg, showDialog) {
            switch (mob.state) {
                case 0:
                    showDialog("[" + mob.name + "]: Hello there!\n\nYour answer:", 
                            ["Hi!", "General Kenobi!", "[Don't answer]"], 
                            idx => {
                                mob.state = { 0: 1, 1: 2, 2: 0 }[idx];

                                if (mob.state !== 0) {
                                    for (let mob of events.levels["Ukko's House"].mobs) {
                                        if (mob.name === "Ukko") {
                                            mob.state = 0;
                                            break;
                                        }
                                    }
                                    // call again to talk immediately
                                    events.onInteract["Some guy"](mob, showMsg, showDialog);
                                }
                            }
                    );
                    break;
                case 1:
                    showMsg("[" + mob.name + "]: So uncivilized!");
                    break;
                case 2:
                    showMsg("[" + mob.name + "]: You are strong and wise, and I'm very proud of you!");
                    break;
            }
        },
        "a chest": function(item, showMsg) {
            let playerHasKey = false;

            for (let invItem of events.player.inventory) {
                if (invItem.name === "a key") {
                    playerHasKey = true;
                    break;
                }
            }
            if (playerHasKey) {
                item.state = 1;
            }
            switch (item.state) {
                case 0:
                    showMsg("You try to loot " + item.name + ", but it's locked.");
                    break;
                case 1:
                    showMsg("You try to loot " + item.name + ", but it's empty.");
                    break;
            }
        }
    }
};
