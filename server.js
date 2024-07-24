const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const boardSize = 5;
let gameState = {
  board: [],
  currentPlayer: "A",
  gameOver: false,
  kills: { A: 0, B: 0 },
};

function initializeBoard() {
  gameState.board = [];
  for (let i = 0; i < boardSize; i++) {
    let row = [];
    for (let j = 0; j < boardSize; j++) {
      row.push(null);
    }
    gameState.board.push(row);
  }
}

initializeBoard();

io.on("connection", (socket) => {
  socket.emit("gameState", gameState);

  socket.on("restartGame", () => {
    gameState.gameOver = false;
    gameState.currentPlayer = "A";
    gameState.kills = { A: 0, B: 0 };
    initializeBoard();
    io.emit("gameState", gameState);
  });

  socket.on("isSafePlace", (data, callback) => {
    const { row, col, player } = data;
    callback(isSafePlace(row, col, player));
  });

  socket.on("placeTank", (data) => {
    const { row, col, direction } = data;
    if (gameState.board[row][col] || gameState.gameOver) return;
    gameState.board[row][col] = { player: gameState.currentPlayer, direction };
    checkForKill();
    gameState.currentPlayer = gameState.currentPlayer === "A" ? "B" : "A";
    if (!findSafePlace()) {
      gameState.gameOver = true;
      displayGameOver();
    }
    io.emit("gameState", gameState);
    io.emit("scores", {
      A: calculateScore("A"),
      B: calculateScore("B"),
    });
  });
});

function isSafePlace(row, col, player) {
  let dangerCount = 0;
  const directions = [
    { rowStep: -1, colStep: 0 }, // N
    { rowStep: -1, colStep: 1 }, // NE
    { rowStep: 0, colStep: 1 }, // E
    { rowStep: 1, colStep: 1 }, // SE
    { rowStep: 1, colStep: 0 }, // S
    { rowStep: 1, colStep: -1 }, // SW
    { rowStep: 0, colStep: -1 }, // W
    { rowStep: -1, colStep: -1 }, // NW
  ];

  for (const { rowStep, colStep } of directions) {
    let currentRow = row + rowStep;
    let currentCol = col + colStep;

    while (
      currentRow >= 0 &&
      currentRow < boardSize &&
      currentCol >= 0 &&
      currentCol < boardSize
    ) {
      if (gameState.board[currentRow][currentCol]) {
        if (
          gameState.board[currentRow][currentCol].player !== player &&
          isPointingAt(currentRow, currentCol, row, col)
        ) {
          dangerCount++;
        }
        break; // Stop at the first obstacle
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
  }

  return dangerCount < 2;
}

function isPointingAt(tankRow, tankCol, targetRow, targetCol) {
  const tank = gameState.board[tankRow][tankCol];
  const rowDiff = targetRow - tankRow;
  const colDiff = targetCol - tankCol;

  switch (tank.direction) {
    case "N":
      return (
        rowDiff < 0 &&
        colDiff === 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "NE":
      return (
        rowDiff < 0 &&
        colDiff > 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "E":
      return (
        rowDiff === 0 &&
        colDiff > 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "SE":
      return (
        rowDiff > 0 &&
        colDiff > 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "S":
      return (
        rowDiff > 0 &&
        colDiff === 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "SW":
      return (
        rowDiff > 0 &&
        colDiff < 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "W":
      return (
        rowDiff === 0 &&
        colDiff < 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    case "NW":
      return (
        rowDiff < 0 &&
        colDiff < 0 &&
        !hasObstacle(tankRow, tankCol, targetRow, targetCol)
      );
    default:
      return false;
  }
}

function hasObstacle(tankRow, tankCol, targetRow, targetCol) {
  const rowStep = Math.sign(targetRow - tankRow);
  const colStep = Math.sign(targetCol - tankCol);
  let currentRow = tankRow + rowStep;
  let currentCol = tankCol + colStep;

  while (currentRow !== targetRow || currentCol !== targetCol) {
    if (gameState.board[currentRow][currentCol]) {
      return true;
    }
    currentRow += rowStep;
    currentCol += colStep;
  }
  return false;
}

function checkForKill() {
  const A_tank_points = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(0)
  );
  const B_tank_points = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(0)
  );
  let targetsA = [];
  let targetsB = [];

  // Mark points for player A
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (gameState.board[i][j] && gameState.board[i][j].player === "A") {
        markPoints(i, j, "A", A_tank_points);
      }
    }
  }

  // Mark points for player B
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (gameState.board[i][j] && gameState.board[i][j].player === "B") {
        markPoints(i, j, "B", B_tank_points);
      }
    }
  }

  // Find targets for player A (B tanks that are pointed by at least 2 A tanks)
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (
        A_tank_points[i][j] >= 2 &&
        gameState.board[i][j] &&
        gameState.board[i][j].player === "B"
      ) {
        targetsA.push({ row: i, col: j });
      }
    }
  }

  // Find targets for player B (A tanks that are pointed by at least 2 B tanks)
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (
        B_tank_points[i][j] >= 2 &&
        gameState.board[i][j] &&
        gameState.board[i][j].player === "A"
      ) {
        targetsB.push({ row: i, col: j });
      }
    }
  }

  // Kill targets for player A
  for (let target of targetsA) {
    gameState.board[target.row][target.col] = null;
    gameState.kills.A += 1;
  }

  // Kill targets for player B
  for (let target of targetsB) {
    gameState.board[target.row][target.col] = null;
    gameState.kills.B += 1;
  }
}

