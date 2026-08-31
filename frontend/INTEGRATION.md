# Chess Master - Frontend Integration Guide

Welcome to the **Chess Master** hackathon frontend repository! This document serves as the technical integration contract for the **Chess Engine Developer** and the **Backend Developer**.

---

## 1. How to Run the Frontend

The frontend is built purely with **HTML5, CSS3, and Vanilla JavaScript** (zero npm packages or framework dependencies).

To run locally:
```bash
# Option 1: Python simple server
python -m http.server 8000

# Option 2: Node.js npx serve
npx serve .

# Option 3: VS Code Live Server
Right-click `index.html` -> "Open with Live Server"
```
Navigate to `http://localhost:8000` in any modern web browser.

---

## 2. Project Structure

```
/
├── index.html                  # Single Page Application HTML shell
├── INTEGRATION.md              # Technical integration contract (this file)
│
├── css/
│   ├── style.css               # Design system, CSS variables, dark/light theme
│   ├── chessboard.css          # 8x8 Board, piece styling, coordinate labels, highlights
│   ├── components.css          # Navigation, cards, sidebars, modals, move lists, toasts
│   └── responsive.css          # Adaptive layout for desktop, tablet, mobile
│
├── js/
│   ├── pieces.js               # High-fidelity SVG piece dictionary
│   ├── mockData.js             # Fixtures for user profile, bots, match history
│   ├── state.js                # State management, localStorage settings, Web Audio synth
│   ├── api.js                  # Backend API & WebSocket adapter abstraction layer
│   ├── chessboard.js           # Visual 8x8 chessboard controller & DOM renderer
│   ├── game.js                 # Shared game logic (timers, move lists, modals, sounds)
│   ├── ai.js                   # Play with AI screen & ChessEngineAdapter
│   ├── online.js               # Online matchmaking & multiplayer live game controller
│   ├── history.js              # Match history filtering & match card renderer
│   ├── replay.js               # Interactive step-by-step match replay engine
│   ├── profile.js              # Profile editor and settings persistence
│   ├── router.js               # Client-side SPA hash router (no page reloads)
│   └── app.js                  # App bootstrap and initialization
│
└── assets/
    └── pieces/                 # Vector SVG chess pieces
```

---

## 3. Chess Engine Integration Contract

### Location: [`js/ai.js`](file:///c:/Users/princ/OneDrive/Desktop/0dependency/js/ai.js)

The frontend communicates with the chess engine via the `MockChessEngine` adapter class. To connect your real chess engine (Stockfish WASM, Web Worker, or custom JS/WASM engine):

