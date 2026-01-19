// client/src/pages/trips/Brainstorm.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Plus, MapPin, FileText, Image, Link2, Lightbulb,
    Trash2, Edit3, GripVertical, X, ZoomIn, ZoomOut, Move, Map, Grid
} from 'lucide-react';
import { tripAPI, brainstormAPI } from '../../services/api';
import BrainstormCanvas from '../../components/brainstorm/BrainstormCanvas';
import BrainstormMap from '../../components/brainstorm/BrainstormMap';
import BrainstormItemModal from '../../components/brainstorm/BrainstormItemModal';
import Button from '../../components/ui/Button';
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';
import { useSocket } from '../../contexts/SocketContext';

// Item type configuration
const ITEM_TYPES = {
    place: { icon: MapPin, color: 'teal', label: 'Place' },
    note: { icon: FileText, color: 'amber', label: 'Note' },
    image: { icon: Image, color: 'purple', label: 'Image' },
    link: { icon: Link2, color: 'emerald', label: 'Link' },
    idea: { icon: Lightbulb, color: 'rose', label: 'Quick Idea' },
};

const Brainstorm = ({ tripId: propTripId, fromDashboard = false }) => {
    const { t } = useTranslation();
    const { tripId: urlTripId, token } = useParams();
    const tripId = propTripId || urlTripId;
    const navigate = useNavigate();
    const containerRef = useRef(null);
    const mapRef = useRef(null); // Store map instance for external control

    // State
    const [trip, setTrip] = useState(null);
    const [members, setMembers] = useState([]);
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]); // Visual groups
    const [loading, setLoading] = useState(true);
    const [isResizing, setIsResizing] = useState(false);
    const [panelWidth, setPanelWidth] = useState(() => {
        const saved = localStorage.getItem('brainstormPanelWidth');
        return saved ? parseInt(saved, 10) : 500;
    });

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [modalDefaultType, setModalDefaultType] = useState('idea');
    const [modalDefaultLocation, setModalDefaultLocation] = useState(null);

    // Quick add menu state (for map clicks)
    const [quickAddMenu, setQuickAddMenu] = useState(null);

    // Canvas state
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [canvasZoom, setCanvasZoom] = useState(1);

    // Mobile split view state - 3 states: 'canvas' (full canvas), 'split' (default), 'map' (full map)
    const [mobileViewState, setMobileViewState] = useState('split'); // 'canvas' | 'split' | 'map'
    const latchDragStartY = useRef(0);
    const isDraggingLatch = useRef(false);
    const mobileMapHeight = 280; // Height of mobile map in pixels

    // Panel width constraints
    const MIN_PANEL_WIDTH = 400;


    // Check for Mapbox token
    const hasMapboxToken = !!import.meta.env.VITE_MAPBOX_TOKEN;

    // Get socket for room members display
    const { isConnected, roomMembers, connectWithPublicToken } = useSocket();

    // Connect with public token if present
    useEffect(() => {
        if (token) {
            connectWithPublicToken(token);
        }
    }, [token, connectWithPublicToken]);

    // Real-time update handlers
    const realtimeHandlers = useMemo(() => ({
        onBrainstormCreate: (item) => {
            setItems(prev => [item, ...prev]);
        },
        onBrainstormUpdate: (item) => {
            setItems(prev => prev.map(i => i.id === item.id ? item : i));
        },
        onBrainstormDelete: (itemId) => {
            setItems(prev => prev.filter(i => i.id !== itemId));
        },
        onBrainstormMove: ({ itemId, position_x, position_y }) => {
            setItems(prev => prev.map(i =>
                i.id === itemId ? { ...i, position_x, position_y } : i
            ));
        }
    }), []);

    // Initialize real-time updates
    const {
        emitBrainstormCreate,
        emitBrainstormUpdate,
        emitBrainstormDelete,
        emitBrainstormMove
    } = useRealtimeUpdates(tripId || trip?.id, realtimeHandlers);

    // Fetch trip and brainstorm data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            if (token) {
                // Public view fetch
                const response = await tripAPI.getTripByPublicToken(token);
                setTrip(response.data.trip);
                setMembers(response.data.members || []);
                // Ensure brainstorm items are included in the response or handle empty
                setItems(response.data.brainstorm_items || []);

                // Verify public access is allowed
                if (!response.data.trip.is_brainstorm_public) {
                    toast.error(t('brainstorm.notPublic', 'Brainstorming is not public for this trip'));
                    navigate(`/trip/public/${token}`);
                }
            } else if (tripId) {
                // Private view fetch
                const [tripResponse, brainstormResponse, groupsResponse] = await Promise.all([
                    tripAPI.getTripById(tripId),
                    brainstormAPI.getBrainstormItems(tripId),
                    brainstormAPI.getBrainstormGroups(tripId),
                ]);

                setTrip(tripResponse.data.trip);
                setMembers(tripResponse.data.members);
                setItems(brainstormResponse.data.items || []);
                setGroups(groupsResponse.data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error(t('errors.failedFetch', 'Failed to load data'));
            if (token) {
                navigate(`/trip/public/${token}`);
            } else {
                navigate('/trips');
            }
        } finally {
            setLoading(false);
        }
    }, [tripId, token, navigate, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permission helpers
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = () => {
        if (token) return false; // Always read-only for public view
        if (!trip || !members || !user) return false;
        const userMember = members.find(m => m.id === user.id);
        return userMember && (userMember.role === 'owner' || userMember.role === 'editor');
    };

    // Panel resize handlers
    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleResizeMove = useCallback((e) => {
        if (!isResizing || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        // Allow resizing up to the full container width minus a safety buffer for the handle
        const maxWidth = containerRect.width - 20;
        const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), maxWidth);
        setPanelWidth(clampedWidth);
    }, [isResizing, MIN_PANEL_WIDTH]);

    const handleResizeEnd = useCallback(() => {
        if (isResizing) {
            setIsResizing(false);
            localStorage.setItem('brainstormPanelWidth', panelWidth.toString());
        }
    }, [isResizing, panelWidth]);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // Handle map click to add location-based item
    const handleMapClick = (lngLat, locationName) => {
        setQuickAddMenu({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            lngLat,
            locationName,
        });
    };

    // Handle quick add menu selection
    const handleQuickAdd = (type) => {
        setModalDefaultType(type);
        if (quickAddMenu) {
            setModalDefaultLocation({
                latitude: quickAddMenu.lngLat.lat,
                longitude: quickAddMenu.lngLat.lng,
                location_name: quickAddMenu.locationName,
            });
        }
        setQuickAddMenu(null);
        setIsModalOpen(true);
    };

    // Handle floating button add
    const handleFloatingAdd = (type = 'idea') => {
        setModalDefaultType(type);
        setModalDefaultLocation(null);
        setEditingItem(null);
        setIsModalOpen(true);
    };

    // Handle edit item
    const handleEditItem = (item) => {
        setEditingItem(item);
        setModalDefaultType(item.type);
        setIsModalOpen(true);
    };

    // Handle delete item
    const handleDeleteItem = async (itemId) => {
        try {
            await brainstormAPI.deleteBrainstormItem(itemId, tripId);
            setItems(prev => prev.filter(item => item.id !== itemId));
            emitBrainstormDelete(itemId); // Broadcast to other users
            toast.success(t('brainstorm.deleted', 'Item deleted'));
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error(t('brainstorm.deleteFailed', 'Failed to delete item'));
        }
    };

    // Handle position update
    const handlePositionUpdate = async (itemId, position_x, position_y) => {
        try {
            await brainstormAPI.updateItemPosition(itemId, position_x, position_y, tripId);
            setItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, position_x, position_y } : item
            ));
            emitBrainstormMove(itemId, position_x, position_y); // Broadcast to other users
        } catch (error) {
            console.error('Error updating position:', error);
        }
    };

    // Handle modal save
    const handleModalSave = async (itemData) => {
        try {
            if (editingItem && !editingItem.prefill) {
                const response = await brainstormAPI.updateBrainstormItem(editingItem.id, itemData, tripId);
                const updatedItem = response.data.item;
                setItems(prev => prev.map(item =>
                    item.id === editingItem.id ? updatedItem : item
                ));
                emitBrainstormUpdate(updatedItem); // Broadcast to other users
                toast.success(t('brainstorm.updated', 'Item updated'));
            } else {
                // Find a position that doesn't overlap with existing cards
                const position = findNonOverlappingPosition(items);
                const itemWithPosition = {
                    ...itemData,
                    position_x: position.x,
                    position_y: position.y,
                };

                const response = await brainstormAPI.createBrainstormItem(tripId, itemWithPosition);
                const newItem = response.data.item;
                setItems(prev => [newItem, ...prev]);
                emitBrainstormCreate(newItem); // Broadcast to other users
                toast.success(t('brainstorm.created', 'Item created'));
            }
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error('Error saving item:', error);
            toast.error(t('brainstorm.saveFailed', 'Failed to save item'));
        }
    };

    // Group Handlers
    const handleCreateGroup = async () => {
        if (!canEdit()) return;
        try {
            // Center in current view approx
            const centerX = (-canvasOffset.x + 100) / canvasZoom;
            const centerY = (-canvasOffset.y + 100) / canvasZoom;

            const response = await brainstormAPI.createBrainstormGroup(tripId, {
                title: t('brainstorm.newGroup', 'New Group'),
                position_x: centerX > 0 ? centerX : 100,
                position_y: centerY > 0 ? centerY : 100,
                width: 300,
                height: 300,
                color: '#e5e7eb'
            });
            setGroups(prev => [...prev, response.data.group]);
            toast.success(t('brainstorm.groupCreated', 'Group created'));
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error(t('brainstorm.groupCreateFailed', 'Failed to create group'));
        }
    };

    const handleUpdateGroup = async (group) => {
        if (!canEdit()) return;
        try {
            // Optimistic update
            setGroups(prev => prev.map(g => g.id === group.id ? group : g));
            await brainstormAPI.updateBrainstormGroup(group.id, group);
        } catch (error) {
            console.error('Error updating group:', error);
            // Revert on error (could be improved by refetching)
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!canEdit()) return;
        try {
            await brainstormAPI.deleteBrainstormGroup(groupId);
            setGroups(prev => prev.filter(g => g.id !== groupId));
            toast.success(t('brainstorm.groupDeleted', 'Group deleted'));
        } catch (error) {
            console.error('Error deleting group:', error);
            toast.error(t('brainstorm.groupDeleteFailed', 'Failed to delete group'));
        }
    };

    // Handle clipboard paste
    useEffect(() => {
        // Inline non-overlapping position finder for paste handler
        const findPastePosition = (existingItems) => {
            const CARD_WIDTH = 240;
            const CARD_HEIGHT = 150;
            const PADDING = 20;
            const baseX = 100, baseY = 100;

            const overlaps = (x, y) => {
                return existingItems.some(item => {
                    const itemX = item.position_x || 0;
                    const itemY = item.position_y || 0;
                    return (
                        x < itemX + CARD_WIDTH + PADDING &&
                        x + CARD_WIDTH + PADDING > itemX &&
                        y < itemY + CARD_HEIGHT + PADDING &&
                        y + CARD_HEIGHT + PADDING > itemY
                    );
                });
            };

            let x = baseX, y = baseY;
            if (!overlaps(x, y)) return { x, y };

            const step = CARD_WIDTH + PADDING;
            let layer = 1, attempts = 0;
            while (attempts < 50) {
                for (let i = 0; i < layer && attempts < 50; i++) { x += step; attempts++; if (!overlaps(x, y)) return { x, y }; }
                for (let i = 0; i < layer && attempts < 50; i++) { y += step; attempts++; if (!overlaps(x, y)) return { x, y }; }
                layer++;
                for (let i = 0; i < layer && attempts < 50; i++) { x -= step; attempts++; if (!overlaps(x, y)) return { x, y }; }
                for (let i = 0; i < layer && attempts < 50; i++) { y -= step; attempts++; if (!overlaps(x, y)) return { x, y }; }
                layer++;
            }
            return { x: baseX + Math.random() * 400, y: baseY + Math.random() * 400 };
        };

        const handlePaste = async (e) => {
            if (!canEdit() || isModalOpen) return;

            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text');

            if (pastedText) {
                // Check if it's a URL
                const urlPattern = /^(https?:\/\/[^\s]+)/i;
                const isUrl = urlPattern.test(pastedText.trim());

                if (isUrl) {
                    setModalDefaultType('link');
                    setModalDefaultLocation(null);
                    setEditingItem({ prefill: { url: pastedText.trim() } });
                    setIsModalOpen(true);
                } else if (pastedText.trim().length > 0 && pastedText.trim().length < 500) {
                    // Short text, treat as quick idea - use non-overlapping position
                    try {
                        const position = findPastePosition(items);
                        const response = await brainstormAPI.createBrainstormItem(tripId, {
                            type: 'idea',
                            content: pastedText.trim(),
                            position_x: position.x,
                            position_y: position.y,
                        });
                        setItems(prev => [response.data.item, ...prev]);
                        toast.success(t('brainstorm.pastedIdea', 'Added from clipboard'));
                    } catch (error) {
                        console.error('Error creating from paste:', error);
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [canEdit, isModalOpen, tripId, t, items]);

    // Helper function to find a position that doesn't overlap with existing cards
    const findNonOverlappingPosition = useCallback((existingItems, baseX = 100, baseY = 100) => {
        const CARD_WIDTH = 240;  // Approximate card width
        const CARD_HEIGHT = 150; // Approximate card height
        const PADDING = 20;      // Space between cards

        // Check if a position overlaps with any existing card
        const overlaps = (x, y) => {
            return existingItems.some(item => {
                const itemX = item.position_x || 0;
                const itemY = item.position_y || 0;
                return (
                    x < itemX + CARD_WIDTH + PADDING &&
                    x + CARD_WIDTH + PADDING > itemX &&
                    y < itemY + CARD_HEIGHT + PADDING &&
                    y + CARD_HEIGHT + PADDING > itemY
                );
            });
        };

        // Try different positions in a spiral pattern
        let x = baseX;
        let y = baseY;
        let attempts = 0;
        const maxAttempts = 50;

        // If base position doesn't overlap, use it
        if (!overlaps(x, y)) {
            return { x, y };
        }

        // Try spiral pattern
        const step = CARD_WIDTH + PADDING;
        let layer = 1;
        while (attempts < maxAttempts) {
            // Try right side
            for (let i = 0; i < layer && attempts < maxAttempts; i++) {
                x += step;
                attempts++;
                if (!overlaps(x, y)) return { x, y };
            }
            // Try down
            for (let i = 0; i < layer && attempts < maxAttempts; i++) {
                y += step;
                attempts++;
                if (!overlaps(x, y)) return { x, y };
            }
            layer++;
            // Try left
            for (let i = 0; i < layer && attempts < maxAttempts; i++) {
                x -= step;
                attempts++;
                if (!overlaps(x, y)) return { x, y };
            }
            // Try up
            for (let i = 0; i < layer && attempts < maxAttempts; i++) {
                y -= step;
                attempts++;
                if (!overlaps(x, y)) return { x, y };
            }
            layer++;
        }

        // Fallback: return a random position if no non-overlapping position found
        return {
            x: baseX + Math.random() * 400,
            y: baseY + Math.random() * 400
        };
    }, []);

    // Handle zoom to location from canvas
    const handleZoomToLocation = useCallback((lat, lng, name) => {
        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [lng, lat],
                zoom: 14,
                duration: 1000
            });
        }
    }, []);

    // Handle map ready callback
    const handleMapReady = useCallback((map) => {
        mapRef.current = map;
    }, []);

    // Latch Drag Handlers for mobile split view - 3 states
    const handleLatchTouchStart = (e) => {
        latchDragStartY.current = e.touches[0].clientY;
        isDraggingLatch.current = true;
        e.stopPropagation();
    };

    const handleLatchTouchMove = (e) => {
        if (!isDraggingLatch.current) return;
        e.preventDefault();
    };

    const handleLatchTouchEnd = (e) => {
        if (!isDraggingLatch.current) return;
        const endY = e.changedTouches[0].clientY;
        const deltaY = endY - latchDragStartY.current;
        isDraggingLatch.current = false;

        // Dragged DOWN (positive delta) -> Go to next state (more map)
        if (deltaY > 50) {
            if (mobileViewState === 'canvas') {
                setMobileViewState('split');
            } else if (mobileViewState === 'split') {
                setMobileViewState('map');
            }
        }
        // Dragged UP (negative delta) -> Go to previous state (more canvas)
        else if (deltaY < -50) {
            if (mobileViewState === 'map') {
                setMobileViewState('split');
            } else if (mobileViewState === 'split') {
                setMobileViewState('canvas');
            }
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</span>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Mobile layout with map - 3 states: canvas, split, map */}
            <div className="md:hidden h-full flex flex-col overflow-hidden relative">
                {/* Mobile Map Container - fixed at top, hidden in canvas mode */}
                {hasMapboxToken && mobileViewState !== 'canvas' && (
                    <div
                        className="absolute top-0 left-0 right-0 z-0 transition-all duration-300 ease-out"
                        style={{
                            height: mobileViewState === 'map' ? '100%' : `${mobileMapHeight}px`,
                        }}
                    >
                        <BrainstormMap
                            items={items}
                            trip={trip}
                            canEdit={canEdit()}
                            onMapClick={handleMapClick}
                            onItemClick={handleEditItem}
                            onMapReady={handleMapReady}
                            compact={mobileViewState === 'split'} // Compact in split mode
                            bottomOffset={mobileViewState === 'map' ? 160 : 0} // Offset legend above minimized panel
                        />
                    </div>
                )}

                {/* Mobile Content Panel - floats over map */}
                <div
                    className={`flex-1 flex flex-col overflow-hidden z-10 transition-all duration-300 ease-out ${mobileViewState !== 'canvas' ? 'shadow-[0_-4px_20px_rgba(0,0,0,0.15)]' : ''}`}
                    style={{
                        marginTop: mobileViewState === 'map'
                            ? 'calc(100vh - 160px)' // Leave 160px visible at bottom
                            : mobileViewState === 'split'
                                ? `${mobileMapHeight - 20}px` // Overlap map slightly
                                : '0', // Full canvas
                        borderTopLeftRadius: mobileViewState !== 'canvas' ? '24px' : '0',
                        borderTopRightRadius: mobileViewState !== 'canvas' ? '24px' : '0',
                    }}
                >
                    <div className="bg-white dark:bg-gray-800 flex-1 flex flex-col min-h-full">
                        {/* Latch indicator - drag to switch views - always visible when map is available */}
                        {hasMapboxToken && (
                            <div
                                className="flex justify-center py-3 touch-none flex-shrink-0 cursor-grab active:cursor-grabbing"
                                onTouchStart={handleLatchTouchStart}
                                onTouchMove={handleLatchTouchMove}
                                onTouchEnd={handleLatchTouchEnd}
                            >
                                <div className="w-16 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
                            </div>
                        )}

                        {/* Mobile header */}
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                            <Link
                                to={token ? `/trip/public/${token}` : fromDashboard ? '/brainstorm' : `/trips/${tripId}`}
                                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400"
                            >
                                <ArrowLeft className="mr-1 h-4 w-4" />
                                {t('common.back', 'Back')}
                            </Link>

                            <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
                                {trip?.name}
                            </h1>

                            <div className="flex items-center gap-2">
                                {/* Toggle map visibility - cycles through states */}
                                {hasMapboxToken && (
                                    <button
                                        onClick={() => {
                                            // Cycle: split -> map -> canvas -> split
                                            if (mobileViewState === 'split') setMobileViewState('map');
                                            else if (mobileViewState === 'map') setMobileViewState('canvas');
                                            else setMobileViewState('split');
                                        }}
                                        className={`p-1.5 rounded-lg transition-colors ${mobileViewState === 'map'
                                            ? 'bg-accent text-white'
                                            : mobileViewState === 'canvas'
                                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                            }`}
                                        title={
                                            mobileViewState === 'map'
                                                ? t('brainstorm.hideMap', 'Hide map')
                                                : mobileViewState === 'canvas'
                                                    ? t('brainstorm.showMap', 'Show map')
                                                    : t('brainstorm.expandMap', 'Expand map')
                                        }
                                    >
                                        <Map className="w-4 h-4" />
                                    </button>
                                )}

                                {canEdit() && (
                                    <button
                                        onClick={() => handleFloatingAdd()}
                                        className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mobile canvas - always visible except when map is full screen */}
                        <div
                            className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900"
                            style={{
                                display: mobileViewState === 'map' ? 'none' : 'block',
                            }}
                        >
                            <BrainstormCanvas
                                items={items}
                                groups={groups}
                                canEdit={canEdit()}
                                onEditItem={handleEditItem}
                                onDeleteItem={handleDeleteItem}
                                onPositionUpdate={handlePositionUpdate}
                                onZoomToLocation={handleZoomToLocation}
                                onGroupChange={handleUpdateGroup}
                                onDeleteGroup={handleDeleteGroup}
                                offset={canvasOffset}
                                zoom={canvasZoom}
                                onOffsetChange={setCanvasOffset}
                                onZoomChange={setCanvasZoom}
                            />
                        </div>
                    </div>
                </div>

                {/* Quick add menu for map clicks */}
                {quickAddMenu && (
                    <div
                        className="fixed z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-3 border border-gray-200 dark:border-gray-700"
                        style={{
                            left: `${quickAddMenu.x}px`,
                            top: `${quickAddMenu.y}px`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                {quickAddMenu.locationName || t('brainstorm.newItem', 'New item')}
                            </span>
                            <button
                                onClick={() => setQuickAddMenu(null)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            {['place', 'note', 'image', 'link', 'idea'].map(type => {
                                const TypeIcon = { place: MapPin, note: FileText, image: Image, link: Link2, idea: Lightbulb }[type];
                                return (
                                    <button
                                        key={type}
                                        onClick={() => handleQuickAdd(type)}
                                        className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        title={t(`brainstorm.types.${type}`, type)}
                                    >
                                        <TypeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop layout */}
            <div ref={containerRef} className="hidden md:flex h-full overflow-hidden">
                {/* Left Panel - Canvas */}
                <div
                    className="bg-gray-100 dark:bg-gray-900 flex flex-col min-h-0 flex-shrink-0 relative"
                    style={{ width: hasMapboxToken ? `${panelWidth}px` : '100%' }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <Link
                                to={token ? `/trip/public/${token}` : fromDashboard ? '/brainstorm' : `/trips/${tripId}`}
                                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                <ArrowLeft className="mr-1 h-4 w-4" />
                                {t('common.back', 'Back')}
                            </Link>
                            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('brainstorm.title', 'Brainstorm')}
                            </h1>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {trip?.name}
                        </span>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 overflow-hidden relative">
                        <BrainstormCanvas
                            items={items}
                            groups={groups}
                            canEdit={canEdit()}
                            onEditItem={handleEditItem}
                            onDeleteItem={handleDeleteItem}
                            onPositionUpdate={handlePositionUpdate}
                            onZoomToLocation={handleZoomToLocation}
                            onGroupChange={handleUpdateGroup}
                            onDeleteGroup={handleDeleteGroup}
                            offset={canvasOffset}
                            zoom={canvasZoom}
                            onOffsetChange={setCanvasOffset}
                            onZoomChange={setCanvasZoom}
                        />

                        {/* Canvas controls */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-1.5">
                            <button
                                onClick={() => setCanvasZoom(z => Math.min(2, z + 0.1))}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title={t('brainstorm.zoomIn', 'Zoom in')}
                            >
                                <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px] text-center">
                                {Math.round(canvasZoom * 100)}%
                            </span>
                            <button
                                onClick={() => setCanvasZoom(z => Math.max(0.25, z - 0.1))}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title={t('brainstorm.zoomOut', 'Zoom out')}
                            >
                                <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
                            <button
                                onClick={() => { setCanvasOffset({ x: 0, y: 0 }); setCanvasZoom(1); }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title={t('brainstorm.resetView', 'Reset view')}
                            >
                                <Move className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>

                        {/* Floating add button */}
                        {canEdit() && (
                            <div className="absolute bottom-4 right-4">
                                <FloatingAddButton onAdd={handleFloatingAdd} onAddGroup={handleCreateGroup} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Resize Handle */}
                {hasMapboxToken && (
                    <div
                        className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-accent hover:w-1.5 cursor-col-resize transition-all duration-150 flex-shrink-0 group relative"
                        onMouseDown={handleResizeStart}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full bg-gray-400 dark:bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}

                {/* Right Panel - Map */}
                {hasMapboxToken && (
                    <div className="flex-1 h-full relative min-w-0">
                        <BrainstormMap
                            items={items}
                            trip={trip}
                            canEdit={canEdit()}
                            onMapClick={handleMapClick}
                            onItemClick={handleEditItem}
                            onMapReady={handleMapReady}
                        />

                        {/* Quick add menu */}
                        {quickAddMenu && (
                            <div
                                className="fixed z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-3 border border-gray-200 dark:border-gray-700"
                                style={{
                                    left: `${quickAddMenu.x}px`,
                                    top: `${quickAddMenu.y}px`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {t('brainstorm.addAt', 'Add at')} {quickAddMenu.locationName || 'this location'}
                                    </span>
                                    <button
                                        onClick={() => setQuickAddMenu(null)}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(ITEM_TYPES).map(([type, config]) => (
                                        <button
                                            key={type}
                                            onClick={() => handleQuickAdd(type)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-${config.color}-50 dark:hover:bg-${config.color}-900/20 transition-colors`}
                                        >
                                            <div className={`w-10 h-10 rounded-full bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center`}>
                                                <config.icon className={`w-5 h-5 text-${config.color}-600 dark:text-${config.color}-400`} />
                                            </div>
                                            <span className="text-xs text-gray-600 dark:text-gray-400">{config.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Item Modal */}
            <BrainstormItemModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingItem(null);
                    setModalDefaultLocation(null);
                }}
                onSave={handleModalSave}
                editingItem={editingItem}
                defaultType={modalDefaultType}
                defaultLocation={modalDefaultLocation}
            />
        </>
    );
};

// Floating add button with type selection
const FloatingAddButton = ({ onAdd, onAddGroup }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="relative">
            {isOpen && (
                <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-3 border border-gray-200 dark:border-gray-700 min-w-[200px]">
                    <div className="space-y-1">
                        {Object.entries(ITEM_TYPES).map(([type, config]) => (
                            <button
                                key={type}
                                onClick={() => {
                                    onAdd(type);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className={`w-8 h-8 rounded-full bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center`}>
                                    <config.icon className={`w-4 h-4 text-${config.color}-600 dark:text-${config.color}-400`} />
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(`brainstorm.add${config.label.replace(' ', '')}`, `Add ${config.label}`)}
                                </span>
                            </button>
                        ))}
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                        <button
                            onClick={() => {
                                onAddGroup();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <Grid className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('brainstorm.addGroup', 'Add Visual Group')}
                            </span>
                        </button>
                    </div>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 bg-accent text-white rounded-2xl shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl ${isOpen ? 'rotate-45' : ''}`}
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
};

export default Brainstorm;
