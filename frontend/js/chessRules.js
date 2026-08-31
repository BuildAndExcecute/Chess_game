/* ==========================================================================
   FRONTEND CHESS RULES - STANDARD LEGAL MOVE VALIDATION
   ========================================================================== */

class ChessRules {
  static files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  static initialState() {
    return {
      castlingRights: {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true },
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      positionCounts: {},
    };
  }

  static cloneState(state = {}) {
    const fallback = this.initialState();
    return {
      castlingRights: {
        white: {
          kingside: state.castlingRights?.white?.kingside ?? fallback.castlingRights.white.kingside,
          queenside: state.castlingRights?.white?.queenside ?? fallback.castlingRights.white.queenside,
        },
        black: {
          kingside: state.castlingRights?.black?.kingside ?? fallback.castlingRights.black.kingside,
          queenside: state.castlingRights?.black?.queenside ?? fallback.castlingRights.black.queenside,
        },
      },
      enPassantTarget: state.enPassantTarget || null,
      halfmoveClock: state.halfmoveClock || 0,
      positionCounts: { ...(state.positionCounts || {}) },
    };
  }

  static colorOf(piece) {
    return piece?.split("-")[0] || null;
  }

  static typeOf(piece) {
    return piece?.split("-")[1] || null;
  }

  static opposite(color) {
    return color === "white" ? "black" : "white";
  }

  static parseSquare(square) {
    return { file: this.files.indexOf(square[0]), rank: Number.parseInt(square[1], 10) };
  }

  static toSquare(file, rank) {
    if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
    return `${this.files[file]}${rank}`;
  }

  static findKing(board, color) {
    return Object.keys(board).find((square) => board[square] === `${color}-king`) || null;
  }

  static getPseudoLegalMoves(board, from, state = {}, options = {}) {
    const piece = board[from];
    if (!piece) return [];

    const color = this.colorOf(piece);
    const type = this.typeOf(piece);
    const enemy = this.opposite(color);
    const { file, rank } = this.parseSquare(from);
    const moves = [];
    const addMove = (to, extra = {}) => {
      if (!to) return;
      const target = board[to];
      if (target && this.colorOf(target) === color) return;
      if (target && this.typeOf(target) === "king") return;
      moves.push({ from, to, piece, ...extra });
    };

    if (type === "pawn") {
      const dir = color === "white" ? 1 : -1;
      const startRank = color === "white" ? 2 : 7;
      const promotionRank = color === "white" ? 8 : 1;

      [-1, 1].forEach((offset) => {
        const to = this.toSquare(file + offset, rank + dir);
        if (!to) return;
        if (options.attacksOnly) {
          moves.push({ from, to, piece });
          return;
        }
        const target = board[to];
        if (target && this.colorOf(target) === enemy && this.typeOf(target) !== "king") {
          addMove(to, rank + dir === promotionRank ? { promotion: `${color}-queen` } : {});
        } else if (state.enPassantTarget === to) {
          const capturedSquare = this.toSquare(file + offset, rank);
          if (board[capturedSquare] === `${enemy}-pawn`) {
            addMove(to, { isEnPassant: true, capturedSquare });
          }
        }
      });

      if (options.attacksOnly) return moves;

      const one = this.toSquare(file, rank + dir);
      if (one && !board[one]) {
        addMove(one, rank + dir === promotionRank ? { promotion: `${color}-queen` } : {});
        const two = this.toSquare(file, rank + 2 * dir);
        if (rank === startRank && two && !board[two]) {
          addMove(two, { isDoublePawnPush: true });
        }
      }
      return moves;
    }

    if (type === "knight") {
      [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ].forEach(([df, dr]) => addMove(this.toSquare(file + df, rank + dr)));
      return moves;
    }

    if (type === "bishop" || type === "rook" || type === "queen") {
      const dirs = [];
      if (type === "bishop" || type === "queen") dirs.push([-1, 1], [1, 1], [-1, -1], [1, -1]);
      if (type === "rook" || type === "queen") dirs.push([0, 1], [0, -1], [-1, 0], [1, 0]);

      dirs.forEach(([df, dr]) => {
        for (let step = 1; step < 8; step++) {
          const to = this.toSquare(file + df * step, rank + dr * step);
          if (!to) break;
          const target = board[to];
          if (!target) {
            addMove(to);
            continue;
          }
          if (this.colorOf(target) === enemy && this.typeOf(target) !== "king") addMove(to);
          break;
        }
      });
      return moves;
    }

    if (type === "king") {
      [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1],
      ].forEach(([df, dr]) => addMove(this.toSquare(file + df, rank + dr)));

      if (!options.attacksOnly) {
        moves.push(...this.getCastlingMoves(board, color, state));
      }
    }

