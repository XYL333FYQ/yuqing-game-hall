// Create variables for use in our game.
var Game = {};

// Global game config
Game.config = {
  startingPlayer: "black", // Choose 'black' or 'red'.
  takenMsg: "此列已满，请选择其他列。",
  drawMsg: "棋盘已满，平局。",
  winMsg: "获胜者：",
  countToWin: 4,

  // note: board dimensions are zero-indexed
  boardLength: 6,
  boardHeight: 5,
};

// Global Game State
Game.board = [[0,0,0,0,0,0,0],
              [0,0,0,0,0,0,0],
              [0,0,0,0,0,0,0],
              [0,0,0,0,0,0,0],
              [0,0,0,0,0,0,0],
              [0,0,0,0,0,0,0]];

Game.currentPlayer = Game.config.startingPlayer;
