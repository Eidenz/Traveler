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
    const [publicToken, setPublicToken] = useState(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Refs to track current values for event handlers (avoid stale closures)
    const currentTripIdRef = useRef(null);
    const socketRef = useRef(null);

    // Initialize socket connection
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        const socketUrl = getSocketUrl();

        // Prioritize publicToken if set (e.g. explicitly requested by a public view component)
        const authOptions = publicToken ? { publicToken } : (token ? { token } : null);

        if (!authOptions) return;

        const newSocket = io(socketUrl, {
            auth: authOptions,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            reconnectAttempts.current = 0;

            // Rejoin current trip room if we were in one
            if (currentTripId) {
                newSocket.emit('trip:join', currentTripId);
            }
        });

        newSocket.on('disconnect', (reason) => {
            setIsConnected(false);
            setRoomMembers([]);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            reconnectAttempts.current++;
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
        socketRef.current = newSocket;

        // Handle browser close/refresh - emit leave before closing
        const handleBeforeUnload = () => {
            if (currentTripIdRef.current && socketRef.current) {
                socketRef.current.emit('trip:leave', currentTripIdRef.current);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Emit leave when socket is being closed
            if (currentTripIdRef.current && newSocket) {
                newSocket.emit('trip:leave', currentTripIdRef.current);
            }
            newSocket.close();
        };
    }, [publicToken]); // Re-run if publicToken changes (or initial mount checks local token)

    // Join a trip room
    const joinTrip = useCallback((tripId) => {
        if (socket && isConnected && tripId) {
            // Only join if not already in this room
            if (currentTripId === tripId) {
                return;
            }
            socket.emit('trip:join', tripId);
            setCurrentTripId(tripId);
            currentTripIdRef.current = tripId; // Keep ref in sync
        }
    }, [socket, isConnected, currentTripId]);

    // Leave current trip room - only call when actually navigating away from all trip pages
    const leaveTrip = useCallback((forceTripId = null) => {
        const tripIdToLeave = forceTripId || currentTripId;
        if (socket && tripIdToLeave) {
            socket.emit('trip:leave', tripIdToLeave);
            if (!forceTripId || forceTripId === currentTripId) {
                setCurrentTripId(null);
                currentTripIdRef.current = null; // Keep ref in sync
                setRoomMembers([]);
            }
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

    const connectWithPublicToken = useCallback((token) => {
        setPublicToken(token);
    }, []);

    const value = {
        socket,
        isConnected,
        roomMembers,
        currentTripId,
        joinTrip,
        leaveTrip,
        emit,
        subscribe,
        connectWithPublicToken
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
    const { joinTrip, emit, subscribe, isConnected, roomMembers } = useSocket();

    // Join/leave trip room - only join, don't leave on unmount
    // This prevents double notifications when switching between trip pages
    useEffect(() => {
        if (tripId) {
            joinTrip(tripId);
        }
        // Don't call leaveTrip on unmount - handled by useRealtimeUpdates or when navigating away
    }, [tripId, joinTrip]);

    return {
        isConnected,
        roomMembers,
        emit,
        subscribe
    };
};

// Hook to watch route changes and leave trip room when navigating away from trip pages
// Use this in the main layout component
export const useSocketRouteWatcher = (pathname) => {
    const { leaveTrip, currentTripId } = useSocket();
    const previousPathRef = useRef(pathname);

    // Helper to check if a path is a trip-related page
    const isTripRelatedPage = (path) => {
        return path?.includes('/trips/') ||
            path?.includes('/brainstorm') ||
            path?.includes('/budgets/');
    };

    useEffect(() => {
        const previousPath = previousPathRef.current;
        const wasTripPage = isTripRelatedPage(previousPath);
        const isTripPage = isTripRelatedPage(pathname);

        // If we were on a trip page and now we're not, leave the room
        if (wasTripPage && !isTripPage && currentTripId) {
            leaveTrip();
        }

        previousPathRef.current = pathname;
    }, [pathname, leaveTrip, currentTripId]);
};

export default SocketContext;
