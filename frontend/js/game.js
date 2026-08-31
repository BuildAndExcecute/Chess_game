/* ==========================================================================
   GAME CONTROLLER - TIMERS, NOTATION, CAPTURES, MODALS & TOASTS
   ========================================================================== */

class GameController {
  constructor() {
    this.timerInterval = null;
  }

  // Start Clock Timers
  startClocks() {
    this.stopClocks();
    this.timerInterval = setInterval(() => {
      const activeGame = window.AppState.getState().activeGame;
      if (activeGame.status !== 'playing') return;

      const turn = activeGame.turn;
      const currentClock = activeGame.clocks[turn];

      if (currentClock <= 1) {
        // Time expired
        this.handleTimeout(turn);
        return;
      }

      activeGame.clocks[turn] = currentClock - 1;
      this.updateClockDisplays();
    }, 1000);
  }

  stopClocks() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Format seconds into MM:SS
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Update DOM clocks
  updateClockDisplays() {
    const activeGame = window.AppState.getState().activeGame;
    const whiteClocks = document.querySelectorAll('.clock-white');
    const blackClocks = document.querySelectorAll('.clock-black');

    const formattedWhite = this.formatTime(activeGame.clocks.white);
    const formattedBlack = this.formatTime(activeGame.clocks.black);

    whiteClocks.forEach(c => {
      c.textContent = formattedWhite;
      if (activeGame.clocks.white <= 30) c.classList.add('low-time');
      else c.classList.remove('low-time');
    });

    blackClocks.forEach(c => {
      c.textContent = formattedBlack;
      if (activeGame.clocks.black <= 30) c.classList.add('low-time');
      else c.classList.remove('low-time');
    });
  }

  handleTimeout(timeoutColor) {
    this.stopClocks();
    const activeGame = window.AppState.getState().activeGame;
    const isPlayerLoss = activeGame.playerColor === timeoutColor;
    
    this.showGameOverModal({
      result: isPlayerLoss ? 'loss' : 'win',
      title: isPlayerLoss ? 'YOU LOST' : 'YOU WON',
      reason: `${timeoutColor === 'white' ? 'White' : 'Black'} ran out of time.`
    });
  }

  // Render Move History List in Sidebar
  renderMoveHistory(containerElement, moves = [], activeIndex = -1, onMoveClick = null) {
    const container = typeof containerElement === 'string'
      ? document.getElementById(containerElement)
      : containerElement;
    if (!container) return;

    container.innerHTML = '';

    if (!moves.length) {
      container.innerHTML = '<div class="move-history-empty">Moves will appear here after the first move.</div>';
      return;
    }

    const table = document.createElement('div');
    table.className = 'move-list-table';

    for (let i = 0; i < moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1];

      const row = document.createElement('div');
      row.className = 'move-list-row';

      const numCell = document.createElement('div');
      numCell.className = 'move-number';
      numCell.textContent = `${moveNum}.`;
      row.appendChild(numCell);

      // White move cell
      const whiteCell = document.createElement('div');
      whiteCell.className = `move-cell ${i === activeIndex ? 'active-move' : ''}`;
      whiteCell.textContent = whiteMove.notation || `${whiteMove.from}-${whiteMove.to}`;
      if (onMoveClick) {
        whiteCell.addEventListener('click', () => onMoveClick(i));
      }
      row.appendChild(whiteCell);

      // Black move cell (if played)
      const blackCell = document.createElement('div');
      blackCell.className = `move-cell ${i + 1 === activeIndex ? 'active-move' : ''}`;
      if (blackMove) {
        blackCell.textContent = blackMove.notation || `${blackMove.from}-${blackMove.to}`;
        if (onMoveClick) {
          blackCell.addEventListener('click', () => onMoveClick(i + 1));
        }
      }
      row.appendChild(blackCell);

      table.appendChild(row);
    }

