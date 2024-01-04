export const levelTiles = {
    floor: ".",
    doorWay: "^",
    stairsDown: ">",
    stairsUp: "<",
    wall: "*w", // "normal" wall
    fakeWall: "*f",
    seeThroughWall: "*s",
    transparentBgWall: "*t" // wall that blocks sight, but shows the background of the wall tile
};
export const levelTilesRaw = {
    floor: ".",
    doorWay: "^",
    stairsDown: ">",
    stairsUp: "<",
    wall: "w",
    fakeWall: "f",
    seeThroughWall: "s",
    transparentBgWall: "t"
};
export const levelCharMap = {
    [levelTilesRaw.wall]: levelTiles.wall,
    [levelTilesRaw.fakeWall]: levelTiles.fakeWall,
    [levelTilesRaw.seeThroughWall]: levelTiles.seeThroughWall,
    [levelTilesRaw.transparentBgWall]: levelTiles.transparentBgWall
};
export const infoTable = {
    [levelTiles.doorWay]: "[" + levelTiles.doorWay + "]: A doorway",
    "Player": "[@]: You, the player",
    "some money": "[$]: Some money",
    "weird object": "[?]: Strange object",
    "chest": "[(]: Chest",
    "key": "[\u00A3]: Key",
    "strange device": "[+]: Strange device",
    "Make": "[M]: Make, a hostile human",
    "Pekka": "[P]: Pekka, a hostile human shooter",
    "Jorma": "[J]: Jorma, a hostile human",
};
export const PLACEHOLDER_TP = 'PLACEHOLDER_TP';

// all characters' special meaning can be escaped using preceding "e"
// the first declared level here is the starting level 

export const levelData = `

Road's end
url("bgImages/bg.png")
Start of uncharted
Woods

..wwwwwww...............................
.ww....ww...............................
ww......w...............................
w.......w...............................
w.......w...............................
w......ww...............................
w......www..............................
w........w.wwwwww........wwwwww.........
w........www....www....www....www.......
w.................wwwwww........www...ww
w.................................wwwwww
w......................................^
w...........................www.......ww
^..........................wwwww......w.
w........ww................w...w......w.
w.......wwww..wwwwww.......w...w......w.
w......ww..wwww....w....wwww...ww....ww.
w.....ww...........w....w.......wwwwww..
w....ww............wwwwww...............
wwwwwww.................................
........................................
........................................
........................................
........................................
........................................;

Woods
url("bgImages/hut.png")
Hut
Road's end

tttttttttttttttttttttttttttttttttttttttt
tttt..tttttttt........ttttt.......tttttt
tttt..............................tttttt
tttt...............................ttttt
tt..........tttttt.................ttttt
tt.........tttttttt.....sss.........tttt
ttt........tttttttt....ssssss........ttt
ttt..tt.....tttttt.....ssssss........ttt
ttt..tt.....tt^ttt......ssss.........ttt
ttt..tt..............................ttt
ttt...................................tt
ttt...................................tt
ttt...................................tt
t.....................tt...............t
t.....................tt...............^
tt.....................................t
tt.....................................t
tt.....................................t
tt....................................tt
t.....................................tt
ttt.............................ttt...tt
ttt....tt.......................ttt....t
ttt....tt.tttt..............ttttttt....t
tttttttttttttttttttt........ttttttt..ttt
tttttttttttttttttttttttttttttttttttttttt;

Hut
#282828
Woods

........................................
........................................
........................................
.........wwwwwwwwwwwwwwwww..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........wwww^wwwwwwwwwwww..............
............www.........................
........................................
........................................
........................................
........................................
........................................
........................................;

Start of uncharted
#282828
Guard house
Road's end
PLACEHOLDER_TP
Secret room

wwwwwwwwwww.w..........w.wwwwwwwwww...ww
wwwwwww.....w.........ww..........w...ww
wwww........w.........w^..........wwwwww
www.........w.........ww..............ww
ww..........w..........w..............ww
ww..........wwwwwwwwwwww..............ww
w................ww...................ww
w................ww...................ww
w................ww...................ww
w................ww...................ww
w................ww...................ww
^......................................^
w................ww...................ww
w................ww...................ww
w................ww...................ww
w................ww...................ww
w...........wwwwwwwwwwww..............ww
w...........w..........w..............ww
w...........w........www..............ww
w...........w........w^f..............ww
ww..........w........www..............ww
ww..........w..........w..............ww
wwwww.......w..........w..........wwwwww
wwwwwwww....w..........w..........w...ww
wwwwwwwwwww.w..........w.wwwwwwwwww...ww;

Guard house
#282828
Start of uncharted

........................................
........................................
........................................
.........wwwwwwwwwwwwwwwww..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............ww.............
.........w...............^w.............
.........w...............ww.............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........wwwwwwwwwwwwwwwww..............
........................................
........................................
........................................
........................................
........................................
........................................
........................................;

Secret room
#282828
Start of uncharted

........................................
........................................
........................................
.........wwwwwwwwwwwwwwwww..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............ww.............
.........w...............^w.............
.........w...............ww.............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........wwwwwwwwwwwwwwwww..............
........................................
........................................
........................................
........................................
........................................
........................................
........................................;

Crossroads
#282828
PLACEHOLDER_TP
PLACEHOLDER_TP
PLACEHOLDER_TP
PLACEHOLDER_TP

........................................
........................................
..................www...................
.......wwwwwwwwwwww^wwwwwwwwwwwww.......
.......w........................w.......
.......w........................w.......
.......w........................w.......
.......w........................w.......
......ww........................ww......
......w^........................^w......
......ww........................ww......
.......w........................w.......
.......w........................w.......
.......w........................w.......
.......w........................w.......
.......w........................w.......
.......w........................w.......
.......wwwwwwwwwwww^wwwwwwwwwwwww.......
..................www...................
........................................
........................................
........................................
........................................
........................................
........................................;

Strange cavern
#282828
PLACEHOLDER_TP

..wwwwwww...............................
.ww....ww...............................
ww......w...............................
w.......w...............................
........w...............................
.......ww...............................
.......www..............................
.........w.wwwwww........wwwwww.........
.........www....www....www....www.......
..........w.......wwwwww........www...ww
..........w.......................wwwwww
..........w............................^
..........w.................www.......ww
..........w................wwwww......w.
.........ww................w...w......w.
........wwww..wwwwww.......w...w......w.
.......ww..wwww....w....wwww...ww....ww.
......ww...........w....w.......wwwwww..
.....ww............wwwwww...............
wwwwwww.................................
........................................
........................................
........................................
........................................
........................................;

The Beginning
#282828
PLACEHOLDER_TP

........................................
........................................
................www.....................
.........wwwwwwww^wwwwwwww..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........w...............w..............
.........wwwwwwwwwwwwwwwww..............
........................................
........................................
........................................
........................................
........................................
........................................
........................................;

`
