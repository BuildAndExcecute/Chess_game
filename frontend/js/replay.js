/* ==========================================================================
   MATCH REPLAY CONTROLLER - MOVE-BY-MOVE INTERACTIVE REVIEW
   ========================================================================== */

class ReplayManager {
  constructor() {
    this.board = null;
    this.currentMatch = null;
    this.currentMoveIndex = -1; // -1 represents starting board
    this.isPlaying = false;
    this.playInterval = null;
  }

  init() {
    const boardContainer = document.getElementById('replay-board');
    if (!boardContainer) return;

    this.board = new ChessboardView(boardContainer, {
      orientation: 'white',
      interactive: false,
      showCoordinates: window.AppState.getState().settings.showCoordinates
    });

    this.bindControls();
  }

  bindControls() {
    const btnFirst = document.getElementById('btn-replay-first');
    const btnPrev = document.getElementById('btn-replay-prev');
    const btnPlay = document.getElementById('btn-replay-play');
    const btnNext = document.getElementById('btn-replay-next');
    const btnLast = document.getElementById('btn-replay-last');

    if (btnFirst) btnFirst.onclick = () => this.firstMove();
    if (btnPrev) btnPrev.onclick = () => this.previousMove();
    if (btnPlay) btnPlay.onclick = () => this.togglePlay();
    if (btnNext) btnNext.onclick = () => this.nextMove();
    if (btnLast) btnLast.onclick = () => this.lastMove();

    const progressBar = document.getElementById('replay-progress-bar');
    if (progressBar) {
      progressBar.addEventListener('click', (e) => {
        if (!this.currentMatch || !this.currentMatch.moves) return;
        const rect = progressBar.getBoundingClientRect();
        const clickRatio = (e.clientX - rect.left) / rect.width;
        const targetIndex = Math.floor(clickRatio * this.currentMatch.moves.length) - 1;
        this.goToMove(targetIndex);
      });
    }
  }

  async loadMatchById(matchId) {
    try {
      const match = await window.API.getMatch(matchId);
      this.loadMatch(match);
    } catch (err) {
      console.error('Failed to load match for replay:', err);
      window.GameCtrl.showToast('Could not load match for replay.', 'error');
    }
  }

  loadMatch(match) {
    this.currentMatch = match;
    this.currentMoveIndex = -1;
    this.pauseReplay();

    window.Router.navigate('replay');

    const oppName = document.getElementById('replay-opponent-name');
    const oppRating = document.getElementById('replay-opponent-rating');
    const dateEl = document.getElementById('replay-match-date');
    const resultBadge = document.getElementById('replay-result-badge');

    if (oppName) oppName.textContent = match.opponent.username;
    if (oppRating) oppRating.textContent = `(${match.opponent.rating})`;
    if (dateEl) dateEl.textContent = `${match.date} - ${match.timeControl}`;

    if (resultBadge) {
      const isWin = match.result === 'win';
      resultBadge.className = `badge ${isWin ? 'badge-win' : match.result === 'loss' ? 'badge-loss' : 'badge-draw'}`;
      resultBadge.textContent = isWin ? 'Victory' : match.result === 'loss' ? 'Defeat' : 'Draw';
    }

    this.board.setOrientation(match.userColor || 'white');
    this.board.setCoordinatesVisible(window.AppState.getState().settings.showCoordinates);

    this.renderCurrentPosition();
  }

  calculatePositionAtMove(index) {
    const position = { ...window.INITIAL_BOARD_POSITION };
    if (!this.currentMatch || !this.currentMatch.moves) return position;

    for (let i = 0; i <= index && i < this.currentMatch.moves.length; i++) {
      const move = this.currentMatch.moves[i];
      delete position[move.from];
      position[move.to] = move.promotion || move.piece;
    }

    return position;
  }

  renderCurrentPosition() {
    if (!this.currentMatch) return;

    const position = this.calculatePositionAtMove(this.currentMoveIndex);
    this.board.updatePosition(position);

    if (this.currentMoveIndex >= 0 && this.currentMatch.moves[this.currentMoveIndex]) {
      const activeMove = this.currentMatch.moves[this.currentMoveIndex];
      this.board.setLastMove(activeMove);
    } else {
      this.board.clearHighlights();
    }

    window.GameCtrl.renderMoveHistory(
      'replay-move-history',
      this.currentMatch.moves || [],
      this.currentMoveIndex,
      (clickedIdx) => this.goToMove(clickedIdx)
    );

    const totalMoves = this.currentMatch.moves ? this.currentMatch.moves.length : 0;
    const currentNum = this.currentMoveIndex + 1;

    const counterEl = document.getElementById('replay-move-counter');
    if (counterEl) counterEl.textContent = `Move ${currentNum} / ${totalMoves}`;

    const progressFill = document.getElementById('replay-progress-fill');
    if (progressFill) {
      const percentage = totalMoves > 0 ? (currentNum / totalMoves) * 100 : 0;
      progressFill.style.width = `${percentage}%`;
    }
  }

  goToMove(index) {
    if (!this.currentMatch || !this.currentMatch.moves) return;
    const total = this.currentMatch.moves.length;
    this.currentMoveIndex = Math.max(-1, Math.min(index, total - 1));
    this.renderCurrentPosition();
    window.AppState.playSound('move');
  }

  firstMove() {
    this.pauseReplay();
    this.goToMove(-1);
  }

  previousMove() {
    this.pauseReplay();
    this.goToMove(this.currentMoveIndex - 1);
  }

  nextMove() {
    if (!this.currentMatch || !this.currentMatch.moves) return;
    if (this.currentMoveIndex < this.currentMatch.moves.length - 1) {
      this.goToMove(this.currentMoveIndex + 1);
      return true;
    }
    this.pauseReplay();
    return false;
  }

  lastMove() {
    this.pauseReplay();
    if (this.currentMatch && this.currentMatch.moves) {
      this.goToMove(this.currentMatch.moves.length - 1);
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pauseReplay();
    } else {
      this.playReplay();
    }
  }

  playReplay() {
    if (!this.currentMatch || !this.currentMatch.moves) return;
    this.isPlaying = true;
    const playBtn = document.getElementById('btn-replay-play');
    if (playBtn) playBtn.textContent = 'Pause';

    if (this.currentMoveIndex >= this.currentMatch.moves.length - 1) {
      this.currentMoveIndex = -1;
    }

    this.playInterval = setInterval(() => {
      const hasNext = this.nextMove();
      if (!hasNext) this.pauseReplay();
    }, 1200);
  }

  pauseReplay() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    const playBtn = document.getElementById('btn-replay-play');
    if (playBtn) playBtn.textContent = 'Play';
  }
}

window.ReplayController = new ReplayManager();
