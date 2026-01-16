// client/src/components/brainstorm/BrainstormMap.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Layers, Navigation, MapPin, Search } from 'lucide-react';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Item type colors for markers
const MARKER_COLORS = {
    place: '#14b8a6', // teal-500
    note: '#f59e0b', // amber-500
    image: '#a855f7', // purple-500
    link: '#10b981', // emerald-500
    idea: '#f43f5e', // rose-500
};

const BrainstormMap = ({
    items = [],
    trip,
    canEdit = false,
    onMapClick,
    onItemClick,
    onMapReady, // Callback to expose map ref for external control
    compact = false, // Compact mode for mobile
    bottomOffset = 0, // Extra bottom offset for legend when panel covers bottom
}) => {
    const { t } = useTranslation();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]); // Now stores { id, marker, element } objects
    const initialFitDoneRef = useRef(false); // Track if we've done initial fit
    const [mapStyle, setMapStyle] = useState('streets');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Map styles
    const styles = {
        streets: 'mapbox://styles/mapbox/streets-v12',
        satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
        light: 'mapbox://styles/mapbox/light-v11',
        dark: 'mapbox://styles/mapbox/dark-v11',
    };

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styles[mapStyle],
            center: [0, 20],
            zoom: 2,
        });

        mapRef.current = map;

        // Notify parent when map is ready
        map.on('load', () => {
            setIsLoaded(true);
            if (onMapReady) {
                onMapReady(map);
            }
        });

        // Click handler for adding items
        map.on('click', async (e) => {
            if (!canEdit) return;

            const { lng, lat } = e.lngLat;

            // Reverse geocode to get location name
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`
                );
                const data = await response.json();
                const locationName = data.features?.[0]?.place_name || '';
                onMapClick(e.lngLat, locationName);
            } catch (error) {
                console.error('Geocoding error:', error);
                onMapClick(e.lngLat, '');
            }
        });

        // Change cursor on hover
        map.on('mousemove', () => {
            if (canEdit) {
                map.getCanvas().style.cursor = 'crosshair';
            }
        });

        // Resize observer to handle panel resizing (debounced)
        let resizeTimeout;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.resize();
                }
            }, 100);
        });
        resizeObserver.observe(mapContainerRef.current);

        return () => {
            clearTimeout(resizeTimeout);
            resizeObserver.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, [onMapReady]);

    // Update map style
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setStyle(styles[mapStyle]);
        }
    }, [mapStyle]);

    // Add markers for items with locations and route lines for prioritized items
    // Optimized to update in-place without resetting map view
    useEffect(() => {
        if (!mapRef.current || !isLoaded) return;

        // Check if map style is fully loaded before modifying sources
        if (!mapRef.current.isStyleLoaded()) {
            mapRef.current.once('style.load', () => {
                setIsLoaded(true);
            });
            return;
        }

        const itemsWithLocation = items.filter(item => item.latitude && item.longitude);

        // Track which item IDs we've seen
        const existingItemIds = new Set();

        // Get items with priorities for drawing route lines
        const prioritizedItems = itemsWithLocation
            .filter(item => item.priority && item.priority > 0)
            .sort((a, b) => a.priority - b.priority);

        // Draw route lines between prioritized items
        const routeSource = mapRef.current.getSource('brainstorm-route');
        if (prioritizedItems.length > 1) {
            const lineCoordinates = prioritizedItems.map(item => [
                parseFloat(item.longitude),
                parseFloat(item.latitude)
            ]);

            const routeData = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: lineCoordinates
                }
            };

            if (routeSource) {
                // Update existing source data in-place
                routeSource.setData(routeData);
            } else {
                // Create new source and layer
                try {
                    mapRef.current.addSource('brainstorm-route', {
                        type: 'geojson',
                        data: routeData
                    });
                    mapRef.current.addLayer({
                        id: 'brainstorm-route',
                        type: 'line',
                        source: 'brainstorm-route',
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#8b5cf6', // Violet color to match priorities
                            'line-width': 3,
                            'line-opacity': 0.7,
                            'line-dasharray': [2, 2]
                        }
                    });
                } catch (e) {
                    console.warn('Error adding brainstorm route layer:', e);
                }
            }
        } else if (routeSource) {
            // Remove route if no longer needed
            try {
                if (mapRef.current.getLayer('brainstorm-route')) {
                    mapRef.current.removeLayer('brainstorm-route');
                }
                mapRef.current.removeSource('brainstorm-route');
            } catch (e) {
                // Ignore errors
            }
        }

        // Build a map of existing markers by item ID
        const existingMarkersMap = new Map();
        markersRef.current.forEach((item) => {
            if (item && item.id && item.marker) {
                existingMarkersMap.set(item.id, { marker: item.marker, element: item.element });
            } else if (item && typeof item.remove === 'function') {
                // Old format marker without ID - remove it
                item.remove();
            }
        });

        const newMarkers = [];

        // Helper function to create marker element
        const createMarkerElement = (item) => {
            const el = document.createElement('div');
            el.className = 'brainstorm-marker';
            el.dataset.itemId = item.id;

            const hasPriority = item.priority && item.priority > 0;

            el.style.cssText = `
                width: ${hasPriority ? '28px' : '32px'};
                height: ${hasPriority ? '28px' : '32px'};
                background: ${MARKER_COLORS[item.type] || MARKER_COLORS.idea};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: box-shadow 0.2s, border-width 0.1s;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: ${hasPriority ? '14px' : '12px'};
                color: white;
                user-select: none;
            `;

            if (hasPriority) {
                el.textContent = item.priority;
            } else {
                el.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        ${getIconPath(item.type)}
                    </svg>
                `;
            }

            // Hover effects
            el.addEventListener('mouseenter', () => {
                el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
                el.style.borderWidth = '4px';
            });
            el.addEventListener('mouseleave', () => {
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                el.style.borderWidth = '3px';
            });

            // Click handler
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onItemClick(item);
            });

            return el;
        };

        // Update existing markers or add new ones
        itemsWithLocation.forEach((item) => {
            const itemId = `brainstorm-${item.id}`;
            existingItemIds.add(itemId);

            const existing = existingMarkersMap.get(itemId);

            if (existing) {
                // Update existing marker position if changed
                const currentPos = existing.marker.getLngLat();
                const newLng = parseFloat(item.longitude);
                const newLat = parseFloat(item.latitude);
                if (currentPos.lng !== newLng || currentPos.lat !== newLat) {
                    existing.marker.setLngLat([newLng, newLat]);
                }

                // Update priority display if changed
                const hasPriority = item.priority && item.priority > 0;
                if (hasPriority) {
                    existing.element.textContent = item.priority;
                    existing.element.style.width = '28px';
                    existing.element.style.height = '28px';
                    existing.element.style.fontSize = '14px';
                } else {
                    existing.element.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            ${getIconPath(item.type)}
                        </svg>
                    `;
                    existing.element.style.width = '32px';
                    existing.element.style.height = '32px';
                    existing.element.style.fontSize = '12px';
                }

                // Update color if type changed
                existing.element.style.background = MARKER_COLORS[item.type] || MARKER_COLORS.idea;

                newMarkers.push({ id: itemId, marker: existing.marker, element: existing.element });
            } else {
                // Create new marker
                const el = createMarkerElement(item);

                const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([item.longitude, item.latitude])
                    .addTo(mapRef.current);

                newMarkers.push({ id: itemId, marker, element: el });
            }
        });

        // Remove markers that no longer exist in items
        existingMarkersMap.forEach(({ marker }, id) => {
            if (!existingItemIds.has(id)) {
                marker.remove();
            }
        });

        markersRef.current = newMarkers;

        // Fit bounds to show all markers - ONLY on initial load
        if (itemsWithLocation.length > 0 && !initialFitDoneRef.current) {
            const bounds = new mapboxgl.LngLatBounds();
            itemsWithLocation.forEach(item => {
                bounds.extend([parseFloat(item.longitude), parseFloat(item.latitude)]);
            });

            mapRef.current.fitBounds(bounds, {
                padding: 80,
                maxZoom: 12,
            });

            initialFitDoneRef.current = true;
        }
    }, [items, onItemClick, isLoaded]);

    // Handle search
    const handleSearch = async () => {
        if (!searchQuery.trim() || !mapRef.current) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxgl.accessToken}&limit=1`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                mapRef.current.flyTo({
                    center: [lng, lat],
                    zoom: 10,
                });
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    // Map controls
    const handleZoomIn = () => mapRef.current?.zoomIn();
    const handleZoomOut = () => mapRef.current?.zoomOut();
    const handleCenter = () => {
        if (!mapRef.current) return;

        const itemsWithLocation = items.filter(item => item.latitude && item.longitude);
        if (itemsWithLocation.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            itemsWithLocation.forEach(item => {
                bounds.extend([item.longitude, item.latitude]);
            });
            mapRef.current.fitBounds(bounds, { padding: 80 });
        } else {
            mapRef.current.flyTo({ center: [0, 20], zoom: 2 });
        }
    };

    const toggleMapStyle = () => {
        const styleKeys = Object.keys(styles);
        const currentIndex = styleKeys.indexOf(mapStyle);
        const nextIndex = (currentIndex + 1) % styleKeys.length;
        setMapStyle(styleKeys[nextIndex]);
    };

    return (
        <div className="relative w-full h-full">
            {/* Map container */}
            <div ref={mapContainerRef} className="absolute inset-0" />

            {/* Search bar */}
            <div className="absolute top-4 left-4 right-4 max-w-md">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={t('brainstorm.searchLocation', 'Search location...')}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            </div>

            {/* Map controls */}
            <div className="absolute right-4 top-20 flex flex-col gap-2">
                <button
                    onClick={handleZoomIn}
                    className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                    title={t('map.zoomIn', 'Zoom in')}
                >
                    <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                    title={t('map.zoomOut', 'Zoom out')}
                >
                    <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                    onClick={toggleMapStyle}
                    className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                    title={t('map.changeStyle', 'Change map style')}
                >
                    <Layers className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                    onClick={handleCenter}
                    className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                    title={t('map.center', 'Center map')}
                >
                    <Navigation className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
            </div>

            {/* Legend - positioned higher when there's a bottom offset */}
            <div
                className={`absolute left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg ${compact ? 'px-2.5 py-1.5' : 'p-3'} border border-gray-200 dark:border-gray-700`}
                style={{
                    bottom: bottomOffset > 0 ? `${bottomOffset + 16}px` : (compact ? '32px' : '16px'),
                }}
            >
                {!compact && (
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        {t('brainstorm.legend', 'Item types')}
                    </div>
                )}
                <div className={`flex ${compact ? 'gap-2' : 'flex-wrap gap-2'}`}>
                    {Object.entries(MARKER_COLORS).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-1">
                            <div
                                className={`${compact ? 'w-2 h-2' : 'w-3 h-3'} rounded-full flex-shrink-0`}
                                style={{ backgroundColor: color }}
                            />
                            <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-600 dark:text-gray-300 capitalize`}>
                                {type}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Click hint - hidden on compact/mobile */}
            {canEdit && !compact && (
                <div className="absolute bottom-4 right-4 bg-accent/90 text-white rounded-xl px-3 py-2 text-sm shadow-lg">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {t('brainstorm.clickToAdd', 'Click anywhere to add an item')}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper function to get SVG path for each icon type
function getIconPath(type) {
    switch (type) {
        case 'place':
            return '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>';
        case 'note':
            return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
        case 'image':
            return '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>';
        case 'link':
            return '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>';
        case 'idea':
        default:
            return '<line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>';
    }
}

export default BrainstormMap;
