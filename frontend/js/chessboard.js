/* ==========================================================================
   CHESSBOARD CONTROLLER - PURE VISUAL & INTERACTIVE 8x8 BOARD
   ========================================================================== */

class ChessboardView {
  constructor(containerElement, options = {}) {
    this.container = typeof containerElement === 'string' 
      ? document.getElementById(containerElement) 
      : containerElement;

    this.options = {
      orientation: 'white', // 'white' | 'black'
      showCoordinates: true,
      interactive: true,
      validateMovesRemotely: false,
      onMove: () => {},
      onSquareSelect: () => {},
      ...options
    };

    this.position = {};
    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.checkSquare = null;
    this.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    this.ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.className = 'chessboard-container';

    this.boardElement = document.createElement('div');
    this.boardElement.className = 'chessboard';
    this.boardElement.setAttribute('role', 'grid');
    this.boardElement.setAttribute('aria-label', 'Chessboard');

    this.createSquares();
    this.container.appendChild(this.boardElement);
  }

  setOrientation(color) {
    if (this.options.orientation !== color) {
      this.options.orientation = color;
      this.createSquares();
      this.render();
    }
  }

  setCoordinatesVisible(visible) {
    if (this.options.showCoordinates === visible) return;
    this.options.showCoordinates = visible;
    this.createSquares();
    this.render();
  }

  createSquares() {
    this.boardElement.innerHTML = '';
    const files = this.options.orientation === 'white' ? [...this.files] : [...this.files].reverse();
    const ranks = this.options.orientation === 'white' ? [...this.ranks] : [...this.ranks].reverse();

    ranks.forEach((rank, rankIndex) => {
      files.forEach((file, fileIndex) => {
        const squareId = `${file}${rank}`;
        const isLight = (fileIndex + rankIndex) % 2 === 0;
        
        const square = document.createElement('div');
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        square.dataset.square = squareId;
        square.id = `sq-${squareId}`;
        square.setAttribute('role', 'gridcell');
        square.setAttribute('aria-label', `${squareId}`);

        // Rank coordinate (left-most column)
        if (this.options.showCoordinates && fileIndex === 0) {
          const rankCoord = document.createElement('span');
          rankCoord.className = 'coord-rank';
          rankCoord.textContent = rank;
          square.appendChild(rankCoord);
        }

        // File coordinate (bottom-most row)
        if (this.options.showCoordinates && rankIndex === 7) {
          const fileCoord = document.createElement('span');
          fileCoord.className = 'coord-file';
          fileCoord.textContent = file;
          square.appendChild(fileCoord);
        }

        // Piece holder container
        const pieceContainer = document.createElement('div');
        pieceContainer.className = 'piece';
        square.appendChild(pieceContainer);

        // Click Handler
        square.addEventListener('click', (e) => this.handleSquareClick(squareId, e));

        this.boardElement.appendChild(square);
      });
    });
  }

  handleSquareClick(squareId) {
    if (!this.options.interactive) return;

    const targetPiece = this.position[squareId];

    if (this.options.validateMovesRemotely && this.selectedSquare && this.selectedSquare !== squareId) {
      const from = this.selectedSquare;
      const piece = this.position[from];
      const isOwnTarget = piece && targetPiece && piece.split('-')[0] === targetPiece.split('-')[0];

      if (piece && !isOwnTarget) {
        this.submitMove(from, squareId, piece);
        this.clearSelection();
        return;
      }
    }

    // 1. If a square is already selected and target is a legal move
    if (this.selectedSquare && this.legalMoves.includes(squareId)) {
      const from = this.selectedSquare;
      const to = squareId;
      const piece = this.position[from];

      this.submitMove(from, to, piece);
      this.clearSelection();
      return;
    }

    // 2. Select a piece of the active player
    const piece = targetPiece;
    if (piece) {
      this.selectedSquare = squareId;
      this.options.onSquareSelect(squareId, piece);
    } else {
      this.clearSelection();
    }
  }

  submitMove(from, to, piece) {
    const isWhitePromotion = piece === 'white-pawn' && to.endsWith('8');
    const isBlackPromotion = piece === 'black-pawn' && to.endsWith('1');

    if (isWhitePromotion || isBlackPromotion) {
      const color = isWhitePromotion ? 'white' : 'black';
      this.showPromotionDialog(to, color, (promotedPiece) => {
        this.options.onMove({ from, to, piece, promotion: promotedPiece });
      });
      return;
    }

    this.options.onMove({ from, to, piece });
  }

