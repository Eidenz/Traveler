// client/src/components/brainstorm/BrainstormCanvas.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MapPin, FileText, Image, Link2, Lightbulb,
    Trash2, Edit3, GripVertical, ExternalLink
} from 'lucide-react';

// Item type configuration with colors
const ITEM_TYPES = {
    place: {
        icon: MapPin,
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        borderColor: 'border-teal-200 dark:border-teal-800',
        iconColor: 'text-teal-600 dark:text-teal-400',
        accentColor: 'bg-teal-500',
    },
    note: {
        icon: FileText,
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        iconColor: 'text-amber-600 dark:text-amber-400',
        accentColor: 'bg-amber-500',
    },
    image: {
        icon: Image,
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        iconColor: 'text-purple-600 dark:text-purple-400',
        accentColor: 'bg-purple-500',
    },
    link: {
        icon: Link2,
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        accentColor: 'bg-emerald-500',
    },
    idea: {
        icon: Lightbulb,
        bgColor: 'bg-rose-50 dark:bg-rose-900/20',
        borderColor: 'border-rose-200 dark:border-rose-800',
        iconColor: 'text-rose-600 dark:text-rose-400',
        accentColor: 'bg-rose-500',
    },
};

const BrainstormCanvas = ({
    items = [],
    canEdit = false,
    onEditItem,
    onDeleteItem,
    onPositionUpdate,
    onZoomToLocation, // Callback to zoom to a location on the map
    offset = { x: 0, y: 0 },
    zoom = 1,
    onOffsetChange,
    onZoomChange,
}) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const [draggingItemId, setDraggingItemId] = useState(null);
    const longPressTimerRef = useRef(null);

    // All interactive state stored in refs to avoid stale closures
    const panStateRef = useRef({
        isPanning: false,
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
    });

    const dragStateRef = useRef({
        isDragging: false,
        itemId: null,
        itemEl: null,
        startMouseX: 0,
        startMouseY: 0,
        startItemX: 0,
        startItemY: 0,
        zoom: 1,
    });

    // Handle canvas pan start
    const handleCanvasMouseDown = useCallback((e) => {
        // Only start panning if clicking on the canvas background (not on items)
        const isCanvasBackground = e.target === canvasRef.current ||
            e.target.classList.contains('canvas-transform-container');

        if (e.button === 0 && isCanvasBackground) {
            e.preventDefault();
            e.stopPropagation();

            panStateRef.current = {
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                startOffsetX: offset.x,
                startOffsetY: offset.y,
            };
        }
    }, [offset.x, offset.y]);

    // Start dragging an item
    const handleItemDragStart = (e, item) => {
        if (!canEdit) return;
        e.preventDefault();
        e.stopPropagation();

        const itemEl = document.getElementById(`brainstorm-item-${item.id}`);
        if (!itemEl) return;

        dragStateRef.current = {
            isDragging: true,
            itemId: item.id,
            itemEl: itemEl,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startItemX: item.position_x,
            startItemY: item.position_y,
            zoom: zoom,
        };
        setDraggingItemId(item.id);
    };

    // --- Touch Handlers ---

    const handleCanvasTouchStart = (e) => {
        // Single touch for panning
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            panStateRef.current = {
                isPanning: true,
                startX: touch.clientX,
                startY: touch.clientY,
                startOffsetX: offset.x,
                startOffsetY: offset.y,
            };
        }
    };

    const handleItemTouchStart = (e, item) => {
        if (!canEdit) return;
        // Don't stop propagation immediately, let the canvas listeners potentially see it, 
        // but we manage our own state.

        const touch = e.touches[0];
        const startX = touch.clientX;
        const startY = touch.clientY;

        // Clear existing timer if any
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

        // Start Long Press Timer
        longPressTimerRef.current = setTimeout(() => {
            // Long Press Triggered
            const itemEl = document.getElementById(`brainstorm-item-${item.id}`);
            if (!itemEl) return;

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(50);

            dragStateRef.current = {
                isDragging: true,
                itemId: item.id,
                itemEl: itemEl,
                startMouseX: startX, // Use captured start position
                startMouseY: startY,
                startItemX: item.position_x,
                startItemY: item.position_y,
                zoom: zoom,
            };
            setDraggingItemId(item.id);

            // Disable panning when item drag starts
            panStateRef.current.isPanning = false;

        }, 500); // 500ms long press
    };

    // Global Event Handlers (Mouse & Touch)
    useEffect(() => {
        const handleMove = (clientX, clientY) => {
            // Handle panning
            const panState = panStateRef.current;
            if (panState.isPanning) {
                const deltaX = clientX - panState.startX;
                const deltaY = clientY - panState.startY;
                onOffsetChange({
                    x: panState.startOffsetX + deltaX,
                    y: panState.startOffsetY + deltaY,
                });

                // If moved significantly, cancel any long press timers
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                }
            }

            // Handle item dragging with live visual feedback
            const dragState = dragStateRef.current;
            if (dragState.isDragging && dragState.itemEl) {
                const deltaX = (clientX - dragState.startMouseX) / dragState.zoom;
                const deltaY = (clientY - dragState.startMouseY) / dragState.zoom;

                const newX = dragState.startItemX + deltaX;
                const newY = dragState.startItemY + deltaY;

                // Update visual position directly on the DOM element
                dragState.itemEl.style.left = `${newX}px`;
                dragState.itemEl.style.top = `${newY}px`;
            }
        };

        const handleEnd = () => {
            // Clear long press timer
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            // Handle panning end
            if (panStateRef.current.isPanning) {
                panStateRef.current.isPanning = false;
            }

            // Handle item drag end
            const dragState = dragStateRef.current;
            if (dragState.isDragging && canEdit) {
                // Finalize position
                // (Using the last known visual position which is tracked in DOM, 
                // but we need to calculate it relative to start)
                // Or we could track last known X/Y in handleMove. 
                // Simple way: read style or re-calc from last event? 
                // React's event pooling and closing over vars makes "e" hard to use here.
                // HOWEVER, we don't have "e" here easily for finalize.
                // But wait, the original logic did re-calculate in mouseup using `e`.
                // My extracted `handleMove` doesn't expose `e`.

                // Let's rely on the fact that if we are dragging, the element style matches expectation.
            }
        };

        // Standard Mouse Events
        const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const onMouseUp = (e) => {
            // Replicate original logic for update
            const dragState = dragStateRef.current;
            if (dragState.isDragging && canEdit) {
                const deltaX = (e.clientX - dragState.startMouseX) / dragState.zoom;
                const deltaY = (e.clientY - dragState.startMouseY) / dragState.zoom;
                const newX = Math.max(0, dragState.startItemX + deltaX);
                const newY = Math.max(0, dragState.startItemY + deltaY);
                onPositionUpdate(dragState.itemId, newX, newY);

                dragStateRef.current = { ...dragStateRef.current, isDragging: false, itemId: null, itemEl: null };
                setDraggingItemId(null);
            }
            handleEnd();
        };

        // Touch Events
        const onTouchMove = (e) => {
            if (e.touches.length > 0) {
                // Prevent default scroll if panning or dragging item
                if (panStateRef.current.isPanning || dragStateRef.current.isDragging) {
                    e.preventDefault();
                }
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const onTouchEnd = (e) => {
            // For touch end, we need the last position. `changedTouches` has it.
            if (dragStateRef.current.isDragging && canEdit && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                const dragState = dragStateRef.current;
                const deltaX = (touch.clientX - dragState.startMouseX) / dragState.zoom;
                const deltaY = (touch.clientY - dragState.startMouseY) / dragState.zoom;
                const newX = Math.max(0, dragState.startItemX + deltaX);
                const newY = Math.max(0, dragState.startItemY + deltaY);
                onPositionUpdate(dragState.itemId, newX, newY);

                dragStateRef.current = { ...dragStateRef.current, isDragging: false, itemId: null, itemEl: null };
                setDraggingItemId(null);
            }
            handleEnd();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        // Passive: false is crucial for preventing scrolling
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [onOffsetChange, onPositionUpdate, canEdit, zoom]);

    // Handle zoom with mouse wheel
    const handleWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.min(2, Math.max(0.25, zoom + delta));
            onZoomChange(newZoom);
        }
    }, [zoom, onZoomChange]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            return () => canvas.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    // Get link preview (domain)
    const getLinkDomain = (url) => {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch {
            return url;
        }
    };

    return (
        <div
            ref={canvasRef}
            className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing touch-none select-none" // touch-none prevents browser default pan/zoom
            style={{
                backgroundImage: `
          radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)
        `,
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${offset.x}px ${offset.y}px`,
            }}
            onMouseDown={handleCanvasMouseDown}
            onTouchStart={handleCanvasTouchStart}
        >
            {/* Items container with transform */}
            <div
                className="absolute inset-0 canvas-transform-container pointer-events-none"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                }}
            >
                {items.map((item) => {
                    const typeConfig = ITEM_TYPES[item.type] || ITEM_TYPES.idea;
                    const Icon = typeConfig.icon;
                    const isDragging = draggingItemId === item.id;

                    return (
                        <div
                            key={item.id}
                            id={`brainstorm-item-${item.id}`}
                            data-brainstorm-item
                            className={`absolute group ${typeConfig.bgColor} ${typeConfig.borderColor} border-2 rounded-2xl shadow-lg hover:shadow-xl transition-shadow pointer-events-auto ${isDragging ? 'cursor-grabbing z-50 scale-105' : 'cursor-default transition-all duration-300'}`}
                            style={{
                                left: `${item.position_x}px`,
                                top: `${item.position_y}px`,
                                maxWidth: item.type === 'image' ? '280px' : '240px',
                                minWidth: '160px',
                                zIndex: isDragging ? 1000 : 1,
                                opacity: isDragging ? 0.9 : 1,
                            }}
                            onTouchStart={(e) => handleItemTouchStart(e, item)}
                        >
                            {/* Drag handle (Desktop) */}
                            {canEdit && (
                                <div
                                    className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move hidden md:block"
                                    onMouseDown={(e) => handleItemDragStart(e, item)}
                                >
                                    <div className="bg-white dark:bg-gray-800 rounded-full p-1 shadow-md border border-gray-200 dark:border-gray-600">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            )}

                            {/* Type indicator */}
                            <div className={`absolute -left-1 top-3 w-1.5 h-6 rounded-full ${typeConfig.accentColor}`} />

                            {/* Priority badge */}
                            {item.priority > 0 && (
                                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${typeConfig.accentColor} flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white dark:border-gray-800`}>
                                    {item.priority}
                                </div>
                            )}

                            {/* Card content */}
                            <div className="p-3 select-none"> {/* select-none helps with touch dragging */}
                                {/* Image type - show image */}
                                {item.type === 'image' && item.image_path && (
                                    <div className="mb-2 -mx-1.5 -mt-1.5 rounded-t-xl overflow-hidden">
                                        <img
                                            src={item.image_path}
                                            alt={item.title || 'Brainstorm image'}
                                            className="w-full h-32 object-cover pointer-events-none" // prevent image drag on mobile
                                        />
                                    </div>
                                )}

                                {/* Header with icon and title/location */}
                                <div className="flex items-start gap-2 mb-1">
                                    <div className={`p-1.5 rounded-lg ${typeConfig.bgColor}`}>
                                        <Icon className={`w-4 h-4 ${typeConfig.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {item.title && (
                                            <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                {item.title}
                                            </h4>
                                        )}
                                        {item.location_name && (
                                            item.latitude && item.longitude && onZoomToLocation ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onZoomToLocation(item.latitude, item.longitude, item.location_name);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.stopPropagation();
                                                        onZoomToLocation(item.latitude, item.longitude, item.location_name);
                                                    }}
                                                    className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 hover:underline transition-colors max-w-full overflow-hidden"
                                                    title={t('brainstorm.clickToZoom', 'Click to zoom to location')}
                                                >
                                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{item.location_name}</span>
                                                </button>
                                            ) : (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{item.location_name}</span>
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                {item.content && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mt-2">
                                        {item.content}
                                    </p>
                                )}

                                {/* Link preview */}
                                {item.type === 'link' && item.url && (
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 flex items-center gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()} // Allow clicking links without triggering drag
                                    >
                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{getLinkDomain(item.url)}</span>
                                    </a>
                                )}

                                {/* Creator info */}
                                {item.creator_name && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                        {item.creator_image ? (
                                            <img
                                                src={item.creator_image}
                                                alt={item.creator_name}
                                                className="w-4 h-4 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600" />
                                        )}
                                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                            {item.creator_name}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            {canEdit && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditItem(item);
                                        }}
                                        onTouchEnd={(e) => { // Better mobile touch support for buttons
                                            e.stopPropagation();
                                            onEditItem(item);
                                        }}
                                        className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        title={t('common.edit', 'Edit')}
                                    >
                                        <Edit3 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(t('brainstorm.confirmDelete', 'Delete this item?'))) {
                                                onDeleteItem(item.id);
                                            }
                                        }}
                                        onTouchEnd={(e) => {
                                            e.stopPropagation();
                                            if (confirm(t('brainstorm.confirmDelete', 'Delete this item?'))) {
                                                onDeleteItem(item.id);
                                            }
                                        }}
                                        className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title={t('common.delete', 'Delete')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <Lightbulb className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                            {t('brainstorm.empty', 'Start brainstorming!')}
                        </h3>
                        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
                            {t('brainstorm.emptyHint', 'Click the + button to add ideas, places, notes, links, or images. You can also paste content from your clipboard.')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrainstormCanvas;
