import { encodeFrame } from "./frame.js";

import {
    joinRoom,
    broadcastToRoom,
    closeRoom
} from "./connectionManager.js";

import { findMatch } from "../game/matchmaking.js";

import * as GameAdapter from "../game/game-adapter.js";


// gameId -> userId who offered the draw
const drawOffers = new Map();


function sendMessage(socket, data) {
    if (socket.destroyed) {
        return;
    }

    socket.write(
        encodeFrame(JSON.stringify(data))
    );
}


export async function handleMessage(socket, rawMessage, rooms) {

    // =========================================================
    // AUTHENTICATION
    // =========================================================

    if (!socket.userId) {
        sendMessage(socket, {
            type: "error",
            error: "Authentication required"
        });

        return;
    }


    // =========================================================
    // PARSE JSON
    // =========================================================

    let message;

    try {
        message = JSON.parse(rawMessage);
    } catch {
        sendMessage(socket, {
            type: "error",
            error: "Invalid JSON message"
        });

        return;
    }


    const { type } = message;


    // =========================================================
    // HANDLE MESSAGE
    // =========================================================

    switch (type) {

        // =====================================================
        // FIND MATCH
        // =====================================================

        case "find_match": {

            // Player is already in a game
            if (socket.gameId) {
                sendMessage(socket, {
                    type: "error",
                    error: "You are already in a game"
                });

                break;
            }


            // Find opponent
            const match = findMatch({
                socket
            });


            // No opponent available
            if (!match.matched) {

                sendMessage(socket, {
                    type: "waiting",
                    message: "Waiting for opponent"
                });

                break;
            }


            // =================================================
            // CREATE GAME
            // =================================================

            const game = await GameAdapter.createGame();

            if (!game.success) {

                sendMessage(socket, {
                    type: "error",
                    error: game.error
                });

                break;
            }


            const gameId = game.gameId;

            const player1 = match.player1.socket;
            const player2 = match.player2.socket;


            // =================================================
            // JOIN BOTH PLAYERS TO ROOM
            // =================================================

            joinRoom(gameId, player1);
            joinRoom(gameId, player2);


            // =================================================
            // STORE GAME DATA ON SOCKET
            // =================================================

            player1.gameId = gameId;
            player2.gameId = gameId;

            player1.color = "W";
            player2.color = "B";


            // Clear old draw state
            player1.drawOffered = false;
            player2.drawOffered = false;

            drawOffers.delete(gameId);


            // =================================================
            // GAME START - PLAYER 1
            // =================================================

            sendMessage(player1, {
                type: "game_start",
                gameId,
                color: "W"
            });


            // =================================================
            // GAME START - PLAYER 2
            // =================================================

            sendMessage(player2, {
                type: "game_start",
                gameId,
                color: "B"
            });


            break;
        }


        // =====================================================
        // MOVE
        // =====================================================

        case "move": {

            if (!socket.gameId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You are not in a game"
                });

                break;
            }


            const gameId = socket.gameId;


            // IMPORTANT:
            // gameId comes from socket, NOT from client message
            const result = await GameAdapter.makeMove(
                gameId,
                message.move
            );


            // =================================================
            // INVALID MOVE
            // =================================================

            if (!result.success) {

                sendMessage(socket, {
                    type: "invalid_move",
                    error: result.error,
                    state: result.state
                });

                break;
            }


            // =================================================
            // CHECKMATE
            // moveResult = 10
            // =================================================

            if (result.moveResult === 10) {

                broadcastToRoom(gameId, {
                    type: "game_over",
                    move: message.move,
                    state: result.state,
                    result: "checkmate",
                    gameResult: result.gameResult,
                    winnerId: result.winnerId
                });


                drawOffers.delete(gameId);


                setTimeout(async () => {

                    closeRoom(gameId);

                    try {
                        await GameAdapter.deleteGame(gameId);
                    } catch (error) {
                        console.error(
                            "Failed to delete game:",
                            error
                        );
                    }

                    drawOffers.delete(gameId);

                }, 100);


                break;
            }


            // =================================================
            // STALEMATE
            // moveResult = 1
            // =================================================

            if (result.moveResult === 1) {

                broadcastToRoom(gameId, {
                    type: "game_over",
                    move: message.move,
                    state: result.state,
                    result: "stalemate",
                    gameResult: result.gameResult,
                    winnerId: null
                });


                drawOffers.delete(gameId);


                setTimeout(async () => {

                    closeRoom(gameId);

                    try {
                        await GameAdapter.deleteGame(gameId);
                    } catch (error) {
                        console.error(
                            "Failed to delete game:",
                            error
                        );
                    }

                    drawOffers.delete(gameId);

                }, 100);


                break;
            }


            // =================================================
            // NORMAL MOVE / CAPTURE
            // 2 = normal move
            // 5 = capture
            // =================================================

            if (
                result.moveResult === 2 ||
                result.moveResult === 5
            ) {

                broadcastToRoom(gameId, {
                    type: "move",
                    move: message.move,
                    state: result.state,
                    result: result.moveResult
                });

                break;
            }


            break;
        }


        // =====================================================
        // RESIGN
        // =====================================================

        case "resign": {

            if (!socket.gameId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You are not in a game"
                });

                break;
            }


            const gameId = socket.gameId;


            // IMPORTANT:
            // userId comes from authenticated socket
            // NOT from client message
            const result = await GameAdapter.resignGame(
                gameId,
                socket.userId
            );


            if (!result.success) {

                sendMessage(socket, {
                    type: "error",
                    error: result.error
                });

                break;
            }


            broadcastToRoom(gameId, {
                type: "game_over",
                result: result.result,
                winnerId: result.winnerId,
                reason: "resignation"
            });


            drawOffers.delete(gameId);


            setTimeout(async () => {

                closeRoom(gameId);

                try {
                    await GameAdapter.deleteGame(gameId);
                } catch (error) {
                    console.error(
                        "Failed to delete game:",
                        error
                    );
                }

                drawOffers.delete(gameId);

            }, 100);


            break;
        }


        // =====================================================
        // DRAW OFFER
        // =====================================================

        case "draw_offer": {

            if (!socket.gameId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You are not in a game"
                });

                break;
            }


            const gameId = socket.gameId;


            // Already an offer pending
            if (drawOffers.has(gameId)) {

                sendMessage(socket, {
                    type: "error",
                    error: "A draw offer is already pending"
                });

                break;
            }


            // Store the authenticated user who made the offer
            drawOffers.set(
                gameId,
                socket.userId
            );


            // Send offer to opponent only
            broadcastToRoom(
                gameId,
                {
                    type: "draw_offer",
                    playerId: socket.userId
                },
                socket
            );


            // Optional confirmation to sender
            sendMessage(socket, {
                type: "draw_offer_sent"
            });


            break;
        }


        // =====================================================
        // DRAW ACCEPT
        // =====================================================

        case "draw_accept": {

            if (!socket.gameId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You are not in a game"
                });

                break;
            }


            const gameId = socket.gameId;

            const offeredBy = drawOffers.get(gameId);


            // No pending offer
            if (!offeredBy) {

                sendMessage(socket, {
                    type: "error",
                    error: "No draw offer is pending"
                });

                break;
            }


            // Player cannot accept their own offer
            if (offeredBy === socket.userId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You cannot accept your own draw offer"
                });

                break;
            }


            // =================================================
            // DRAW ACCEPTED
            // =================================================

            broadcastToRoom(gameId, {
                type: "game_over",
                result: "draw",
                reason: "agreement",
                winnerId: null
            });


            drawOffers.delete(gameId);


            setTimeout(async () => {

                closeRoom(gameId);

                try {
                    await GameAdapter.deleteGame(gameId);
                } catch (error) {
                    console.error(
                        "Failed to delete game:",
                        error
                    );
                }

                drawOffers.delete(gameId);

            }, 100);


            break;
        }


        // =====================================================
        // DRAW REJECT
        // =====================================================

        case "draw_reject": {

            if (!socket.gameId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You are not in a game"
                });

                break;
            }


            const gameId = socket.gameId;

            const offeredBy = drawOffers.get(gameId);


            // No pending offer
            if (!offeredBy) {

                sendMessage(socket, {
                    type: "error",
                    error: "No draw offer is pending"
                });

                break;
            }


            // Player cannot reject own offer
            if (offeredBy === socket.userId) {

                sendMessage(socket, {
                    type: "error",
                    error: "You cannot reject your own draw offer"
                });

                break;
            }


            drawOffers.delete(gameId);


            broadcastToRoom(gameId, {
                type: "draw_rejected"
            });


            break;
        }


        // =====================================================
        // UNKNOWN MESSAGE
        // =====================================================

        default: {

            sendMessage(socket, {
                type: "error",
                error: `Unknown message type: ${type}`
            });

            break;
        }
    }
}