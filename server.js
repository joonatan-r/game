
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import GameManager from './server-game/gameManager.js';
import { removeByReference } from './server-game/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
const wss = new WebSocketServer({ noServer: true });
const clients = [];
let playerLoaded = true; // later for each player

// --------------------------------------------------------------------

let queuePromise = Promise.resolve();

async function addToQueue() {
  return new Promise(resolve => {
      queuePromise = queuePromise.then(() => {
          return new Promise(queueResolve => {
              resolve(queueResolve);
          });
      });
  });
}

const gm = new GameManager();

// --------------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/world", (req, res) => {
  playerLoaded = false;
  res.send(JSON.stringify({
    levels: gm.levels,
    player: gm.player,
    timeTracker: gm.timeTracker,
    referenced: gm.referenced
  }));
});

app.use("/test", express.static(path.join(__dirname, "client")));

server.on("upgrade", function upgrade(request, socket, head) {
  // This function is not defined on purpose. Implement it with your own logic.
  /*authenticate(request, function next(err, client) {
    if (err || !client) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }*/

    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request);
    });
  //});
});

wss.on("connection", function connection(ws) {
  clients.push(ws);
  ws.send("Connected");
  console.log("Connected");
  ws.on("message", function message(data, isBinary) {
    /*wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });*/
    const msgText = Buffer.from(data).toString('ascii');
    // console.log(msgText);
    // ws.send('Hello there!');
    action(msgText);
  });
  ws.on("close", function close() {
    removeByReference(clients, ws);
    console.log("Disconnected");
  });
});

// TODO: processturn events to client, support several clients, mobs etc.,
// later sending only to clients on the same level + fetch on each level change

// (initially before properly saving players, create/delete for each client while connected)

// --------------------------------------------------------------------

const TICK_INTERVAL = 1000;
const GAME_INTERVAL = 3000;
const GAME_PER_TICK = GAME_INTERVAL / TICK_INTERVAL;
let tickCounter = 0;
// later for each player, store update messages that happen while client still loading the initial state
let clientUpdateQueue = []; 

let msgCounter = 0;

setInterval(() => {
  tickCounter++;

  if (tickCounter >= GAME_PER_TICK) {
    tickCounter = 0;

    // do game logic stuff
    // loop updates for each level where there is a player
  }
  // update tick stuff, send all player movement etc.

  const someUpdateMsg = msgCounter++;

  if (!playerLoaded) {
    clientUpdateQueue.push(someUpdateMsg);
  } else {
    // NOTE: would have to make sure msgs are sent in order, if in theory the 
    // next interval triggers before this finishes

    if (clients[0]) {
      for (const item of clientUpdateQueue) {
        clients[0].send(item);
      }
      clientUpdateQueue = [];
      clients[0].send(someUpdateMsg);
    }
  }
}, TICK_INTERVAL);

async function action(msg) {
  const resolve = await addToQueue();
  const actionInfo = JSON.parse(msg);

  switch (actionInfo.type) {
    case "loaded":
      playerLoaded = true;
      break;
    case "move":
      gm.movePlayer(...actionInfo.args);
      break;
  }
  resolve();
}
