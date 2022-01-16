import { removeByReference } from "./util.js";

const events = {
    onStart: function(ui, currentState) {
        if (currentState.timeTracker.timer === 0) {
            currentState.setPause(true);
            ui.showDialog("Hello, adventurer!", ["Continue"], () => {
                currentState.setPause(false);
            });
        } else {
            currentState.setPause(true);
            ui.showDialog("Welcome back, adventurer!", ["Continue"], () => {
                currentState.setPause(false);
            });
        }
    },
    onEnterLevel: {
        "Start of uncharted": function(ui, currentState) {
            const memorized = currentState.levels["Start of uncharted"].memorized;
            let previouslyVisited = false;

            // TODO maybe improved way to check if previously visited

            for (const i of memorized) {
                for (const j of i) {
                    if (j !== "") {
                        previouslyVisited = true;
                        break;
                    }
                }
                if (previouslyVisited) break;
            }
            if (!previouslyVisited) {
                currentState.setPause(true);
                ui.showDialog("A great wall blocks the path. There seems to be only one closed gate.", ["Continue"], () => {
                    currentState.setPause(false);
                });
            }
        }
    },
    onInteract: {
        "Scared Traveller": function(mob, ui, currentState) {
            switch (mob.state) {
                case 0:
                    ui.showMsg("[" + mob.name + "]: Why are you here? Turn back while you still can!");
                    mob.state = 1;
                    break;
                case 1:
                    currentState.setPause(true);
                    ui.showDialog("[" + mob.name + "]:\n\nSince you seem bent on going on, would you like to know something?", 
                            ["Sure.", "No."], 
                            idx => {
                                switch (idx) {
                                    case 0:
                                        ui.showMsg("[" + mob.name + "]: I think there's something hidden in the area past the gate.");
                                        mob.state = 2;
                                        break;
                                    case 1:
                                        ui.showMsg("[" + mob.name + "]: Fair enough.");
                                        mob.state = 2;
                                        break;
                                }
                                currentState.setPause(false);
                            }
                    );
                    break;
                case 2:
                    ui.showMsg("[" + mob.name + "]: I gotta get out of here...");
                    break;
            }
        },
        "a gate": function(item, ui, currentState) {
            let playerHasObject = false;
            let obj = null;

            for (let invItem of currentState.player.inventory) {
                if (invItem.name === "a weird object") {
                    playerHasObject = true;
                    obj = invItem;
                    break;
                }
            }
            if (playerHasObject) {
                ui.showMsg("The weird object in your hands glows brightly and disintegrates, and the gate opens!");
                removeByReference(currentState.player.inventory, obj);
                removeByReference(currentState.levels["Start of uncharted"].items, item);
                
                // TODO: player can currently pick up all items, so could pick up the opened gate too.
                
                // currentState.levels["Start of uncharted"].items.push({
                //     name: "an opened gate",
                //     symbol: "#",
                //     pos: [11, 17]
                // });
            } else {
                ui.showMsg("You seem to need something to open this gate.");
            }
        },
        "a chest": function(item, ui, currentState) {
            let playerHasKey = false;

            for (let invItem of currentState.player.inventory) {
                if (invItem.name === "a key") {
                    playerHasKey = true;
                    break;
                }
            }
            if (playerHasKey && item.state === 0) {
                item.state = 1;
            }
            switch (item.state) {
                case 0:
                    ui.showMsg("You try to loot " + item.name + ", but it's locked.");
                    break;
                case 1:
                    ui.showMsg("You loot a diamond!");
                    currentState.player.inventory.push({
                        name: "a diamond",
                        symbol: "*"
                    });
                    item.state = 2;
                    break;
                case 2:
                    ui.showMsg("You try to loot " + item.name + ", but it's empty.");
                    break;
            }
        },
        "a strange device": function(item, ui, currentState) {
            if (currentState.player.health === currentState.player.maxHealth) {
                ui.showMsg("You get a strange feeling.");
            } else {
                currentState.player.health++;
                ui.showMsg("You feel restored.");
            }
        }
    }
};

export default events;