    container.appendChild(table);
    // Auto-scroll to bottom of move list
    container.scrollTop = container.scrollHeight;
  }

  // Update Captured Pieces and Score difference
  updateCapturedDisplay(containerId, capturedList, scoreDiff = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    capturedList.forEach(pieceName => {
      const icon = document.createElement('div');
      icon.className = 'captured-piece-mini';
      icon.innerHTML = window.CHESS_PIECES_SVG[pieceName] || '';
      container.appendChild(icon);
    });

    if (scoreDiff > 0) {
      const diffSpan = document.createElement('span');
      diffSpan.className = 'captured-score-diff';
      diffSpan.textContent = `+${scoreDiff}`;
      container.appendChild(diffSpan);
    }
  }

  // Show Toast Notification
  showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Custom rule: Centralized game-over for king-capture (and any future rule).
  // Called with result = 'win' | 'loss', endReason = 'King Captured' | any string
  endGame(result, endReason, onNewGame) {
    const activeGame = window.AppState.getState().activeGame;

    // Guard: if already game-over, do nothing
    if (activeGame.status === 'gameover') return;

    // Persist end reason on the game state for history/replay
    activeGame.endReason = endReason;
    activeGame.winner   = result === 'win' ? activeGame.playerColor : (activeGame.playerColor === 'white' ? 'black' : 'white');

    const isWin  = result === 'win';
    const title  = isWin ? 'YOU WIN' : 'YOU LOSE';
    const reason = isWin
      ? `You captured the opponent's king. Game over!`
      : `Your king was captured. Game over!`;

    this.showGameOverModal({ result, title, reason, onNewGame });
  }

  // Show Game Over Modal
  showGameOverModal({ result, title, reason, onReplay, onNewGame }) {
    this.stopClocks();
    const activeGame = window.AppState.getState().activeGame;
    activeGame.status = 'gameover';
    activeGame.result = result;

    if (result === 'win') window.AppState.playSound('win');
    else if (result === 'loss') window.AppState.playSound('loss');

    const modal = document.getElementById('game-result-modal');
    if (!modal) return;

    const iconBadge = modal.querySelector('.modal-icon-badge');
    const titleEl = modal.querySelector('.modal-title');
    const reasonEl = modal.querySelector('.modal-reason');
    const statsList = modal.querySelector('.modal-stats-list');

    titleEl.textContent = title;
    reasonEl.textContent = reason;

    iconBadge.className = `modal-icon-badge modal-icon-${result}`;
    iconBadge.textContent = result === 'win' ? '1-0' : result === 'loss' ? '0-1' : '1/2';

    statsList.innerHTML = `
      <div class="modal-stat-line">
        <span class="text-muted">Total Moves:</span>
        <b>${activeGame.moveHistory.length}</b>
      </div>
      <div class="modal-stat-line">
        <span class="text-muted">Opponent:</span>
        <b>${activeGame.opponent ? activeGame.opponent.name || activeGame.opponent.username : 'AI Engine'}</b>
      </div>
      <div class="modal-stat-line">
        <span class="text-muted">Result:</span>
        <b class="${result === 'win' ? 'text-green' : result === 'loss' ? 'text-red' : 'text-gold'}">
          ${result.toUpperCase()}
        </b>
      </div>
    `;

    modal.classList.add('active');

    // Wire action buttons
    const btnReplay = document.getElementById('btn-modal-replay');
    const btnNewGame = document.getElementById('btn-modal-new-game');
    const btnHome = document.getElementById('btn-modal-home');

    if (btnReplay) {
      btnReplay.onclick = () => {
        modal.classList.remove('active');
        if (onReplay) onReplay();
      };
    }

    if (btnNewGame) {
      btnNewGame.onclick = () => {
        modal.classList.remove('active');
        if (onNewGame) onNewGame();
      };
    }

    if (btnHome) {
      btnHome.onclick = () => {
        modal.classList.remove('active');
        window.Router.navigate('home');
      };
    }
  }
}

// Global Game Controller Instance
window.GameCtrl = new GameController();
