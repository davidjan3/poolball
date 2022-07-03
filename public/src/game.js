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

const debug = false;

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

//settings:
const playerSize = 20;
const ballSize = 30;
const ballPhysics = { friction: 0.0, frictionAir: 0.004, restitution: 1.0, sleepThreshold: 400 };
const maxDrag = 120;
const maxForce = 0.015;

//colors:
const backgroundColor = "rgb(8,8,12)";
const mapColor = "rgb(160,160,160)";
const goalColor = "rgb(200,200,200)";
const playerColor = "rgb(120,120,240)";
const enemyColor = "rgb(240,120,120)";
const activeColor = "white";
const ballColor = mapColor;

//map:
const goalWidth = 120;
const borderSize = 10;
const margin = maxDrag;

const canvas = document.getElementById("canvas");
const scoreL = document.getElementById("scoreL");
const scoreR = document.getElementById("scoreR");
var render = Render.create({
  element: document.body,
  engine: engine,
  canvas: canvas,
  options: {
    width: 1000,
    height: 500,
    wireframes: false,
    background: backgroundColor,
    showAngleIndicator: debug,
    showSleeping: debug,
  },
});

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
    render: {
      fillStyle: mapColor,
      lineWidth: 0,
    },
  });
  Body.translate(top, { x: 0, y: margin - top.bounds.min.y });
  let verticesBottom = Vertices.scale(verticesTop, 1.0, -1.0);
  let bottom = Bodies.fromVertices(500, 250 + (250 + goalWidth / 2) / 2, verticesBottom, {
    isStatic: true,
    restitution: 1.0,
    render: {
      fillStyle: mapColor,
      lineWidth: 0,
    },
  });
  Body.translate(bottom, { x: 0, y: 500 - margin - bottom.bounds.max.y });
  let goalL = Bodies.rectangle(margin + borderSize / 2, 250, borderSize, goalWidth, {
    isStatic: true,
    restitution: 1.0,
    collisionFilter: {
      group: -1,
    },
    render: {
      fillStyle: goalColor,
      lineWidth: 0,
    },
  });
  let goalR = Bodies.rectangle(1000 - (margin + borderSize / 2), 250, borderSize, goalWidth, {
    isStatic: true,
    restitution: 1.0,
    collisionFilter: {
      group: -1,
    },
    render: {
      fillStyle: goalColor,
      lineWidth: 0,
    },
  });
  Composite.add(engine.world, [top, bottom, goalL, goalR]);
}

//balls:
let players = [];
let ball;
let aiming = null;
const playerDensity = 1 / (Math.PI * Math.pow(playerSize / 2, 2));
const ballDensity = 1 / (Math.PI * Math.pow(ballSize / 2, 2));

{
  players = [
    Bodies.circle(0, 0, playerSize / 2, {
      ...ballPhysics,
      density: playerDensity,
      render: {
        fillStyle: ballColor,
        strokeStyle: activeColor,
      },
    }),
    Bodies.circle(0, 0, playerSize / 2, {
      ...ballPhysics,
      density: playerDensity,
      render: {
        fillStyle: ballColor,
        strokeStyle: activeColor,
      },
    }),
  ];
  ball = Bodies.circle(0, 0, ballSize / 2, {
    ...ballPhysics,
    density: ballDensity,
    collisionFilter: {
      group: -1,
    },
    render: {
      fillStyle: ballColor,
    },
  });
  Composite.add(engine.world, [...players, ball]);
  //setTimeout(() => Body.applyForce(player0, player0.position, vectify([force * 15, force * 15])), 1000);
}

