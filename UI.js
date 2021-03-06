const dialog = document.getElementById("dialog");
const table = document.getElementById("table");
const msgBox = document.getElementById("msgBox");
const status = document.getElementById("status");

export default class UI {
    dialogMoved = false;
    msgMoved = false;
    dialogStack = [];

    constructor(removeListeners, addListeners, msgHistory) {
        this.removeListeners = removeListeners;
        this.addListeners = addListeners;
        this.msgHistory = msgHistory;
        this.dialogMoveListener = this.dialogMoveListener.bind(this);
        this.msgMoveListener = this.msgMoveListener.bind(this);

        msgBox.onclick = e => {
            e.stopPropagation();
    
            if (this.movingMsg) {
                document.body.style.cursor = "default";
                document.removeEventListener("mousemove", this.msgMoveListener);
            } else {
                document.body.style.cursor = "move";
                document.addEventListener("mousemove", this.msgMoveListener);
            }
            this.movingMsg = !this.movingMsg;
        };
    }

    dialogMoveListener(e) {
        dialog.style.left = (e.clientX - 5) + "px";
        dialog.style.top = (e.clientY - 5) + "px";
        this.dialogMoved = true;
    }

    msgMoveListener(e) {
        msgBox.style.left = (e.clientX - 5) + "px";
        msgBox.style.top = (e.clientY - 5) + "px";
        this.msgMoved = true;
    }

    showMsg(msg) {
        if (!this.msgMoved) {
            const tableRect = table.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(document.getElementById("info")); 
            let infoHeight = document.getElementById("info").clientHeight;
            infoHeight += parseInt(computedStyle.marginTop, 10);
            infoHeight += parseInt(computedStyle.marginBottom, 10);
            msgBox.style.left = tableRect.left + "px";
            msgBox.style.top = tableRect.top + tableRect.height + infoHeight + "px";
        }
        msgBox.style.display = "block";
        status.textContent = msg;

        if (!msg) {
            msgBox.style.display = "none";
            return;
        }
        msg = msg.trim().replaceAll("\n", "\n\t\t"); // more readable in history
        this.msgHistory.unshift(msg);
    }

    // stackDepth used to enable navigating to the previous dialog, when a choice can open a new dialog.
    // The first dialog should have 0, the dialog that its choices can open should have 1, etc.
    // negative stackDepth can be used to make a dialog use a stack without putting itself in it (can be
    // useful when the dialog can open up new dialogs that should return to the one before it)
    // startPage can be used to have dialogs that stay open after selecting a choice by opening again on
    // the same page. The implementation is made like this so that the dialog can also update its contents
    // before opening again.

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
    
        // if there are over 9 possible choices, divide them into groups of 9 (last one being probably
        // shorter), there are controls to navigate between the groups
    
        if (choices.length > 9) {
            const choicesCopy = choices.slice();
            let currIdx = 0;
            choiceGroupIdx = 0;
            choices = [];
    
            while (choicesCopy.length) {
                choices.push([]);
    
                for (let i = 0; i < 9 && choicesCopy.length; i++) {
                    choices[currIdx].push(choicesCopy.shift());
                }
                currIdx++;
            }
        }
        let choiceGroup = choiceGroupIdx !== null ? choices[choiceGroupIdx] : choices;
    
        const repopulateDialog = modifier => {
            if (modifier === 1) {
                choiceGroupIdx = choiceGroupIdx < choices.length - 1 ? choiceGroupIdx + 1 : 0;
                choiceGroup = choices[choiceGroupIdx];
            } else if (modifier === -1) {
                choiceGroupIdx = choiceGroupIdx === 0 ? choices.length - 1 : choiceGroupIdx - 1;
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
        
                    let optionNumber = choiceIdx;
                    !skipLog && this.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

                    if (choiceGroupIdx !== null) {
                        optionNumber += 9 * choiceGroupIdx;
                    }
                    this.hideDialog();

                    if (this.dialogStack.length === stackDepth) {
                        this.dialogStack.push(arguments);
                    }
                    onSelect(optionNumber);
                }
                idx++;
            }
            if (choiceGroupIdx !== null) {
                if (choiceGroupIdx > 0) {
                    const prevP = document.createElement("p");
                    prevP.textContent = "[\u2191]:\t\t[Show previous]";
                    dialog.appendChild(prevP);
                    prevP.onclick = e => {
                        e.stopPropagation();
                        repopulateDialog(-1);
                    };
                }
                if (choiceGroupIdx < choices.length - 1) {
                    const nextP = document.createElement("p");
                    nextP.textContent = "[\u2193]:\t\t[Show next]";
                    dialog.appendChild(nextP);
                    nextP.onclick = e => {
                        e.stopPropagation();
                        repopulateDialog(1);
                    };
                }
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
            if (e.key === "ArrowUp" && choiceGroupIdx > 0) {
                repopulateDialog(-1);
                return;
            }
            if (e.key === "ArrowDown" && choiceGroupIdx < choices.length - 1) {
                repopulateDialog(1);
                return;
            }
            let pressedNumber = Number(e.key);
    
            if (isNaN(pressedNumber) || pressedNumber > choiceGroup.length || pressedNumber <= 0) {
                return;
            }
            let optionNumber = pressedNumber - 1;
            !skipLog && this.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

            if (choiceGroupIdx !== null) {
                optionNumber += 9 * choiceGroupIdx;
            }
            this.hideDialog();

            if (this.dialogStack.length === stackDepth) {
                this.dialogStack.push(arguments);
            }
            onSelect(optionNumber);
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
                repopulateDialog(1);
            }
        } else {
            repopulateDialog(0);
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
