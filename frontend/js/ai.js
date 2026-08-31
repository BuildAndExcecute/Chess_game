/* ==========================================================================
   CHESS ENGINE ADAPTER & PLAY WITH AI CONTROLLER
   ==========================================================================
   ATTENTION CHESS ENGINE DEVELOPER:
   This file contains the ChessEngineAdapter interface and MockChessEngine.
   
   To connect your real Chess Engine:
   1. Replace MockChessEngine methods with your engine calls (WebAssembly/Worker/JS).
   2. Ensure getLegalMoves(position, square) returns an array of valid target square strings: ['e3', 'e4'].
   3. Ensure getBestMove(position, difficulty) returns { from: '...', to: '...', notation: '...' }.
   ========================================================================== */

class MockChessEngine {
  constructor() {
    this.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    this.ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  }

  initialize() {
    console.log('Chess Engine initialized.');
    return true;
  }

  // Calculate legal target squares for a selected square
  getLegalMoves(position, fromSquare) {
    const piece = position[fromSquare];
    if (!piece) return [];

    const isWhite = piece.startsWith('white');
    const [file, rank] = [fromSquare[0], parseInt(fromSquare[1])];
    const fileIdx = this.files.indexOf(file);
    const legalMoves = [];

    // Helper: is valid square coordinates
    const isValid = (fIdx, r) => fIdx >= 0 && fIdx < 8 && r >= 1 && r <= 8;
    const toSq = (fIdx, r) => `${this.files[fIdx]}${r}`;

    // PAWNS
    if (piece.endsWith('pawn')) {
      const dir = isWhite ? 1 : -1;
      const startRank = isWhite ? 2 : 7;

      // 1-step forward
      const oneStep = toSq(fileIdx, rank + dir);
      if (isValid(fileIdx, rank + dir) && !position[oneStep]) {
        legalMoves.push(oneStep);
        // 2-step forward from starting rank
        const twoStep = toSq(fileIdx, rank + 2 * dir);
        if (rank === startRank && !position[twoStep]) {
          legalMoves.push(twoStep);
        }
      }

      // Diagonal captures
      [-1, 1].forEach(offset => {
        const targetFIdx = fileIdx + offset;
        const targetR = rank + dir;
        if (isValid(targetFIdx, targetR)) {
          const targetSq = toSq(targetFIdx, targetR);
          const targetPiece = position[targetSq];
          if (targetPiece && (isWhite ? targetPiece.startsWith('black') : targetPiece.startsWith('white'))) {
            legalMoves.push(targetSq);
          }
        }
      });
    }

    // KNIGHTS
    else if (piece.endsWith('knight')) {
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      knightOffsets.forEach(([fOff, rOff]) => {
        const tF = fileIdx + fOff;
        const tR = rank + rOff;
        if (isValid(tF, tR)) {
          const tSq = toSq(tF, tR);
          const tPiece = position[tSq];
          if (!tPiece || (isWhite ? tPiece.startsWith('black') : tPiece.startsWith('white'))) {
            legalMoves.push(tSq);
          }
        }
      });
    }

    // BISHOPS, ROOKS, QUEENS (Sliding pieces)
    else if (piece.endsWith('bishop') || piece.endsWith('rook') || piece.endsWith('queen')) {
      const directions = [];
      if (piece.endsWith('bishop') || piece.endsWith('queen')) {
        directions.push([-1, 1], [1, 1], [-1, -1], [1, -1]); // Diagonals
      }
      if (piece.endsWith('rook') || piece.endsWith('queen')) {
        directions.push([0, 1], [0, -1], [-1, 0], [1, 0]); // Straights
      }

      directions.forEach(([fDir, rDir]) => {
        let step = 1;
        while (true) {
          const tF = fileIdx + fDir * step;
          const tR = rank + rDir * step;
          if (!isValid(tF, tR)) break;

          const tSq = toSq(tF, tR);
          const tPiece = position[tSq];
          if (!tPiece) {
            legalMoves.push(tSq);
          } else {
            if (isWhite ? tPiece.startsWith('black') : tPiece.startsWith('white')) {
              legalMoves.push(tSq);
            }
            break; // Stop ray at first piece
          }
          step++;
        }
      });
    }

    // KING
    else if (piece.endsWith('king')) {
      const kingDirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1]
      ];
      kingDirs.forEach(([fOff, rOff]) => {
        const tF = fileIdx + fOff;
        const tR = rank + rOff;
        if (isValid(tF, tR)) {
          const tSq = toSq(tF, tR);
          const tPiece = position[tSq];
          if (!tPiece || (isWhite ? tPiece.startsWith('black') : tPiece.startsWith('white'))) {
            legalMoves.push(tSq);
          }
        }
      });
    }

    return legalMoves;
  }

  // Calculate Best Move for AI
  async getBestMove(position, aiColor = 'black') {
    // Gather all legal moves for AI's pieces
    const allMoves = [];
    Object.keys(position).forEach(sq => {
      const piece = position[sq];
      if (piece && piece.startsWith(aiColor)) {
        const legalTargets = this.getLegalMoves(position, sq);
        legalTargets.forEach(target => {
          allMoves.push({
            from: sq,
            to: target,
            piece: piece,
            isCapture: !!position[target]
          });
        });
      }
    });

    if (allMoves.length === 0) return null;

    // Prioritize captures or center development
    const captures = allMoves.filter(m => m.isCapture);
    const chosenMove = captures.length > 0
      ? captures[Math.floor(Math.random() * captures.length)]
      : allMoves[Math.floor(Math.random() * allMoves.length)];

    // Generate simple algebraic notation
    const notation = this.formatMoveNotation(chosenMove);
    return { ...chosenMove, notation };
  }

  formatMoveNotation(move) {
    const piece = move.piece;
    let pieceLetter = '';
    if (piece.endsWith('knight')) pieceLetter = 'N';
    else if (piece.endsWith('bishop')) pieceLetter = 'B';
    else if (piece.endsWith('rook')) pieceLetter = 'R';
    else if (piece.endsWith('queen')) pieceLetter = 'Q';
    else if (piece.endsWith('king')) pieceLetter = 'K';

    const captureChar = move.isCapture ? (piece.endsWith('pawn') ? `${move.from[0]}x` : 'x') : '';
    return `${pieceLetter}${captureChar}${move.to}`;
  }
}

