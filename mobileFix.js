
// bandaid to enable mobile somehow

export function mobileFix(mobileInput, infoObject) {
    const table = document.getElementById("table");
    const c = document.createElement("div");
    const d = document.createElement("div");
    const enterD = document.createElement("div");
    const escD = document.createElement("div");
    enterD.style.backgroundColor = "#333";
    enterD.style.textAlign = "center";
    enterD.style.float = "left";
    enterD.style.width = "100px";
    enterD.style.height = "60px";
    enterD.style.margin = "5px 15px 15px 5px";
    escD.style.backgroundColor = "#333";
    escD.style.textAlign = "center";
    escD.style.float = "left";
    escD.style.width = "100px";
    escD.style.height = "60px";
    escD.style.margin = "5px 15px 15px 5px";
    d.style.width = "100px";
    d.style.height = "60px";
    d.style.overflow = "hidden";
    d.style.margin = "5px 15px 15px 5px";
    mobileInput.style.fontSize = "2em"; // prevents zooming to input
    c.style.overflow = "hidden";
    d.appendChild(mobileInput);
    c.appendChild(enterD);
    c.appendChild(escD);
    c.appendChild(d);
    document.body.insertBefore(c, table);
    mobileInput.addEventListener("input", () => {
        if (!infoObject.listenersActive) return;
        handleKeypress(mobileInput.value.toLowerCase(), false);
        mobileInput.value = "";
    });
    enterD.ontouchstart = () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        return false;
    };
    enterD.innerHTML = "<p data-ignore-click='true'>ENTER</p>";
    escD.ontouchstart = () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        return false;
    };
    escD.innerHTML = "<p data-ignore-click='true'>ESC</p>";
    enterD.dataset.ignoreClick = true;
    escD.dataset.ignoreClick = true;
    c.dataset.ignoreClick = true;
    d.dataset.ignoreClick = true;
    mobileInput.dataset.ignoreClick = true;
}
