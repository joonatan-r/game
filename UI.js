import options from "./options.js";

const dialog = document.getElementById("dialog");
const table = document.getElementById("table");
const msgBox = document.getElementById("msgBox");
const status = document.getElementById("status");
const info = document.getElementById("info");

export default class UI {
    msgHistory = [];
    msgQueue = [];
    msgTimeOutQueue = [];
    movePos = [];
    dialogStack = [];
    dialogDisplayed = false;

    constructor(removeListeners, addListeners, pauser) {
        this.removeListeners = removeListeners;
        this.addListeners = addListeners;
        this.pauser = pauser;
        this.dialogMoveListener = this.dialogMoveListener.bind(this);
        this.msgMoveListener = this.msgMoveListener.bind(this);
        this.infoMoveListener = this.infoMoveListener.bind(this);

        msgBox.onmousedown = e => {
            e.stopPropagation();
    
            if (!this.movingMsg) {
                this.movePos = [e.pageX - msgBox.offsetLeft, e.pageY - msgBox.offsetTop];
                document.addEventListener("mousemove", this.msgMoveListener);
                this.movingMsg = true;
            }
        };
        msgBox.onmouseup = e => {
            e.stopPropagation();
            document.removeEventListener("mousemove", this.msgMoveListener);
            this.movingMsg = false;
            localStorage.setItem(
                "gameMsgBoxPos", 
                JSON.stringify({ left: msgBox.style.left, top: msgBox.style.top })
            );
        };
        info.onmousedown = e => {
            e.stopPropagation();
    
            if (!this.movingInfo) {
                this.movePos = [e.pageX - info.offsetLeft, e.pageY - info.offsetTop];
                document.addEventListener("mousemove", this.infoMoveListener);
                this.movingInfo = true;
            }
        };
        info.onmouseup = e => {
            e.stopPropagation();
            document.removeEventListener("mousemove", this.infoMoveListener);
            this.movingInfo = false;
            localStorage.setItem(
                "gameInfoPos", 
                JSON.stringify({ left: info.style.left, top: info.style.top })
            );
        };
        const msgBoxPos = localStorage.getItem("gameMsgBoxPos");
        const dialogPos = localStorage.getItem("gameDialogPos");
        const infoPos = localStorage.getItem("gameInfoPos");
        const tableRect = table.getBoundingClientRect();
        
        if (msgBoxPos) {
            const newMsgBoxPos = JSON.parse(msgBoxPos);
            msgBox.style.left = newMsgBoxPos.left;
            msgBox.style.top = newMsgBoxPos.top;
        } else {
            msgBox.style.top = (tableRect.top + tableRect.height + 5) + "px";
            // msgBox.style.left = (info.clientWidth + 25) + "px";
        }
        if (dialogPos) {
            const newDialogPos = JSON.parse(dialogPos);
            dialog.style.left = newDialogPos.left;
            dialog.style.top = newDialogPos.top;
        } else {
            dialog.style.left = tableRect.left + "px";
            dialog.style.top = tableRect.top + "px";
        }
        if (infoPos) {
            const newInfoPos = JSON.parse(infoPos);
            info.style.left = newInfoPos.left;
            info.style.top = newInfoPos.top;
        } else {
            info.style.left = (tableRect.left + tableRect.width + 10) + "px";
            info.style.top = tableRect.top + "px";
        }
    }

    dialogMoveListener(e) {
        dialog.style.left = (e.clientX - this.movePos[0]) + "px";
        dialog.style.top = (e.clientY - this.movePos[1]) + "px";
    }

    msgMoveListener(e) {
        msgBox.style.left = (e.clientX - this.movePos[0]) + "px";
        msgBox.style.top = (e.clientY - this.movePos[1]) + "px";
    }

    infoMoveListener(e) {
        info.style.left = (e.clientX - this.movePos[0]) + "px";
        info.style.top = (e.clientY - this.movePos[1]) + "px";
    }