class BackendChessEngine {
  constructor(api = window.API) {
    this.api = api;
    this.localEngine = new MockChessEngine();
    this.localGames = new Map();
  }

  initialize() {
    console.log('Backend chess engine adapter initialized.');
    return true;
  }

  async createGame() {
    const game = await this.api.createEngineGame();
    const position = game.position || { ...window.INITIAL_BOARD_POSITION };
    this.localGames.set(game.gameId, { position: { ...position }, turn: game.turn || 'white' });
    return { ...game, position };
  }

  async getLegalMoves(position, fromSquare, gameId = null) {
    return this.localEngine.getLegalMoves(position, fromSquare);
  }

  async makeMove(gameId, move) {
    const game = this.localGames.get(gameId);
    if (!game) throw new Error('Game not found');

    const legalMoves = this.localEngine.getLegalMoves(game.position, move.from);
    if (!legalMoves.includes(move.to)) {
      throw new Error('Invalid move');
    }

    delete game.position[move.from];
    game.position[move.to] = move.promotion || move.piece;
    game.turn = game.turn === 'white' ? 'black' : 'white';

    return {
      position: { ...game.position },
      turn: game.turn,
      moveResult: move.isCapture ? 5 : 2
    };
  }

  async getBestMove(position, aiColor = 'black', gameId = null, difficulty = 'medium') {
    return this.localEngine.getBestMove(position, aiColor);
  }

  syncGameState(gameId, position, turn) {
    if (!gameId) return;
    this.localGames.set(gameId, { position: { ...position }, turn });
  }

