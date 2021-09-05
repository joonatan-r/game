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
// the first declared level here is the starting level 

export const levelData = `

Village
url('village.jpg')
Ukko's House
Mystery place 4
Wilderness
Mystery place 4
Wilderness
Random House

w...................................w...
w..wwwww............................w...
w..w...w...................w........w...
w..w...w...................w........w...
w..wwwww...................w........w...
w..ww^ww...................f........w...
w..........................f........w...
w..........................f........w...
w..........................s........w...
w..........................s........ww..
^..........................s........^w..
^...................................^w..
w...................................ww..
w...................................w...
w...................................w...
w.........................ttt.......w...
w.........................ttt.......w...
w.......ww^wwwww....................w...
w.......wwww...w....................w...
w.......w......w....................w...
w.......w......w....................w...
w.......w......w....................w...
w.......wwwwwwww....................w...
w...................................w...
w...................................w...;

Mystery place 1
#282828
Mystery place 2
Mystery place 2
Mystery place 2

........................................
.........wwwwwwwwww.....................
.......www........ww....................
.....www...........w....................
....ww.............wwwwwwwwwwww.........
...ww.................w.......ww........
.www...........................w........
.ww............................w........
..w............................w........
.ww............................w........
.w.............................ww....www
.w..............................wwwwww.w
.w.....................................w
.ww....................................^
..wwww.................................^
.....www...............................^
.......ww..............................w
........w.........................wwwwww
........w............wwwwwww......w.....
........w..........www.....ww.....w.....
........ww........ww........www.www.....
.........www......w...........www.......
...........wwwwwwww.....................
........................................
........................................;

Mystery place 2
#282828
Mystery place 3
Mystery place 3
Mystery place 1
Mystery place 1
Mystery place 1
Mystery place 4
Mystery place 4

.....................w^^w...............
.....................w..ww..............
.....................w...ww.............
...............www...w....ww............
..............ww.www.w.....w............
..............w....www.....ww...........
..............w.............www.........
..............w...............wwwwww....
.............ww....................ww...
............ww......................ww..
..........www........................w..
.......wwww..........................w..
wwwwwwww.............................w..
^ww..................................ww.
^.....................................ww
^......................................w
wwwww....................wwwwwwwwww....w
....wwww.................w........ww...w
.......ww................w.........ww..^
........w................w..........ww.^
........w...........ww...w...........www
........ww........wwwwwwww..............
.........w......www.....................
.........wwwwwwww.......................
........................................;

Mystery place 3
#282828
Mystery place 2
Mystery place 2

..........wwww..wwwwwwwwwwwwwwwwwwwwww..
.....wwwwww..wwww..ww.........ww.....ww.
...www.............w..................w.
..ww.....................ww...........ww
..w.........wwwwwwwwwwwwwwww.....ww....w
..w.......www..............wwwwwwww.wwww
..w......ww...wwwwwwwww......ww...w.w...
..w.....ww...ww.......wwwwwwww....w.w...
..w.....w...ww...............ww...w.w...
..w.....w..ww.................ww..w.w...
..w.....w..w...................w..w.w...
..w.....ww.ww..................w..w.w...
..w......w..w..................w..w.w...
.ww......w..ww.................w..w.w...
.w.......w...wwww..............w..w.w...
.w.......w......www............wwww.w...
.ww......w........w...............w.w...
..ww..wwww........ww................w...
...wwww............w................ww..
...................ww.....wwwwww....ww..
....................w...www....wwwwww...
....................ww..w...............
.....................w..w...............
.....................w..w...............
.....................w^^w...............;

Mystery place 4
#282828
Village
Village
Mystery place 2
Mystery place 2

........................................
........................................
.....................wwwwwwwww..........
.................wwwww.......ww.........
.................w...........ww.........
.................w...........w..........
....wwwwwwwww...ww...........w..........
...ww.......wwwww............ww.........
...w..........................wwwww.....
..ww..............................ww.www
..w................................www.^
..w................................ww..^
..w...................................ww
..ww..................................w.
...w..................................w.
...w.................................ww.
..ww..............................wwww..
www.............................www.....
^..............................ww.......
^..............................w........
wwwww.........................ww........
....ww.......wwwwwwwwwww......w.........
.....ww....www.........www..www.........
......wwwwww.............wwww...........
........................................;

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

..................w.....................
..................w.....................
..................w.....................
..................w.....................
.......wwwwww.....w.....................
.....www....wwww..w.....................
.....w.........ww.w.....................
.....w..........w.w.....................
.....ww.........w.w.....................
......ww.......ww.w.....................
.......www.....w..w.....................
.........w.....ww.w.....................
........ww......w.w.....................
........w.......www.....................
........w........w^.....................
........w...............................
........w.........w.....................
........w.........w.....................
........ww........w.....................
.........ww......ww.....................
..........ww....www.....................
...........wwwwww.w.....................
..................w.....................
..................w.....................
..................w.....................;

Wilderness
url('wilderness.jpg')
Place
Village
Village
Cave or something

..w.....................................
..w.....................................
..w..^....ww............................
..w.......ww...........ww...............
..w....................ww...............
..w.....................................
..w.....................................
..w.....................................
.ww.....................................
.w^.............................ww....ww
.w^.............................ww.....^
.ww...................................ww
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
