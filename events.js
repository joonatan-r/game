const events = {
    updateFields: function(items, mobs, levels, level, player) {
        events.items = items;
        events.mobs = mobs;
        events.levels = levels;
        events.level = level;
        events.player = player;
    },
    onInteract: {
        "Ukko": function(mob, showMsg, showDialog) {
            switch (mob.state) {
                case 0:
                    showMsg("[" + mob.name + "]: I heard that you talked to that guy in the random house.");
                    break;
                case 9001:
                    showDialog("[" + mob.name + "]:\n\nHi! Give me a random number.\n\n[Your answer]:", 
                            ["No.", "Why?", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", 
                             "14", "15", "16", "17", "18", "19", "20"], 
                            idx => {
                                switch (idx) {
                                    case 0:
                                        showMsg("[" + mob.name + "]: Well screw you, too!");
                                        break;
                                    case 1:
                                        showMsg("[" + mob.name + "]: Why not?");
                                        break;
                                    default:
                                        showMsg("[" + mob.name + "]: That's a nice one dude!");
                                }
                            }
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
                    showDialog("[" + mob.name + "]:\n\nHello there!\n\n[Your answer]:", 
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

export default events;