  formatMoveNotation(move) {
    const piece = move.piece;
    let pieceLetter = '';
    if (piece.endsWith('knight')) pieceLetter = 'N';
    else if (piece.endsWith('bishop')) pieceLetter = 'B';
    else if (piece.endsWith('rook')) pieceLetter = 'R';
    else if (piece.endsWith('queen')) pieceLetter = 'Q';
    else if (piece.endsWith('king')) pieceLetter = 'K';

    const captureChar = move.isCapture ? (piece.endsWith('pawn') ? `${move.from[0]}x` : 'x') : '';
    return `${pieceLetter}${captureChar}${move.to}`;
  }
}

/* ==========================================================================
   PLAY WITH AI UI CONTROLLER
   ========================================================================== */
class AIGameManager {
  constructor() {
    this.engine = new BackendChessEngine();
    this.board = null;
    this.setup = { timeMinutes: 5, playerColor: 'white', difficulty: 'medium' };
    this.selectedBot = window.MOCK_AI_BOTS[1];
    this.isStartingGame = false;
    this.isAIThinking = false;
    this.aiSearchRequestId = 0;
    this.newGameRequestId = 0;
    this.legalMoveRequestId = 0;
  }

  init() {
    const boardContainer = document.getElementById('ai-board');
    if (!boardContainer) return;

    this.board = new ChessboardView(boardContainer, {
      orientation: 'white',
      showCoordinates: window.AppState.getState().settings.showCoordinates,
      onSquareSelect: (square, piece) => this.handleSquareSelect(square, piece),
      onMove: (move) => this.handlePlayerMove(move)
    });

    this.bindControls();
  }

  bindControls() {
    const timeInput = document.getElementById('ai-time-control');
    if (timeInput) {
      timeInput.addEventListener('input', () => {
        this.updateSetup({ timeMinutes: timeInput.value });
      });
    }

    document.querySelectorAll('[data-ai-time]').forEach(button => {
      button.addEventListener('click', () => {
        this.updateSetup({ timeMinutes: button.dataset.aiTime });
      });
    });

    document.querySelectorAll('[data-ai-color]').forEach(button => {
      button.addEventListener('click', () => {
        this.updateSetup({ playerColor: button.dataset.aiColor || 'white' });
      });
    });

    document.querySelectorAll('[data-ai-difficulty]').forEach(button => {
      button.addEventListener('click', () => {
        this.updateSetup({ difficulty: button.dataset.aiDifficulty || 'medium' });
      });
    });

    const btnStart = document.getElementById('btn-ai-start-game');
    if (btnStart) {
      btnStart.onclick = () => this.startNewGame();
    }

    // Resign Button
    const btnResign = document.getElementById('btn-ai-resign');
    if (btnResign) {
      btnResign.onclick = () => {
        if (confirm('Are you sure you want to resign this match?')) {
          window.GameCtrl.showGameOverModal({
            result: 'loss',
            title: 'YOU RESIGNED',
            reason: 'You resigned against the engine.',
            onNewGame: () => this.returnToSetup()
          });
        }
      };
    }

    // Offer Draw Button
    const btnDraw = document.getElementById('btn-ai-draw');
    if (btnDraw) {
      btnDraw.onclick = () => {
        window.GameCtrl.showToast('AI evaluated the position and accepted the draw offer.', 'info');
        window.GameCtrl.showGameOverModal({
          result: 'draw',
          title: 'DRAW AGREED',
          reason: 'Draw agreed by mutual consent.',
          onNewGame: () => this.returnToSetup()
        });
      };
    }

    // New Game Button
    const btnNewGame = document.getElementById('btn-ai-new-game');
    if (btnNewGame) {
      btnNewGame.onclick = () => this.returnToSetup();
    }

    const btnGameBack = document.getElementById('btn-ai-game-back');
    if (btnGameBack) {
      btnGameBack.onclick = () => this.returnToSetup();
    }
  }