loadDefault();

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
          visible: debug,
        },
      },
    });

  Composite.add(engine.world, mouseConstraint);

  let moved = null;

  Events.on(mouseConstraint, "mousemove", (event) => {
    if (mouseConstraint.body) {
      console.log(player, mouseConstraint.body == players[player], !room.moving);
      if (player > -1 && mouseConstraint.body == players[player] && !room.moving && room.turn == player) {
        console.log("moving");
        moved = mouseConstraint.body;
        let drag = scaleDrag([moved.position.x - mouse.position.x, moved.position.y - mouse.position.y]);
        socket.emit(IO_AIM, drag);
        loadAim(drag);
        return;
      }
    }
    moved = null;
  });

  Events.on(mouseConstraint, "mouseup", (event) => {
    if (moved) {
      if (player > -1 && moved == players[player] && !room.moving && room.turn == player) {
        let drag = scaleDrag([moved.position.x - mouse.position.x, moved.position.y - mouse.position.y]);
        socket.emit(IO_MOVE, drag);
        loadMove(drag);
        moved = null;
      }
    }
  });

  Events.on(render, "afterRender", () => {
    if (aiming) {
      let ctx = render.context;
      const longAim = scaleDragLen(aiming, 1000);
      ctx.beginPath();
      ctx.lineWidth = 8;
      ctx.moveTo(players[room.turn].position.x, players[room.turn].position.y);
      ctx.lineTo(players[room.turn].position.x - aiming[0], players[room.turn].position.y - aiming[1]);
      ctx.strokeStyle = room.turn == player ? playerColor : enemyColor;
      ctx.stroke();
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.moveTo(players[room.turn].position.x, players[room.turn].position.y);
      ctx.lineTo(players[room.turn].position.x + longAim[0], players[room.turn].position.y + longAim[1]);
      ctx.strokeStyle = activeColor;
      ctx.stroke();
    }
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

socket.on(IO_AIM, (move) => {
  console.log("Aim received");
  loadAim(move);
});

socket.on(IO_MOVE, (move) => {
  console.log("Move received");
  loadMove(move);
});

Events.on(runner, "afterUpdate", () => {
  if (room && room.moving && room.turn == player) {
    console.log(room.turn);
    if (ball.position.x < margin) {
      room.score[1]++;
      room.turn = 0;
      loadDefault();
      room.moving = false;
    } else if (ball.position.x > 1000 - margin) {
      room.score[0]++;
      room.turn = 1;
      loadDefault();
      room.moving = false;
    } else {
      room.moving = ![...players, ball].every((b) => b.isSleeping);
      if (!room.moving) room.turn = (room.turn + 1) % 2;
    }
    console.log(room.moving);
    if (!room.moving) {
      saveRoom();
      socket.emit(IO_MATCH, room);
    }
  }
});

Runner.run(runner, engine);

function loadAim([x, y]) {
  aiming = [x, y];
}

function loadMove([x, y]) {
  aiming = null;
  let force = [(x / maxDrag) * maxForce, (y / maxDrag) * maxForce];
  Body.applyForce(players[room.turn], players[room.turn].position, vectify(force));
  room.moving = true;
}

function stopMoving() {
  [...players, ball].forEach((b) => {
    Body.setVelocity(b, { x: 0, y: 0 });
    Body.setAngle(b, 0);
  });
}

function loadDefault() {
  stopMoving();
  Body.setPosition(players[0], { x: margin + borderSize + 50, y: 250 });
  Body.setPosition(players[1], { x: 1000 - (margin + borderSize + 50), y: 250 });
  Body.setPosition(ball, { x: 500, y: 250 });
}

function scaleDrag([dragx, dragy]) {
  return scaleDragLen([dragx, dragy], maxDrag);
}

function scaleDragLen([dragx, dragy], len) {
  ratio = len / Math.sqrt(dragx * dragx + dragy * dragy);
  if (ratio < 1.0 || len >= 1000) {
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
  stopMoving();
  aiming = null;
  if (room.ballCoords.length != 0) {
    let c = room.ballCoords;
    Body.setPosition(ball, { x: c[0], y: c[1] });
    Body.setAngle(ball, c[2]);
  }
  room.playerCoords.forEach((c, i) => {
    Body.setPosition(players[i], { x: c[0], y: c[1] });
    Body.setAngle(players[i], c[2]);
  });
  players.forEach((p, i) => {
    p.render.lineWidth = i == room.turn ? 5 : 0;
    p.render.fillStyle = i == player ? playerColor : enemyColor;
  });
  scoreL.innerText = room.score[0];
  scoreR.innerText = room.score[1];
}

function saveRoom() {
  aiming = null;
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
