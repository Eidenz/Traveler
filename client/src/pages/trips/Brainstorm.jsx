// client/src/pages/trips/Brainstorm.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Plus, MapPin, FileText, Image, Link2, Lightbulb,
    Trash2, Edit3, GripVertical, X, ZoomIn, ZoomOut, Move
} from 'lucide-react';
import { tripAPI, brainstormAPI } from '../../services/api';
import BrainstormCanvas from '../../components/brainstorm/BrainstormCanvas';
import BrainstormMap from '../../components/brainstorm/BrainstormMap';
import BrainstormItemModal from '../../components/brainstorm/BrainstormItemModal';
import Button from '../../components/ui/Button';

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
    const { tripId: urlTripId } = useParams();
    const tripId = propTripId || urlTripId;
    const navigate = useNavigate();
    const containerRef = useRef(null);

    // State
    const [trip, setTrip] = useState(null);
    const [members, setMembers] = useState([]);
    const [items, setItems] = useState([]);
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

    // Panel width constraints
    const MIN_PANEL_WIDTH = 400;
    const MAX_PANEL_WIDTH = 800;

    // Check for Mapbox token
    const hasMapboxToken = !!import.meta.env.VITE_MAPBOX_TOKEN;

    // Fetch trip and brainstorm data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [tripResponse, brainstormResponse] = await Promise.all([
                tripAPI.getTripById(tripId),
                brainstormAPI.getBrainstormItems(tripId),
            ]);

            setTrip(tripResponse.data.trip);
            setMembers(tripResponse.data.members);
            setItems(brainstormResponse.data.items || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error(t('errors.failedFetch', 'Failed to load data'));
            navigate('/trips');
        } finally {
            setLoading(false);
        }
    }, [tripId, navigate, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Permission helpers
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = () => {
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
        const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
        setPanelWidth(clampedWidth);
    }, [isResizing, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH]);

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
        } catch (error) {
            console.error('Error updating position:', error);
        }
    };

    // Handle modal save
    const handleModalSave = async (itemData) => {
        try {
            if (editingItem) {
                const response = await brainstormAPI.updateBrainstormItem(editingItem.id, itemData, tripId);
                setItems(prev => prev.map(item =>
                    item.id === editingItem.id ? response.data.item : item
                ));
                toast.success(t('brainstorm.updated', 'Item updated'));
            } else {
                const response = await brainstormAPI.createBrainstormItem(tripId, itemData);
                setItems(prev => [response.data.item, ...prev]);
                toast.success(t('brainstorm.created', 'Item created'));
            }
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error('Error saving item:', error);
            toast.error(t('brainstorm.saveFailed', 'Failed to save item'));
        }
    };

    // Handle clipboard paste
    useEffect(() => {
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
                    // Short text, treat as quick idea
                    try {
                        const response = await brainstormAPI.createBrainstormItem(tripId, {
                            type: 'idea',
                            content: pastedText.trim(),
                            position_x: 100 + Math.random() * 200,
                            position_y: 100 + Math.random() * 200,
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
    }, [canEdit, isModalOpen, tripId, t]);

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
            {/* Mobile layout */}
            <div className="md:hidden h-full flex flex-col overflow-hidden">
                {/* Mobile header */}
                <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <Link
                        to={fromDashboard ? '/brainstorm' : `/trips/${tripId}`}
                        className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        {t('common.back', 'Back')}
                    </Link>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                        {trip?.name} - {t('brainstorm.title', 'Brainstorm')}
                    </h1>
                    {canEdit() && (
                        <button
                            onClick={() => handleFloatingAdd()}
                            className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Mobile canvas */}
                <div className="flex-1 overflow-hidden">
                    <BrainstormCanvas
                        items={items}
                        canEdit={canEdit()}
                        onEditItem={handleEditItem}
                        onDeleteItem={handleDeleteItem}
                        onPositionUpdate={handlePositionUpdate}
                        offset={canvasOffset}
                        zoom={canvasZoom}
                        onOffsetChange={setCanvasOffset}
                        onZoomChange={setCanvasZoom}
                    />
                </div>
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
                                to={fromDashboard ? '/brainstorm' : `/trips/${tripId}`}
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
                            canEdit={canEdit()}
                            onEditItem={handleEditItem}
                            onDeleteItem={handleDeleteItem}
                            onPositionUpdate={handlePositionUpdate}
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
                                <FloatingAddButton onAdd={handleFloatingAdd} />
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
const FloatingAddButton = ({ onAdd }) => {
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
