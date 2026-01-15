// client/src/contexts/SocketContext.jsx
// Real-time collaboration context using Socket.IO

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const SocketContext = createContext(null);

// Get the socket URL
// In development, Vite proxies /socket.io to the backend
// In production, we connect to the same origin where the app is served
const getSocketUrl = () => {
    // If VITE_API_URL is set and we're in production, extract the base URL
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && import.meta.env.PROD) {
        // Remove /api from the end if present
        return apiUrl.replace(/\/api\/?$/, '');
    }
    // In development or if no API URL set, use same origin (Vite proxy handles it)
    return undefined; // Socket.IO will default to current origin
};

export const SocketProvider = ({ children }) => {
    const { t } = useTranslation();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomMembers, setRoomMembers] = useState([]);
    const [currentTripId, setCurrentTripId] = useState(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Initialize socket connection
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        const socketUrl = getSocketUrl();
        console.log('[Socket] Connecting to:', socketUrl);

        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            console.log('[Socket] Connected');
            setIsConnected(true);
            reconnectAttempts.current = 0;

            // Rejoin current trip room if we were in one
            if (currentTripId) {
                newSocket.emit('trip:join', currentTripId);
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
            setRoomMembers([]);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            reconnectAttempts.current++;

            if (reconnectAttempts.current >= maxReconnectAttempts) {
                console.log('[Socket] Max reconnection attempts reached');
            }
        });

        newSocket.on('error', (error) => {
            console.error('[Socket] Error:', error.message);
        });

        // Room membership updates
        newSocket.on('room:members', (members) => {
            setRoomMembers(members);
        });

        newSocket.on('user:joined', (user) => {
            setRoomMembers(prev => {
                // Don't add if already exists
                if (prev.some(m => m.userId === user.userId)) return prev;
                return [...prev, user];
            });

            // Show subtle notification
            toast(t('realtime.userJoined', '{{name}} joined', { name: user.userName }), {
                icon: '👋',
                duration: 2000,
                style: {
                    background: '#10B981',
                    color: '#fff',
                    fontSize: '14px',
                    padding: '8px 12px'
                }
            });
        });

        newSocket.on('user:left', (user) => {
            setRoomMembers(prev => prev.filter(m => m.userId !== user.userId));
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    // Join a trip room
    const joinTrip = useCallback((tripId) => {
        if (socket && isConnected && tripId) {
            console.log('[Socket] Joining trip:', tripId);
            socket.emit('trip:join', tripId);
            setCurrentTripId(tripId);
        }
    }, [socket, isConnected]);

    // Leave current trip room
    const leaveTrip = useCallback(() => {
        if (socket && currentTripId) {
            console.log('[Socket] Leaving trip:', currentTripId);
            socket.emit('trip:leave', currentTripId);
            setCurrentTripId(null);
            setRoomMembers([]);
        }
    }, [socket, currentTripId]);

    // Emit event wrappers
    const emit = useCallback((event, data) => {
        if (socket && isConnected) {
            socket.emit(event, { ...data, tripId: currentTripId });
        }
    }, [socket, isConnected, currentTripId]);

    // Subscribe to real-time events
    const subscribe = useCallback((event, callback) => {
        if (socket) {
            socket.on(event, callback);
            return () => socket.off(event, callback);
        }
        return () => { };
    }, [socket]);

    const value = {
        socket,
        isConnected,
        roomMembers,
        currentTripId,
        joinTrip,
        leaveTrip,
        emit,
        subscribe
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

// Hook to use socket context
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

// Hook for trip-specific real-time features
export const useTripSocket = (tripId) => {
    const { joinTrip, leaveTrip, emit, subscribe, isConnected, roomMembers } = useSocket();

    // Join/leave trip room on mount/unmount
    useEffect(() => {
        if (tripId) {
            joinTrip(tripId);
        }
        return () => {
            leaveTrip();
        };
    }, [tripId, joinTrip, leaveTrip]);

    return {
        isConnected,
        roomMembers,
        emit,
        subscribe
    };
};

export default SocketContext;
