const SIZE_Y = 25;
const SIZE_X = 40;
const level = [];
const edges = [];
const area = [];
const rendered = [];
const table = document.getElementById("table");

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if ((i + j) % 7 === 0 && (i * j) % 3 === 0
            || (i + j + 1) % 7 === 0 && (i * j + 1) % 3 === 0
        ) {
        // if (j === 15 && [2, 15].indexOf(i) === -1) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183"; // middle dot
        }
        if (i === 0 || j === 0 || i === SIZE_Y - 1 || j === SIZE_X - 1) {
            edges.push([i, j]);
        }
    }
}
for (let i = 0; i < level.length; i++) {
    const tr = document.createElement("tr");
    table.appendChild(tr);
    area.push([]);
  
    for (let j = 0; j < level[0].length; j++) {
        const td = document.createElement("td");
        tr.appendChild(td);
        area[i][j] = td;
    }
}
for (let i = 0; i < level.length; i++) {
    rendered.push([]);

    for (let j = 0; j < level[0].length; j++) {
        rendered[i][j] = false;
    }
}
