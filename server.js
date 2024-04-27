import dotenv from "dotenv";
dotenv.config();
import http, { request } from "http";
import express, { response } from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import * as crypto from "crypto";

const serverUrl = process.env.SERVER_URL;
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    type(req) {
      return true;
    },
  })
);

app.get("/api/server-url", (req, res) => {
  serverUrl += `:${PORT}`;
  res.json({ serverUrl });
});

app.get("/api/websocket-url", (req, res) => {
  const wsURL = serverUrl.replace('https', 'wss') + `:${PORT}` + '/ws';
  res.json({ wsURL });
})

app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

const userState = [];

app.post("/new-user", async (request, response) => {
  console.log(request.body);
  if (Object.keys(request.body).length === 0) {
    const result = {
      status: "error",
      message: "Enter your name!",
    };
    response.status(400).send(JSON.stringify(result)).end();
  }
  const { name } = request.body;
  const isExist = userState.find((user) => user.name === name);
  if (!isExist) {
    const newUser = {
      id: crypto.randomUUID(),
      name: name,
    };
    userState.push(newUser);
    const result = {
      status: "ok",
      user: newUser,
    };
    response.send(JSON.stringify(result)).end();
  } else {
    const result = {
      status: "error",
      message: "This name is already taken!",
    };
    response.status(409).send(JSON.stringify(result)).end();
  }
});

app.use("/", (req, res) => {
  if (req.method === 'GET' && req.path === '/') {
    return res.end();
  }
});

const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });

wsServer.on("connection", (ws) => {
  ws.on("message", (msg, isBinary) => {
    const receivedMSG = JSON.parse(msg);
    
//  Я не понял как по-другому получать всех пользователей при необходимости 
    if (receivedMSG.type === 'getUsers') {
      [...wsServer.clients]
    .filter((o) => o.readyState === WebSocket.OPEN)
    .forEach((o) => o.send(JSON.stringify(userState)));
    return;
    }

    if (!receivedMSG.user) return;

    if (receivedMSG.type === "exit") {
      const idx = userState.findIndex(
        (user) => user.name === receivedMSG.user.name
      );
      userState.splice(idx, 1);
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(JSON.stringify(userState)));
        console.dir(userState);
      return;
    }
    if (receivedMSG.type === "send") {
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(msg, { binary: isBinary }));
    }
  });
  [...wsServer.clients]
    .filter((o) => o.readyState === WebSocket.OPEN)
    .forEach((o) => o.send(JSON.stringify(userState)));
});

const bootstrap = async () => {
  try {
    server.listen(PORT, () =>
      console.log(`Server has been started on ${PORT}`)
    );
  } catch (error) {
    console.error(error);
  }
};

bootstrap();