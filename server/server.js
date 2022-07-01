const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 80;

app.use(express.json());

const roomCodeLen = 5;
let rooms = new Map();

const IO_MATCH = "io_match";
const IO_AIM = "io_aim";
const IO_MOVE = "io_move";

const addr = path.join(__dirname, "../public/");
app.use(express.static(addr));
app.use("/modules/", express.static(path.join(__dirname, "../node_modules/")));
app.get("/room/:id", (req, res) => {
  if (req.params.id === "new") {
    let id = generateRoomName();
    console.log("New room: " + id);
    rooms.set(id, new Room());
    res.redirect("/room/" + id);
    return;
  } else if (!rooms.has(req.params.id)) {
    res.redirect("/index.html?error=invalid_room");
    console.log("Invalid room: " + req.params.id);
    return;
  }
  console.log("Joining room: " + req.params.id);
  res.sendFile(path.join(addr, "room.html"));
});
app.get("*", (req, res) => {
  res.redirect("/");
});
app.get("/", (req, res) => {
  res.sendFile(path.join(addr, "index.html"));
});

io.on("connection", (socket) => {
  const url = socket.request.headers.referer.split("/");
  const roomCode = url ? url[url.length - 1] : null;
  console.log("Attempt to connect to: " + roomCode);
  if (roomCode.length == roomCodeLen && rooms.has(roomCode)) {
    let room = rooms.get(roomCode);
    room.players.push(socket.id);
    console.log("Player connected: " + roomCode);
    console.log("Players: " + room.players);
    room.players.forEach((id) => io.sockets.sockets.get(id).emit(IO_MATCH, room));

    socket.on("disconnect", () => {
      room.players = room.players.filter((id) => id != socket.id);
      console.log("Player disconnected: " + roomCode);
      console.log("Players: " + room.players);
      if (room.players.length == 0) {
        rooms.delete(roomCode);
        console.log("Room deleted: " + roomCode);
      } else {
        room.players.forEach((id) => io.sockets.sockets.get(id).emit(IO_MATCH, room));
      }
    });

    socket.on(IO_MATCH, (match) => {
      console.log("Match received");
      if ((room.moving || room.ballCoords.length == 0) && !match.moving && room.players[room.turn] == socket.id) {
        console.log("Match loaded");
        room = match;
        rooms.set(roomCode, room);
        if (room.ballCoords.length != 0) room.turn = (room.turn + 1) % 2;
        room.players.forEach((id) => io.sockets.sockets.get(id).emit(IO_MATCH, room));
      }
    });

    socket.on(IO_AIM, (move) => {
      //move = [x, y]
      if (!room.moving && room.players[room.turn] == socket.id) {
        room.players.forEach((id) => {
          if (id != socket.id) {
            io.sockets.sockets.get(id).emit(IO_AIM, move);
          }
        });
      }
    });

    socket.on(IO_MOVE, (move) => {
      //move = [x, y]
      if (!room.moving && room.players[room.turn] == socket.id) {
        room.players.forEach((id) => {
          if (id != socket.id) {
            io.sockets.sockets.get(id).emit(IO_MOVE, move);
          }
        });
      }
    });
  }
});

server.listen(port, () => console.log("Server accessible on port " + port));

function generateRoomName() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  while (id == "" || id in rooms) {
    id = "";
    for (let i = 0; i < roomCodeLen; i++) {
      id += letters.charAt(Math.floor(Math.random() * letters.length));
    }
  }
  return id;
}

class Room {
  players = []; //unlimited, first two play, others spectate
  turn = 0; //index of player who aims
  moving = false; //true after IO_MOVE until IO_MATCH with moving = false
  playerCoords = []; //[x, y, r], ...
  ballCoords = []; //x, y, r
  score = [0, 0]; //player0, player1
}
