const dialog = document.getElementById("dialog");
const table = document.getElementById("table");
const status = document.getElementById("status");

export default class UI {
    dialogMoved = false;
    dialogStack = [];

    constructor(removeListeners, addListeners, msgHistory) {
        this.removeListeners = removeListeners;
        this.addListeners = addListeners;
        this.msgHistory = msgHistory;
        this.dialogMoveListener = this.dialogMoveListener.bind(this);
    }

    dialogMoveListener(e) {
        dialog.style.left = (e.clientX - 5) + "px";
        dialog.style.top = (e.clientY - 5) + "px";
        this.dialogMoved = true;
    }

    showMsg(msg) {
        status.textContent = msg;
        if (!msg) return; // empty string / null
        msg = msg.trim().replaceAll("\n", "\n\t\t"); // more readable in history
        this.msgHistory.unshift(msg);
    }

    // stackDepth used to enable navigating to the previous dialog, when a choice can open a new dialog.
    // The first dialog should have 0, the dialog that its choices can open should have 1, etc.
    // negative stackDepth can be used to make a dialog use a stack without putting itself in it (can be
    // useful when the dialog can open up new dialogs that should return to the one before it)

    showDialog(text, choices, onSelect, allowEsc, skipLog, stackDepth, startPage) {
        if (!this.dialogMoved) {
            dialog.style.left = table.getBoundingClientRect().left + "px";
            dialog.style.top = table.getBoundingClientRect().top + "px";
        }
        if (this.dialogStack.length !== stackDepth && !(stackDepth < 0)) {
            this.dialogStack = [];
        }
    
        let choiceGroupIdx = null;
        this.removeListeners();
        !skipLog && this.msgHistory.unshift(text.trim().replaceAll("\n", "\n\t\t"));
    
        // if there are over 9 possible choices, divide them into groups of 8 (last one being probably
        // shorter) and add an option 9 to go to the next "choice group" (last one has the option to go
        // back to start), this way number keys 1-9 can be still be used to select a choice
    
        if (choices.length > 9) {
            const choicesCopy = choices.slice();
            let currIdx = 0;
            choiceGroupIdx = 0;
            choices = [];
    
            while (choicesCopy.length) {
                choices.push([]);
    
                for (let i = 0; i < 8 && choicesCopy.length; i++) {
                    choices[currIdx].push(choicesCopy.shift());
                }
                if (choicesCopy.length) {
                    choices[currIdx].push("[Show more]");
                } else {
                    choices[currIdx].push("[Back to start]");
                }
                currIdx++;
            }
        }
        let choiceGroup = choiceGroupIdx !== null ? choices[choiceGroupIdx] : choices;
    
        const repopulateDialog = noGroupUpdate => {
            if (!noGroupUpdate) {
                choiceGroupIdx = choiceGroupIdx < choices.length - 1 ? choiceGroupIdx + 1 : 0;
                choiceGroup = choices[choiceGroupIdx];
            }
            let idx = 0;
        
            while (dialog.children.length > 1) { // remove all but the first text element
                dialog.firstChild.onclick = null; // just to be safe
                dialog.removeChild(dialog.lastChild);
            }
            for (let choice of choiceGroup) {
                const choiceIdx = idx;
                const c = document.createElement("p");
                c.textContent = "[" + (idx + 1) + "]:\t\t" + choice;
                dialog.appendChild(c);
                c.onclick = e => {
                    e.stopPropagation();
        
                    if (choiceGroupIdx !== null && choiceIdx === choiceGroup.length - 1) {
                        repopulateDialog();
                    } else {
                        let optionNumber = choiceIdx;
                        !skipLog && this.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");
    
                        if (choiceGroupIdx !== null) {
                            optionNumber += 8 * choiceGroupIdx;
                        }
                        this.hideDialog();

                        if (this.dialogStack.length === stackDepth) {
                            this.dialogStack.push(arguments);
                        }
                        onSelect(optionNumber);
                    }
                }
                idx++;
            }
            if ((stackDepth > 0 && this.dialogStack.length === stackDepth) || stackDepth < 0) {
                const backP = document.createElement("p");
                backP.textContent = "[\u2190]:\t\t[Go back]";
                dialog.appendChild(backP);
                backP.onclick = e => {
                    e.stopPropagation();
                    this.hideDialog();
                    this.showDialog(...this.dialogStack.pop());
                };
            }
            if (allowEsc) {
                const escP = document.createElement("p");
                escP.textContent = "[Esc]:\t[Close menu]";
                dialog.appendChild(escP);
                escP.onclick = e => {
                    e.stopPropagation();
                    this.hideDialog();
                };
            }
        }
        // i guess this doesnt need to be bound because it uses arrow function?
        this.dialogKeyListener = e => {
            if (allowEsc && e.key === "Escape") {
                this.hideDialog();
                return;
            }
            if (e.key === "ArrowLeft"
                && ((stackDepth > 0 && this.dialogStack.length === stackDepth) || stackDepth < 0)
            ) {
                this.hideDialog();
                this.showDialog(...this.dialogStack.pop());
                return;
            }
            let pressedNumber = Number(e.key);
    
            if (isNaN(pressedNumber) || pressedNumber > choiceGroup.length || pressedNumber <= 0) {
                return;
            }
            if (choiceGroupIdx !== null && pressedNumber === choiceGroup.length) {
                repopulateDialog();
            } else {
                let optionNumber = pressedNumber - 1;
                !skipLog && this.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");
    
                if (choiceGroupIdx !== null) {
                    optionNumber += 8 * choiceGroupIdx;
                }
                this.hideDialog();

                if (this.dialogStack.length === stackDepth) {
                    this.dialogStack.push(arguments);
                }
                onSelect(optionNumber);
            }
        };
        document.addEventListener("keydown", this.dialogKeyListener);
        dialog.style.display = "block";
        const p = document.createElement("p");
        p.setAttribute("id", "dialogText");
        p.textContent = text;
        dialog.appendChild(p);
        p.onclick = e => {
            e.stopPropagation();
    
            if (this.movingDialog) {
                document.body.style.cursor = "default";
                document.removeEventListener("mousemove", this.dialogMoveListener);
            } else {
                document.body.style.cursor = "move";
                document.addEventListener("mousemove", this.dialogMoveListener);
            }
            this.movingDialog = !this.movingDialog;
        }
        if (startPage > 0) {
            for (let i = 0; i < startPage; i++) {
                repopulateDialog();
            }
        } else {
            repopulateDialog(true);
        }
    }

    hideDialog() {
        dialog.style.display = "none";
        document.removeEventListener("keydown", this.dialogKeyListener);
        this.addListeners();
    
        while (dialog.firstChild) {
            dialog.firstChild.onclick = null; // just to be safe
            dialog.removeChild(dialog.firstChild);
        }
    }
};
