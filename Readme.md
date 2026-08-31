# ♟️ Zero-Dependency Multiplayer Chess Backend

A real-time multiplayer chess backend built entirely with **Node.js standard-library APIs**.

The project provides user authentication, session management, matchmaking, real-time multiplayer gameplay, chess move validation, game state management, draw handling, resignation, and game results — **without using any third-party runtime packages**.

The goal is simple:

> Build something that would normally be expected to require several npm packages, while using only what Node.js provides out of the box.

---

## ✨ Features

### 🔐 Custom Authentication

The backend implements its own authentication system instead of relying on authentication libraries.

* User registration
* Password hashing using Node's built-in `crypto`
* Login
* Session creation
* Session validation
* Authentication middleware
* Current-user endpoint
* Logout
* Invalid-session detection

Authentication is session-based using a `sessionId` cookie and a session automatically expires after one day.

---

### ♟️ Multiplayer Chess

Players can play chess against another online player in real time.

The server handles:

* Matchmaking
* Game creation
* Player color assignment
* Turn management
* Move validation
* Board state
* Checkmate detection
* Stalemate detection
* Resignation
* Draw offers
* Draw acceptance
* Draw rejection
* Game completion
* Winner determination

Players do not need to manually create or exchange a game ID when using matchmaking , we have created a simple findmatching logic for this.

---

### ⚡ Real-Time WebSocket Communication

The project implements its own WebSocket communication layer using Node.js built-ins.

Instead of using packages such as:

* `ws`
* `socket.io`

the project handles the required WebSocket communication itself.

The server:

1. Accepts a WebSocket upgrade request.
2. Authenticates the connection.
3. Associates the socket with the authenticated user.
4. Places players into game rooms.
5. Receives client messages.
6. Processes chess actions.
7. Broadcasts game updates to the appropriate players.

---

### 🧩 Custom WebSocket Frames

The project also contains its own frame encoding/decoding implementation.

This allows the server to process WebSocket frames without depending on a WebSocket npm package.

The implementation supports the communication required by the chess application, including text messages and control messages.

---

## 🏗️ Architecture

The backend is organized into separate modules for authentication, HTTP routing, game management, WebSocket communication, storage, and chess logic.

Project Root folder structure
```text
zero_dependency backend/
│
├── data/
│
├── src/
│   │
│   ├── auth/
│   │   └── auth-controller.js
│   │
│   ├── game/
│   │   ├── game-adapter.js
│   │   ├── game-controller.js
│   │   └── matchmaking.js
│   │
│   ├── game-manager/
│   │   └── game/
│   │       ├── board.js
│   │       ├── check.js
│   │       ├── index.js
│   │       ├── pieces.js
│   │       ├── readme.md
│   │       └── validateMoves.js
│   │
│   ├── http/
│   │   └── router.js
│   │
│   ├── middleware/
│   │   └── require-auth.js
│   │
│   ├── storage/
│   │   ├── game-store.js
│   │   ├── session-store.js
│   │   └── user-store.js
│   │
│   ├── utils/
│   │   ├── api-response.js
│   │   ├── async-handler.js
│   │   ├── body-parser.js
│   │   ├── cookie-utils.js
│   │   ├── create-id.js
│   │   ├── password-utils.js
│   │   └── session-utils.js
│   │
│   ├── web-socket/
│   │   ├── connectionManager.js
│   │   ├── frame.js
│   │   ├── messageHandler.js
│   │   └── webSocketServer.js
│   │
│   └── server.js
│
├── .zero-dep.toml
├── deps-proof.txt
├── package.json
├── Readme.md
└── STDLIB.md

```




The exact directory structure may vary slightly as the project evolves.

---

# 🔄 Multiplayer Flow

A typical multiplayer game works like this:

```text
Player A
   │
   │ Register / Login
   ▼
Session created
   │
   │ WebSocket + sessionId
   ▼
Authenticated WebSocket
   │
   │ find_match
   ▼
Waiting for opponent
   │
   │
Player B ────────────────┐
                         │
                         ▼
                    Match found
                         │
                         ▼
                    Game created
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        Player A                  Player B
           W                         B
             │                       │
             └────── Chess moves ───┘
                         │
                         ▼
                  Game finishes
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Checkmate   Stalemate  Resignation
```

---

# 🔐 Authentication Flow

Authentication is implemented without an authentication framework.

### Registration

```http
POST /api/auth/register
```