  validateSetup(settings = {}) {
    const timeMinutes = Number.parseInt(settings.timeMinutes, 10);
    const playerColor = ['white', 'black'].includes(settings.playerColor) ? settings.playerColor : 'white';
    const difficulty = ['easy', 'medium', 'hard'].includes(settings.difficulty) ? settings.difficulty : 'medium';

    return {
      timeMinutes: Number.isInteger(timeMinutes) ? Math.min(10, Math.max(1, timeMinutes)) : 5,
      playerColor,
      difficulty
    };
  }

  updateSetup(updates = {}) {
    this.setup = this.validateSetup({ ...this.setup, ...updates });
    const botIndexByDifficulty = { easy: 0, medium: 1, hard: 2 };
    this.selectedBot = window.MOCK_AI_BOTS[botIndexByDifficulty[this.setup.difficulty]] || window.MOCK_AI_BOTS[1];

    window.AppState.setState({ aiSetup: { ...this.setup } });
    this.renderSetup();
  }

  renderSetup() {
    this.setup = this.validateSetup(window.AppState.getState().aiSetup || this.setup);
    const botIndexByDifficulty = { easy: 0, medium: 1, hard: 2 };
    this.selectedBot = window.MOCK_AI_BOTS[botIndexByDifficulty[this.setup.difficulty]] || window.MOCK_AI_BOTS[1];

    const timeInput = document.getElementById('ai-time-control');
    const timeDisplay = document.getElementById('ai-time-display');
    if (timeInput) timeInput.value = String(this.setup.timeMinutes);
    if (timeDisplay) timeDisplay.textContent = `${this.setup.timeMinutes} ${this.setup.timeMinutes === 1 ? 'minute' : 'minutes'}`;

    document.querySelectorAll('[data-ai-time]').forEach(button => {
      button.classList.toggle('active', Number.parseInt(button.dataset.aiTime, 10) === this.setup.timeMinutes);
    });

    document.querySelectorAll('[data-ai-color]').forEach(button => {
      const isActive = button.dataset.aiColor === this.setup.playerColor;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      const marker = button.querySelector('.setup-choice-mark');
      if (marker) marker.textContent = isActive ? 'Selected' : 'Select';
    });

    document.querySelectorAll('[data-ai-difficulty]').forEach(button => {
      const isActive = button.dataset.aiDifficulty === this.setup.difficulty;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      const marker = button.querySelector('.setup-choice-mark');
      if (marker) marker.textContent = isActive ? 'Selected' : 'Select';
    });

    const botNameEl = document.getElementById('ai-opponent-name');
    const botRatingEl = document.getElementById('ai-opponent-rating');
    if (botNameEl) botNameEl.textContent = this.selectedBot.name;
    if (botRatingEl) botRatingEl.textContent = `(${this.selectedBot.rating})`;
  }

  ensureActiveGameView() {
    const activeGame = window.AppState.getState().activeGame;
    if (!activeGame || activeGame.status !== 'playing' || window.AppState.getState().gameMode !== 'ai') {
      window.Router.navigate('ai');
    }
  }

  enterSetupRoute() {
    const state = window.AppState.getState();
    if (state.gameMode === 'ai' && state.activeGame?.status === 'playing') {
      this.resetActiveGame();
    }
    this.renderSetup();
  }

  resetActiveGame() {
    this.newGameRequestId++;
    this.legalMoveRequestId++;
    this.aiSearchRequestId++;
    this.isAIThinking = false;
    window.GameCtrl.stopClocks();
    if (this.board) this.board.clearHighlights();
    window.AppState.setState({
      gameMode: null,
      activeGame: {
        id: null,
        position: window.INITIAL_BOARD_POSITION ? { ...window.INITIAL_BOARD_POSITION } : {},
        turn: 'white',
        playerColor: this.setup.playerColor,
        selectedSquare: null,
        legalMoves: [],
        moveHistory: [],
        lastMove: null,
        isCheck: false,
        checkSquare: null,
        status: 'ready',
        result: null,
        clocks: { white: this.setup.timeMinutes * 60, black: this.setup.timeMinutes * 60 },
        captured: { white: [], black: [] },
        opponent: null,
        rules: window.ChessRules.initialState()
      }
    });
  }