function markPoints(row, col, player, tank_points) {
  const tank = gameState.board[row][col];
  const directions = {
    N: [-1, 0],
    NE: [-1, 1],
    E: [0, 1],
    SE: [1, 1],
    S: [1, 0],
    SW: [1, -1],
    W: [0, -1],
    NW: [-1, -1],
  };

  const [rowStep, colStep] = directions[tank.direction];
  let currentRow = row + rowStep;
  let currentCol = col + colStep;

  while (
    currentRow >= 0 &&
    currentRow < boardSize &&
    currentCol >= 0 &&
    currentCol < boardSize
  ) {
    tank_points[currentRow][currentCol] += 1;
    if (gameState.board[currentRow][currentCol]) {
      break;
    }
    currentRow += rowStep;
    currentCol += colStep;
  }
}

function findSafePlace() {
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!gameState.board[i][j]) {
        if (isSafePlace(i, j, gameState.currentPlayer)) {
          return true;
        }
      }
    }
  }
  return false;
}

function calculateScore(player) {
  let remaining = 0;
  let controlled = 0;

  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (gameState.board[i][j] && gameState.board[i][j].player === player) {
        remaining++;
        if (isControlledBlock(i, j, player)) {
          controlled++;
        }
      }
    }
  }

  return {
    killed: gameState.kills[player],
    remaining: remaining,
    controlled: controlled,
    total: gameState.kills[player] + remaining + controlled,
  };
}

function isControlledBlock(row, col, player) {
  let count = 0;
  const directions = [
    { rowStep: -1, colStep: 0 }, // N
    { rowStep: -1, colStep: 1 }, // NE
    { rowStep: 0, colStep: 1 }, // E
    { rowStep: 1, colStep: 1 }, // SE
    { rowStep: 1, colStep: 0 }, // S
    { rowStep: 1, colStep: -1 }, // SW
    { rowStep: 0, colStep: -1 }, // W
    { rowStep: -1, colStep: -1 }, // NW
  ];

  for (const { rowStep, colStep } of directions) {
    let currentRow = row + rowStep;
    let currentCol = col + colStep;

    while (
      currentRow >= 0 &&
      currentRow < boardSize &&
      currentCol >= 0 &&
      currentCol < boardSize
    ) {
      if (gameState.board[currentRow][currentCol]) {
        if (gameState.board[currentRow][currentCol].player === player) {
          count++;
        }
        break; // Stop at the first obstacle
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
  }

  return count >= 2;
}

function displayGameOver() {
  const redScore = calculateScore("A");
  const blueScore = calculateScore("B");
  const winner =
    redScore.total > blueScore.total
      ? "A"
      : redScore.total < blueScore.total
      ? "B"
      : "Everyone";
  const gameOverMessage = `Game Over. ${winner} wins!`;
  io.emit("gameState", gameState);
  io.emit("scores", {
    A: redScore,
    B: blueScore,
  });
  io.emit("gameOver", gameOverMessage);
}

app.use(express.static(__dirname));

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
