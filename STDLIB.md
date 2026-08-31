# STDLIB.md

## Zero-Dependency Implementation

This project was built for the **Open / Wildcard Zero-Dependency** track.

The backend has **zero third-party runtime dependencies**. Everything required to run the application is implemented using Node.js built-in modules and code written specifically for this project.

The goal was not to replace packages just for the sake of having an empty `package.json`. We implemented the core functionality ourselves where a typical Node.js project would normally depend on external packages.

---

## Dependency Substitutions

| What we might normally use    | What we use instead                                           | Why |
|---|---|---|
| Express                       | `node:http` + custom router                                   | HTTP server and routing |
| `bcrypt` / password library   | `node:crypto`                                                 | Password hashing |
| `uuid`                        | Custom `createId()` using Node APIs                           | Generating unique IDs |
| `ws`                          | `node:http` + `node:crypto` + custom WebSocket implementation | WebSocket communication |
| Socket.IO                     | Custom WebSocket message protocol + room manager              | Real-time multiplayer communication |
| Database driver               | `node:fs/promises` + JSON files                               | Persistent local storage |

| WebSocket test library        | `node:net` + custom WebSocket test client                     | WebSocket testing |

---

# Node.js Standard Library

## `node:http`

Used for the HTTP server and HTTP communication.

The project uses Node's built-in HTTP functionality instead of an external framework such as Express.

Used for:

- Creating the HTTP server
- Receiving HTTP requests
- Sending HTTP responses
- Handling API requests
- HTTP testing

---

## `node:crypto`

Used for cryptographic operations.

The authentication system uses Node's built-in cryptography instead of a third-party authentication or password library.

Used for:

- Password hashing
- Generating cryptographically strong session tokens
- WebSocket handshake-related cryptographic operations

For example, session tokens are generated using:

```js
crypto.randomBytes(32).toString("hex")