  returnToSetup() {
    this.resetActiveGame();
    window.Router.navigate('ai');
  }

  getAIColor() {
    return this.setup.playerColor === 'white' ? 'black' : 'white';
  }

  async startNewGame() {
    if (this.isStartingGame) return;
    this.isStartingGame = true;
    this.updateSetup(this.setup);

    const btnStart = document.getElementById('btn-ai-start-game');
    if (btnStart) btnStart.disabled = true;

    const requestId = ++this.newGameRequestId;
    let engineState = null;
    try {
      engineState = await this.engine.createGame();
    } catch (error) {
      if (requestId !== this.newGameRequestId) return;
      console.error('Failed to create backend engine game:', error);
      window.GameCtrl.showToast('Backend chess engine is not available.', 'error');
      return;
    } finally {
      this.isStartingGame = false;
      if (btnStart) btnStart.disabled = false;
    }

    if (requestId !== this.newGameRequestId) return;

    const playerColor = this.setup.playerColor;
    const aiColor = this.getAIColor();
    const initialSeconds = this.setup.timeMinutes * 60;
    const activeGame = {
      id: engineState.gameId,
      position: { ...engineState.position },
      turn: engineState.turn || 'white',
      playerColor,
      selectedSquare: null,
      legalMoves: [],
      moveHistory: [],
      lastMove: null,
      isCheck: false,
      checkSquare: null,
      status: 'playing',
      result: null,
      clocks: { white: initialSeconds, black: initialSeconds },
      captured: { white: [], black: [] },
      opponent: { ...this.selectedBot, color: aiColor },
      aiSettings: { ...this.setup },
      rules: window.ChessRules.recordInitialPosition(
        engineState.position,
        engineState.turn || 'white',
        window.ChessRules.initialState()
      )
    };

    window.AppState.setState({ activeGame, gameMode: 'ai' });
    this.board.setCoordinatesVisible(window.AppState.getState().settings.showCoordinates);
    this.board.setOrientation(playerColor);
    this.board.updatePosition(activeGame.position);
    this.board.clearHighlights();
    this.updateCheckUI(activeGame);
    this.updatePlayerPanels(playerColor, aiColor);

    // Update Opponent Info
    const botNameEl = document.getElementById('ai-opponent-name');
    const botRatingEl = document.getElementById('ai-opponent-rating');
    if (botNameEl) botNameEl.textContent = this.selectedBot.name;
    if (botRatingEl) botRatingEl.textContent = `(${this.selectedBot.rating}) - ${aiColor}`;

    // Update Status Badge
    this.updateStatusBadge(activeGame.turn === playerColor ? 'Your Turn' : "AI's Turn");
    window.GameCtrl.renderMoveHistory('ai-move-history', []);
    window.GameCtrl.updateClockDisplays();
    window.GameCtrl.startClocks();
    window.GameCtrl.updateCapturedDisplay('ai-captured-white', []);
    window.GameCtrl.updateCapturedDisplay('ai-captured-black', []);

    window.Router.navigate('ai-game');

    if (playerColor === 'black') {
      setTimeout(async () => {
        await this.triggerAIMove();
      }, 350);
    }
  }

  updatePlayerPanels(playerColor, aiColor) {
    const user = window.AppState.getState().user || {};
    const playerStrip = document.getElementById('ai-strip-player');
    const opponentStrip = document.getElementById('ai-strip-opponent');
    const playerAvatar = playerStrip?.querySelector('.avatar-circle');
    const opponentAvatar = opponentStrip?.querySelector('.avatar-circle');
    const playerName = playerStrip?.querySelector('.player-strip-name');
    const playerRating = playerStrip?.querySelector('.text-muted');
    const opponentClock = opponentStrip?.querySelector('.player-strip-clock');
    const playerClock = playerStrip?.querySelector('.player-strip-clock');

    if (playerAvatar) playerAvatar.textContent = user.initials || 'YOU';
    if (opponentAvatar) opponentAvatar.textContent = 'AI';
    if (playerName) playerName.textContent = 'You';
    if (playerRating) playerRating.textContent = `(${user.rating || 1200}) - ${playerColor}`;
    if (opponentClock) opponentClock.className = `player-strip-clock clock-${aiColor}`;
    if (playerClock) playerClock.className = `player-strip-clock clock-${playerColor}`;
  }

