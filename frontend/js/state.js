/* ==========================================================================
   CENTRALIZED STATE MANAGEMENT, PERSISTENCE & AUDIO SYNTHESIZER
   ========================================================================== */

class StateManager {
  constructor() {
    // Load persisted settings or fallback to defaults
    const defaultSettings = {
      soundEnabled: true,
      showCoordinates: true,
      moveConfirmation: false,
      theme: 'dark',
      boardHighlights: true
    };

    let savedSettings = defaultSettings;
    try {
      const stored = localStorage.getItem('chess_game_settings');
      if (stored) savedSettings = { ...defaultSettings, ...JSON.parse(stored) };
    } catch (e) {
      console.warn('LocalStorage not accessible, using default settings.');
    }

    const authSession = this.loadAuthSession();

    this.state = {
      currentView: authSession.user ? 'home' : 'auth',
      isAuthenticated: !!authSession.user,
      user: authSession.user,
      settings: savedSettings,
      aiSetup: {
        timeMinutes: 5,
        playerColor: 'white',
        difficulty: 'medium'
      },
      gameMode: null, // 'ai' | 'online'
      activeGame: {
        id: null,
        position: window.INITIAL_BOARD_POSITION ? { ...window.INITIAL_BOARD_POSITION } : {},
        turn: 'white',
        playerColor: 'white',
        selectedSquare: null,
        legalMoves: [],
        moveHistory: [],
        lastMove: null,
        isCheck: false,
        status: 'ready', // 'ready' | 'playing' | 'gameover'
        result: null,
        clocks: { white: 600, black: 600 },
        captured: { white: [], black: [] },
        opponent: null
      },
      replay: {
        matchId: null,
        currentMoveIndex: 0,
        totalMoves: 0,
        moves: [],
        isPlaying: false,
        timerId: null,
        initialPosition: window.INITIAL_BOARD_POSITION ? { ...window.INITIAL_BOARD_POSITION } : {}
      }
    };

    this.listeners = new Map();
    this.audioContext = null;
    this.applyTheme();
  }

  loadAuthSession() {
    const fallbackUser = window.MOCK_CURRENT_USER ? JSON.parse(JSON.stringify(window.MOCK_CURRENT_USER)) : null;

    try {
      const backendToken = sessionStorage.getItem('chess_backend_token') || localStorage.getItem('chess_backend_token');
      const backendUser = sessionStorage.getItem('chess_backend_user') || localStorage.getItem('chess_backend_user');
      if (backendToken && backendUser) {
        sessionStorage.setItem('chess_backend_token', backendToken);
        sessionStorage.setItem('chess_backend_user', backendUser);
        return { user: this.sanitizeUser(JSON.parse(backendUser)) };
      }

      const storedUsers = localStorage.getItem('chess_auth_users');
      const sessionEmail = localStorage.getItem('chess_auth_session');
      let users = storedUsers ? JSON.parse(storedUsers) : [];

      if (!Array.isArray(users)) users = [];
      if (fallbackUser && !users.some(user => user.email === fallbackUser.email)) {
        users.unshift({ ...fallbackUser, password: 'chess123' });
        localStorage.setItem('chess_auth_users', JSON.stringify(users));
      }

      const activeUser = users.find(user => user.email === sessionEmail);
      return { user: activeUser ? this.sanitizeUser(activeUser) : null };
    } catch (e) {
      console.warn('Auth session unavailable, continuing as logged out.');
      return { user: null };
    }
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return JSON.parse(JSON.stringify(safeUser));
  }

  // Subscribe to state change events
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => {
      const list = this.listeners.get(event);
      this.listeners.set(event, list.filter(cb => cb !== callback));
    };
  }

  // Emit event to subscribers
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try { callback(data); } catch (err) { console.error(`Error in listener for ${event}:`, err); }
      });
    }
    // Also trigger wildcard subscribers
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try { callback({ event, data }); } catch (err) { console.error('Error in wildcard listener:', err); }
      });
    }
  }

  // Get current state snapshot
  getState() {
    return this.state;
  }

  // Update top-level or nested properties
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.emit('stateChanged', this.state);
  }

  setAuthenticatedUser(user) {
    this.state.user = this.sanitizeUser(user);
    this.state.isAuthenticated = !!this.state.user;
    this.emit('authChanged', {
      isAuthenticated: this.state.isAuthenticated,
      user: this.state.user
    });
    this.emit('stateChanged', this.state);
  }

  // Update Settings and persist to localStorage
  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    try {
      localStorage.setItem('chess_game_settings', JSON.stringify(this.state.settings));
    } catch (e) {
      console.warn('Could not save settings to localStorage');
    }
    this.applyTheme();
    this.emit('settingsUpdated', this.state.settings);
  }

  // Apply theme class to document body
  applyTheme() {
    if (this.state.settings.theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  // Embedded Web Audio Synthesizer (Zero asset dependency)
  playSound(type) {
    if (!this.state.settings.soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext) this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') this.audioContext.resume();

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      if (type === 'move') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'capture') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'check') {
        [440, 660].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + (i * 0.08));
          gain.gain.setValueAtTime(0.25, now + (i * 0.08));
          gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.08) + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + (i * 0.08));
          osc.stop(now + (i * 0.08) + 0.12);
        });
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + (i * 0.09));
          gain.gain.setValueAtTime(0.3, now + (i * 0.09));
          gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.09) + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + (i * 0.09));
          osc.stop(now + (i * 0.09) + 0.25);
        });
      } else if (type === 'loss') {
        [400, 360, 320, 260].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + (i * 0.12));
          gain.gain.setValueAtTime(0.2, now + (i * 0.12));
          gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.12) + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + (i * 0.12));
          osc.stop(now + (i * 0.12) + 0.2);
        });
      }
    } catch (e) {
      console.warn('Web Audio playback skipped:', e);
    }
  }
}

// Global App State Instance
window.AppState = new StateManager();