1. Replace or extend the methods inside `class MockChessEngine` in [`js/ai.js`](file:///c:/Users/princ/OneDrive/Desktop/0dependency/js/ai.js).
2. Maintain the function signatures detailed below.

### Engine Method Signatures

#### A. `getLegalMoves(position, fromSquare)`
- **Arguments**:
  - `position`: Object mapping square coordinates to piece names. Example: `{"e2": "white-pawn", "e4": "black-pawn", ...}`
  - `fromSquare`: String square coordinate. Example: `"e2"`
- **Returns**: Array of legal target square strings:
  ```json
  ["e3", "e4"]
  ```

#### B. `getBestMove(position, aiColor)`
- **Arguments**:
  - `position`: Current board position object.
  - `aiColor`: `"black"` or `"white"`.
- **Returns**: Promise resolving to a move object:
  ```json
  {
    "from": "e7",
    "to": "e5",
    "piece": "black-pawn",
    "notation": "e5"
  }
  ```

#### C. Board Position Representation
```javascript
{
  "a8": "black-rook", "b8": "black-knight", "c8": "black-bishop", "d8": "black-queen",
  "e8": "black-king", "f8": "black-bishop", "g8": "black-knight", "h8": "black-rook",
  "a7": "black-pawn", ...
  "a2": "white-pawn", ...
  "a1": "white-rook", "b1": "white-knight", "c1": "white-bishop", "d1": "white-queen",
  "e1": "white-king", "f1": "white-bishop", "g1": "white-knight", "h1": "white-rook"
}
```

#### D. Pawn Promotion
When a pawn reaches rank 8 (for white) or rank 1 (for black), the frontend prompts the user with an interactive modal and transmits the chosen piece:
```javascript
{
  from: "e7",
  to: "e8",
  piece: "white-pawn",
  promotion: "white-queen" // "white-queen" | "white-rook" | "white-bishop" | "white-knight"
}
```

---

## 4. Backend API Integration Contract

### Location: [`js/api.js`](file:///c:/Users/princ/OneDrive/Desktop/0dependency/js/api.js)

All REST and WebSocket network communication is isolated in `js/api.js`.

### How to Switch from Mock to Real Backend
In `js/api.js`:
```javascript
const CONFIG = {
  USE_MOCK_API: false, // Set to false to enable real HTTP & WS requests
  API_BASE_URL: "https://your-chess-backend.com/api",
  WS_URL: "wss://your-chess-backend.com/ws"
};
```

### Expected REST Endpoints

| Method | Endpoint | Description | Expected Response Format |
|---|---|---|---|
| `GET` | `/user` | Logged-in user data | User object (see schema below) |
| `GET` | `/profile` | User stats & profile | Profile object |
| `PUT` | `/profile` | Update profile info | `{ "success": true, "user": { ... } }` |
| `GET` | `/matches` | User match history | Array of match objects |
| `GET` | `/matches/:id`| Single match details | Single match object with `moves: [...]` |
| `POST`| `/matchmaking/find` | Find opponent | `{ "matchId": "...", "opponent": { ... }, "playerColor": "white" }` |
| `POST`| `/matchmaking/cancel`| Cancel search | `{ "success": true }` |
| `POST`| `/matches/:id/resign` | Resign game | `{ "success": true, "result": "loss" }` |
| `POST`| `/matches/:id/draw/offer` | Offer draw | `{ "success": true }` |

### Match Object Schema (History & Replay)
```json
{
  "id": "match_8921",
  "date": "2026-08-24",
  "time": "21:40",
  "timeControl": "10 min",
  "opponent": {
    "id": "usr_shadow_99",
    "username": "ShadowKnight",
    "rating": 1515,
    "avatarUrl": null,
    "initials": "SK",
    "countryFlag": "🇬🇧"
  },
  "userColor": "white",
  "result": "win",
  "resultType": "Checkmate",
  "eloChange": "+14",
  "moveCount": 16,
  "moves": [
    { "from": "e2", "to": "e4", "piece": "white-pawn", "notation": "e4" },
    { "from": "e7", "to": "e5", "piece": "black-pawn", "notation": "e5" },
    { "from": "g1", "to": "f3", "piece": "white-knight", "notation": "Nf3" }
  ]
}
```

---

## 5. WebSocket Real-Time Multiplayer Protocol

### Location: `OnlineGameAdapter` in [`js/api.js`](file:///c:/Users/princ/OneDrive/Desktop/0dependency/js/api.js)

The `OnlineGameAdapter` manages WebSocket connections and provides event hooks.

### Outgoing Messages (Client -> Server)
```json
// Move made by local player
{
  "type": "MOVE",
  "matchId": "match_8921",
  "move": {
    "from": "e2",
    "to": "e4",
    "piece": "white-pawn",
    "notation": "e4"
  }
}
```

### Incoming Messages (Server -> Client)
```json
// 1. Opponent played a move
{
  "type": "OPPONENT_MOVE",
  "move": {
    "from": "e7",
    "to": "e5",
    "piece": "black-pawn",
    "notation": "e5"
  }
}

// 2. Opponent disconnected
{
  "type": "OPPONENT_DISCONNECTED",
  "matchId": "match_8921"
}

// 3. Match completed
{
  "type": "GAME_OVER",
  "result": {
    "result": "win",
    "title": "CHECKMATE",
    "reason": "You won by checkmate"
  }
}
```

---

## 6. Audio Synthesizer & Local Settings

The application features a zero-dependency Web Audio API synthesizer in [`js/state.js`](file:///c:/Users/princ/OneDrive/Desktop/0dependency/js/state.js):
- `window.AppState.playSound('move')`
- `window.AppState.playSound('capture')`
- `window.AppState.playSound('check')`
- `window.AppState.playSound('win')`
- `window.AppState.playSound('loss')`

User settings (sound, theme, coordinates, move confirmation) are automatically synchronized and persisted in `localStorage`.
