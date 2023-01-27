
import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import GameManager from './server-game/gameManager.js';
import { coordsEq, removeByReference } from './server-game/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
const wss = new WebSocketServer({ noServer: true });
const clientInfos = [];
const msgQueue = [];
const prevPlayerInfoById = {};
let idCounter = 0;

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

const gm = new GameManager(msgQueue);

// --------------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/world", (req, res) => {
  const otherPlayers = [];

  for (const clientInfo of clientInfos) {
    if (clientInfo.id === Number(req.query.clientId)) {
      clientInfo.loaded = false;
    } else if (clientInfo.currentLvl === "Road's end" && !clientInfo.player.dead) { // TODO improve
      otherPlayers.push(clientInfo.player);
    }
  }
  res.send(JSON.stringify({
    levels: gm.levels,
    player: gm.player,
    otherPlayers: otherPlayers,
    timeTracker: gm.timeTracker,
    referenced: gm.referenced
  }));
  // console.log(req.ip)
});

app.get("/level", (req, res) => {
  const name = req.query.name;
  const currentLvl = req.query.currentLvl;
  const pos = [Number(req.query.y), Number(req.query.x)];
  const otherPlayers = [];
  let ci = null;

  for (const clientInfo of clientInfos) {
    if (clientInfo.id === Number(req.query.clientId)) {
      clientInfo.loaded = false;
      ci = clientInfo;
    } else if (clientInfo.currentLvl === name && !clientInfo.player.dead) {
      otherPlayers.push(clientInfo.player);
    }
  }
  const newLevel = gm.getLevelAndChange(ci, name, currentLvl, pos);
  res.send(JSON.stringify({
    level: newLevel,
    playerPos: ci.player.pos, // changed while getting the level
    otherPlayers: otherPlayers
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

wss.on("connection", function connection(ws, req) {
  const newId = idCounter++;
  const newClientInfo = {
    id: newId,
    client: ws,
    loaded: true,
    updateQueue: [], // store update messages that happen while client still loading initial state
    player: gm.createPlayer(newId),
    level: gm.levels["Road's end"].level,
    mobs: gm.levels["Road's end"].mobs,
    items: gm.levels["Road's end"].items,
    customRenders: gm.levels["Road's end"].customRenders,
    currentLvl: "Road's end"
  };
  clientInfos.push(newClientInfo);
  ws.send(JSON.stringify({ type: "assignId", id: newClientInfo.id }));
  console.log(newClientInfo.id + " connected");
  // console.log(req.socket.remoteAddress);
  ws.on("message", function message(data, isBinary) {
    /*wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });*/
    if (newClientInfo.player.dead) return;
    const msgText = Buffer.from(data).toString('ascii');
    action(newClientInfo, msgText);
  });
  ws.on("close", function close() {
    removeByReference(gm.levels[newClientInfo.currentLvl].players, newClientInfo.player);
    removeByReference(clientInfos, newClientInfo);
    console.log(newClientInfo.id + " disconnected");

    for (const clientInfo of clientInfos) {
      clientInfo.client.send(JSON.stringify({
        type: "list", // NOTE: use list because current client implementation
        msgs: [{
          type: "death",
          clientId: newClientInfo.id,
          level: newClientInfo.currentLvl
        }]
      }));
    }
  });
});

// TODO: processturn events to client, support several clients, mobs etc.,
// later sending only to clients on the same level

// (initially before properly saving players, create/delete for each client while connected)
// send client disconnect (maybe at first just directly in the close handler)

// --------------------------------------------------------------------

const TICK_INTERVAL = 100;
const GAME_INTERVAL = 300;
const GAME_PER_TICK = GAME_INTERVAL / TICK_INTERVAL;
let tickCounter = 0;

setInterval(() => {
  // initialize msgs to what is in the queue and empty the queue
  const msgs = msgQueue.splice(0, msgQueue.length);
  tickCounter++;

  if (tickCounter >= GAME_PER_TICK) {
    tickCounter = 0;
    msgs.push(...gm.processTick(clientInfos));
  }
  for (const clientInfo of clientInfos) {
    if (clientInfo.deathMsgSent) continue;
    const prevInfo = prevPlayerInfoById[clientInfo.id];

    if (!prevInfo || !coordsEq(clientInfo.player.pos, prevInfo.pos)) {
      const newMsg = {
        type: "move",
        clientId: clientInfo.id,
        value: clientInfo.player.pos,
        level: clientInfo.currentLvl
      };
      msgs.push(newMsg);
    }
    if (prevInfo && prevInfo.level !== clientInfo.currentLvl) {
      const newMsg = {
        type: "levelChange",
        clientId: clientInfo.id,
        level: clientInfo.currentLvl
      };
      msgs.push(newMsg);
    }
    if (clientInfo.player.health < 1 && (!prevInfo || prevInfo.health > 0)) {
      // NOTE: player.dead already set when happens in game
      clientInfo.deathMsgSent = true;
      const newMsg = {
        type: "death",
        clientId: clientInfo.id,
        level: clientInfo.currentLvl
      };
      msgs.push(newMsg);
      removeByReference(gm.levels[clientInfo.currentLvl].players, clientInfo.player);
      // delete all properties, so all references to it recognize deletion
      for (const prop in clientInfo.player) {
        if (clientInfo.player.hasOwnProperty(prop) && prop !== "dead") delete clientInfo.player[prop];
      }
      continue; // skip updating prevInfo
    } else if (prevInfo && prevInfo.health !== clientInfo.player.health) {
      // NOTE: for now only send player health changes to themselves
      clientInfo.client.send(JSON.stringify({
        type: "list", // NOTE: use list because current client implementation
        msgs: [{
          type: "healthChange",
          clientId: clientInfo.id,
          value: clientInfo.player.health,
          level: clientInfo.currentLvl
        }]
      }));
    }
    prevPlayerInfoById[clientInfo.id] = {
      pos: clientInfo.player.pos.slice(),
      level: clientInfo.currentLvl,
      health: clientInfo.player.health
    };
  }
  for (const clientInfo of clientInfos) {
    if (!clientInfo.loaded) {
      clientInfo.updateQueue.push(...msgs);
    } else {
      // NOTE: would have to make sure msgs are sent in order, if in theory the 
      // next interval triggers before this finishes

      clientInfo.client.send(JSON.stringify({
        type: "list",
        msgs: [...clientInfo.updateQueue, ...msgs]
      }));
      clientInfo.updateQueue = [];
    }
  }
}, TICK_INTERVAL);

async function action(clientInfo, msg) {
  const resolve = await addToQueue();
  const actionInfo = JSON.parse(msg);

  switch (actionInfo.type) {
    case "loaded":
      clientInfo.loaded = true;
      break;
    case "move":
      gm.movePlayer(clientInfo, ...actionInfo.args);
      break;
    case "shoot":
      msgQueue.push({
        type: "shoot",
        clientId: clientInfo.id,
        level: clientInfo.currentLvl,
        pos: actionInfo.pos.slice(),
        drc: actionInfo.drc
      });
      gm.shoot(gm.levels[clientInfo.currentLvl], actionInfo.pos, actionInfo.drc, clientInfo.id);
      break;
  }
  resolve();
}