    showMsg(msg) {
        msgBox.style.display = "block";
        this.msgQueue.unshift(msg);
        this.msgTimeOutQueue.unshift(
            setTimeout(async () => {
                await this.pauser.waitForUnpause();
                this.msgQueue.pop();
                this.msgTimeOutQueue.pop();
        
                if (!this.msgQueue.length) {
                    msgBox.style.display = "none";
                } else {
                    status.textContent = this.msgQueue.join("\n\n");
                }
            }, 5000) // hide each individual message after 5 seconds (unless paused)
        );

        if (this.msgQueue.length > 7) {
            clearTimeout(this.msgTimeOutQueue[this.msgTimeOutQueue.length - 1]);
            this.msgQueue.pop();
            this.msgTimeOutQueue.pop();
        }
        status.textContent = this.msgQueue.join("\n\n");
        msg = msg.trim().replaceAll("\n", "\n\t\t"); // more readable in history
        this.msgHistory.unshift(msg);
    }
    
    hideMsgs() {
        this.msgQueue = [];
        for (const t of this.msgTimeOutQueue) clearTimeout(t);
        this.msgTimeOutQueue = [];
        msgBox.style.display = "none";
    }

    getPageForIdx(idx) {
        return Math.ceil((idx + 1) / 9) - 1;
    }

    // If the dialog is closed with escape (when allowed), onSelect is called with -1. 
    // stackDepth used to enable navigating to the previous dialog, when a choice can open a new dialog.
    // The first dialog should have 0, the dialog that its choices can open should have 1, etc.
    // negative stackDepth can be used to make a dialog use a stack without putting itself in it (can be
    // useful when the dialog can open up new dialogs that should return to the one before it)
    // startPage can be used to have dialogs that stay open after selecting a choice by opening again on
    // the same page. The implementation is made like this so that the dialog can also update its contents
    // before opening again.

    showDialog(text, choices, onSelect, allowEsc, skipLog, stackDepth, startPage) {
        if (this.dialogStack.length !== stackDepth && !(stackDepth < 0)) {
            this.dialogStack = [];
        }
        let choiceGroupIdx = null;
        this.dialogDisplayed = true;
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
                    onSelect(-1);
                };
            }
        }
        // i guess this doesnt need to be bound because it uses arrow function?
        this.dialogKeyListener = e => {
            if (allowEsc && e.key === options.CONTROLS.ESC) {
                this.hideDialog();
                onSelect(-1);
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
            if (e.key === "ArrowDown" && choiceGroupIdx !== null && choiceGroupIdx < choices.length - 1) {
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
        p.onmousedown = e => {
            e.stopPropagation();
    
            if (!this.movingDialog) {
                this.movePos = [e.pageX - dialog.offsetLeft, e.pageY - dialog.offsetTop];
                document.addEventListener("mousemove", this.dialogMoveListener);
                this.movingDialog = true;
            }
        };
        p.onmouseup = e => {
            e.stopPropagation();
            document.removeEventListener("mousemove", this.dialogMoveListener);
            this.movingDialog = false;
            localStorage.setItem(
                "gameDialogPos",
                JSON.stringify({ left: dialog.style.left, top: dialog.style.top })
            );
        };

        if (startPage > 0) {
            for (let i = 0; i < startPage; i++) {
                repopulateDialog(1);
            }
        } else {
            repopulateDialog(0);
        }
    }

    hideDialog() {
        if (!this.dialogDisplayed) return;
        dialog.style.display = "none";
        document.removeEventListener("keydown", this.dialogKeyListener);
        this.addListeners();
    
        while (dialog.firstChild) {
            dialog.firstChild.onclick = null; // just to be safe
            dialog.removeChild(dialog.firstChild);
        }
    }

    showMsgHistory(startPage) {
        if (this.msgHistory.length) {
            this.showDialog("Message history:", this.msgHistory, idx => {
                if (idx < 0) return;
                this.showMsgHistory(this.getPageForIdx(idx));
            }, true, true, null, startPage);
        }
    }
};
