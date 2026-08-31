/* ==========================================================================
   MATCH HISTORY VIEW CONTROLLER
   ========================================================================== */

class MatchHistoryController {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.matches = [];
  }

  async init() {
    this.bindEvents();
  }

  bindEvents() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter || 'all';
        this.renderList();
      });
    });

    const searchInput = document.getElementById('history-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderList();
      });
    }
  }

  async loadHistory() {
    if (!window.AppState.getState().isAuthenticated) {
      this.matches = [];
      return;
    }

    const listContainer = document.getElementById('history-match-list');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="empty-state-box">
          <p class="text-secondary">Loading match history...</p>
        </div>
      `;
    }

    try {
      this.matches = await window.API.getMatchHistory();
      this.renderList();
    } catch (err) {
      console.error('Failed to load history:', err);
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="empty-state-box">
            <p class="text-red">Failed to load match history.</p>
            <button class="btn btn-secondary btn-sm" onclick="window.MatchHistory.loadHistory()">Retry</button>
          </div>
        `;
      }
    }
  }

  renderList() {
    const listContainer = document.getElementById('history-match-list');
    if (!listContainer) return;

    let filtered = this.matches;

    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(m => m.result === this.currentFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(m =>
        m.opponent.username.toLowerCase().includes(this.searchQuery) ||
        m.id.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state-box">
          <h3>No matches found</h3>
          <p class="text-secondary">Your completed games will appear here with opponent, result, colour, time and replay details.</p>
          <button class="btn btn-primary btn-sm" onclick="window.Router.navigate('online')">Play Online</button>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    filtered.forEach(match => {
      const card = document.createElement('div');
      card.className = 'match-card';

      const resultBadgeClass = match.result === 'win' ? 'badge-win' : match.result === 'loss' ? 'badge-loss' : 'badge-draw';
      const resultText = match.result === 'win' ? 'Victory' : match.result === 'loss' ? 'Defeat' : 'Draw';

      card.innerHTML = `
        <div class="match-card-main">
          <div class="match-card-opponent">
            <div class="avatar-circle">${match.opponent.initials || match.opponent.username.substring(0, 2).toUpperCase()}</div>
            <div>
              <div class="match-opponent-line">
                <b>${match.opponent.username}</b>
                <span class="badge badge-rating">${match.opponent.rating}</span>
              </div>
              <div class="match-facts">
                <span>${match.userColor}</span>
                <span>${match.timeControl}</span>
                <span>${match.moveCount} moves</span>
              </div>
            </div>
          </div>
          <span class="badge ${resultBadgeClass}">${resultText} ${match.eloChange}</span>
        </div>

        <div class="match-card-meta">
          <span>${match.date}</span>
          <button class="btn btn-secondary btn-sm btn-view-match" data-id="${match.id}">
            View Game
          </button>
        </div>
      `;

      card.querySelector('.btn-view-match').addEventListener('click', () => {
        window.ReplayController.loadMatchById(match.id);
      });

      listContainer.appendChild(card);
    });
  }
}

window.MatchHistory = new MatchHistoryController();