  async handleSquareSelect(square, piece) {
    const activeGame = window.AppState.getState().activeGame;
    if (this.isAIThinking || activeGame.status !== 'playing' || activeGame.turn !== activeGame.playerColor) return;

    if (piece.startsWith(activeGame.playerColor)) {
      const requestId = ++this.legalMoveRequestId;
      const legalMoves = window.ChessRules
        .getLegalMoves(activeGame.position, square, activeGame.rules)
        .map(move => move.to);
      if (requestId !== this.legalMoveRequestId) return;
      this.board.setLegalMoves(square, legalMoves);
    } else {
      this.board.clearSelection();
    }
  }

  async handlePlayerMove(move) {
    const activeGame = window.AppState.getState().activeGame;
    if (activeGame.status !== 'playing' || activeGame.turn !== activeGame.playerColor) return;

    const applied = this.applyFrontendMove(activeGame, move, activeGame.playerColor);
    if (!applied) {
      window.GameCtrl.showToast('Illegal move.', 'error');
      this.board.updatePosition(activeGame.position);
      return;
    }

    if (this.finishTurn(activeGame, this.getAIColor(), applied, "AI's Turn")) return;

    setTimeout(async () => {
      await this.triggerAIMove();
    }, 500);
  }

  async triggerAIMove() {
    const activeGame = window.AppState.getState().activeGame;
    const aiColor = this.getAIColor();
    if (this.isAIThinking || activeGame.status !== 'playing' || activeGame.turn !== aiColor) return;

    const requestId = ++this.aiSearchRequestId;
    const gameId = activeGame.id;
    const moveCount = activeGame.moveHistory.length;
    const fixedDifficulty = activeGame.aiSettings?.difficulty || this.setup.difficulty;
    this.isAIThinking = true;
    this.updateStatusBadge('AI Thinking');

    let bestMove = null;
    try {
      bestMove = await this.engine.getBestMove(activeGame.position, aiColor, gameId, fixedDifficulty);
    } catch (error) {
      if (requestId === this.aiSearchRequestId) {
        this.isAIThinking = false;
        this.updateStatusBadge("AI's Turn");
        console.error('AI search failed:', error);
        window.GameCtrl.showToast(error.message || 'AI search failed.', 'error');
      }
      return;
    }

    const latestGame = window.AppState.getState().activeGame;
    if (
      requestId !== this.aiSearchRequestId ||
      !latestGame ||
      latestGame.id !== gameId ||
      latestGame.status !== 'playing' ||
      latestGame.turn !== aiColor ||
      latestGame.moveHistory.length !== moveCount
    ) {
      this.isAIThinking = false;
      return;
    }
    this.isAIThinking = false;

    const legalAIMoves = window.ChessRules.generateAllLegalMoves(activeGame.position, aiColor, activeGame.rules);
    if (!legalAIMoves.length) {
      this.finishTurn(activeGame, aiColor, null, "AI's Turn");
      return;
    }

    let aiMove = bestMove
      ? window.ChessRules.resolveMove(activeGame.position, bestMove, activeGame.rules)
      : null;

    if (!aiMove) {
      aiMove = legalAIMoves[Math.floor(Math.random() * legalAIMoves.length)];
    }

    if (window.ChessRules.typeOf(aiMove.piece) === 'pawn' && (aiMove.to.endsWith('1') || aiMove.to.endsWith('8'))) {
      aiMove.promotion = aiMove.promotion || `${aiColor}-queen`;
    }

    const applied = this.applyFrontendMove(activeGame, aiMove, aiColor);
    if (!applied) {
      window.GameCtrl.showToast('AI move failed.', 'error');
      return;
    }

    this.finishTurn(activeGame, activeGame.playerColor, applied, 'Your Turn');
  }

