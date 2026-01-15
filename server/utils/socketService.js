// server/utils/socketService.js
// Real-time collaboration service using Socket.IO

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

let io = null;

// Track users in each trip room
const tripRooms = new Map(); // tripId -> Map of { odId, userName, userId }

/**
 * Initialize Socket.IO with the HTTP server
 */
function initializeSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: ['https://eidenz.moe', 'http://localhost:3000', 'https://traveler.eidenz.moe', 'https://hub.eidenz.moe'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        const publicToken = socket.handshake.auth?.publicToken;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                socket.userId = decoded.userId; // JWT stores userId, not id

                // Look up user name from database
                const user = db.prepare('SELECT name FROM users WHERE id = ?').get(decoded.userId);
                socket.userName = user?.name || 'Anonymous';

                next();
            } catch (err) {
                console.error('[Socket] Auth error:', err.message);
                next(new Error('Invalid token'));
            }
        } else if (publicToken) {
            try {
                // Validate public token
                const trip = db.prepare('SELECT id, is_brainstorm_public FROM trips WHERE public_share_token = ?').get(publicToken);

                if (trip) {
                    socket.userId = `public-${socket.id.substring(0, 5)}`; // Temp ID
                    socket.userName = 'Guest'; // Or 'Public Viewer'
                    socket.isPublic = true;
                    socket.publicTripId = trip.id;
                    // Public users are only allowed to see brainstorming if enabled
                    socket.publicBrainstormAllowed = !!trip.is_brainstorm_public;

                    next();
                } else {
                    next(new Error('Invalid public token'));
                }
            } catch (err) {
                console.error('[Socket] Public auth error:', err.message);
                next(new Error('Invalid public token'));
            }
        } else {
            next(new Error('Authentication required'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        // Join a trip room
        socket.on('trip:join', async (tripId) => {
            try {
                // Verify user has access to this trip
                let member = null;

                if (socket.isPublic) {
                    // Public user: check if trip ID matches the token's trip
                    // And check if they are trying to join the trip room 
                    if (socket.publicTripId === tripId) {
                        // Mock member object for public users (read-only viewer)
                        member = { role: 'viewer' };
                    }
                } else {
                    // Authenticated user: check DB
                    member = db.prepare(`
                      SELECT role FROM trip_members 
                      WHERE trip_id = ? AND user_id = ?
                    `).get(tripId, socket.userId);
                }

                if (!member) {
                    socket.emit('error', { message: 'Access denied to this trip' });
                    return;
                }

                const roomName = `trip:${tripId}`;

                // Check if user is already in this room (prevent duplicate notifications)
                const currentMembers = getTripRoomMembers(tripId);
                const alreadyInRoom = currentMembers.some(m => m.userId === socket.userId);

                // Leave any OTHER trip rooms (not the current one if rejoining)
                socket.rooms.forEach(room => {
                    if (room.startsWith('trip:') && room !== roomName) {
                        socket.leave(room);
                        removeFromTripRoom(room.replace('trip:', ''), socket.userId);
                    }
                });

                // If not already in room, join and broadcast
                if (!alreadyInRoom) {
                    // Join the room
                    socket.join(roomName);

                    // Track user in room
                    addToTripRoom(tripId, {
                        socketId: socket.id,
                        userId: socket.userId,
                        userName: socket.userName,
                        role: member.role
                    });

                    // Notify others in the room
                    socket.to(roomName).emit('user:joined', {
                        userId: socket.userId,
                        userName: socket.userName,
                        role: member.role
                    });

                } else {
                    // Just join the room (for this socket) without broadcasting
                    socket.join(roomName);
                    // Update the socket ID for existing user
                    addToTripRoom(tripId, {
                        socketId: socket.id,
                        userId: socket.userId,
                        userName: socket.userName,
                        role: member.role
                    });
                }

                // Send current room members to the joining user
                const roomMembers = getTripRoomMembers(tripId);
                socket.emit('room:members', roomMembers);
            } catch (error) {
                console.error('[Socket] Error joining trip:', error);
                socket.emit('error', { message: 'Failed to join trip room' });
            }
        });

        // Leave a trip room
        socket.on('trip:leave', (tripId) => {
            const roomName = `trip:${tripId}`;
            socket.leave(roomName);
            removeFromTripRoom(tripId, socket.userId);

            socket.to(roomName).emit('user:left', {
                userId: socket.userId,
                userName: socket.userName
            });
        });

        // Brainstorm events
        socket.on('brainstorm:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('brainstorm:created', data.item);
        });

        socket.on('brainstorm:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('brainstorm:updated', data.item);
        });

        socket.on('brainstorm:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('brainstorm:deleted', data.itemId);
        });

        socket.on('brainstorm:move', (data) => {
            socket.to(`trip:${data.tripId}`).emit('brainstorm:moved', {
                itemId: data.itemId,
                position_x: data.position_x,
                position_y: data.position_y
            });
        });

        // Trip data events (activities, lodging, transport)
        socket.on('activity:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('activity:created', data.activity);
        });

        socket.on('activity:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('activity:updated', data.activity);
        });

        socket.on('activity:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('activity:deleted', data.activityId);
        });

        socket.on('lodging:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('lodging:created', data.lodging);
        });

        socket.on('lodging:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('lodging:updated', data.lodging);
        });

        socket.on('lodging:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('lodging:deleted', data.lodgingId);
        });

        socket.on('transport:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('transport:created', data.transport);
        });

        socket.on('transport:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('transport:updated', data.transport);
        });

        socket.on('transport:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('transport:deleted', data.transportId);
        });

        // Trip info update
        socket.on('trip:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('trip:updated', data.trip);
        });

        // Budget events
        socket.on('budget:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('budget:updated', data.budget);
        });

        socket.on('expense:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('expense:created', data.expense);
        });

        socket.on('expense:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('expense:updated', data.expense);
        });

        socket.on('expense:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('expense:deleted', data.expenseId);
        });

        // Checklist events
        socket.on('checklist:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklist:created', data.checklist);
        });

        socket.on('checklist:update', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklist:updated', data.checklist);
        });

        socket.on('checklist:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklist:deleted', data.checklistId);
        });

        socket.on('checklistItem:toggle', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklistItem:toggled', {
                checklistId: data.checklistId,
                itemId: data.itemId,
                checked: data.checked
            });
        });

        socket.on('checklistItem:create', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklistItem:created', {
                checklistId: data.checklistId,
                item: data.item
            });
        });

        socket.on('checklistItem:delete', (data) => {
            socket.to(`trip:${data.tripId}`).emit('checklistItem:deleted', {
                checklistId: data.checklistId,
                itemId: data.itemId
            });
        });

        // Member events
        socket.on('member:add', (data) => {
            socket.to(`trip:${data.tripId}`).emit('member:added', data.member);
        });

        socket.on('member:remove', (data) => {
            socket.to(`trip:${data.tripId}`).emit('member:removed', data.userId);
        });

        socket.on('member:roleChange', (data) => {
            socket.to(`trip:${data.tripId}`).emit('member:roleChanged', {
                userId: data.userId,
                role: data.role
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            // Remove from all trip rooms
            socket.rooms.forEach(room => {
                if (room.startsWith('trip:')) {
                    const tripId = room.replace('trip:', '');
                    removeFromTripRoom(tripId, socket.userId);

                    socket.to(room).emit('user:left', {
                        userId: socket.userId,
                        userName: socket.userName
                    });
                }
            });
        });
    });

    console.log('[Socket] Socket.IO initialized');
    return io;
}

// Helper functions for room tracking
function addToTripRoom(tripId, user) {
    if (!tripRooms.has(tripId)) {
        tripRooms.set(tripId, new Map());
    }
    tripRooms.get(tripId).set(user.userId, user);
}

function removeFromTripRoom(tripId, userId) {
    if (tripRooms.has(tripId)) {
        tripRooms.get(tripId).delete(userId);
        if (tripRooms.get(tripId).size === 0) {
            tripRooms.delete(tripId);
        }
    }
}

function getTripRoomMembers(tripId) {
    if (!tripRooms.has(tripId)) return [];
    return Array.from(tripRooms.get(tripId).values());
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
}

/**
 * Emit an event to all users in a trip room
 */
function emitToTrip(tripId, event, data) {
    if (io) {
        io.to(`trip:${tripId}`).emit(event, data);
    }
}

module.exports = {
    initializeSocket,
    getIO,
    emitToTrip
};
