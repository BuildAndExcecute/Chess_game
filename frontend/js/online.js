/* ==========================================================================
   ONLINE MULTIPLAYER & MATCHMAKING CONTROLLER
   ========================================================================== */

class OnlineGameManager {
  constructor() {
    this.board = null;
    this.searchTimer = null;
    this.searchSeconds = 0;
    this.currentMatch = null;
    this.matchmakingRequestId = 0;
    this.pendingMove = null;
    this.countdownTimer = null;
    this.isMatchmaking = false;
    this.previewEngine = null;
    this.tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.waitingPeer = null;
    this.tabChannel = null;
  }

  init() {
    const boardContainer = document.getElementById('online-board');
    if (!boardContainer) return;

    this.board = new ChessboardView(boardContainer, {
      orientation: 'white',
      showCoordinates: window.AppState.getState().settings.showCoordinates,
      validateMovesRemotely: true,
      onSquareSelect: (square, piece) => this.handleSquareSelect(square, piece),
      onMove: (move) => this.handlePlayerMove(move)
    });

    this.bindControls();
    this.bindCrossTabMatchmaking();
  }

  bindCrossTabMatchmaking() {
    if ('BroadcastChannel' in window) {
      this.tabChannel = new BroadcastChannel('chess_online_tabs');
      this.tabChannel.onmessage = (event) => this.handleTabSignal(event.data);
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== 'chess_online_tab_signal' || !event.newValue) return;

      let signal = null;
      try {
        signal = JSON.parse(event.newValue);
      } catch (error) {
        return;
      }

      this.handleTabSignal(signal);
    });
  }

  handleTabSignal(signal) {
    if (!signal || signal.sourceTabId === this.tabId) return;

    if (signal.type === 'waiting' && this.isMatchmaking) {
      this.waitingPeer = signal.user || null;
      return;
    }

    if (signal.type === 'game_start' && this.isMatchmaking && !this.currentMatch) {
      const playerColor = signal.playerColor === 'white' ? 'black' : 'white';
      const opponent = signal.user || {
        id: 'local_peer',
        username: playerColor === 'white' ? 'Black Player' : 'White Player',
        rating: 1200,
        countryFlag: 'IN'
      };
      this.onOpponentFound({
        matchId: signal.matchId,
        timeControl: signal.timeControl || '10 min',
        opponent,
        playerColor,
        state: signal.state || window.BackendChessCompat.createLocalBackendState(),
        fromTabSignal: true,
        relayOwnerTabId: signal.sourceTabId
      });
      return;
    }

    if (signal.type === 'move_request' && signal.toTabId === this.tabId) {
      this.submitRelayedMove(signal);
      return;
    }

    if (signal.type === 'state_sync') {
      this.applySharedState(signal);
      return;
    }

    if (signal.type === 'move_error' && signal.toTabId === this.tabId) {
      this.pendingMove = null;
      this.updateStatusBadge('Your Turn');
      window.GameCtrl.showToast(signal.error || 'Move failed.', 'error');
      return;
    }

    if (signal.type === 'game_closed') {
      this.handlePeerClosedGame(signal);
    }
  }

  publishTabSignal(signal) {
    const payload = {
      ...signal,
      sourceTabId: this.tabId,
      createdAt: Date.now()
    };

    try {
      if (this.tabChannel) this.tabChannel.postMessage(payload);
      localStorage.setItem('chess_online_tab_signal', JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not publish online tab signal:', error);
    }
  }

  bindControls() {
    // Cancel matchmaking button
    const btnCancel = document.getElementById('btn-cancel-matchmaking');
    if (btnCancel) {
      btnCancel.onclick = () => this.cancelMatchmaking();
    }

    const onlineBackButton = document.querySelector('#view-online .btn-home-return');
    if (onlineBackButton) {
      onlineBackButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.cancelMatchmaking();
      });
    }

    document.querySelectorAll('#view-online-game [data-route="home"], #view-online-game .btn-home-return').forEach(button => {
      button.addEventListener('click', (event) => {
        const activeGame = window.AppState.getState().activeGame;
        if (window.AppState.getState().gameMode !== 'online' || activeGame?.status !== 'playing') return;

        event.preventDefault();
        event.stopPropagation();
        this.leaveActiveGame('You left the online match.', 'leave');
      }, true);
    });

    window.addEventListener('beforeunload', () => {
      const activeGame = window.AppState.getState().activeGame;
      if (window.AppState.getState().gameMode !== 'online' || activeGame?.status !== 'playing') return;

      this.publishTabSignal({
        type: 'game_closed',
        matchId: activeGame.id,
        reason: 'Your opponent left the match.',
        resultForPeer: 'win'
      });
      window.OnlineAdapter.disconnect('gameover');
    });

    // Resign online match
    const btnResign = document.getElementById('btn-online-resign');
    if (btnResign) {
      btnResign.onclick = async () => {
        if (confirm('Are you sure you want to resign this online match?')) {
          try {
            await window.API.resignMatch(this.currentMatch?.matchId);
          } catch (error) {
            console.warn('Resign notification failed; closing local online match anyway.', error);
          }
          this.endOnlineGame({
            result: 'loss',
            title: 'YOU RESIGNED',
            reason: 'You resigned against your opponent.',
            peerResult: 'win',
            peerTitle: 'VICTORY BY RESIGNATION',
            peerReason: 'Your opponent resigned.'
          });
        }
      };
    }

    // Offer Draw
    const btnDraw = document.getElementById('btn-online-draw');
    if (btnDraw) {
      btnDraw.onclick = async () => {
        await window.API.offerDraw(this.currentMatch?.matchId);
        window.GameCtrl.showToast('Draw offer sent to opponent.', 'info');
      };
    }

    // Wire Online Game Adapter listeners
    window.OnlineAdapter.onOpponentMove((move, state) => this.handleOpponentMove(move, state));
    window.OnlineAdapter.onMoveAccepted((move, state) => this.handleMoveAccepted(move, state));
    window.OnlineAdapter.onInvalidMove((error, state) => this.handleInvalidMove(error, state));
    window.OnlineAdapter.onGameState((state) => this.syncBackendState(state));
    window.OnlineAdapter.onConnectionClosed(() => this.handleConnectionClosed());
    window.OnlineAdapter.onOpponentDisconnected((event) => {
      const activeGame = window.AppState.getState().activeGame;
      if (activeGame?.status !== 'playing' || window.Router.currentRoute !== 'online-game') return;
      if (event?.gameId && event.gameId !== activeGame.id) return;

      this.endOnlineGame({
        result: 'win',
        title: 'VICTORY BY ABANDONMENT',
        reason: 'Your opponent disconnected from the match.',
        broadcast: false
      });
    });

    window.OnlineAdapter.onGameOver((event) => {
      const activeGame = window.AppState.getState().activeGame;
      if (activeGame.status === 'gameover') return;

      const currentUserId = window.AppState.getState().user?.id;
      const result = event?.result || 'finished';
      const isDraw = result === 'draw' || result === 'stalemate';
      const didLose = (event?.loserId && event.loserId === currentUserId) ||
        (event?.winnerId && event.winnerId !== currentUserId);

      this.endOnlineGame({
        result: isDraw ? 'draw' : didLose ? 'loss' : 'win',
        title: isDraw ? 'STALEMATE' : didLose ? 'CHECKMATE' : 'VICTORY',
        reason: result === 'resignation' ? 'Your opponent resigned.' : 'The online match has ended.',
        broadcast: true,
        peerResult: isDraw ? 'draw' : didLose ? 'win' : 'loss',
        peerTitle: isDraw ? 'STALEMATE' : didLose ? 'VICTORY' : 'CHECKMATE',
        peerReason: result === 'resignation' ? 'Your opponent resigned.' : 'The online match has ended.'
      });
    });
  }

  // Start Matchmaking Flow
  async startMatchmaking() {
    if (this.isMatchmaking || window.AppState.getState().activeGame?.status === 'playing') {
      return;
    }

    const requestId = ++this.matchmakingRequestId;
    this.isMatchmaking = true;
    this.clearMatchmakingTimers();
    this.currentMatch = null;
    this.pendingMove = null;

    const searchingView = document.getElementById('matchmaking-searching');
    const foundView = document.getElementById('matchmaking-found');
    const timerEl = document.getElementById('matchmaking-timer');

    if (searchingView) searchingView.style.display = 'flex';
    if (foundView) foundView.style.display = 'none';

    this.searchSeconds = 0;
    if (this.searchTimer) clearInterval(this.searchTimer);
    this.searchTimer = setInterval(() => {
      this.searchSeconds++;
      if (timerEl) timerEl.textContent = `Searching: ${this.searchSeconds}s`;
    }, 1000);
    this.publishTabSignal({
      type: 'waiting',
      user: this.getCurrentUserSummary()
    });

    try {
      const match = await window.API.findOpponent();
      if (requestId !== this.matchmakingRequestId) return;
      this.onOpponentFound(match);
    } catch (err) {
      if (requestId !== this.matchmakingRequestId) return;
      console.error('Matchmaking error:', err);
      this.resetMatchmakingSession();
      this.isMatchmaking = false;
      window.GameCtrl.showToast('Matchmaking timed out or failed.', 'error');
    }
  }

  cancelMatchmaking() {
    this.matchmakingRequestId++;
    this.isMatchmaking = false;
    this.pendingMove = null;
    this.resetMatchmakingSession();
    window.Router.navigate('home');
  }

  resetMatchmakingSession() {
    this.clearMatchmakingTimers();
    window.API.cancelMatchmaking();
  }

  clearMatchmakingTimers() {
    if (this.searchTimer) {
      clearInterval(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  onOpponentFound(match) {
    this.isMatchmaking = false;
    const requestId = this.matchmakingRequestId;
    if (this.searchTimer) {
      clearInterval(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.currentMatch = match;
    if (match.matchId && !match.fromTabSignal) {
      this.publishTabSignal({
        type: 'game_start',
        matchId: match.matchId,
        playerColor: match.playerColor || 'white',
        timeControl: match.timeControl || '10 min',
        state: match.state || window.BackendChessCompat.createLocalBackendState(),
        user: this.getCurrentUserSummary()
      });
    }
    const searchingView = document.getElementById('matchmaking-searching');
    const foundView = document.getElementById('matchmaking-found');

    if (searchingView) searchingView.style.display = 'none';
    if (foundView) {
      foundView.style.display = 'flex';
      document.getElementById('found-opponent-name').textContent = match.opponent.username;
      document.getElementById('found-opponent-rating').textContent = `Rating: ${match.opponent.rating}`;
      document.getElementById('found-opponent-flag').textContent = match.opponent.countryFlag;
    }

    window.AppState.playSound('check');

    if (match.fromTabSignal) {
      const countdownEl = document.getElementById('found-countdown');
      if (countdownEl) countdownEl.textContent = 'Game starting now...';
      this.countdownTimer = setTimeout(() => {
        if (requestId === this.matchmakingRequestId) {
          this.countdownTimer = null;
          this.launchOnlineGame(match);
        }
      }, 250);
      return;
    }

    // Countdown 2.5s and start match
    let countdown = 3;
    const countdownEl = document.getElementById('found-countdown');
    if (countdownEl) countdownEl.textContent = `Game starting in ${countdown}...`;

    this.countdownTimer = setInterval(() => {
      if (requestId !== this.matchmakingRequestId) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }

      countdown--;
      if (countdownEl) countdownEl.textContent = `Game starting in ${countdown}...`;
      if (countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.launchOnlineGame(match);
      }
    }, 800);
  }

  launchOnlineGame(match) {
    this.isMatchmaking = false;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    const normalizedState = match.state || window.BackendChessCompat.createLocalBackendState();
    const activeGame = {
      id: match.matchId,
      position: normalizedState.position ? { ...normalizedState.position } : { ...window.INITIAL_BOARD_POSITION },
      backendPosition: normalizedState.backendPosition ? { ...normalizedState.backendPosition } : null,
      turn: normalizedState.turn || 'white',
      playerColor: match.playerColor || 'white',
      selectedSquare: null,
      legalMoves: [],
      moveHistory: [],
      lastMove: null,
      isCheck: false,
      checkSquare: null,
      status: 'playing',
      result: null,
      clocks: { white: 600, black: 600 },
      captured: { white: [], black: [] },
      opponent: match.opponent || this.waitingPeer || {
        id: 'backend_opponent',
        username: 'Online Opponent',
        rating: 1200,
        countryFlag: 'IN'
      },
      relayOwnerTabId: match.relayOwnerTabId || null,
      isRelayOwner: !match.fromTabSignal,
      frontendAuthoritative: false,
      rules: window.ChessRules.recordInitialPosition(
        normalizedState.position ? { ...normalizedState.position } : { ...window.INITIAL_BOARD_POSITION },
        normalizedState.turn || 'white',
        window.ChessRules.initialState()
      )
    };

    window.AppState.setState({ activeGame, gameMode: 'online' });
    window.Router.navigate('online-game');

    // Set board orientation based on assigned player color
    this.board.setOrientation(activeGame.playerColor);
    this.board.setCoordinatesVisible(window.AppState.getState().settings.showCoordinates);
    this.board.updatePosition(activeGame.position);
    this.board.clearHighlights();
    this.updateCheckUI(activeGame);

    // Update Opponent Display in Sidebar
    const oppName = document.getElementById('online-opponent-name');
    const oppRating = document.getElementById('online-opponent-rating');
    if (oppName) oppName.textContent = `${activeGame.opponent.countryFlag || 'IN'} ${activeGame.opponent.username || 'Online Opponent'}`;
    if (oppRating) oppRating.textContent = `(${activeGame.opponent.rating || 1200})`;

    this.updateStatusBadge(activeGame.turn === activeGame.playerColor ? 'Your Turn' : "Opponent's Turn");
    window.GameCtrl.renderMoveHistory('online-move-history', []);
    window.GameCtrl.updateClockDisplays();
    window.GameCtrl.startClocks();
    window.GameCtrl.updateCapturedDisplay('online-captured-white', []);
    window.GameCtrl.updateCapturedDisplay('online-captured-black', []);
  }

  async handleSquareSelect(square, piece) {
    const activeGame = window.AppState.getState().activeGame;
    if (activeGame.status !== 'playing' || activeGame.turn !== activeGame.playerColor) return;

    if (piece.startsWith(activeGame.playerColor)) {
      const previewMoves = window.ChessRules
        .getLegalMoves(activeGame.position, square, activeGame.rules)
        .map(move => move.to);
      this.board.setLegalMoves(square, previewMoves);
    } else {
      this.board.clearSelection();
    }
  }

  handlePlayerMove(move) {
    const activeGame = window.AppState.getState().activeGame;
    if (this.pendingMove || activeGame.status !== 'playing' || activeGame.turn !== activeGame.playerColor) return;

    const legalMove = window.ChessRules.resolveMove(activeGame.position, move, activeGame.rules);
    if (!legalMove) {
      this.board.updatePosition(activeGame.position);
      window.GameCtrl.showToast('Illegal move.', 'error');
      return;
    }

    const simulation = window.ChessRules.simulateMove(activeGame.position, legalMove);
    const nextTurn = window.ChessRules.opposite(activeGame.playerColor);
    const notation = window.ChessRules.formatMoveNotation(
      { ...legalMove, capturedPiece: simulation.capturedPiece },
      activeGame.position,
      simulation.board,
      nextTurn,
      activeGame.rules
    );
    const moveToSend = {
      ...legalMove,
      capturedPiece: simulation.capturedPiece,
      capturedSquare: simulation.capturedSquare,
      isCapture: !!simulation.capturedPiece,
      notation
    };

    this.pendingMove = moveToSend;
    this.updateStatusBadge('Submitting Move');

    if (activeGame.frontendAuthoritative) {
      this.pendingMove = null;
      this.applyAcceptedMove(moveToSend, null, false);
      return;
    }

    if (activeGame.relayOwnerTabId && !activeGame.isRelayOwner) {
      this.publishTabSignal({
        type: 'move_request',
        toTabId: activeGame.relayOwnerTabId,
        matchId: activeGame.id,
        move: moveToSend
      });
      return;
    }

    const sent = window.OnlineAdapter.sendMove(activeGame.id, moveToSend);
    if (!sent) {
      this.pendingMove = null;
      this.updateStatusBadge('Your Turn');
      window.GameCtrl.showToast('Multiplayer connection is not open.', 'error');
    }
  }

  handleMoveAccepted(move, backendState = null) {
    const activeGame = window.AppState.getState().activeGame;
    if (activeGame.status !== 'playing') return;
    if (!this.pendingMove) return;

    const relayedOpponentMove = !!this.pendingMove.relayFromTabId;
    this.applyAcceptedMove(move || this.pendingMove, backendState, relayedOpponentMove);
    this.pendingMove = null;
  }

  handleInvalidMove(error, backendState = null) {
    const activeGame = window.AppState.getState().activeGame;
    if (this.pendingMove && this.canApplyRejectedMoveLocally(activeGame, this.pendingMove)) {
      const move = this.pendingMove;
      const relayedOpponentMove = !!move.relayFromTabId;
      this.pendingMove = null;
      activeGame.frontendAuthoritative = true;
      this.applyAcceptedMove(move, null, relayedOpponentMove);
      window.GameCtrl.showToast('Move accepted by frontend rules.', 'info');
      return;
    }

    this.pendingMove = null;
    this.syncBackendState(backendState);
    this.board.clearSelection();
    this.updateStatusBadge('Your Turn');
    window.GameCtrl.showToast(error || 'Invalid move.', 'error');
  }

  handleConnectionClosed() {
    const wasMatchmaking = this.isMatchmaking;
    this.isMatchmaking = false;
    this.pendingMove = null;
    if (this.searchTimer) {
      clearInterval(this.searchTimer);
      this.searchTimer = null;
    }

    const activeGame = window.AppState.getState().activeGame;
    if (wasMatchmaking && window.Router.currentRoute === 'online') {
      window.GameCtrl.showToast('Multiplayer connection closed. Please try again.', 'error');
      return;
    }

    if (window.Router.currentRoute === 'online-game' && activeGame.status === 'playing') {
      if (activeGame.relayOwnerTabId && !activeGame.isRelayOwner) {
        return;
      }

      this.endOnlineGame({
        result: 'loss',
        title: 'CONNECTION LOST',
        reason: 'The multiplayer connection closed before the match finished.',
        peerResult: 'win',
        peerTitle: 'VICTORY BY DISCONNECTION',
        peerReason: 'Your opponent left the match.'
      });
    }
  }

  handleOpponentMove(move, backendState = null) {
    const activeGame = window.AppState.getState().activeGame;
    if (activeGame.status !== 'playing') return;
    this.applyAcceptedMove(move, backendState, true);
  }

  applyAcceptedMove(move, backendState = null, isOpponentMove = false) {
    const activeGame = window.AppState.getState().activeGame;
    const normalizedMove = this.normalizeOnlineMove(move);
    if (!normalizedMove.from || !normalizedMove.to) return;

    const boardBefore = { ...activeGame.position };
    const resolvedMove = window.ChessRules.resolveMove(boardBefore, normalizedMove, activeGame.rules) || normalizedMove;
    const simulated = window.ChessRules.simulateMove(boardBefore, resolvedMove);
    const targetPiece = normalizedMove.capturedPiece || simulated.capturedPiece || null;
    const isCapture = !!targetPiece || backendState?.moveResult === 5 || normalizedMove.isCapture;

    if (backendState?.position) {
      activeGame.position = { ...backendState.position };
      activeGame.backendPosition = { ...backendState.backendPosition };
    } else {
      activeGame.position = { ...simulated.board };
    }

    const nextTurn = backendState?.turn || (isOpponentMove
      ? activeGame.playerColor
      : (activeGame.playerColor === 'white' ? 'black' : 'white'));
    const appliedMove = {
      ...resolvedMove,
      ...normalizedMove,
      capturedPiece: targetPiece,
      capturedSquare: normalizedMove.capturedSquare || simulated.capturedSquare,
      isCapture
    };
    activeGame.rules = window.ChessRules.updateRuleState(
      activeGame.rules,
      boardBefore,
      appliedMove,
      activeGame.position,
      nextTurn
    );

    if (isCapture && targetPiece) {
      const capturedColor = targetPiece.startsWith('white') ? 'white' : 'black';
      activeGame.captured[capturedColor].push(targetPiece);
      window.AppState.playSound('capture');
      window.GameCtrl.updateCapturedDisplay(`online-captured-${capturedColor}`, activeGame.captured[capturedColor]);
    } else if (isCapture) {
      window.AppState.playSound('capture');
    } else {
      window.AppState.playSound('move');
    }

    if (!appliedMove.notation) {
      appliedMove.notation = window.ChessRules.formatMoveNotation(
        appliedMove,
        boardBefore,
        activeGame.position,
        nextTurn,
        activeGame.rules
      );
    }

    activeGame.moveHistory.push(appliedMove);
    activeGame.lastMove = appliedMove;
    activeGame.turn = nextTurn;
    this.refreshCheckState(activeGame);

    this.board.updatePosition(activeGame.position);
    this.board.setLastMove(appliedMove);
    this.updateCheckUI(activeGame);
    window.GameCtrl.renderMoveHistory('online-move-history', activeGame.moveHistory, activeGame.moveHistory.length - 1);
    this.updateStatusBadge(this.statusTextForTurn(activeGame));
    this.publishSharedState(activeGame);
  }

  syncBackendState(backendState) {
    if (!backendState?.position) return;

    const activeGame = window.AppState.getState().activeGame;
    if (activeGame.status !== 'playing') return;

    activeGame.position = { ...backendState.position };
    activeGame.backendPosition = { ...backendState.backendPosition };
    activeGame.turn = backendState.turn || activeGame.turn;
    activeGame.rules = activeGame.rules || window.ChessRules.recordInitialPosition(
      activeGame.position,
      activeGame.turn,
      window.ChessRules.initialState()
    );
    this.refreshCheckState(activeGame);
    this.board.updatePosition(activeGame.position);
    this.updateCheckUI(activeGame);
    if (backendState.moveResult === -1 && this.pendingMove) {
      this.pendingMove = null;
      this.updateStatusBadge(this.statusTextForTurn(activeGame));
    }
  }

  updateStatusBadge(text) {
    const badge = document.getElementById('online-game-status');
    if (badge) badge.textContent = text;
  }

  getCurrentUserSummary() {
    const user = window.AppState.getState().user || {};
    return {
      id: user.id || '',
      username: user.username || 'Online Player',
      rating: user.rating || 1200,
      countryFlag: user.countryFlag || 'IN',
      initials: user.initials || 'OP'
    };
  }

  normalizeOnlineMove(move = {}) {
    const normalized = window.BackendChessCompat.backendMoveToFrontend(move);
    if (!normalized.piece && normalized.from) {
      normalized.piece = window.AppState.getState().activeGame.position[normalized.from];
    }
    return normalized;
  }

  refreshCheckState(activeGame) {
    const evaluation = window.ChessRules.evaluateGame(
      activeGame.position,
      activeGame.turn,
      activeGame.rules || window.ChessRules.initialState()
    );
    activeGame.isCheck = evaluation.inCheck;
    activeGame.checkSquare = evaluation.checkSquare;
  }

  updateCheckUI(activeGame) {
    if (this.board) this.board.setCheckSquare(activeGame.checkSquare || null);
  }

  statusTextForTurn(activeGame) {
    const base = activeGame.turn === activeGame.playerColor ? 'Your Turn' : "Opponent's Turn";
    return activeGame.isCheck ? `${base} - CHECK` : base;
  }

  submitRelayedMove(signal) {
    const activeGame = window.AppState.getState().activeGame;
    if (
      !activeGame ||
      activeGame.status !== 'playing' ||
      !activeGame.isRelayOwner ||
      activeGame.id !== signal.matchId
    ) {
      return;
    }

    const move = {
      ...(signal.move || {}),
      relayFromTabId: signal.sourceTabId
    };
    if (!window.ChessRules.resolveMove(activeGame.position, move, activeGame.rules)) {
      this.publishTabSignal({
        type: 'move_error',
        toTabId: signal.sourceTabId,
        error: 'Illegal move.'
      });
      return;
    }

    this.pendingMove = move;
    this.updateStatusBadge("Opponent's Move");
    if (activeGame.frontendAuthoritative) {
      this.pendingMove = null;
      this.applyAcceptedMove(move, null, true);
      return;
    }

    const sent = window.OnlineAdapter.sendMove(activeGame.id, move);
    if (!sent) {
      this.pendingMove = null;
      this.publishTabSignal({
        type: 'move_error',
        toTabId: signal.sourceTabId,
        error: 'Multiplayer connection is not open.'
      });
    }
  }

  publishSharedState(activeGame) {
    if (!activeGame?.isRelayOwner) return;
    this.publishTabSignal({
      type: 'state_sync',
      matchId: activeGame.id,
      position: activeGame.position,
      backendPosition: activeGame.backendPosition,
      turn: activeGame.turn,
      captured: activeGame.captured,
      moveHistory: activeGame.moveHistory,
      lastMove: activeGame.lastMove,
      rules: activeGame.rules,
      isCheck: activeGame.isCheck,
      checkSquare: activeGame.checkSquare,
      frontendAuthoritative: activeGame.frontendAuthoritative,
      status: activeGame.status,
      result: activeGame.result
    });
  }

  applySharedState(signal) {
    const activeGame = window.AppState.getState().activeGame;
    if (
      !activeGame ||
      activeGame.status !== 'playing' ||
      activeGame.isRelayOwner ||
      activeGame.id !== signal.matchId
    ) {
      return;
    }

    activeGame.position = { ...(signal.position || activeGame.position) };
    activeGame.backendPosition = signal.backendPosition ? { ...signal.backendPosition } : activeGame.backendPosition;
    activeGame.turn = signal.turn || activeGame.turn;
    activeGame.captured = signal.captured || activeGame.captured;
    activeGame.moveHistory = signal.moveHistory || activeGame.moveHistory;
    activeGame.lastMove = signal.lastMove || activeGame.lastMove;
    activeGame.rules = signal.rules || activeGame.rules;
    activeGame.isCheck = !!signal.isCheck;
    activeGame.checkSquare = signal.checkSquare || null;
    activeGame.frontendAuthoritative = !!signal.frontendAuthoritative;
    activeGame.status = signal.status || activeGame.status;
    activeGame.result = signal.result || activeGame.result;
    this.pendingMove = null;

    this.board.updatePosition(activeGame.position);
    if (activeGame.lastMove) this.board.setLastMove(activeGame.lastMove);
    this.updateCheckUI(activeGame);
    window.GameCtrl.renderMoveHistory('online-move-history', activeGame.moveHistory, activeGame.moveHistory.length - 1);
    window.GameCtrl.updateCapturedDisplay('online-captured-white', activeGame.captured.white || []);
    window.GameCtrl.updateCapturedDisplay('online-captured-black', activeGame.captured.black || []);
    this.updateStatusBadge(this.statusTextForTurn(activeGame));
  }

  canApplyRejectedMoveLocally(activeGame, move) {
    if (!activeGame || activeGame.status !== 'playing') return false;
    return !!window.ChessRules.resolveMove(
      activeGame.position,
      move,
      activeGame.rules || window.ChessRules.initialState()
    );
  }

  leaveActiveGame(reason, closeReason = 'leave') {
    this.endOnlineGame({
      result: 'loss',
      title: 'MATCH LEFT',
      reason,
      peerResult: 'win',
      peerTitle: 'VICTORY BY ABANDONMENT',
      peerReason: 'Your opponent left the match.',
      closeReason
    });
    window.Router.navigate('home');
  }

  endOnlineGame({
    result,
    title,
    reason,
    peerResult = null,
    peerTitle = null,
    peerReason = null,
    broadcast = true,
    closeReason = 'gameover'
  }) {
    const activeGame = window.AppState.getState().activeGame;
    if (!activeGame || activeGame.status === 'gameover') return;

    activeGame.status = 'gameover';
    activeGame.result = result;
    this.pendingMove = null;
    this.clearMatchmakingTimers();
    this.board?.clearSelection?.();

    if (broadcast) {
      this.publishTabSignal({
        type: 'game_closed',
        matchId: activeGame.id,
        resultForPeer: peerResult || result,
        titleForPeer: peerTitle || title,
        reason: peerReason || reason
      });
    }

    window.OnlineAdapter.disconnect(closeReason === 'leave' ? 'gameover' : closeReason);
    window.GameCtrl.showGameOverModal({
      result,
      title,
      reason,
      onNewGame: () => window.Router.navigate('online')
    });
  }

  handlePeerClosedGame(signal) {
    const activeGame = window.AppState.getState().activeGame;
    if (
      !activeGame ||
      activeGame.status !== 'playing' ||
      activeGame.id !== signal.matchId
    ) {
      return;
    }

    this.endOnlineGame({
      result: signal.resultForPeer || 'win',
      title: signal.titleForPeer || 'VICTORY BY ABANDONMENT',
      reason: signal.reason || 'Your opponent left the match.',
      broadcast: false
    });
  }
}

// Global Online Manager Instance
window.OnlineGame = new OnlineGameManager();
