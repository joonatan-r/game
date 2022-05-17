import { levelTiles } from "./levelData.js";
import { coordsEq, removeByReference } from "./util.js";

const events = {
    onStart: function(gm) {
        if (gm.timeTracker.timer === 0) {
            // No message when starting a random game
            if (gm.levels.currentLvl === "The Beginning") return;
            gm.setPause(true);
            gm.ui.showDialog("Hello, adventurer!", ["Continue"], () => {
                gm.setPause(false);
            });
        } else {
            gm.setPause(true);
            gm.ui.showDialog("Welcome back, adventurer!", ["Continue"], () => {
                gm.setPause(false);
            });
        }
    },
    onMove: function(gm) {
        const lvl = gm.levels.currentLvl;
        const playerPos = gm.player.pos;

        if (lvl === "Start of uncharted") {
            if (coordsEq(playerPos, [19, 23]) && gm.level[19][23] === levelTiles.fakeWall) {
                gm.ui.showMsg("You find a hidden passage!");
                gm.level[19][23] = levelTiles.floor;
            }
        }
    },
    onEnterLevel: {
        "Start of uncharted": function(gm) {
            const memorized = gm.levels["Start of uncharted"].memorized;
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
                gm.setPause(true);
                gm.ui.showDialog("A great wall blocks the path. There seems to be only one closed gate.", ["Continue"], () => {
                    gm.setPause(false);
                });
            }
        }
    },
    onInteract: {
        "Scared Traveller": function(mob, gm) {
            switch (mob.state) {
                case 0:
                    gm.ui.showMsg("[" + mob.name + "]: Why are you here? Turn back while you still can!");
                    mob.state = 1;
                    break;
                case 1:
                    gm.setPause(true);
                    gm.ui.showDialog("[" + mob.name + "]:\n\nSince you seem bent on going on, would you like to know something?", 
                            ["Sure.", "No."], 
                            idx => {
                                switch (idx) {
                                    case 0:
                                        gm.ui.showMsg("[" + mob.name + "]: I think there's something hidden in the area past the gate.");
                                        mob.state = 2;
                                        break;
                                    case 1:
                                        gm.ui.showMsg("[" + mob.name + "]: Fair enough.");
                                        mob.state = 2;
                                        break;
                                }
                                gm.setPause(false);
                            }
                    );
                    break;
                case 2:
                    gm.ui.showMsg("[" + mob.name + "]: I gotta get out of here...");
                    break;
            }
        },
        "gate": function(item, gm) {
            let playerHasObject = false;
            let obj = null;

            for (const invItem of gm.player.inventory) {
                if (invItem.name === "weird object") {
                    playerHasObject = true;
                    obj = invItem;
                    break;
                }
            }
            if (playerHasObject) {
                gm.ui.showMsg("The weird object in your hands glows brightly and disintegrates, and the gate opens!");
                removeByReference(gm.player.inventory, obj);
                removeByReference(gm.levels["Start of uncharted"].items, item);
                
                // TODO: player can currently pick up all items, so could pick up the opened gate too.
                
                // gm.levels["Start of uncharted"].items.push({
                //     name: "an opened gate",
                //     symbol: "#",
                //     pos: [11, 17]
                // });
            } else {
                gm.ui.showMsg("You seem to need something to open this gate.");
            }
        },
        "chest": function(item, gm) {
            let playerHasKey = false;

            for (let invItem of gm.player.inventory) {
                if (invItem.name === "key") {
                    playerHasKey = true;
                    break;
                }
            }
            if (playerHasKey && item.state === 0) {
                item.state = 1;
            }
            switch (item.state) {
                case 0:
                    gm.ui.showMsg("You try to loot \"" + item.name + "\", but it's locked.");
                    break;
                case 1:
                    gm.ui.showMsg("You loot a diamond!");
                    gm.addToInventory({
                        name: "diamond",
                        symbol: "*"
                    });
                    item.state = 2;
                    break;
                case 2:
                    gm.ui.showMsg("You try to loot \"" + item.name + "\", but it's empty.");
                    break;
            }
        },
        "strange device": function(item, gm) {
            if (gm.player.health === gm.player.maxHealth) {
                gm.ui.showMsg("You get a strange feeling.");
            } else {
                gm.player.health++;
                gm.ui.showMsg("You feel restored.");
            }
        }
    },
    onDeath: {
        "Make": function(mob, gm) {
            Math.random() < 0.15 && gm.levels[gm.levels.currentLvl].items.push({
                name: "strange potion",
                symbol: "!",
                usable: "true",
                pos: mob.pos.slice()
            });
            Math.random() < 0.25 && gm.levels[gm.levels.currentLvl].items.push({
                name: "gold",
                symbol: "$",
                pos: mob.pos.slice()
            });
        },
        "Pekka": function(mob, gm) {
            Math.random() < 0.33 && gm.levels[gm.levels.currentLvl].items.push({
                name: "strange potion",
                symbol: "!",
                usable: "true",
                pos: mob.pos.slice()
            });
            Math.random() < 0.25 && gm.levels[gm.levels.currentLvl].items.push({
                name: "gold",
                symbol: "$",
                pos: mob.pos.slice()
            });
        },
        "Jorma": function(mob, gm) {
            Math.random() < 0.33 && gm.levels[gm.levels.currentLvl].items.push({
                name: "strange potion",
                symbol: "!",
                usable: "true",
                pos: mob.pos.slice()
            });
            Math.random() < 0.25 && gm.levels[gm.levels.currentLvl].items.push({
                name: "gold",
                symbol: "$",
                pos: mob.pos.slice()
            });
        }
    },
    onUse: {
        "weird object": function(item, gm) {
            gm.ui.showMsg("The object emits strange light, then fades again.");
        },
        "strange potion": function(item, gm) {
            if (Math.random() < 0.2) {
                gm.player.maxHealth--;
                gm.player.health--;
                gm.ui.showMsg("You feel really bad.");

                if (gm.player.health < 1) gm.gameOver("You die..."); 
            } else {
                gm.player.maxHealth++;
                gm.player.health++;
                gm.ui.showMsg("You feel great!");
            }
            for (const invItem of gm.player.inventory) {
                if (invItem.name === "strange potion") {
                    invItem.number > 1 ? invItem.number-- : removeByReference(gm.player.inventory, invItem);
                    break;
                }
            }
        }
    }
};

export default events;
