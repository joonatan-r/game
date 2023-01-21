
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import GameManager from './server-game/gameManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
const wss = new WebSocketServer({ noServer: true });

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
  ws.send("Connected");
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
});


// --------------------------------------------------------------------


// init stuff, (gm.turnInterval = setInterval(() => gm.processTurn(), options.TURN_DELAY))


async function action(msg) {
  const resolve = await addToQueue();
  const actionInfo = JSON.parse(msg);

  switch (actionInfo.type) {
    case "move":
      gm.movePlayer(...actionInfo.args);
      break;
  }
  resolve();
}
