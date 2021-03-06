export const infoTable = {
    "\u00B7": "[\u00B7]: The floor",
    "^": "[^]: A doorway",
    "Player": "[@]: You, the player",
    "some money": "[$]: Some money",
    "a weird object": "[?]: A strange object",
    "a chest": "[(]: A chest",
    "a key": "[\u00A3]: A key",
    "Ukko": "[@]: Ukko, a peaceful human",
    "Some guy": "[@]: Some guy, a peaceful human",
    "Shady guy": "[@]: Shady guy, a peaceful human",
    "Make": "[M]: Make, a hostile human",
    "Pekka": "[P]: Pekka, a hostile human shooter",
    "Jorma": "[J]: Jorma, a hostile human",
};

// for characters' special meanings see levelCharMap in util.js
// all characters' special meaning can be escaped using preceding "e"

export const levelData = `
Village
url('village.jpg')
Ukko's House
Wilderness
Wilderness
Random House

....................................w...
...wwwww............................w...
...w...w...................w........w...
...w...w...................w........w...
...wwwww...................w........w...
...ww^ww...................f........w...
...........................f........w...
...........................f........w...
...........................s........w...
...........................s........ww..
...........................s........^w..
....................................^w..
....................................ww..
....................................w...
....................................w...
..........................ttt.......w...
..........................ttt.......w...
........ww^wwwww....................w...
........wwww...w....................w...
........w......w....................w...
........w......w....................w...
........w......w....................w...
........wwwwwwww....................w...
....................................w...
....................................w...;

Ukko's House
#282828
Village

........................................
........................................
........................................
........................................
.........wwwwwwwwwwwwwwwwwwww...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........w..................w...........
.........wwwwwwwww^wwwwwwwwww...........
.................www....................
........................................
........................................
........................................
........................................
........................................
........................................;

Place
#282828
Wilderness

........................................
........................................
........................................
........................................
........wwww............................
.....www....wwww........................
.....w.........ww.......................
.....w..........w.......................
......w.........w.......................
......ww.......w........................
........ww.....w........................
.........w.....ww.......................
.........w......w.......................
........w.......w.......................
........w........w......................
........w.........^.....................
........w.........w.....................
........w.........w.....................
.........w........w.....................
..........w......ww.....................
...........w....ww......................
...........w.ww.w.......................
........................................
........................................
........................................;

Wilderness
url('wilderness.jpg')
Place
Village
Village

..w.....................................
..w.....................................
..w..^....ww............................
..w.......ww...........ww...............
..w....................ww...............
..w.....................................
..w.....................................
..w.....................................
.ww.....................................
.w^.............................ww......
.w^.............................ww......
.ww.....................................
..w.....................................
..w.....................................
..w..........ww.........................
..w..........ww.........................
..w.....................................
..w.....................................
..w.....................................
..w.....................................
..w............................ww.......
..w............................ww.......
..w.....................................
..w.....................................
..w.....................................;

Random House
#282828
Village

........................................
........................................
........................................
.......www..............................
.....www^wwwwwwwwwwwwwwwwwwwwwww........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....w.........................w........
.....wwwwwwwwwwwwwwwwwwwwwwwwwww........
........................................
........................................
........................................;
`