  updateStatusBadge(text) {
    const badge = document.getElementById('ai-game-status');
    if (badge) badge.textContent = text;
  }

  applyFrontendMove(activeGame, move, color) {
    const resolved = window.ChessRules.resolveMove(activeGame.position, move, activeGame.rules);
    if (!resolved || window.ChessRules.colorOf(resolved.piece) !== color) return null;

    const boardBefore = { ...activeGame.position };
    const simulation = window.ChessRules.simulateMove(boardBefore, resolved);
    const nextTurn = window.ChessRules.opposite(color);
    const appliedMove = {
      ...resolved,
      capturedPiece: simulation.capturedPiece,
      capturedSquare: simulation.capturedSquare
    };
    const nextRules = window.ChessRules.updateRuleState(
      activeGame.rules,
      boardBefore,
      appliedMove,
      simulation.board,
      nextTurn
    );
    appliedMove.notation = window.ChessRules.formatMoveNotation(
      appliedMove,
      boardBefore,
      simulation.board,
      nextTurn,
      nextRules
    );

    activeGame.position = { ...simulation.board };
    activeGame.rules = nextRules;
    activeGame.moveHistory.push(appliedMove);
    activeGame.lastMove = appliedMove;
    activeGame.turn = nextTurn;

    if (appliedMove.capturedPiece) {
      const capturedColor = window.ChessRules.colorOf(appliedMove.capturedPiece);
      activeGame.captured[capturedColor].push(appliedMove.capturedPiece);
      window.AppState.playSound('capture');
      window.GameCtrl.updateCapturedDisplay(`ai-captured-${capturedColor}`, activeGame.captured[capturedColor]);
    } else {
      window.AppState.playSound('move');
    }

    this.engine.syncGameState(activeGame.id, activeGame.position, activeGame.turn);
    return appliedMove;
  }

  finishTurn(activeGame, colorToMove, move, defaultStatus) {
    const evaluation = window.ChessRules.evaluateGame(activeGame.position, colorToMove, activeGame.rules);
    activeGame.isCheck = evaluation.inCheck;
    activeGame.checkSquare = evaluation.checkSquare;

    this.board.updatePosition(activeGame.position);
    if (move) this.board.setLastMove(move);
    this.updateCheckUI(activeGame);
    window.GameCtrl.renderMoveHistory('ai-move-history', activeGame.moveHistory, activeGame.moveHistory.length - 1);

    if (evaluation.status === 'checkmate') {
      const playerWon = evaluation.winner === activeGame.playerColor;
      window.GameCtrl.showGameOverModal({
        result: playerWon ? 'win' : 'loss',
        title: 'CHECKMATE',
        reason: `${evaluation.winner === 'white' ? 'White' : 'Black'} wins by checkmate.`,
        onNewGame: () => this.returnToSetup()
      });
      this.updateStatusBadge('CHECKMATE');
      return true;
    }

    const drawTitles = {
      stalemate: 'STALEMATE',
      insufficient: 'DRAW',
      fiftyMove: 'DRAW',
      threefold: 'DRAW'
    };
    const drawReasons = {
      stalemate: 'Draw by stalemate.',
      insufficient: 'Draw by insufficient material.',
      fiftyMove: 'Draw by fifty-move rule.',
      threefold: 'Draw by threefold repetition.'
    };
    if (drawTitles[evaluation.status]) {
      window.GameCtrl.showGameOverModal({
        result: 'draw',
        title: drawTitles[evaluation.status],
        reason: drawReasons[evaluation.status],
        onNewGame: () => this.returnToSetup()
      });
      this.updateStatusBadge(drawTitles[evaluation.status]);
      return true;
    }

    this.updateStatusBadge(evaluation.inCheck ? `${defaultStatus} - CHECK` : defaultStatus);
    return false;
  }

  updateCheckUI(activeGame) {
    if (this.board) this.board.setCheckSquare(activeGame.checkSquare || null);
  }
}

// Global AI Controller
window.AIGame = new AIGameManager();
window.MockChessEngine = MockChessEngine;
