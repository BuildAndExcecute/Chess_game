// Pieces dictionary for instant board rendering
const PIECE_ASSETS = {
  white: {
    pawn: "white-piece/pawn.png",
    knight: "white-piece/knight.png",
    bishop: "white-piece/bishop.png",
    rook: "white-piece/rook.png",
    queen: "white-piece/queen.png",
    king: "white-piece/king.png",
  },
  black: {
    pawn: "black-piece/pawn.png",
    knight: "black-piece/knight.png",
    bishop: "black-piece/bishop.png",
    rook: "black-piece/rook.png",
    queen: "black-piece/queen.png",
    king: "black-piece/king.png",
  },
};

const createPieceImage = (color, piece) =>
  `<img class="piece-image ${color}-piece-image" src="${PIECE_ASSETS[color][piece]}" alt="${color} ${piece}" draggable="false">`;

const CHESS_PIECES_SVG = {
  "white-pawn": createPieceImage("white", "pawn"),
  "white-knight": createPieceImage("white", "knight"),
  "white-bishop": createPieceImage("white", "bishop"),
  "white-rook": createPieceImage("white", "rook"),
  "white-queen": createPieceImage("white", "queen"),
  "white-king": createPieceImage("white", "king"),

  "black-pawn": createPieceImage("black", "pawn"),
  "black-knight": createPieceImage("black", "knight"),
  "black-bishop": createPieceImage("black", "bishop"),
  "black-rook": createPieceImage("black", "rook"),
  "black-queen": createPieceImage("black", "queen"),
  "black-king": createPieceImage("black", "king"),
};

if (typeof window !== "undefined") {
  window.CHESS_PIECES_SVG = CHESS_PIECES_SVG;
}