    return moves;
  }

  static getCastlingMoves(board, color, state = {}) {
    const rights = state.castlingRights?.[color];
    const rank = color === "white" ? 1 : 8;
    const kingFrom = `e${rank}`;
    const enemy = this.opposite(color);
    const moves = [];

    if (board[kingFrom] !== `${color}-king`) return moves;
    if (this.isKingInCheck(board, color)) return moves;

    const canCastle = (side, rookFrom, emptySquares, safeSquares, kingTo, rookTo) => {
      if (!rights?.[side] || board[rookFrom] !== `${color}-rook`) return;
      if (emptySquares.some((square) => board[square])) return;
      if (safeSquares.some((square) => this.isSquareAttacked(board, square, enemy))) return;
      moves.push({
        from: kingFrom,
        to: kingTo,
        piece: `${color}-king`,
        isCastling: true,
        rookFrom,
        rookTo,
      });
    };

    canCastle("kingside", `h${rank}`, [`f${rank}`, `g${rank}`], [`f${rank}`, `g${rank}`], `g${rank}`, `f${rank}`);
    canCastle("queenside", `a${rank}`, [`d${rank}`, `c${rank}`, `b${rank}`], [`d${rank}`, `c${rank}`], `c${rank}`, `d${rank}`);
    return moves;
  }

  static isSquareAttacked(board, square, attackingColor) {
    const { file, rank } = this.parseSquare(square);
    const pawnDir = attackingColor === "white" ? 1 : -1;

    for (const df of [-1, 1]) {
      const pawnFrom = this.toSquare(file - df, rank - pawnDir);
      if (board[pawnFrom] === `${attackingColor}-pawn`) return true;
    }

    for (const [df, dr] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      if (board[this.toSquare(file + df, rank + dr)] === `${attackingColor}-knight`) return true;
    }

    for (const [df, dr] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      if (board[this.toSquare(file + df, rank + dr)] === `${attackingColor}-king`) return true;
    }

    const scan = (dirs, attackers) => {
      for (const [df, dr] of dirs) {
        for (let step = 1; step < 8; step++) {
          const candidate = this.toSquare(file + df * step, rank + dr * step);
          if (!candidate) break;
          const piece = board[candidate];
          if (!piece) continue;
          if (this.colorOf(piece) === attackingColor && attackers.includes(this.typeOf(piece))) return true;
          break;
        }
      }
      return false;
    };

    return scan([[-1, 1], [1, 1], [-1, -1], [1, -1]], ["bishop", "queen"]) ||
      scan([[0, 1], [0, -1], [-1, 0], [1, 0]], ["rook", "queen"]);
  }

  static isKingInCheck(board, color) {
    const kingSquare = this.findKing(board, color);
    if (!kingSquare) return true;
    return this.isSquareAttacked(board, kingSquare, this.opposite(color));
  }

  static simulateMove(board, move) {
    const next = { ...board };
    const piece = move.piece || next[move.from];
    const targetPiece = next[move.to] || null;
    const capturedSquare = move.isEnPassant ? move.capturedSquare : move.to;
    const capturedPiece = move.isEnPassant ? next[capturedSquare] || null : targetPiece;

    delete next[move.from];
    if (move.isEnPassant && capturedSquare) delete next[capturedSquare];
    if (move.isCastling) {
      delete next[move.rookFrom];
      next[move.rookTo] = `${this.colorOf(piece)}-rook`;
    }
    next[move.to] = move.promotion || piece;

    return { board: next, capturedPiece, capturedSquare };
  }

  static isLegalMove(board, move, color, state = {}) {
    if (!move || this.colorOf(move.piece || board[move.from]) !== color) return false;
    if (this.typeOf(board[move.to]) === "king") return false;
    const simulated = this.simulateMove(board, move);
    return !this.isKingInCheck(simulated.board, color);
  }

  static getLegalMoves(board, from, state = {}) {
    const piece = board[from];
    if (!piece) return [];
    const color = this.colorOf(piece);
    return this.getPseudoLegalMoves(board, from, state)
      .filter((move) => this.isLegalMove(board, move, color, state));
  }

  static generateAllLegalMoves(board, color, state = {}) {
    return Object.keys(board).flatMap((square) => {
      const piece = board[square];
      return piece && this.colorOf(piece) === color ? this.getLegalMoves(board, square, state) : [];
    });
  }

  static resolveMove(board, inputMove, state = {}) {
    const piece = board[inputMove.from];
    if (!piece) return null;
    const promotion = inputMove.promotion || this.normalizePromotion(piece, inputMove.to, inputMove.promotion);
    const legalMoves = this.getLegalMoves(board, inputMove.from, state);
    return legalMoves.find((candidate) => candidate.to === inputMove.to)
      ? { ...legalMoves.find((candidate) => candidate.to === inputMove.to), ...inputMove, piece, promotion }
      : null;
  }

  static normalizePromotion(piece, to, requestedPromotion) {
    if (requestedPromotion) return requestedPromotion;
    const color = this.colorOf(piece);
    if (this.typeOf(piece) !== "pawn") return null;
    if ((color === "white" && to.endsWith("8")) || (color === "black" && to.endsWith("1"))) {
      return `${color}-queen`;
    }
    return null;
  }

  static updateRuleState(state, boardBefore, move, boardAfter, nextTurn) {
    const nextState = this.cloneState(state);
    const color = this.colorOf(move.piece);
    const type = this.typeOf(move.piece);
    const disable = (side, flank) => {
      if (nextState.castlingRights[side]) nextState.castlingRights[side][flank] = false;
    };

    if (type === "king") {
      disable(color, "kingside");
      disable(color, "queenside");
    }
    if (type === "rook") {
      if (move.from === "h1") disable("white", "kingside");
      if (move.from === "a1") disable("white", "queenside");
      if (move.from === "h8") disable("black", "kingside");
      if (move.from === "a8") disable("black", "queenside");
    }
    if (move.capturedSquare === "h1") disable("white", "kingside");
    if (move.capturedSquare === "a1") disable("white", "queenside");
    if (move.capturedSquare === "h8") disable("black", "kingside");
    if (move.capturedSquare === "a8") disable("black", "queenside");

    nextState.enPassantTarget = null;
    const from = this.parseSquare(move.from);
    const to = this.parseSquare(move.to);
    if (type === "pawn" && Math.abs(to.rank - from.rank) === 2) {
      nextState.enPassantTarget = this.toSquare(from.file, (from.rank + to.rank) / 2);
    }

    nextState.halfmoveClock = type === "pawn" || move.capturedPiece ? 0 : nextState.halfmoveClock + 1;
    const key = this.positionKey(boardAfter, nextTurn, nextState);
    nextState.positionCounts[key] = (nextState.positionCounts[key] || 0) + 1;
    return nextState;
  }

  static positionKey(board, turn, state = {}) {
    const pieces = Object.keys(board).sort().map((square) => `${square}:${board[square]}`).join("|");
    const rights = ["white", "black"].map((color) => {
      const side = state.castlingRights?.[color] || {};
      return `${color[0]}${side.kingside ? "K" : ""}${side.queenside ? "Q" : ""}`;
    }).join("");
    return `${pieces} ${turn} ${rights} ${state.enPassantTarget || "-"}`;
  }

  static recordInitialPosition(board, turn = "white", state = this.initialState()) {
    const nextState = this.cloneState(state);
    nextState.positionCounts = {};
    nextState.positionCounts[this.positionKey(board, turn, nextState)] = 1;
    return nextState;
  }

  static isInsufficientMaterial(board) {
    const pieces = Object.values(board).filter(Boolean);
    const nonKings = pieces.filter((piece) => this.typeOf(piece) !== "king");
    if (nonKings.length === 0) return true;
    if (nonKings.length === 1 && ["bishop", "knight"].includes(this.typeOf(nonKings[0]))) return true;
    if (nonKings.length === 2 && nonKings.every((piece) => this.typeOf(piece) === "bishop")) {
      const bishopSquares = Object.keys(board).filter((square) => this.typeOf(board[square]) === "bishop");
      const colors = bishopSquares.map((square) => {
        const { file, rank } = this.parseSquare(square);
        return (file + rank) % 2;
      });
      return colors[0] === colors[1];
    }
    return false;
  }

  static evaluateGame(board, colorToMove, state = {}) {
    const inCheck = this.isKingInCheck(board, colorToMove);
    const legalMoves = this.generateAllLegalMoves(board, colorToMove, state);
    if (inCheck && legalMoves.length === 0) {
      return { status: "checkmate", inCheck, winner: this.opposite(colorToMove), checkSquare: this.findKing(board, colorToMove) };
    }
    if (!inCheck && legalMoves.length === 0) {
      return { status: "stalemate", inCheck, winner: null, checkSquare: null };
    }
    if (this.isInsufficientMaterial(board)) {
      return { status: "insufficient", inCheck, winner: null, checkSquare: inCheck ? this.findKing(board, colorToMove) : null };
    }
    if ((state.halfmoveClock || 0) >= 100) {
      return { status: "fiftyMove", inCheck, winner: null, checkSquare: inCheck ? this.findKing(board, colorToMove) : null };
    }
    const key = this.positionKey(board, colorToMove, state);
    if ((state.positionCounts?.[key] || 0) >= 3) {
      return { status: "threefold", inCheck, winner: null, checkSquare: inCheck ? this.findKing(board, colorToMove) : null };
    }
    return { status: inCheck ? "check" : "playing", inCheck, winner: null, checkSquare: inCheck ? this.findKing(board, colorToMove) : null };
  }

  static formatMoveNotation(move, boardBefore, boardAfter, nextTurn, state) {
    if (move.isCastling) return move.to[0] === "g" ? "O-O" : "O-O-O";

    const type = this.typeOf(move.piece);
    const letters = { knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K" };
    const capture = !!move.capturedPiece || move.isEnPassant;
    const pieceLetter = letters[type] || "";
    const captureText = capture ? (type === "pawn" ? `${move.from[0]}x` : "x") : "";
    const promotionText = move.promotion ? `=${(letters[this.typeOf(move.promotion)] || "Q")}` : "";
    const evalState = this.evaluateGame(boardAfter, nextTurn, state);
    const suffix = evalState.status === "checkmate" ? "#" : evalState.inCheck ? "+" : "";
    return `${pieceLetter}${captureText}${move.to}${promotionText}${suffix}`;
  }
}

if (typeof window !== "undefined") {
  window.ChessRules = ChessRules;
}

if (typeof module !== "undefined") {
  module.exports = ChessRules;
}
