import { decodeFrame, encodeFrame, OPCODES } from "./frame.js";
import { handleMessage } from "./messageHandler.js";

import { requireAuth } from "../middleware/require-auth.js";

const rooms = new Map();

export async function handleConnection(socket, req) {

    console.log("New WebSocket connection");

    // =========================================================
    // AUTHENTICATE WEBSOCKET CONNECTION
    // =========================================================

    const authenticated = await requireAuth(req);

    if (!authenticated) {
        console.log("WebSocket authentication failed");

        socket.end();
        return;
    }

    // req.user and req.session were populated by requireAuth()
    socket.userId = req.user.id;
    socket.sessionId = req.session.id;

    console.log("WebSocket authenticated:", socket.userId);


    // =========================================================
    // HANDLE DATA
    // =========================================================

    socket.on("data", async (buffer) => {

        try {

            const { opcode, payload } = decodeFrame(buffer);


            // =================================================
            // CLOSE
            // =================================================

            if (opcode === OPCODES.CLOSE) {

                socket.end();
                return;
            }


            // =================================================
            // PING
            // =================================================

            if (opcode === OPCODES.PING) {

                socket.write(
                    encodeFrame("", OPCODES.PONG)
                );

                return;
            }


            // =================================================
            // TEXT MESSAGE
            // =================================================

            if (opcode === OPCODES.TEXT) {

                const message = payload.toString("utf-8");

                await handleMessage(
                    socket,
                    message,
                    rooms
                );
            }

        } catch (error) {

            console.error(
                "Failed to process frame:",
                error
            );

        }

    });


    // =========================================================
    // CONNECTION CLOSED
    // =========================================================

    socket.on("close", () => {

        removeFromAllRooms(socket);

        console.log(
            "WebSocket connection closed:",
            socket.userId
        );

    });


    // =========================================================
    // SOCKET ERROR
    // =========================================================

    socket.on("error", (error) => {

        console.error(
            "Socket error:",
            error
        );

        removeFromAllRooms(socket);
    });
}


// =============================================================
// JOIN ROOM
// =============================================================

export function joinRoom(gameId, socket) {

    if (!rooms.has(gameId)) {
        rooms.set(gameId, new Set());
    }

    rooms.get(gameId).add(socket);
}


// =============================================================
// BROADCAST
// =============================================================

export function broadcastToRoom(
    gameId,
    data,
    excludeSocket = null
) {

    const room = rooms.get(gameId);

    if (!room) {
        return;
    }

    const frame = encodeFrame(
        JSON.stringify(data)
    );

    for (const client of room) {

        if (
            client !== excludeSocket &&
            !client.destroyed
        ) {

            client.write(frame);
        }
    }
}


// =============================================================
// REMOVE SOCKET FROM ALL ROOMS
// =============================================================

function removeFromAllRooms(socket) {

    for (const [gameId, sockets] of rooms.entries()) {

        sockets.delete(socket);

        if (sockets.size === 0) {
            rooms.delete(gameId);
        }
    }
}


// =============================================================
// CLOSE ROOM
// =============================================================

export function closeRoom(gameId) {

    const room = rooms.get(gameId);

    if (!room) {
        return;
    }

    for (const socket of room) {

        if (!socket.destroyed) {
            socket.end();
        }
    }

    rooms.delete(gameId);
}