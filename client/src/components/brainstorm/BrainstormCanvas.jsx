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
    offset = { x: 0, y: 0 },
    zoom = 1,
    onOffsetChange,
    onZoomChange,
}) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const [draggingItemId, setDraggingItemId] = useState(null);

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
    const handleCanvasMouseDown = (e) => {
        // Only start panning if clicking on the canvas background (not on items)
        const isCanvasBackground = e.target === canvasRef.current ||
            e.target.classList.contains('canvas-transform-container');

        if (e.button === 0 && isCanvasBackground) {
            panStateRef.current = {
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                startOffsetX: offset.x,
                startOffsetY: offset.y,
            };
            e.preventDefault();
        }
    };

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

    // Global mouse handlers - set up once
    useEffect(() => {
        const handleMouseMove = (e) => {
            // Handle panning
            const panState = panStateRef.current;
            if (panState.isPanning) {
                const deltaX = e.clientX - panState.startX;
                const deltaY = e.clientY - panState.startY;
                onOffsetChange({
                    x: panState.startOffsetX + deltaX,
                    y: panState.startOffsetY + deltaY,
                });
            }

            // Handle item dragging with live visual feedback
            const dragState = dragStateRef.current;
            if (dragState.isDragging && dragState.itemEl) {
                const deltaX = (e.clientX - dragState.startMouseX) / dragState.zoom;
                const deltaY = (e.clientY - dragState.startMouseY) / dragState.zoom;

                const newX = dragState.startItemX + deltaX;
                const newY = dragState.startItemY + deltaY;

                // Update visual position directly on the DOM element
                dragState.itemEl.style.left = `${newX}px`;
                dragState.itemEl.style.top = `${newY}px`;
            }
        };

        const handleMouseUp = (e) => {
            // Handle panning end
            const panState = panStateRef.current;
            if (panState.isPanning) {
                panStateRef.current.isPanning = false;
            }

            // Handle item drag end
            const dragState = dragStateRef.current;
            if (dragState.isDragging && canEdit) {
                const deltaX = (e.clientX - dragState.startMouseX) / dragState.zoom;
                const deltaY = (e.clientY - dragState.startMouseY) / dragState.zoom;

                const newX = Math.max(0, dragState.startItemX + deltaX);
                const newY = Math.max(0, dragState.startItemY + deltaY);

                // Save the new position to backend
                onPositionUpdate(dragState.itemId, newX, newY);

                // Reset drag state
                dragStateRef.current = {
                    isDragging: false,
                    itemId: null,
                    itemEl: null,
                    startMouseX: 0,
                    startMouseY: 0,
                    startItemX: 0,
                    startItemY: 0,
                    zoom: 1,
                };
                setDraggingItemId(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onOffsetChange, onPositionUpdate, canEdit]);

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
            className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing"
            style={{
                backgroundImage: `
          radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)
        `,
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${offset.x}px ${offset.y}px`,
            }}
            onMouseDown={handleCanvasMouseDown}
        >
            {/* Items container with transform */}
            <div
                className="absolute inset-0 canvas-transform-container"
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
                            className={`absolute group ${typeConfig.bgColor} ${typeConfig.borderColor} border-2 rounded-2xl shadow-lg hover:shadow-xl transition-shadow ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                            style={{
                                left: `${item.position_x}px`,
                                top: `${item.position_y}px`,
                                maxWidth: item.type === 'image' ? '280px' : '240px',
                                minWidth: '160px',
                                zIndex: isDragging ? 1000 : 1,
                                opacity: isDragging ? 0.9 : 1,
                            }}
                        >
                            {/* Drag handle */}
                            {canEdit && (
                                <div
                                    className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
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
                            <div className="p-3">
                                {/* Image type - show image */}
                                {item.type === 'image' && item.image_path && (
                                    <div className="mb-2 -mx-1.5 -mt-1.5 rounded-t-xl overflow-hidden">
                                        <img
                                            src={item.image_path}
                                            alt={item.title || 'Brainstorm image'}
                                            className="w-full h-32 object-cover"
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
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {item.location_name}
                                            </p>
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
