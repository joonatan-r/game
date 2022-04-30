import { addItems } from "./itemData.js";
import { addMobs } from "./mobData.js";
import options, { controlNameMap, optionNameMap } from "./options.js";
import { load, removeByReference, save } from "./util.js";

export default class BuiltinDialogs {
    constructor(gm, start, removeListeners, mobileInput) {
        this.gm = gm;
        this.start = start;
        this.removeListeners = removeListeners;
        this.mobileInput = mobileInput;
    }

    saveGame() {
        save({
            levels: this.gm.levels,
            player: this.gm.player,
            timeTracker: this.gm.timeTracker,
            referenced: this.gm.referenced
        });
    }
    
    loadGame() {
        load((loadData) => {
            this.gm.levels = loadData.levels;
            this.gm.level = this.gm.levels[this.gm.levels.currentLvl].level;
            this.gm.mobs = this.gm.levels[this.gm.levels.currentLvl].mobs;
            this.gm.items = this.gm.levels[this.gm.levels.currentLvl].items;
            this.gm.player = loadData.player;
            this.gm.timeTracker = loadData.timeTracker;
            this.gm.ui.hideDialog(); // loading from start menu keeps dialog open (in case user cancels), this ensures it's closed
            this.start();
        });
    }

    showStartDialog() {
        this.gm.ui.showDialog("Start", ["New game", "Load game", "Options", "Controls", "Save configs as default"], idx => {
            switch (idx) {
                case 0:
                    addMobs(this.gm.levels);
                    addItems(this.gm.levels);
                    this.start();
                    break;
                case 1:
                    this.loadGame();
                    this.showStartDialog(); // only shown in case user cancels
                    break;
                case 2:
                    this.showOptionsDialog();
                    break;
                case 3:
                    this.showControlsDialog();
                    break;
                case 4:
                    localStorage.setItem("gameDefaultOptions", JSON.stringify(options));
                    this.gm.ui.showMsg("Saved default options");
                    this.showStartDialog();
                    break;
            }
        }, false, true, 0);
    }
    
    showOptionsDialog(startPage) {
        const optKeys = [...Object.keys(options)];
        removeByReference(optKeys, "CONTROLS");
        const optList = optKeys.map(k => optionNameMap[k]);
        
        for (let i = 0; i < optList.length; i++) {
            optList[i] += ": " + options[optKeys[i]];
        }
        this.gm.ui.showDialog("Options", optList, idx => {
            let opt = options[optKeys[idx]];
    
            if (typeof opt === "number") {
                let input = "";
                const inputListener = e => {
                    if (e.key === "Escape") {
                        input = "";
                        document.removeEventListener("keydown", inputListener);
                        this.gm.ui.showMsg("");
                        this.showOptionsDialog(this.gm.ui.getPageForIdx(idx));
                    } else if (e.key === "Enter") {
                        const val = Number(input);
    
                        if (val > 10) {
                            options[optKeys[idx]] = val;
                        }
                        input = "";
                        document.removeEventListener("keydown", inputListener);
                        this.gm.ui.showMsg("");
                        this.showOptionsDialog(this.gm.ui.getPageForIdx(idx));
                    } else {
                        input += e.key;
                        this.gm.ui.showMsg("");
                        this.gm.ui.showMsg("New value: " + input);
                    }
                };
                this.removeListeners();
                document.addEventListener("keydown", inputListener);
                this.gm.ui.showMsg("Type the new value. Enter to accept and escape to cancel.");
            } else if (typeof opt === "boolean") {
                options[optKeys[idx]] = !opt;
                this.showOptionsDialog(this.gm.ui.getPageForIdx(idx));
            }
            this.gm.render.changeOptions(options);
        }, false, true, -1, startPage);
    }
    
    showControlsDialog(startPage) {
        const optKeys = [...Object.keys(options.CONTROLS)];
        const optList = optKeys.map(k => controlNameMap[k]);
        
        for (let i = 0; i < optList.length; i++) {
            optList[i] += ": \"" + options.CONTROLS[optKeys[i]] + "\"";
        }
        this.gm.ui.showDialog("Controls", optList, idx => {
            const changeInput = e => {
                this.gm.ui.showMsg("");
    
                for (let [key, val] of Object.entries(options.CONTROLS)) {
                    if ((val === e.key && key !== optKeys[idx])) {
                        document.removeEventListener("keydown", changeInput);
                        this.gm.ui.showMsg("Error, \"" + e.key + "\" is already in use");
                        this.showControlsDialog(this.gm.ui.getPageForIdx(idx));
                        return;
                    }
                }
                options.CONTROLS[optKeys[idx]] = e.key;
                document.removeEventListener("keydown", changeInput);
                this.showControlsDialog(this.gm.ui.getPageForIdx(idx));
            };
            const mobileChangeInput = () => {
                this.gm.ui.showMsg("");
    
                for (let [key, val] of Object.entries(options.CONTROLS)) {
                    if ((val === this.mobileInput.value && key !== optKeys[idx])) {
                        this.mobileInput.removeEventListener("input", mobileChangeInput);
                        this.gm.ui.showMsg("Error, \"" + this.mobileInput.value + "\" is already in use");
                        this.mobileInput.value = "";
                        this.showControlsDialog(this.gm.ui.getPageForIdx(idx));
                        return;
                    }
                }
                options.CONTROLS[optKeys[idx]] = this.mobileInput.value.toLowerCase();
                this.mobileInput.removeEventListener("input", mobileChangeInput);
                this.mobileInput.value = "";
                this.showControlsDialog(this.gm.ui.getPageForIdx(idx));
            };
            if (
                optKeys[idx] === "MOVE_MOD" || optKeys[idx] === "AUTOMOVE_MOD" || optKeys[idx] === "ACTION_MOD"
            ) {
                const modList = ["None", "Control", "Alt", "Shift"];
                this.gm.ui.showDialog("Set new modifier", modList, optionIdx => {
                    const oldValue = options.CONTROLS[optKeys[idx]];
                    const newValue = modList[optionIdx];

                    for (let key of ["MOVE_MOD", "AUTOMOVE_MOD", "ACTION_MOD"]) {
                        if (options.CONTROLS[key] === newValue) {
                            options.CONTROLS[key] = oldValue;
                            break;
                        }
                    }
                    options.CONTROLS[optKeys[idx]] = newValue;
                    this.showControlsDialog(this.gm.ui.getPageForIdx(idx));
                }, false, true, -1);
            } else {
                this.removeListeners();
        
                if (this.mobileInput) {
                    this.mobileInput.addEventListener("input", mobileChangeInput);
                } else {
                    document.addEventListener("keydown", changeInput);
                }
                this.gm.ui.showMsg("Press the new input for \"" + optKeys[idx] + "\"");
            }
        }, false, true, -1, startPage);
    }
    
    showPauseMenu() {
        this.gm.setPause(true);
        this.gm.ui.showDialog("Pause Menu", ["Save", "Load"], idx => {
            switch (idx) {
                case 0:
                    this.saveGame();
                    break;
                case 1:
                    this.loadGame();
                    break;
            }
            this.gm.setPause(false);
        }, true, true);
    }
}
