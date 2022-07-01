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
  options: { width: 1000, height: 500, wireframes: false, showSleeping: false }, //showAngleIndicator: true, showSleeping: true,
});

//settings:
const playerSize = 30;
const ballSize = 50;
const ballPhysics = { friction: 0.0, frictionAir: 0.004, restitution: 1.0, sleepThreshold: 400 };
const maxDrag = 60;
const maxForce = 0.02;

//map:
const goalWidth = 80;
const borderSize = 20;
const margin = maxDrag;
{
  let verticesTop = arrVectify([
    [margin, margin],
    [1000 - margin, margin],
    [1000 - margin, 250 - goalWidth / 2],
    [1000 - margin - borderSize, 250 - goalWidth / 2],
    [1000 - margin - borderSize, margin + borderSize],
    [margin + borderSize, margin + borderSize],
    [margin + borderSize, 250 - goalWidth / 2],
    [margin, 250 - goalWidth / 2],
    [margin, margin],
  ]);
  let top = Bodies.fromVertices(500, (250 - goalWidth / 2) / 2, verticesTop, {
    isStatic: true,
    restitution: 1.0,
  });
  Body.translate(top, { x: 0, y: margin - top.bounds.min.y });
  let verticesBottom = Vertices.scale(verticesTop, 1.0, -1.0);
  let bottom = Bodies.fromVertices(500, 250 + (250 + goalWidth / 2) / 2, verticesBottom, {
    isStatic: true,
    restitution: 1.0,
  });
  Body.translate(bottom, { x: 0, y: 500 - margin - bottom.bounds.max.y });
  Composite.add(engine.world, [top, bottom]);
}

//balls:
let players = [];
let ball;
const playerDensity = 1 / (Math.PI * Math.pow(playerSize / 2, 2));
const ballDensity = 1 / (Math.PI * Math.pow(ballSize / 2, 2));
{
  players = [
    Bodies.circle(100, 250, playerSize / 2, {
      ...ballPhysics,
      density: playerDensity,
      render: {
        fillStyle: "white",
        strokeStyle: "red",
      },
    }),
    Bodies.circle(1000 - 100, 250, playerSize / 2, {
      ...ballPhysics,
      density: playerDensity,
      render: {
        fillStyle: "white",
        strokeStyle: "red",
      },
    }),
  ];
  ball = Bodies.circle(500, 250, ballSize / 2, {
    ...ballPhysics,
    density: ballDensity,
    render: {
      fillStyle: "green",
    },
  });
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
        let drag = scaleDrag([moved.position.x - mouse.position.x, moved.position.y - mouse.position.y]);
        let force = [(drag[0] / maxDrag) * maxForce, (drag[1] / maxDrag) * maxForce];
        Body.applyForce(moved, moved.position, vectify(force));
        moved = null;
      }
    }
  });

  Events.on(render, "afterRender", () => {
    let mouse = mouseConstraint.mouse;
    let ctx = render.context;
    let drag = scaleDrag([moved.position.x - mouse.position.x, moved.position.y - mouse.position.y]);
    ctx.beginPath();
    ctx.moveTo(moved.position.x, moved.position.y);
    ctx.lineTo(moved.position.x - drag[0], moved.position.y - drag[1]);
    ctx.strokeStyle = "red 5px";
    ctx.strokeWidth = "4px";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(moved.position.x, moved.position.y);
    ctx.lineTo(moved.position.x + drag[0] * 2.0, moved.position.y + drag[1] * 2.0);
    ctx.strokeStyle = "grey";
    ctx.strokeWidth = "2px";
    ctx.stroke();
  });
}

this.socket = io();

socket.on(IO_MATCH, (match) => {
  console.log("Match received");
  player = match.players.findIndex((p) => p == socket.id);

  if (match.ballCoords.length == 0 && player == 0) {
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

function scaleDrag([dragx, dragy]) {
  ratio = maxDrag / Math.sqrt(dragx * dragx + dragy * dragy);
  if (ratio < 1.0) {
    dragx *= ratio;
    dragy *= ratio;
  }
  return [dragx, dragy];
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
  console.log(players);
  players.forEach((p, i) => (p.render.lineWidth = i == room.turn ? 5 : 0));
  players.forEach((p, i) => (p.render.fillStyle = i == player ? "blue" : "white"));
}

function saveRoom() {
  room.ballCoords = [ball.position.x, ball.position.y, ball.angle];
  room.playerCoords = players.map((p) => [p.position.x, p.position.y, p.angle]);
}

class Room {
  players = []; //unlimited, first two play, others spectate
  turn = 0; //index of player who aims
  moving = false; //true after IO_MOVE until IO_MATCH with moving = false
  playerCoords = []; //[x, y, r], ...
  ballCoords = []; //x, y, r
  score = [0, 0]; //player0, player1
}
