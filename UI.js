const dialog = document.getElementById("dialog");
let movingDialog = false;
let dialogKeyListener;

function dialogMoveListener(e) {
    dialog.style.left = (e.clientX - 5) + "px";
    dialog.style.top = (e.clientY - 5) + "px";
}

// these have to be initialized before use

showDialog.removeListeners = () => {};
showDialog.addListeners = () => {};
showDialog.msgHistory = [];

export function showDialog(text, choices, onSelect, allowEsc, skipLog) {
    let choiceGroupIdx = null;
    showDialog.removeListeners();
    !skipLog && showDialog.msgHistory.unshift(text.trim().replaceAll("\n", "\n\t"));

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
            c.textContent = "[" + (idx + 1) + "]:\t" + choice;
            dialog.appendChild(c);
            c.onclick = e => {
                e.stopPropagation();
    
                if (choiceGroupIdx !== null && choiceIdx === choiceGroup.length - 1) {
                    repopulateDialog();
                } else {
                    let optionNumber = choiceIdx;
                    !skipLog && showDialog.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

                    if (choiceGroupIdx !== null) {
                        optionNumber += 8 * choiceGroupIdx;
                    }
                    hideDialog();
                    onSelect(optionNumber);
                }
            }
            idx++;
        }
    }
    dialogKeyListener = e => {
        if (allowEsc && e.key === "Escape") {
            hideDialog();
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
            !skipLog && showDialog.msgHistory.unshift("[You chose: \"" + choiceGroup[optionNumber] + "\"]");

            if (choiceGroupIdx !== null) {
                optionNumber += 8 * choiceGroupIdx;
            }
            hideDialog();
            onSelect(optionNumber);
        }
    };
    document.addEventListener("keydown", dialogKeyListener);
    dialog.style.display = "block";
    const p = document.createElement("p");
    p.setAttribute("id", "dialogText");
    p.textContent = text;
    dialog.appendChild(p);
    p.onclick = e => {
        e.stopPropagation();

        if (movingDialog) {
            document.body.style.cursor = "default";
            document.removeEventListener("mousemove", dialogMoveListener);
        } else {
            document.body.style.cursor = "move";
            document.addEventListener("mousemove", dialogMoveListener);
        }
        movingDialog = !movingDialog;
    }
    repopulateDialog(true);
}

function hideDialog() {
    dialog.style.display = "none";
    document.removeEventListener("keydown", dialogKeyListener);
    showDialog.addListeners();

    while (dialog.firstChild) {
        dialog.firstChild.onclick = null; // just to be safe
        dialog.removeChild(dialog.firstChild);
    }
};
