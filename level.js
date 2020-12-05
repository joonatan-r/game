const SIZE_Y = 25;
const SIZE_X = 40;
const level = [];
const edges = [];

for (let i = 0; i < SIZE_Y; i++) {
    level.push([]);
  
    for (let j = 0; j < SIZE_X; j++) {
        level[i].push([]);

        if ((i + j) % 7 === 0 && (i * j) % 3 === 0
                || (i + j + 1) % 7 === 0 && (i * j + 1) % 3 === 0) {
            level[i][j] = "";
        } else {
            level[i][j] = "&#183"; // middle dot
        }
        if (i === 0 || j === 0 || i === SIZE_Y - 1 || j === SIZE_X - 1) {
            edges.push([i, j]);
        }
    }
}
