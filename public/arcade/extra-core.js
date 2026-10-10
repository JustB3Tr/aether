export const stackPieces = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

export function makeStackBoard(width = 10, height = 20) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

export function createStackPiece(type, x = 3, y = 0) {
  return { type, shape: stackPieces[type].map(row => [...row]), x, y };
}

export function canPlaceStackPiece(board, piece, x = piece.x, y = piece.y, shape = piece.shape) {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const nextX = x + col;
      const nextY = y + row;
      if (nextX < 0 || nextX >= board[0].length || nextY >= board.length) return false;
      if (nextY >= 0 && board[nextY][nextX]) return false;
    }
  }
  return true;
}

export function rotateStackShape(shape) {
  const height = shape.length;
  const width = shape[0].length;
  return Array.from({ length: width }, (_, row) =>
    Array.from({ length: height }, (_, col) => shape[height - 1 - col][row]),
  );
}

export function rotateStackPiece(board, piece) {
  const shape = rotateStackShape(piece.shape);
  for (const kick of [0, -1, 1, -2, 2]) {
    const x = piece.x + kick;
    if (canPlaceStackPiece(board, piece, x, piece.y, shape)) return { ...piece, x, shape };
  }
  return piece;
}

export function lockStackPiece(board, piece) {
  const next = board.map(row => [...row]);
  let overflow = false;
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (!piece.shape[row][col]) continue;
      const x = piece.x + col;
      const y = piece.y + row;
      if (y < 0) overflow = true;
      else next[y][x] = piece.type;
    }
  }
  return { board: next, overflow };
}

export function clearStackLines(board) {
  const width = board[0].length;
  const remaining = board.filter(row => row.some(cell => !cell));
  const lines = board.length - remaining.length;
  return {
    board: [...Array.from({ length: lines }, () => Array(width).fill(0)), ...remaining],
    lines,
  };
}

export function typingStats(correctChars, typedChars, elapsedSeconds) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const correct = Math.max(0, Number(correctChars) || 0);
  const typed = Math.max(0, Number(typedChars) || 0);
  const wpm = elapsed ? correct / 5 / (elapsed / 60) : 0;
  const accuracy = typed ? correct / typed * 100 : 0;
  return {
    wpm: Math.round(wpm * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
  };
}
