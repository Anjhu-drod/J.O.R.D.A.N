const FILES = "abcdefgh";
const PIECE_VALUES = Object.freeze({ P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 });

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function coordToSquare(row, col) {
  if (!inBounds(row, col)) return "";
  return `${FILES[col]}${8 - row}`;
}

function squareToCoord(square = "") {
  const clean = String(square || "").trim().toLowerCase();
  if (!/^[a-h][1-8]$/.test(clean)) return null;
  return { row: 8 - Number(clean[1]), col: FILES.indexOf(clean[0]) };
}

function pieceColor(piece) {
  return piece?.[0] || null;
}

function pieceType(piece) {
  return piece?.[1] || null;
}

function initialBoard() {
  return [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
  ];
}

function normalizePromotion(value = "Q") {
  const clean = String(value || "Q").trim().toUpperCase();
  return ["Q", "R", "B", "N"].includes(clean) ? clean : "Q";
}

function materialAndActivity(board, perspective) {
  let score = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece) continue;
      const color = pieceColor(piece);
      const type = pieceType(piece);
      const sign = color === perspective ? 1 : -1;
      const centerDistance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
      let activity = Math.max(0, 7 - centerDistance) * 2;
      if (type === "P") {
        const progress = color === "w" ? 6 - row : row - 1;
        activity += Math.max(0, progress) * 3;
      }
      if (type === "K") activity *= 0.15;
      score += sign * ((PIECE_VALUES[type] || 0) + activity);
    }
  }
  return score;
}

export class JordanChessService {
  constructor() {
    this.reset();
  }

  reset({ playerColor = "w", difficulty = this.difficulty || "normal" } = {}) {
    this.board = initialBoard();
    this.turn = "w";
    this.playerColor = playerColor === "b" ? "b" : "w";
    this.jordanColor = opposite(this.playerColor);
    this.difficulty = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    this.castling = { w: { k: true, q: true }, b: { k: true, q: true } };
    this.enPassant = null;
    this.halfmove = 0;
    this.fullmove = 1;
    this.status = "playing";
    this.winner = null;
    this.moveLog = [];
    this.history = [];
    return this.publicState();
  }

  setDifficulty(value = "normal") {
    this.difficulty = ["easy", "normal", "hard"].includes(value) ? value : "normal";
  }