  // Update Board Position
  updatePosition(position) {
    const nextPosition = { ...position };
    if (JSON.stringify(this.position) === JSON.stringify(nextPosition)) return;
    this.position = nextPosition;
    this.render();
  }

  // Render pieces onto squares
  render() {
    const squares = this.boardElement.querySelectorAll('.square');
    squares.forEach(sq => {
      const sqId = sq.dataset.square;
      const pieceName = this.position[sqId];
      const pieceDiv = sq.querySelector('.piece');

      if (sq.dataset.pieceName === (pieceName || '')) {
        sq.setAttribute('aria-label', pieceName ? `${pieceName.replace('-', ' ')} on ${sqId}` : `Empty square ${sqId}`);
      } else if (pieceName && window.CHESS_PIECES_SVG && window.CHESS_PIECES_SVG[pieceName]) {
        pieceDiv.innerHTML = window.CHESS_PIECES_SVG[pieceName];
        sq.dataset.pieceName = pieceName;
        sq.setAttribute('aria-label', `${pieceName.replace('-', ' ')} on ${sqId}`);
      } else {
        pieceDiv.innerHTML = '';
        sq.dataset.pieceName = '';
        sq.setAttribute('aria-label', `Empty square ${sqId}`);
      }
    });

    this.updateHighlights();
  }

  // Set Legal Moves
  setLegalMoves(squareId, moves = []) {
    this.selectedSquare = squareId;
    this.legalMoves = moves;
    this.updateHighlights();
  }

  // Set Last Move Highlight
  setLastMove(lastMove) {
    this.lastMove = lastMove;
    this.updateHighlights();
  }

  // Set Check King Highlight
  setCheckSquare(squareId) {
    this.checkSquare = squareId;
    this.updateHighlights();
  }

  clearSelection() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.updateHighlights();
  }

  clearHighlights() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.checkSquare = null;
    this.updateHighlights();
  }

  // Update visual CSS classes across the board
  updateHighlights() {
    const squares = this.boardElement.querySelectorAll('.square');
    squares.forEach(sq => {
      const sqId = sq.dataset.square;
      
      // Selected highlight
      if (this.selectedSquare === sqId) {
        sq.classList.add('selected');
      } else {
        sq.classList.remove('selected');
      }

      // Legal moves highlight
      if (this.legalMoves.includes(sqId)) {
        if (this.position[sqId]) {
          sq.classList.add('legal-capture');
          sq.classList.remove('legal-move');
        } else {
          sq.classList.add('legal-move');
          sq.classList.remove('legal-capture');
        }
      } else {
        sq.classList.remove('legal-move', 'legal-capture');
      }

      // Last move highlight
      if (this.lastMove && (this.lastMove.from === sqId || this.lastMove.to === sqId)) {
        sq.classList.add('last-move');
      } else {
        sq.classList.remove('last-move');
      }

      // King in check
      if (this.checkSquare === sqId) {
        sq.classList.add('in-check');
      } else {
        sq.classList.remove('in-check');
      }
    });
  }

  // Pawn Promotion Dialog Overlay
  showPromotionDialog(squareId, color, onSelect) {
    const overlay = document.createElement('div');
    overlay.className = 'promotion-modal-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'promotion-dialog';
    dialog.innerHTML = `
      <h3>Promote Pawn</h3>
      <div class="promotion-options">
        <button class="promotion-btn" data-piece="${color}-queen" title="Queen">
          ${window.CHESS_PIECES_SVG[`${color}-queen`]}
        </button>
        <button class="promotion-btn" data-piece="${color}-knight" title="Knight">
          ${window.CHESS_PIECES_SVG[`${color}-knight`]}
        </button>
        <button class="promotion-btn" data-piece="${color}-rook" title="Rook">
          ${window.CHESS_PIECES_SVG[`${color}-rook`]}
        </button>
        <button class="promotion-btn" data-piece="${color}-bishop" title="Bishop">
          ${window.CHESS_PIECES_SVG[`${color}-bishop`]}
        </button>
      </div>
    `;

    dialog.querySelectorAll('.promotion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const piece = btn.dataset.piece;
        overlay.remove();
        if (onSelect) onSelect(piece);
      });
    });

    overlay.appendChild(dialog);
    this.container.appendChild(overlay);
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.ChessboardView = ChessboardView;
}
