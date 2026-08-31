/* ==========================================================================
   BACKEND INTEGRATION LAYER & API ADAPTER
   ==========================================================================
   ATTENTION BACKEND DEVELOPER:
   This file acts as the single boundary between the Frontend and the Backend.
   All REST requests and WebSocket real-time traffic are routed through here.
   
   To connect your real backend:
   1. Set CONFIG.USE_MOCK_API = false
   2. Configure CONFIG.API_BASE_URL and CONFIG.WS_URL
   3. Preserve the function signatures and returned data formats below.
   ========================================================================== */

const APP_ORIGIN =
  window.location.protocol === "file:"
    ? "http://localhost:8080"
    : window.location.origin;
const API_PROXY_ORIGIN =
  (window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost") &&
  window.location.port !== "8080"
    ? "http://localhost:8080"
    : APP_ORIGIN;
const WS_BACKEND_ORIGIN =
  API_PROXY_ORIGIN.replace(/^http/, "ws");

const CONFIG = {
  USE_MOCK_API: false,
  USE_BACKEND_AUTH: true,
  USE_MOCK_ONLINE_OPPONENT: false,
  API_BASE_URL: `${API_PROXY_ORIGIN}/api`,
  WS_URL: `${WS_BACKEND_ORIGIN}/ws`,
};

const BACKEND_INITIAL_BOARD_POSITION = {
  a8: "BR2",
  b8: "BN2",
  c8: "BB2",
  d8: "BQ1",
  e8: "BK1",
  f8: "BB1",
  g8: "BN1",
  h8: "BR1",
  a7: "BP8",
  b7: "BP7",
  c7: "BP6",
  d7: "BP5",
  e7: "BP4",
  f7: "BP3",
  g7: "BP2",
  h7: "BP1",
  a6: "---",
  b6: "---",
  c6: "---",
  d6: "---",
  e6: "---",
  f6: "---",
  g6: "---",
  h6: "---",
  a5: "---",
  b5: "---",
  c5: "---",
  d5: "---",
  e5: "---",
  f5: "---",
  g5: "---",
  h5: "---",
  a4: "---",
  b4: "---",
  c4: "---",
  d4: "---",
  e4: "---",
  f4: "---",
  g4: "---",
  h4: "---",
  a3: "---",
  b3: "---",
  c3: "---",
  d3: "---",
  e3: "---",
  f3: "---",
  g3: "---",
  h3: "---",
  a2: "WP1",
  b2: "WP2",
  c2: "WP3",
  d2: "WP4",
  e2: "WP5",
  f2: "WP6",
  g2: "WP7",
  h2: "WP8",
  a1: "WR1",
  b1: "WN1",
  c1: "WB1",
  d1: "WQ1",
  e1: "WK1",
  f1: "WB2",
  g1: "WN2",
  h1: "WR2",
};

const BACKEND_PIECE_NAMES = {
  P: "pawn",
  R: "rook",
  N: "knight",
  B: "bishop",
  Q: "queen",
  K: "king",
};

function backendPieceToFrontend(piece) {
  if (!piece || piece === "---") return null;
  if (typeof piece === "string" && piece.includes("-")) return piece;
  const color = piece[0] === "W" ? "white" : "black";
  const type = BACKEND_PIECE_NAMES[piece[1]];
  return type ? `${color}-${type}` : null;
}

function backendBoardToFrontend(board = {}) {
  const position = {};
  Object.entries(board || {}).forEach(([square, piece]) => {
    const frontendPiece = backendPieceToFrontend(piece);
    if (frontendPiece) position[square] = frontendPiece;
  });
  return position;
}

function frontendPromotionToBackend(piece) {
  if (!piece) return "";
  const color = piece.startsWith("white") ? "W" : "B";
  if (piece.endsWith("queen")) return `${color}Q`;
  if (piece.endsWith("rook")) return `${color}R`;
  if (piece.endsWith("bishop")) return `${color}B`;
  if (piece.endsWith("knight")) return `${color}N`;
  return "";
}

function backendTurnToFrontend(turn) {
  if (turn === "W") return "white";
  if (turn === "B") return "black";
  return turn || "white";
}

function normalizeBackendGameState(state, turn = null) {
  const board = state?.position || state?.board || state?.game?.board || state?.game?.position || state || {};
  return {
    backendPosition: { ...board },
    position: backendBoardToFrontend(board),
    turn: state?.turn ? backendTurnToFrontend(state.turn) : turn,
    moveResult: state?.moveResult ?? state?.result ?? null,
  };
}

function createLocalBackendState() {
  return normalizeBackendGameState(BACKEND_INITIAL_BOARD_POSITION, "white");
}

function backendMoveToFrontend(move = {}) {
  if (typeof move === "string") {
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotionCode = move[4]?.toLowerCase();
    const activePosition = window.AppState?.getState?.().activeGame?.position || {};
    const piece = activePosition[from] || "";
    const color = piece.split("-")[0] || "";
    const promotionMap = { q: "queen", r: "rook", b: "bishop", n: "knight" };
    return {
      from,
      to,
      piece,
      promotion: promotionCode && color && promotionMap[promotionCode]
        ? `${color}-${promotionMap[promotionCode]}`
        : null,
    };
  }

  return {
    ...move,
    piece: backendPieceToFrontend(move.piece) || move.piece,
    promotion: backendPieceToFrontend(move.promotion) || move.promotion,
  };
}

function frontendMoveToBackend(move = {}, backendPosition = {}) {
  const promotion = frontendPromotionToBackend(move.promotion);
  return {
    ...move,
    piece: backendPosition[move.from] || move.piece,
    promotion,
    lan: `${move.from}${move.to}${promotion ? promotion[1].toLowerCase() : ""}`,
  };
}

function isSameMove(left = {}, right = {}) {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.piece === right.piece
  );
}

function getSessionValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

function setSessionValue(key, value) {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

function removeSessionValue(key) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

class ApiService {
  constructor(config = CONFIG) {
    this.config = config;
  }

  getMockUsers() {
    const defaultUser = window.MOCK_CURRENT_USER
      ? { ...window.MOCK_CURRENT_USER, password: "chess123" }
      : null;

    try {
      const stored = localStorage.getItem("chess_auth_users");
      let users = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(users)) users = [];

      if (
        defaultUser &&
        !users.some((user) => user.email === defaultUser.email)
      ) {
        users.unshift(defaultUser);
        this.saveMockUsers(users);
      }

      return users;
    } catch (error) {
      console.warn("Could not read mock users:", error);
      return defaultUser ? [defaultUser] : [];
    }
  }

  saveMockUsers(users) {
    localStorage.setItem("chess_auth_users", JSON.stringify(users));
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return JSON.parse(JSON.stringify(safeUser));
  }

  calculateWinRate(stats) {
    if (!stats.gamesPlayed) return "0.0%";
    return `${((stats.wins / stats.gamesPlayed) * 100).toFixed(1)}%`;
  }

  getAuthToken() {
    return getSessionValue("chess_backend_token");
  }

  normalizeBackendUser(user) {
    const username = user?.username || "Player";
    const stats = user?.stats || {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: "0.0%",
    };

    return {
      id: user?.id || "",
      username,
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || null,
      initials: user?.initials || username.substring(0, 2).toUpperCase(),
      rating: user?.rating || 1200,
      country: user?.country || "IN",
      countryFlag: user?.countryFlag || "IN",
      joinedDate: user?.joinedDate || "New Player",
      stats: {
        ...stats,
        winRate: stats.winRate || this.calculateWinRate(stats),
      },
    };
  }

  normalizeBackendMatch(match) {
    const created = match?.createdAt ? new Date(match.createdAt) : new Date();
    const moves = Array.isArray(match?.moves)
      ? match.moves.map((move) => ({
          ...move,
          piece: backendPieceToFrontend(move.piece) || move.piece,
        }))
      : [];
    const isFinished = match?.status === "finished";
    const result =
      match?.finishedReason === "stalemate"
        ? "draw"
        : isFinished && match?.winnerId
          ? "win"
          : "draw";

    return {
      id: match?.id || "",
      opponent: {
        id: match?.opponent?.id || "backend_opponent",
        username: match?.opponent?.username || "Backend Game",
        rating: match?.opponent?.rating || 1200,
        initials: match?.opponent?.initials || "BG",
        countryFlag: match?.opponent?.countryFlag || "IN",
      },
      result,
      eloChange: match?.eloChange || "+0",
      date: Number.isNaN(created.getTime())
        ? "Unknown date"
        : created.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
      moveCount: match?.moveCount || moves.length || 0,
      timeControl: match?.timeControl || "10 min",
      userColor: match?.userColor || "white",
      moves,
      backendState: match?.board
        ? normalizeBackendGameState(match.board)
        : null,
    };
  }

  storeBackendSession(user, token) {
    const normalizedUser = this.normalizeBackendUser(user);
    setSessionValue("chess_backend_token", token);
    setSessionValue("chess_backend_user", JSON.stringify(normalizedUser));
    window.AppState.setAuthenticatedUser(normalizedUser);
    return normalizedUser;
  }

  clearBackendSession() {
    removeSessionValue("chess_backend_token");
    removeSessionValue("chess_backend_user");
    localStorage.removeItem("chess_auth_session");
  }

  async restoreBackendSession() {
    if (!this.config.USE_BACKEND_AUTH) return null;

    const token = this.getAuthToken();
    if (!token) {
      window.AppState.setAuthenticatedUser(null);
      return null;
    }

    try {
      return await this.getCurrentUser();
    } catch (error) {
      this.clearBackendSession();
      window.AppState.setAuthenticatedUser(null);
      return null;
    }
  }

  // 0. Login with an Existing Account
  async login(credentials) {
    if (this.config.USE_BACKEND_AUTH) {
      const response = await this.request(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: (credentials.email || "").trim().toLowerCase(),
            password: credentials.password || "",
          }),
        },
        false,
      );

      const user = this.storeBackendSession(
        response.data.user,
        response.data.token,
      );
      return { success: true, user };
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(250);
      const email = (credentials.email || "").trim().toLowerCase();
      const password = credentials.password || "";
      const user = this.getMockUsers().find(
        (account) =>
          account.email.toLowerCase() === email &&
          account.password === password,
      );

      if (!user) {
        throw new Error("Invalid email or password.");
      }

      localStorage.setItem("chess_auth_session", user.email);
      window.AppState.setAuthenticatedUser(user);
      return { success: true, user: this.sanitizeUser(user) };
    }

    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  // 0b. Create a New Account
  async signup(userData) {
    if (this.config.USE_BACKEND_AUTH) {
      const credentials = {
        username: (userData.username || "").trim(),
        email: (userData.email || "").trim().toLowerCase(),
        password: userData.password || "",
      };

      await this.request(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(credentials),
        },
        false,
      );

      return this.login(credentials);
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(300);
      const username = (userData.username || "").trim();
      const email = (userData.email || "").trim().toLowerCase();
      const password = userData.password || "";

      if (!username || !email || !password) {
        throw new Error("Please fill all signup fields.");
      }

      const users = this.getMockUsers();
      if (users.some((user) => user.email.toLowerCase() === email)) {
        throw new Error("An account already exists with this email.");
      }

      const stats = {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: "0.0%",
      };

      const newUser = {
        id: `usr_${Date.now()}`,
        username,
        email,
        password,
        avatarUrl: null,
        initials: username.substring(0, 2).toUpperCase(),
        rating: 1200,
        country: "IN",
        countryFlag: "IN",
        joinedDate: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        stats,
      };

      users.push(newUser);
      this.saveMockUsers(users);
      localStorage.setItem("chess_auth_session", newUser.email);
      window.AppState.setAuthenticatedUser(newUser);
      return { success: true, user: this.sanitizeUser(newUser) };
    }

    return this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // 0c. Logout Current User
  async logout() {
    if (this.config.USE_BACKEND_AUTH) {
      const token = this.getAuthToken();
      if (token) {
        await this.request("/auth/logout", { method: "POST" });
      }
      this.clearBackendSession();
      window.AppState.setAuthenticatedUser(null);
      return { success: true };
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(120);
      localStorage.removeItem("chess_auth_session");
      window.AppState.setAuthenticatedUser(null);
      return { success: true };
    }

    return this.request("/auth/logout", { method: "POST" });
  }

  // Generic helper for real fetch requests
  async request(endpoint, options = {}, includeAuth = true) {
    const url = `${this.config.API_BASE_URL}${endpoint}`;
    const token = this.getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...(includeAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message ||
            payload.error ||
            `HTTP ${response.status}: ${response.statusText}`,
        );
      }
      return payload;
    } catch (error) {
      console.error(`API Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // 1. Get Current Logged-in User
  async getCurrentUser() {
    if (this.config.USE_BACKEND_AUTH) {
      if (!this.getAuthToken()) return null;
      const response = await this.request("/auth/me");
      const backendUser = response?.data?.user || response?.data || response?.user;
      const stored = getSessionValue("chess_backend_user");
      if (!backendUser?.id && stored) {
        const user = this.normalizeBackendUser(JSON.parse(stored));
        window.AppState.setAuthenticatedUser(user);
        return user;
      }
      const user = this.normalizeBackendUser(backendUser);
      setSessionValue("chess_backend_user", JSON.stringify(user));
      window.AppState.setAuthenticatedUser(user);
      return user;
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(150);
      return window.AppState.getState().user;
    }
    return this.request("/auth/me");
  }

  // 2. Get User Profile Details & Statistics
  async getProfile() {
    if (this.config.USE_BACKEND_AUTH) {
      return this.getCurrentUser();
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(180);
      return window.AppState.getState().user;
    }
    return this.request("/profile");
  }

  // 3. Update User Profile
  async updateProfile(userData) {
    if (this.config.USE_BACKEND_AUTH) {
      const currentUser = window.AppState.getState().user;
      const updated = this.normalizeBackendUser({
        ...currentUser,
        ...userData,
      });
      setSessionValue("chess_backend_user", JSON.stringify(updated));
      window.AppState.setAuthenticatedUser(updated);
      return { success: true, user: updated };
    }

    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(250);
      const currentUser = window.AppState.getState().user;
      const updated = { ...currentUser, ...userData };
      const users = this.getMockUsers().map((user) =>
        user.email === currentUser.email
          ? { ...user, ...updated, password: user.password }
          : user,
      );
      this.saveMockUsers(users);
      localStorage.setItem("chess_auth_session", updated.email);
      window.AppState.setState({ user: updated });
      return { success: true, user: updated };
    }
    return this.request("/profile", {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  // 4. Get Match History
  async getMatchHistory() {
    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(220);
      return [...window.MOCK_MATCH_HISTORY];
    }
    const response = await this.request("/games");
    const matches = Array.isArray(response?.data) ? response.data : response;
    return Array.isArray(matches)
      ? matches.map((match) => this.normalizeBackendMatch(match))
      : [];
  }

  // 5. Get Specific Match by ID (for Replay)
  async getMatch(matchId) {
    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(160);
      const match = window.MOCK_MATCH_HISTORY.find((m) => m.id === matchId);
      if (!match) throw new Error(`Match ${matchId} not found`);
      return match;
    }
    let match = null;
    try {
      const response = await this.request(`/games/${matchId}`);
      match = response?.data || response;
    } catch (error) {
      const response = await this.request("/games");
      const matches = Array.isArray(response?.data) ? response.data : response;
      match = Array.isArray(matches)
        ? matches.find((item) => item.id === matchId)
        : null;
    }
    if (!match) throw new Error(`Match ${matchId} not found`);
    return this.normalizeBackendMatch(match);
  }

  // 6. Find Online Opponent (Matchmaking)
  async findOpponent(
    preferences = { timeControl: "10 min", ratingRange: 150 },
  ) {
    if (this.config.USE_MOCK_API) {
      // Simulate 2.5 second search
      await this.simulateDelay(2200);
      return {
        matchId: `match_${Math.floor(1000 + Math.random() * 9000)}`,
        timeControl: preferences.timeControl,
        opponent: {
          id: `usr_${Math.floor(100 + Math.random() * 900)}`,
          username: [
            "VanguardKnight",
            "DeepThinker",
            "StormMaster",
            "AeroQueen",
          ][Math.floor(Math.random() * 4)],
          rating: 1520 + Math.floor(Math.random() * 80 - 40),
          avatarUrl: null,
          initials: "OP",
          countryFlag: ["ES", "GB", "FR", "JP", "DE", "CA"][
            Math.floor(Math.random() * 6)
          ],
        },
        playerColor: Math.random() > 0.5 ? "white" : "black",
      };
    }
    return window.OnlineAdapter.findOpponent(preferences);
  }

  // 7. Cancel Matchmaking
  async cancelMatchmaking() {
    if (this.config.USE_MOCK_API) {
      return { success: true };
    }
    window.OnlineAdapter.cancelMatchmaking();
    return { success: true };
  }

  // 8. Resign Online Match
  async resignMatch(matchId) {
    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(150);
      return { success: true, result: "loss", reason: "Resignation" };
    }
    window.OnlineAdapter.resign(matchId);
    return { success: true, result: "loss", reason: "Resignation" };
  }

  // 9. Offer Draw
  async offerDraw(matchId) {
    if (this.config.USE_MOCK_API) {
      await this.simulateDelay(150);
      return { success: true, status: "offered" };
    }
    window.GameCtrl?.showToast?.(
      "This backend does not expose draw offers yet.",
      "info",
    );
    return { success: true, status: "unsupported" };
  }

  async createEngineGame() {
    const state = createLocalBackendState();
    return {
      gameId: `local_engine_${Date.now()}`,
      ...state,
    };
  }

  async getEngineLegalMoves(gameId, fromSquare) {
    return [];
  }

  async makeEngineMove(gameId, move) {
    return { move, moveResult: 2 };
  }

  async getEngineBestMove(gameId, color = "black", difficulty = "medium") {
    return null;
  }

  // Simulated Network Latency
  simulateDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/* ==========================================================================
   WEBSOCKET MULTIPLAYER ADAPTER
   ========================================================================== */
class OnlineGameAdapter {
  constructor(apiService = new ApiService()) {
    this.api = apiService;
    this.socket = null;
    this.connectionLock = false;
    this.callbacks = {
      onOpponentMove: () => {},
      onMoveAccepted: () => {},
      onInvalidMove: () => {},
      onGameState: () => {},
      onOpponentDisconnected: () => {},
      onConnectionClosed: () => {},
      onGameOver: () => {},
      onDrawOffer: () => {},
    };
    this.mockOpponentTimer = null;
    this.matchmakingPromise = null;
    this.pendingBackendMove = null;
    this.connectionLock = false;
  }

  // Connect to WebSocket or initialize Mock Session
  connect() {
    if (CONFIG.USE_MOCK_API || CONFIG.USE_MOCK_ONLINE_OPPONENT) return null;

    if (this.connectionLock && this.socket) {
      return this.socket;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return this.socket;
    }

    this.connectionLock = true;

    try {
      const token = this.api.getAuthToken();
      const wsUrl = token
        ? `${CONFIG.WS_URL}?token=${encodeURIComponent(token)}`
        : CONFIG.WS_URL;
      this.socket = new WebSocket(wsUrl);
      this.socket.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data));
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      };
      this.socket.onclose = () => {
        this.connectionLock = false;
        this.callbacks.onConnectionClosed();
        if (this.matchmakingPromise) {
          this.matchmakingPromise.reject(
            new Error("Matchmaking connection closed."),
          );
          this.matchmakingPromise = null;
        }
        this.socket = null;
        console.log("Multiplayer WS disconnected");
      };
      this.socket.onerror = () => {
        this.connectionLock = false;
        if (this.matchmakingPromise) {
          this.matchmakingPromise.reject(
            new Error("Could not connect to multiplayer server."),
          );
          this.matchmakingPromise = null;
        }
      };
      return this.socket;
    } catch (err) {
      console.error("Failed to connect to real WebSocket:", err);
      return null;
    }
  }

  waitForOpen(socket) {
    if (!socket) return Promise.reject(new Error("WebSocket is unavailable."));
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("WebSocket connection failed.")),
        { once: true },
      );
    });
  }

  async findOpponent(preferences = {}) {
    const socket = this.connect();
    await this.waitForOpen(socket);

    return new Promise((resolve, reject) => {
      this.matchmakingPromise = { resolve, reject };
      socket.send(
        JSON.stringify({
          type: "find_match",
          token: this.api.getAuthToken(),
          preferences,
        }),
      );
    });
  }

  cancelMatchmaking() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "cancel_match" }));
    }
    this.disconnect("cancel");
  }

  disconnect(reason = "manual") {
    const activeGame = window.AppState?.getState?.().activeGame;
    if (
      activeGame?.status === "playing" &&
      !["gameover", "resign", "cancel"].includes(reason)
    ) {
      return;
    }

    this.connectionLock = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.mockOpponentTimer) {
      clearTimeout(this.mockOpponentTimer);
      this.mockOpponentTimer = null;
    }
  }

  sendMove(matchId, move) {
    if (CONFIG.USE_MOCK_API || CONFIG.USE_MOCK_ONLINE_OPPONENT) {
      // Simulate live online opponent move response after 1.2-2.5s
      if (this.mockOpponentTimer) clearTimeout(this.mockOpponentTimer);
      this.mockOpponentTimer = setTimeout(
        () => {
          if (window.AppState.getState().activeGame.status === "playing") {
            // Trigger mock opponent response move
            const opponentMove = this.generateMockOnlineMove(move);
            if (opponentMove) {
              this.callbacks.onOpponentMove(opponentMove);
            }
          }
        },
        1200 + Math.random() * 1000,
      );
      return true;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const activeGame = window.AppState.getState().activeGame;
      const backendMove = frontendMoveToBackend(
        move,
        activeGame.backendPosition || {},
      );
      this.pendingBackendMove = backendMove;
      this.socket.send(
        JSON.stringify({
          type: "move",
          gameId: matchId,
          matchId,
          token: this.api.getAuthToken(),
          move: backendMove,
          lan: backendMove.lan,
        }),
      );
      return true;
    }

    return false;
  }

  resign(matchId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "resign",
          gameId: matchId,
          loserId: window.AppState.getState().user?.id || null,
        }),
      );
      return true;
    }

    return false;
  }

  generateMockOnlineMove(lastPlayerMove) {
    const currentPos = window.AppState.getState().activeGame.position;
    // Smart heuristic mock moves for online simulation
    const candidateMoves = [
      { from: "e7", to: "e5", piece: "black-pawn", notation: "e5" },
      { from: "g8", to: "f6", piece: "black-knight", notation: "Nf6" },
      { from: "b8", to: "c6", piece: "black-knight", notation: "Nc6" },
      { from: "c7", to: "c5", piece: "black-pawn", notation: "c5" },
      { from: "d7", to: "d5", piece: "black-pawn", notation: "d5" },
      { from: "f8", to: "c5", piece: "black-bishop", notation: "Bc5" },
      { from: "e8", to: "g8", piece: "black-king", notation: "O-O" },
    ];

    for (const m of candidateMoves) {
      if (currentPos[m.from] && !currentPos[m.to]) {
        return m;
      }
    }
    return null;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "OPPONENT_MOVE":
      case "opponent_move":
      case "move":
        {
          const rawState = msg.state || msg.gameState || msg.game || null;
          const normalizedState = rawState
            ? normalizeBackendGameState(rawState)
            : null;
          if (normalizedState) {
            normalizedState.moveResult = msg.result ?? normalizedState.moveResult;
          }
          const move = backendMoveToFrontend(msg.move || msg.data || msg);
          if (
            this.pendingBackendMove &&
            isSameMove(this.pendingBackendMove, msg.move)
          ) {
            this.pendingBackendMove = null;
            this.callbacks.onMoveAccepted(move, normalizedState);
          } else {
            this.callbacks.onOpponentMove(move, normalizedState);
          }
        }
        break;
      case "move_accepted":
      case "MOVE_ACCEPTED":
        this.callbacks.onMoveAccepted(
          backendMoveToFrontend(msg.move || msg.data || msg),
          msg.state || msg.gameState || msg.game
            ? normalizeBackendGameState(msg.state || msg.gameState || msg.game)
            : null,
        );
        this.callbacks.onGameState(
          msg.state || msg.gameState || msg.game
            ? normalizeBackendGameState(msg.state || msg.gameState || msg.game)
            : null,
        );
        break;
      case "invalid_move":
      case "INVALID_MOVE":
        this.pendingBackendMove = null;
        this.callbacks.onInvalidMove(
          msg.error,
          msg.state || msg.gameState || msg.game
            ? normalizeBackendGameState(msg.state || msg.gameState || msg.game)
            : null,
        );
        this.callbacks.onGameState(
          msg.state || msg.gameState || msg.game
            ? normalizeBackendGameState(msg.state || msg.gameState || msg.game)
            : null,
        );
        console.error("Invalid multiplayer move:", msg.error);
        break;
      case "waiting":
        this.callbacks.onGameState(msg);
        break;
      case "game_start":
      case "GAME_START":
        if (this.matchmakingPromise) {
          const rawState = msg.state || msg.gameState || msg.game;
          this.matchmakingPromise.resolve({
            matchId: msg.matchId || msg.gameId,
            timeControl: msg.timeControl || "10 min",
            opponent: msg.opponent || {
              id: "backend_opponent",
              username: msg.color === "B" ? "White Player" : "Black Player",
              rating: 1200,
              initials: msg.color === "B" ? "WP" : "BP",
              countryFlag: "IN",
            },
            playerColor:
              msg.playerColor || (msg.color === "B" ? "black" : "white"),
            state: rawState
              ? normalizeBackendGameState(rawState)
              : createLocalBackendState(),
          });
          this.matchmakingPromise = null;
        }
        break;
      case "GAME_STATE":
      case "game_state":
        this.callbacks.onGameState(
          msg.state || msg.gameState || msg.game
            ? normalizeBackendGameState(msg.state || msg.gameState || msg.game)
            : null,
        );
        break;
      case "OPPONENT_DISCONNECTED":
      case "opponent_disconnected":
        this.callbacks.onOpponentDisconnected(msg);
        break;
      case "GAME_OVER":
      case "game_over":
        this.callbacks.onGameOver(msg);
        break;
      case "DRAW_OFFER":
        this.callbacks.onDrawOffer();
        break;
      case "error":
        if (this.matchmakingPromise) {
          this.matchmakingPromise.reject(
            new Error(msg.error || "Multiplayer error."),
          );
          this.matchmakingPromise = null;
        }
        break;
    }
  }

  onOpponentMove(callback) {
    this.callbacks.onOpponentMove = callback;
  }
  onMoveAccepted(callback) {
    this.callbacks.onMoveAccepted = callback;
  }
  onInvalidMove(callback) {
    this.callbacks.onInvalidMove = callback;
  }
  onGameState(callback) {
    this.callbacks.onGameState = callback;
  }
  onOpponentDisconnected(callback) {
    this.callbacks.onOpponentDisconnected = callback;
  }
  onConnectionClosed(callback) {
    this.callbacks.onConnectionClosed = callback;
  }
  onGameOver(callback) {
    this.callbacks.onGameOver = callback;
  }
  onDrawOffer(callback) {
    this.callbacks.onDrawOffer = callback;
  }
}

// Global API & Adapter Instance
window.API = new ApiService();
window.OnlineAdapter = new OnlineGameAdapter(window.API);
window.CONFIG = CONFIG;
window.BackendChessCompat = {
  backendBoardToFrontend,
  backendMoveToFrontend,
  frontendMoveToBackend,
  createLocalBackendState,
  normalizeBackendGameState,
};