Example:

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "password123"
}
```

The password is hashed using Node's built-in `crypto` module before being stored.

---

### Login

```http
POST /api/auth/login
```

Example:

```json
{
  "email": "alice@example.com",
  "password": "password123"
}
```

A successful login creates a session and returns a session identifier.

---

### Authenticated Requests

Protected HTTP endpoints require:

```http
Cookie: sessionId=<session-id>
```

The authentication middleware:

1. Reads the session cookie.
2. Looks up the session.
3. Finds the associated user.
4. Attaches the user and session to the request.
5. Allows the request to continue.

---

# 🌐 HTTP API

### Health Check

```http
GET /health
```

Used to verify that the server is running.

---

### Test Route

```http
GET /api/test
```

Used to verify that HTTP routing is working.

---

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

---

### Games

```http
GET /api/games
GET /api/games/:gameId
```

Game endpoints require authentication.

---

# ♟️ WebSocket Protocol

After authentication, players communicate with the server using WebSocket messages.

## Find Match

```json
{
  "type": "find_match"
}
```

If no opponent is available:

```json
{
  "type": "waiting"
}
```

When another player joins, both players receive a `game_start` message containing the game information and assigned color.

---

## Make a Move

```json
{
  "type": "move",
  "move": {
    "from": "e2",
    "to": "e4"
  }
}
```

The backend validates the move and updates the game state.

The resulting move is then sent to the players in the game room.

---

## Resign

```json
{
  "type": "resign"
}
```

The game is finished with resignation as the finishing reason.

---

## Offer Draw

```json
{
  "type": "draw_offer"
}
```

---

## Accept Draw

```json
{
  "type": "draw_accept"
}
```

---

## Reject Draw

```json
{
  "type": "draw_reject"
}
```

---

# 🧠 Game State

Each game maintains information such as:

```json
{
  "id": "game-id",
  "whitePlayerId": "player-id",
  "blackPlayerId": "player-id",
  "status": "active",
  "board": {},
  "turn": "white",
  "winnerId": null,
  "result": null,
  "finishedReason": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

The live chess game is maintained in memory while the persistent game representation is stored separately.

This allows the chess engine to operate efficiently while retaining game information.

---


# 📦 Zero Dependencies

This project intentionally contains **zero third-party runtime dependencies**.

The dependency manifest is empty:

```json
{
  "dependencies": {}
}
```

The application relies only on Node.js built-in modules.

Examples include:

```text
node:crypto
node:fs
node:http
node:net
node:path
node:test
node:assert
```

No npm package is required to run the backend.

---

# 🧾 Dependency Proof

To verify the runtime dependency count:

```bash
npm ls --omit=dev
```

The project should report no installed runtime dependencies.

The package manifest can also be inspected directly:

```bash
npm pkg get dependencies
```

Expected result:

```text
{}
```

The project intentionally keeps its runtime dependency surface at zero.

---

# 🚀 Getting Started

## Requirements

* Node.js
* Git

No `npm install` is required for runtime dependencies.

Clone the repository:

```bash
git clone <your-repository-url>
cd zero-dependency-backend
```

Start the server:

```bash
npm start
```

The server will start on the configured port.

---

# 🛠️ Build / Run

The project does not require a compilation step because it runs directly on Node.js.

Start the application with:

```bash
npm start
```

Run tests with:

```bash
npm test
```

---

# 📁 Storage

The project uses local file-based storage rather than requiring an external database.

This keeps the application completely self-contained.

Stored information includes:

* Users
* Sessions
* Games

This approach eliminates the need for database drivers and external database dependencies.

---




# ⚠️ Current Limitations

This project intentionally prioritizes the zero-dependency constraint.

Current limitations include:



* Local file-based persistence rather than a production database.
* It accepts request from every frontend.
* Its castling in game-manager logic is not working correctly if king and rook are on same position again or after king movement after that also it will allow castling.
* It doesn't closes session when user leave the browser.
* If one player left the game, then second player remain in game it doesn't declare the second player winner.
* Expired Sessions are not cleared from the session.json nad there is a bug in Session expiry also.
* No option for user to delete account.
* Live game state is maintained in memory.
* Running multiple backend instances would require shared state.
* We are unable to include test in it due to time constaraints but we have tested this backend on postman.
* The custom WebSocket implementation is designed specifically for this application rather than being a complete general-purpose WebSocket library.
* Authentication is custom-built and should receive additional security hardening before production use.
* Password hashing currently uses the built-in cryptographic primitives and is not intended as a replacement for a production-grade password-hashing strategy without further hardening.

These limitations are documented intentionally rather than hidden.

---

# 🎯 Why we Buit this

This isn't a demonstration that merely proves JavaScript can run without npm packages.

The resulting backend provides the core infrastructure required for an actual online chess application:

```text
Authentication
      +
Session management
      +
Authenticated WebSockets
      +
Matchmaking
      +
Real-time communication
      +
Chess rules
      +
Game state
      +
Game results
      =
Multiplayer Chess Backend
```

A frontend can connect to this backend and provide the user-facing chess board and controls.

---

# 🏆 Zero-Dependency Track

**Track:** Open / Wildcard

**Pitch:**

> **A complete real-time multiplayer chess backend built from Node.js standard-library primitives — including custom authentication, WebSocket communication, matchmaking, game management, and testing — with zero third-party runtime dependencies.**

---

# 📜 License

Add your chosen license here.