  _snapshot() {
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      playerColor: this.playerColor,
      jordanColor: this.jordanColor,
      difficulty: this.difficulty,
      castling: {
        w: { ...this.castling.w },
        b: { ...this.castling.b }
      },
      enPassant: this.enPassant ? { ...this.enPassant } : null,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      status: this.status,
      winner: this.winner,
      moveLog: this.moveLog.map((move) => ({ ...move }))
    };
  }

  _restore(snapshot) {
    this.board = cloneBoard(snapshot.board);
    this.turn = snapshot.turn;
    this.playerColor = snapshot.playerColor || "w";
    this.jordanColor = snapshot.jordanColor || opposite(this.playerColor);
    this.difficulty = snapshot.difficulty || "normal";
    this.castling = {
      w: { ...snapshot.castling.w },
      b: { ...snapshot.castling.b }
    };
    this.enPassant = snapshot.enPassant ? { ...snapshot.enPassant } : null;
    this.halfmove = Number(snapshot.halfmove || 0);
    this.fullmove = Number(snapshot.fullmove || 1);
    this.status = snapshot.status || "playing";
    this.winner = snapshot.winner || null;
    this.moveLog = (snapshot.moveLog || []).map((move) => ({ ...move }));
  }

  serialize() {
    const snap = this._snapshot();
    return { version: 1, ...snap };
  }

  load(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.board) || data.board.length !== 8) return false;
    try {
      this._restore(data);
      this.history = [];
      return true;
    } catch {
      return false;
    }
  }

  pieceAt(square) {
    const coord = typeof square === "string" ? squareToCoord(square) : square;
    return coord && inBounds(coord.row, coord.col) ? this.board[coord.row][coord.col] : null;
  }

  _findKing(color) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (this.board[row][col] === `${color}K`) return { row, col };
      }
    }
    return null;
  }

  isSquareAttacked(row, col, byColor) {
    const pawnDir = byColor === "w" ? -1 : 1;
    const pawnRow = row - pawnDir;
    for (const dc of [-1, 1]) {
      const c = col - dc;
      if (inBounds(pawnRow, c) && this.board[pawnRow][c] === `${byColor}P`) return true;
    }

    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const r = row + dr;
      const c = col + dc;
      if (inBounds(r, c) && this.board[r][c] === `${byColor}N`) return true;
    }

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const r = row + dr;
        const c = col + dc;
        if (inBounds(r, c) && this.board[r][c] === `${byColor}K`) return true;
      }
    }

    const rays = [
      [-1, 0, new Set(["R", "Q"])], [1, 0, new Set(["R", "Q"])],
      [0, -1, new Set(["R", "Q"])], [0, 1, new Set(["R", "Q"])],
      [-1, -1, new Set(["B", "Q"])], [-1, 1, new Set(["B", "Q"])],
      [1, -1, new Set(["B", "Q"])], [1, 1, new Set(["B", "Q"])]
    ];
    for (const [dr, dc, allowed] of rays) {
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (pieceColor(piece) === byColor && allowed.has(pieceType(piece))) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    return false;
  }

  isInCheck(color = this.turn) {
    const king = this._findKing(color);
    if (!king) return true;
    return this.isSquareAttacked(king.row, king.col, opposite(color));
  }

  _pushMove(moves, fromRow, fromCol, toRow, toCol, extra = {}) {
    const piece = this.board[fromRow][fromCol];
    const target = this.board[toRow][toCol];
    moves.push({
      from: coordToSquare(fromRow, fromCol),
      to: coordToSquare(toRow, toCol),
      fromRow,
      fromCol,
      toRow,
      toCol,
      piece,
      captured: target || null,
      promotion: null,
      castle: null,
      enPassant: false,
      ...extra
    });
  }

  _pseudoMovesFor(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = pieceColor(piece);
    const type = pieceType(piece);
    const moves = [];

    if (type === "P") {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const promotionRow = color === "w" ? 0 : 7;
      const one = row + dir;
      if (inBounds(one, col) && !this.board[one][col]) {
        if (one === promotionRow) {
          for (const promotion of ["Q", "R", "B", "N"]) this._pushMove(moves, row, col, one, col, { promotion });
        } else {
          this._pushMove(moves, row, col, one, col);
        }
        const two = row + dir * 2;
        if (row === startRow && inBounds(two, col) && !this.board[two][col]) {
          this._pushMove(moves, row, col, two, col, { doublePawn: true });
        }
      }

      for (const dc of [-1, 1]) {
        const r = row + dir;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = this.board[r][c];
        if (target && pieceColor(target) !== color) {
          if (r === promotionRow) {
            for (const promotion of ["Q", "R", "B", "N"]) this._pushMove(moves, row, col, r, c, { promotion });
          } else {
            this._pushMove(moves, row, col, r, c);
          }
        } else if (!target && this.enPassant && this.enPassant.row === r && this.enPassant.col === c) {
          const captured = this.board[row][c];
          if (captured === `${opposite(color)}P`) {
            this._pushMove(moves, row, col, r, c, { captured, enPassant: true });
          }
        }
      }
      return moves;
    }

    if (type === "N") {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = this.board[r][c];
        if (!target || pieceColor(target) !== color) this._pushMove(moves, row, col, r, c);
      }
      return moves;
    }

    if (["B", "R", "Q"].includes(type)) {
      const directions = [];
      if (["B", "Q"].includes(type)) directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (["R", "Q"].includes(type)) directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c)) {
          const target = this.board[r][c];
          if (!target) {
            this._pushMove(moves, row, col, r, c);
          } else {
            if (pieceColor(target) !== color) this._pushMove(moves, row, col, r, c);
            break;
          }
          r += dr;
          c += dc;
        }
      }
      return moves;
    }

    if (type === "K") {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const r = row + dr;
          const c = col + dc;
          if (!inBounds(r, c)) continue;
          const target = this.board[r][c];
          if (!target || pieceColor(target) !== color) this._pushMove(moves, row, col, r, c);
        }
      }

      const homeRow = color === "w" ? 7 : 0;
      if (row === homeRow && col === 4 && !this.isInCheck(color)) {
        const enemy = opposite(color);
        if (
          this.castling[color]?.k &&
          this.board[homeRow][7] === `${color}R` &&
          !this.board[homeRow][5] && !this.board[homeRow][6] &&
          !this.isSquareAttacked(homeRow, 5, enemy) &&
          !this.isSquareAttacked(homeRow, 6, enemy)
        ) {
          this._pushMove(moves, row, col, homeRow, 6, { castle: "k" });
        }
        if (
          this.castling[color]?.q &&
          this.board[homeRow][0] === `${color}R` &&
          !this.board[homeRow][1] && !this.board[homeRow][2] && !this.board[homeRow][3] &&
          !this.isSquareAttacked(homeRow, 3, enemy) &&
          !this.isSquareAttacked(homeRow, 2, enemy)
        ) {
          this._pushMove(moves, row, col, homeRow, 2, { castle: "q" });
        }
      }
    }

    return moves;
  }

  generateLegalMoves(color = this.turn) {
    if (this.status !== "playing" && color === this.turn) return [];
    const legal = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = this.board[row][col];
        if (!piece || pieceColor(piece) !== color) continue;
        const pseudo = this._pseudoMovesFor(row, col);
        for (const move of pseudo) {
          const snapshot = this._snapshot();
          this._applyMoveUnchecked(move, { updateStatus: false, recordLog: false });
          const safe = !this.isInCheck(color);
          this._restore(snapshot);
          if (safe) legal.push(move);
        }
      }
    }
    return legal;
  }

  legalMovesFrom(square) {
    const clean = typeof square === "string" ? square.toLowerCase() : coordToSquare(square?.row, square?.col);
    return this.generateLegalMoves(this.turn).filter((move) => move.from === clean);
  }

  _updateCastlingRights(move, movedPiece, capturedPiece) {
    const color = pieceColor(movedPiece);
    const type = pieceType(movedPiece);
    if (type === "K") {
      this.castling[color].k = false;
      this.castling[color].q = false;
    }
    if (type === "R") {
      if (move.from === "a1") this.castling.w.q = false;
      if (move.from === "h1") this.castling.w.k = false;
      if (move.from === "a8") this.castling.b.q = false;
      if (move.from === "h8") this.castling.b.k = false;
    }
    if (capturedPiece && pieceType(capturedPiece) === "R") {
      if (move.to === "a1") this.castling.w.q = false;
      if (move.to === "h1") this.castling.w.k = false;
      if (move.to === "a8") this.castling.b.q = false;
      if (move.to === "h8") this.castling.b.k = false;
    }
  }

  _applyMoveUnchecked(move, { updateStatus = true, recordLog = true } = {}) {
    const movedPiece = this.board[move.fromRow][move.fromCol];
    if (!movedPiece) throw new Error("Peça de origem inexistente.");
    const movingColor = pieceColor(movedPiece);
    let capturedPiece = this.board[move.toRow][move.toCol];

    this.board[move.fromRow][move.fromCol] = null;

    if (move.enPassant) {
      capturedPiece = this.board[move.fromRow][move.toCol];
      this.board[move.fromRow][move.toCol] = null;
    }

    let placedPiece = movedPiece;
    if (move.promotion && pieceType(movedPiece) === "P") placedPiece = `${movingColor}${normalizePromotion(move.promotion)}`;
    this.board[move.toRow][move.toCol] = placedPiece;

    if (move.castle === "k") {
      const row = move.toRow;
      this.board[row][5] = this.board[row][7];
      this.board[row][7] = null;
    } else if (move.castle === "q") {
      const row = move.toRow;
      this.board[row][3] = this.board[row][0];
      this.board[row][0] = null;
    }

    this._updateCastlingRights(move, movedPiece, capturedPiece);

    this.enPassant = null;
    if (pieceType(movedPiece) === "P" && Math.abs(move.toRow - move.fromRow) === 2) {
      this.enPassant = { row: (move.fromRow + move.toRow) / 2, col: move.fromCol };
    }

    if (pieceType(movedPiece) === "P" || capturedPiece) this.halfmove = 0;
    else this.halfmove += 1;

    if (movingColor === "b") this.fullmove += 1;
    this.turn = opposite(movingColor);

    if (recordLog) {
      this.moveLog.push({
        ply: this.moveLog.length + 1,
        color: movingColor,
        from: move.from,
        to: move.to,
        piece: movedPiece,
        captured: capturedPiece || null,
        promotion: move.promotion || null,
        castle: move.castle || null,
        notation: this.formatMove(move, movedPiece, capturedPiece)
      });
    }

    if (!updateStatus) return;

    if (this.halfmove >= 100) {
      this.status = "draw-50";
      this.winner = null;
      return;
    }

    const nextMoves = this.generateLegalMoves(this.turn);
    if (!nextMoves.length) {
      if (this.isInCheck(this.turn)) {
        this.status = "checkmate";
        this.winner = opposite(this.turn);
      } else {
        this.status = "stalemate";
        this.winner = null;
      }
    } else {
      this.status = "playing";
      this.winner = null;
    }
  }

  formatMove(move, movedPiece = move.piece, capturedPiece = move.captured) {
    if (move.castle === "k") return "O-O";
    if (move.castle === "q") return "O-O-O";
    const type = pieceType(movedPiece);
    const lead = type === "P" ? "" : type;
    const capture = capturedPiece || move.enPassant ? "x" : "-";
    const promotion = move.promotion ? `=${normalizePromotion(move.promotion)}` : "";
    return `${lead}${move.from}${capture}${move.to}${promotion}`;
  }

  move(from, to, promotion = "Q") {
    if (this.status !== "playing") return { ok: false, error: "A partida já terminou." };
    const fromSquare = typeof from === "string" ? from.toLowerCase() : coordToSquare(from?.row, from?.col);
    const toSquare = typeof to === "string" ? to.toLowerCase() : coordToSquare(to?.row, to?.col);
    if (!squareToCoord(fromSquare) || !squareToCoord(toSquare)) return { ok: false, error: "Casa inválida." };

    const wantedPromotion = normalizePromotion(promotion);
    const legal = this.generateLegalMoves(this.turn).filter((candidate) => candidate.from === fromSquare && candidate.to === toSquare);
    if (!legal.length) return { ok: false, error: "Esse lance não é legal nesta posição." };
    const selected = legal.find((candidate) => !candidate.promotion || candidate.promotion === wantedPromotion) || legal[0];

    const snapshot = this._snapshot();
    this.history.push(snapshot);
    this._applyMoveUnchecked(selected, { updateStatus: true, recordLog: true });
    const lastMove = this.moveLog[this.moveLog.length - 1] || null;
    return {
      ok: true,
      move: lastMove,
      check: this.status === "playing" && this.isInCheck(this.turn),
      status: this.status,
      winner: this.winner
    };
  }

  undo(plies = 1) {
    const amount = Math.max(1, Math.min(8, Number(plies) || 1));
    let restored = false;
    for (let index = 0; index < amount; index += 1) {
      const snapshot = this.history.pop();
      if (!snapshot) break;
      this._restore(snapshot);
      restored = true;
    }
    return restored;
  }

  _terminalScore(perspective, legalMoves) {
    if (legalMoves.length) return null;
    if (this.isInCheck(this.turn)) return this.turn === perspective ? -999999 : 999999;
    return 0;
  }

  _search(depth, alpha, beta, perspective, deadline) {
    if (performance.now() >= deadline) return materialAndActivity(this.board, perspective);
    const legal = this.generateLegalMoves(this.turn);
    const terminal = this._terminalScore(perspective, legal);
    if (terminal !== null) return terminal;
    if (depth <= 0 || this.halfmove >= 100) return materialAndActivity(this.board, perspective);

    const maximizing = this.turn === perspective;
    let best = maximizing ? -Infinity : Infinity;
    const ordered = [...legal].sort((a, b) => {
      const av = a.captured ? PIECE_VALUES[pieceType(a.captured)] || 0 : 0;
      const bv = b.captured ? PIECE_VALUES[pieceType(b.captured)] || 0 : 0;
      return bv - av;
    });

    for (const move of ordered) {
      const snapshot = this._snapshot();
      this._applyMoveUnchecked(move, { updateStatus: false, recordLog: false });
      const score = this._search(depth - 1, alpha, beta, perspective, deadline);
      this._restore(snapshot);

      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha || performance.now() >= deadline) break;
    }
    return best;
  }

  chooseJordanMove({ difficulty = this.difficulty } = {}) {
    if (this.status !== "playing" || this.turn !== this.jordanColor) return null;
    const legal = this.generateLegalMoves(this.turn);
    if (!legal.length) return null;

    const config = {
      easy: { depth: 1, budget: 220, randomness: 100 },
      normal: { depth: 2, budget: 700, randomness: 18 },
      hard: { depth: 3, budget: 1800, randomness: 2 }
    }[difficulty] || { depth: 2, budget: 700, randomness: 18 };

    const deadline = performance.now() + config.budget;
    const scored = [];
    for (const move of legal) {
      const snapshot = this._snapshot();
      this._applyMoveUnchecked(move, { updateStatus: false, recordLog: false });
      let score = this._search(config.depth - 1, -Infinity, Infinity, this.jordanColor, deadline);
      this._restore(snapshot);
      score += (Math.random() - 0.5) * config.randomness;
      scored.push({ move, score });
      if (performance.now() >= deadline) break;
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
    return selected ? { ...selected } : null;
  }

  canUndo() {
    return this.history.length > 0;
  }

  playJordanMove(options = {}) {
    const choice = this.chooseJordanMove(options);
    if (!choice) return { ok: false, error: "A JORDAN não tem um lance disponível." };
    return this.move(choice.from, choice.to, choice.promotion || "Q");
  }

  toFEN() {
    const ranks = this.board.map((row) => {
      let out = "";
      let empty = 0;
      for (const piece of row) {
        if (!piece) {
          empty += 1;
          continue;
        }
        if (empty) {
          out += String(empty);
          empty = 0;
        }
        const type = pieceType(piece);
        out += pieceColor(piece) === "w" ? type : type.toLowerCase();
      }
      if (empty) out += String(empty);
      return out;
    }).join("/");
    const castling = [
      this.castling.w.k ? "K" : "",
      this.castling.w.q ? "Q" : "",
      this.castling.b.k ? "k" : "",
      this.castling.b.q ? "q" : ""
    ].join("") || "-";
    const ep = this.enPassant ? coordToSquare(this.enPassant.row, this.enPassant.col) : "-";
    return `${ranks} ${this.turn} ${castling} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  publicState() {
    const check = this.status === "playing" ? this.isInCheck(this.turn) : false;
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      playerColor: this.playerColor,
      jordanColor: this.jordanColor,
      difficulty: this.difficulty,
      status: this.status,
      winner: this.winner,
      check,
      fen: this.toFEN(),
      moveLog: this.moveLog.map((move) => ({ ...move })),
      lastMove: this.moveLog.length ? { ...this.moveLog[this.moveLog.length - 1] } : null
    };
  }
}

export { coordToSquare, squareToCoord };
