var Engine = Matter.Engine,
  Events = Matter.Events,
  Render = Matter.Render,
  Runner = Matter.Runner,
  Bodies = Matter.Bodies,
  Body = Matter.Body,
  Composite = Matter.Composite,
  Vertices = Matter.Vertices,
  Mouse = Matter.Mouse,
  MouseConstraint = Matter.MouseConstraint;

const IO_MATCH = "io_match";
const IO_AIM = "io_aim";
const IO_MOVE = "io_move";

let player = -1;
let room;

Matter.Common._seed = 13371337;
Matter.Resolver._restingThresh = 0.001;

var engine = Engine.create();
engine.world.gravity.y = 0;
engine.enableSleeping = true;

const canvas = document.getElementById("canvas");
var render = Render.create({
  element: document.body,
  engine: engine,
  canvas: canvas,
  options: { width: 1000, height: 500, showAngleIndicator: true, showSleeping: true },
});

//settings:
const goalWidth = 80;
const borderSize = 20;
const playerSize = 30;
const ballSize = 50;
const ballPhysics = { friction: 0.0, frictionAir: 0.004, restitution: 1.0, sleepThreshold: 400 };
const maxDrag = 100;
const force = 0.02;

//map:
{
  let verticesTop = arrVectify([
    [0, 0],
    [1000, 0],
    [1000, 250 - goalWidth / 2],
    [1000 - borderSize, 250 - goalWidth / 2],
    [1000 - borderSize, borderSize],
    [borderSize, borderSize],
    [borderSize, 250 - goalWidth / 2],
    [0, 250 - goalWidth / 2],
    [0, 0],
  ]);
  let top = Bodies.fromVertices(500, (250 - goalWidth / 2) / 2, verticesTop, {
    isStatic: true,
    restitution: 1.0,
  });
  Body.translate(top, { x: 0, y: -top.bounds.min.y });
  let verticesBottom = Vertices.scale(verticesTop, 1.0, -1.0);
  let bottom = Bodies.fromVertices(500, 250 + (250 + goalWidth / 2) / 2, verticesBottom, {
    isStatic: true,
    restitution: 1.0,
  });
  Body.translate(bottom, { x: 0, y: 500 - bottom.bounds.max.y });
  Composite.add(engine.world, [top, bottom]);
}

//balls:
let players = [];
let ball;
const playerDensity = 1 / (Math.PI * Math.pow(playerSize / 2, 2));
const ballDensity = 1 / (Math.PI * Math.pow(ballSize / 2, 2));
{
  players = [
    Bodies.circle(100, 250, playerSize / 2, { ...ballPhysics, density: playerDensity }),
    Bodies.circle(1000 - 100, 250, playerSize / 2, { ...ballPhysics, density: playerDensity }),
  ];
  ball = Bodies.circle(500, 250, ballSize / 2, { ...ballPhysics, density: ballDensity });
  Composite.add(engine.world, [...players, ball]);
  //setTimeout(() => Body.applyForce(player0, player0.position, vectify([force * 15, force * 15])), 1000);
}

Render.run(render);

var runner = Runner.create();

//mouse:
{
  let mouse = Mouse.create(render.canvas),
    mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.0,
        render: {
          visible: false,
        },
      },
    });

  Composite.add(engine.world, mouseConstraint);

  let moved = null;

  Events.on(mouseConstraint, "mousemove", (event) => {
    if (mouseConstraint.body) {
      if (player > -1 && mouseConstraint.body == players[player] && room.moving === false) {
        moved = mouseConstraint.body;
        return;
      }
    }
    moved = null;
  });

  Events.on(mouseConstraint, "mouseup", (event) => {
    if (moved) {
      if (player > -1 && moved == players[player] && room.moving === false) {
        const vForce = [
          forcify(moved.position.x - event.mouse.position.x),
          forcify(moved.position.y - event.mouse.position.y),
        ];
        Body.applyForce(moved, moved.position, vectify(vForce));
      }
    }
  });
}

this.socket = io();

socket.on(IO_MATCH, (match) => {
  console.log("Match received");
  player = match.players.findIndex((p) => p == socket.id);
  console.log(match.players, socket.id);

  if (match.ball.length == 0 && player == 0) {
    room = match;
    saveRoom();
    console.log("Match initialized");
    socket.emit(IO_MATCH, room);
  } else {
    room = match;
    loadRoom();
    console.log("Match loaded");
  }
});

socket.on(IO_AIM, (move) => {});

Runner.run(runner, engine);

function forcify(drag) {
  if (drag > maxDrag) drag = maxDrag;
  if (drag < -maxDrag) drag = -maxDrag;
  console.log(drag);
  return (force / maxDrag) * drag;
}

function vectify(vertex) {
  return { x: vertex[0], y: vertex[1] };
}

function arrVectify(vertices) {
  let arr = [];
  for (vertex of vertices) {
    arr.push(vectify(vertex));
  }
  return arr;
}

function loadRoom() {
  players[room.turn].render.fillStyle = "#ff0000";
}

function saveRoom() {}

class Room {
  players = []; //fill up until len = 2
  turn = 0; //index or players
  moving = false; //true after IO_MOVE until IO_MATCH with moving = false
  spectators = []; //fill up once players.len = 2
  player0 = []; //x, y, r
  player1 = []; //x, y, r
  ball = []; //x, y, r
  score = [0, 0]; //player0, player1
}
