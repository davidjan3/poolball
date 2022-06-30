const IO_MATCH = "io_match";
const IO_AIM = "io_aim";
const IO_MOVE = "io_move";

class Client {
  socket;

  constructor() {
    this.socket = io();
  }
}
