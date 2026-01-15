// client/src/hooks/useRealtimeUpdates.js
// Hook for subscribing to real-time updates in trip components

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * Hook for real-time trip data updates
 * @param {string} tripId - The trip ID to sync
 * @param {Object} handlers - Event handlers for different data types
 */
export const useRealtimeUpdates = (tripId, handlers = {}) => {
    const { subscribe, emit, isConnected, joinTrip, leaveTrip } = useSocket();
    const previousTripIdRef = useRef(null);

    // Join trip room on mount or when connection is established
    // Only leave when tripId actually changes to a DIFFERENT value
    useEffect(() => {
        if (tripId && isConnected) {
            joinTrip(tripId);
            previousTripIdRef.current = tripId;
        }

        return () => {
            // Only leave the room if we're changing to a different trip
            // The next component mounting with the same tripId will just rejoin silently
            // This prevents the double notification when switching between TripDetail and Brainstorm
        };
    }, [tripId, isConnected, joinTrip]);

    // Handle tripId changes - leave old room when switching trips
    useEffect(() => {
        if (previousTripIdRef.current && tripId && previousTripIdRef.current !== tripId) {
            leaveTrip(previousTripIdRef.current);
            previousTripIdRef.current = tripId;
        }
    }, [tripId, leaveTrip]);

    // Subscribe to all events
    useEffect(() => {
        if (!tripId) return;

        const unsubscribers = [];

        // Brainstorm events
        if (handlers.onBrainstormCreate) {
            unsubscribers.push(subscribe('brainstorm:created', handlers.onBrainstormCreate));
        }
        if (handlers.onBrainstormUpdate) {
            unsubscribers.push(subscribe('brainstorm:updated', handlers.onBrainstormUpdate));
        }
        if (handlers.onBrainstormDelete) {
            unsubscribers.push(subscribe('brainstorm:deleted', handlers.onBrainstormDelete));
        }
        if (handlers.onBrainstormMove) {
            unsubscribers.push(subscribe('brainstorm:moved', handlers.onBrainstormMove));
        }

        // Activity events
        if (handlers.onActivityCreate) {
            unsubscribers.push(subscribe('activity:created', handlers.onActivityCreate));
        }
        if (handlers.onActivityUpdate) {
            unsubscribers.push(subscribe('activity:updated', handlers.onActivityUpdate));
        }
        if (handlers.onActivityDelete) {
            unsubscribers.push(subscribe('activity:deleted', handlers.onActivityDelete));
        }

        // Lodging events
        if (handlers.onLodgingCreate) {
            unsubscribers.push(subscribe('lodging:created', handlers.onLodgingCreate));
        }
        if (handlers.onLodgingUpdate) {
            unsubscribers.push(subscribe('lodging:updated', handlers.onLodgingUpdate));
        }
        if (handlers.onLodgingDelete) {
            unsubscribers.push(subscribe('lodging:deleted', handlers.onLodgingDelete));
        }

        // Transport events
        if (handlers.onTransportCreate) {
            unsubscribers.push(subscribe('transport:created', handlers.onTransportCreate));
        }
        if (handlers.onTransportUpdate) {
            unsubscribers.push(subscribe('transport:updated', handlers.onTransportUpdate));
        }
        if (handlers.onTransportDelete) {
            unsubscribers.push(subscribe('transport:deleted', handlers.onTransportDelete));
        }

        // Trip update
        if (handlers.onTripUpdate) {
            unsubscribers.push(subscribe('trip:updated', handlers.onTripUpdate));
        }

        // Budget events
        if (handlers.onBudgetUpdate) {
            unsubscribers.push(subscribe('budget:updated', handlers.onBudgetUpdate));
        }
        if (handlers.onExpenseCreate) {
            unsubscribers.push(subscribe('expense:created', handlers.onExpenseCreate));
        }
        if (handlers.onExpenseUpdate) {
            unsubscribers.push(subscribe('expense:updated', handlers.onExpenseUpdate));
        }
        if (handlers.onExpenseDelete) {
            unsubscribers.push(subscribe('expense:deleted', handlers.onExpenseDelete));
        }

        // Checklist events
        if (handlers.onChecklistCreate) {
            unsubscribers.push(subscribe('checklist:created', handlers.onChecklistCreate));
        }
        if (handlers.onChecklistUpdate) {
            unsubscribers.push(subscribe('checklist:updated', handlers.onChecklistUpdate));
        }
        if (handlers.onChecklistDelete) {
            unsubscribers.push(subscribe('checklist:deleted', handlers.onChecklistDelete));
        }
        if (handlers.onChecklistItemToggle) {
            unsubscribers.push(subscribe('checklistItem:toggled', handlers.onChecklistItemToggle));
        }
        if (handlers.onChecklistItemCreate) {
            unsubscribers.push(subscribe('checklistItem:created', handlers.onChecklistItemCreate));
        }
        if (handlers.onChecklistItemDelete) {
            unsubscribers.push(subscribe('checklistItem:deleted', handlers.onChecklistItemDelete));
        }

        // Member events
        if (handlers.onMemberAdd) {
            unsubscribers.push(subscribe('member:added', handlers.onMemberAdd));
        }
        if (handlers.onMemberRemove) {
            unsubscribers.push(subscribe('member:removed', handlers.onMemberRemove));
        }
        if (handlers.onMemberRoleChange) {
            unsubscribers.push(subscribe('member:roleChanged', handlers.onMemberRoleChange));
        }

        // Cleanup all subscriptions
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId, subscribe]); // handlers intentionally excluded - should only subscribe once

    // Emit helpers
    const emitBrainstormCreate = useCallback((item) => {
        emit('brainstorm:create', { item });
    }, [emit]);

    const emitBrainstormUpdate = useCallback((item) => {
        emit('brainstorm:update', { item });
    }, [emit]);

    const emitBrainstormDelete = useCallback((itemId) => {
        emit('brainstorm:delete', { itemId });
    }, [emit]);

    const emitBrainstormMove = useCallback((itemId, position_x, position_y) => {
        emit('brainstorm:move', { itemId, position_x, position_y });
    }, [emit]);

    const emitActivityCreate = useCallback((activity) => {
        emit('activity:create', { activity });
    }, [emit]);

    const emitActivityUpdate = useCallback((activity) => {
        emit('activity:update', { activity });
    }, [emit]);

    const emitActivityDelete = useCallback((activityId) => {
        emit('activity:delete', { activityId });
    }, [emit]);

    const emitLodgingCreate = useCallback((lodging) => {
        emit('lodging:create', { lodging });
    }, [emit]);

    const emitLodgingUpdate = useCallback((lodging) => {
        emit('lodging:update', { lodging });
    }, [emit]);

    const emitLodgingDelete = useCallback((lodgingId) => {
        emit('lodging:delete', { lodgingId });
    }, [emit]);

    const emitTransportCreate = useCallback((transport) => {
        emit('transport:create', { transport });
    }, [emit]);

    const emitTransportUpdate = useCallback((transport) => {
        emit('transport:update', { transport });
    }, [emit]);

    const emitTransportDelete = useCallback((transportId) => {
        emit('transport:delete', { transportId });
    }, [emit]);

    const emitTripUpdate = useCallback((trip) => {
        emit('trip:update', { trip });
    }, [emit]);

    const emitBudgetUpdate = useCallback((budget) => {
        emit('budget:update', { budget });
    }, [emit]);

    const emitExpenseCreate = useCallback((expense) => {
        emit('expense:create', { expense });
    }, [emit]);

    const emitExpenseUpdate = useCallback((expense) => {
        emit('expense:update', { expense });
    }, [emit]);

    const emitExpenseDelete = useCallback((expenseId) => {
        emit('expense:delete', { expenseId });
    }, [emit]);

    const emitChecklistCreate = useCallback((checklist) => {
        emit('checklist:create', { checklist });
    }, [emit]);

    const emitChecklistUpdate = useCallback((checklist) => {
        emit('checklist:update', { checklist });
    }, [emit]);

    const emitChecklistDelete = useCallback((checklistId) => {
        emit('checklist:delete', { checklistId });
    }, [emit]);

    const emitChecklistItemToggle = useCallback((checklistId, itemId, checked) => {
        emit('checklistItem:toggle', { checklistId, itemId, checked });
    }, [emit]);

    const emitChecklistItemCreate = useCallback((checklistId, item) => {
        emit('checklistItem:create', { checklistId, item });
    }, [emit]);

    const emitChecklistItemDelete = useCallback((checklistId, itemId) => {
        emit('checklistItem:delete', { checklistId, itemId });
    }, [emit]);

    const emitMemberAdd = useCallback((member) => {
        emit('member:add', { member });
    }, [emit]);

    const emitMemberRemove = useCallback((userId) => {
        emit('member:remove', { userId });
    }, [emit]);

    const emitMemberRoleChange = useCallback((userId, role) => {
        emit('member:roleChange', { userId, role });
    }, [emit]);

    return {
        isConnected,
        // Brainstorm emitters
        emitBrainstormCreate,
        emitBrainstormUpdate,
        emitBrainstormDelete,
        emitBrainstormMove,
        // Activity emitters
        emitActivityCreate,
        emitActivityUpdate,
        emitActivityDelete,
        // Lodging emitters
        emitLodgingCreate,
        emitLodgingUpdate,
        emitLodgingDelete,
        // Transport emitters
        emitTransportCreate,
        emitTransportUpdate,
        emitTransportDelete,
        // Trip emitters
        emitTripUpdate,
        // Budget emitters
        emitBudgetUpdate,
        emitExpenseCreate,
        emitExpenseUpdate,
        emitExpenseDelete,
        // Checklist emitters
        emitChecklistCreate,
        emitChecklistUpdate,
        emitChecklistDelete,
        emitChecklistItemToggle,
        emitChecklistItemCreate,
        emitChecklistItemDelete,
        // Member emitters
        emitMemberAdd,
        emitMemberRemove,
        emitMemberRoleChange
    };
};

export default useRealtimeUpdates;
