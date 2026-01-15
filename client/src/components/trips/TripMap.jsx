// client/src/components/trips/TripMap.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Plus, Minus, Layers, Navigation, MapPin } from 'lucide-react';
import { geocodeLocation, batchGeocode } from '../../utils/geocoding';

// Use environment variable for token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const TripMap = ({
  trip,
  activities = [],
  transportation = [],
  lodging = [],
  onActivityClick,
  selectedActivityId,
  compact = false, // Mobile/compact mode - hides controls and shows minimal legend
  className = ''
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const initialFitDoneRef = useRef(false); // Track if we've done initial fit
  const [mapStyle, setMapStyle] = useState('streets');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasToken, setHasToken] = useState(true);
  const [geocodedPoints, setGeocodedPoints] = useState([]);

  // Collect all locations with coordinates (from DB or geocoded)
  const getMapPoints = useCallback(() => {
    const points = [];

    // Add trip location if it has coordinates
    if (trip?.latitude && trip?.longitude) {
      points.push({
        id: 'trip-main',
        type: 'trip',
        name: trip.location || trip.name,
        lat: parseFloat(trip.latitude),
        lng: parseFloat(trip.longitude),
        isMain: true,
      });
    }

    // Add activities with coordinates
    activities.forEach((activity, index) => {
      if (activity.latitude && activity.longitude) {
        points.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          name: activity.name,
          location: activity.location,
          lat: parseFloat(activity.latitude),
          lng: parseFloat(activity.longitude),
          date: activity.date,
          time: activity.time,
          stepNumber: index + 1,
          data: activity,
        });
      }
    });

    // Add lodging locations
    lodging.forEach(l => {
      if (l.latitude && l.longitude) {
        points.push({
          id: `lodging-${l.id}`,
          type: 'lodging',
          name: l.name,
          lat: parseFloat(l.latitude),
          lng: parseFloat(l.longitude),
          data: l,
        });
      }
    });


    // Merge with geocoded points (from text locations)
    geocodedPoints.forEach(geoPoint => {
      // Only add if not already in points (avoid duplicates)
      if (!points.find(p => p.id === geoPoint.id)) {
        points.push(geoPoint);
      }
    });

    return points;
  }, [trip, activities, lodging, geocodedPoints]);

  // Get center point - prioritize trip location, then average of points, then world view
  const getCenter = useCallback(() => {
    const points = getMapPoints();

    if (points.length > 0) {
      // Calculate average of all points
      const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      return [avgLng, avgLat];
    }

    // Default to a nice world view (centered on Europe)
    return [10, 30];
  }, [getMapPoints]);

  // Check for token
  useEffect(() => {
    if (!mapboxgl.accessToken || mapboxgl.accessToken === '') {
      setHasToken(false);
    }
  }, []);

  // Geocode text locations when coordinates aren't available
  useEffect(() => {
    const geocodeLocations = async () => {
      if (!hasToken) return;

      const itemsToGeocode = [];

      // Check trip location
      if (trip?.location && !trip?.latitude && !trip?.longitude) {
        itemsToGeocode.push({
          id: 'trip-main',
          type: 'trip',
          location: trip.location,
          name: trip.location || trip.name,
          isMain: true
        });
      }

      // Check activities
      activities.forEach((activity, index) => {
        if (activity.location && !activity.latitude && !activity.longitude) {
          itemsToGeocode.push({
            id: `activity-${activity.id}`,
            type: 'activity',
            location: activity.location,
            name: activity.name,
            stepNumber: index + 1,
            data: activity,
            date: activity.date,
            time: activity.time
          });
        }
      });

      // Check lodging (uses 'address' instead of 'location')
      lodging.forEach(l => {
        // Use address or name for geocoding
        const locationToGeocode = l.address || l.name;
        if (locationToGeocode && !l.latitude && !l.longitude) {
          itemsToGeocode.push({
            id: `lodging-${l.id}`,
            type: 'lodging',
            location: locationToGeocode,
            name: l.name,
            data: l
          });
        }
      });

      // Geocode all items
      if (itemsToGeocode.length > 0) {
        console.log('Geocoding locations:', itemsToGeocode.map(i => i.location));
        const results = [];
        for (const item of itemsToGeocode) {
          const coords = await geocodeLocation(item.location);
          if (coords) {
            console.log(`Geocoded "${item.location}" to:`, coords);
            results.push({
              ...item,
              lat: coords.lat,
              lng: coords.lng
            });
          }
        }
        console.log('Geocoded points:', results);
        setGeocodedPoints(results);
      } else {
        setGeocodedPoints([]);
      }
    };

    geocodeLocations();
  }, [trip, activities, lodging, hasToken]);

  // Initialize map
  useEffect(() => {
    if (map.current || !hasToken) return;

    try {
      const points = getMapPoints();
      const initialZoom = points.length > 0 ? 10 : 2;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/${mapStyle}-v12`,
        center: getCenter(),
        zoom: initialZoom,
        pitch: 0,
        bearing: 0,
      });

      map.current.on('load', () => {
        setIsLoaded(true);
      });

      // Enable scroll zoom
      map.current.scrollZoom.enable();

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'bottom-right'
      );

      // Resize observer to handle panel resizing (debounced)
      let resizeTimeout;
      const resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 100);
      });
      resizeObserver.observe(mapContainer.current);

      return () => {
        clearTimeout(resizeTimeout);
        resizeObserver.disconnect();
        // Clean up markers
        markersRef.current.forEach(item => {
          if (item && item.marker && typeof item.marker.remove === 'function') {
            item.marker.remove();
          } else if (item && typeof item.remove === 'function') {
            item.remove();
          }
        });
        markersRef.current = [];
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error('Map initialization error:', error);
      setHasToken(false);
    }
    // Note: We intentionally exclude getMapPoints and getCenter from dependencies
    // because we only want to initialize the map once. Marker updates are handled
    // by the separate marker update effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, mapStyle]);

  // Helper to create a marker element
  const createMarkerElement = useCallback((point, isSelected) => {
    const el = document.createElement('div');
    el.className = 'map-marker-wrapper';
    el.dataset.pointId = point.id;

    const isMain = point.isMain;

    // Different styles based on type
    let bgColor = '#0f1419';
    let content = '📍';

    if (point.type === 'trip' && isMain) {
      bgColor = '#e63946';
      content = '🎯';
    } else if (point.type === 'activity') {
      bgColor = isSelected ? '#e63946' : '#8b5cf6';
      content = `<span style="color: white; font-weight: 600; font-size: 14px;">${point.stepNumber}</span>`;
    } else if (point.type === 'lodging') {
      bgColor = '#10b981';
      content = '🏨';
    }

    el.innerHTML = `
      <div class="map-marker" style="
        width: ${isMain ? '40px' : '36px'};
        height: ${isMain ? '40px' : '36px'};
        background: ${bgColor};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isMain ? '16px' : '12px'};
        transition: all 0.2s ease;
        ${isSelected ? 'transform: scale(1.2);' : ''}
      ">
        ${content}
      </div>
      <div class="marker-tooltip" style="
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        margin-bottom: 8px;
        color: #1f2937;
      ">
        ${point.stepNumber ? `Step ${point.stepNumber}: ` : ''}${point.name}
      </div>
    `;

    // Hover effects
    el.addEventListener('mouseenter', () => {
      const markerEl = el.querySelector('.map-marker');
      const tooltipEl = el.querySelector('.marker-tooltip');
      if (markerEl) markerEl.style.transform = 'scale(1.2)';
      if (tooltipEl) tooltipEl.style.opacity = '1';
    });

    el.addEventListener('mouseleave', () => {
      const markerEl = el.querySelector('.map-marker');
      const tooltipEl = el.querySelector('.marker-tooltip');
      if (!isSelected && markerEl) {
        markerEl.style.transform = 'scale(1)';
      }
      if (tooltipEl) tooltipEl.style.opacity = '0';
    });

    return el;
  }, []);

  // Update markers when data changes - optimized to avoid full refresh
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const points = getMapPoints();

    // Check if map style is fully loaded before modifying sources
    if (!map.current.isStyleLoaded()) {
      map.current.once('style.load', () => {
        setIsLoaded(true);
      });
      return;
    }

    // Track which marker IDs we've seen
    const existingMarkerIds = new Set();

    // Get activity points for route line
    const activityPoints = points.filter(p => p.type === 'activity');
    const lineCoordinates = activityPoints.length > 1
      ? activityPoints.map(p => [p.lng, p.lat])
      : [];

    // Update or create route source/layer
    const routeSource = map.current.getSource('route');
    if (lineCoordinates.length > 1) {
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
          map.current.addSource('route', {
            type: 'geojson',
            data: routeData
          });
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#8b5cf6',
              'line-width': 3,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2]
            }
          });
        } catch (e) {
          console.warn('Error adding route layer:', e);
        }
      }
    } else if (routeSource) {
      // Remove route if no longer needed
      try {
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        map.current.removeSource('route');
      } catch (e) {
        // Ignore errors
      }
    }

    // Update existing markers or add new ones
    const existingMarkersMap = new Map();
    markersRef.current.forEach((item) => {
      // Handle both old format (just marker) and new format ({id, marker, element})
      if (item && item.id && item.marker) {
        existingMarkersMap.set(item.id, { marker: item.marker, element: item.element });
      } else if (item && typeof item.remove === 'function') {
        // Old format marker without ID - remove it
        item.remove();
      }
    });

    const newMarkers = [];

    points.forEach((point) => {
      const isSelected = point.data?.id === selectedActivityId;
      existingMarkerIds.add(point.id);

      const existing = existingMarkersMap.get(point.id);

      if (existing) {
        // Update existing marker position if changed
        const currentPos = existing.marker.getLngLat();
        if (currentPos.lng !== point.lng || currentPos.lat !== point.lat) {
          existing.marker.setLngLat([point.lng, point.lat]);
        }

        // Update marker styling if selection changed
        const markerEl = existing.element.querySelector('.map-marker');
        if (markerEl && point.type === 'activity') {
          const newBg = isSelected ? '#e63946' : '#8b5cf6';
          markerEl.style.background = newBg;
          markerEl.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
        }

        newMarkers.push({ id: point.id, marker: existing.marker, element: existing.element });
      } else {
        // Create new marker
        const el = createMarkerElement(point, isSelected);

        // Add click handler for activities
        if (point.type === 'activity' && point.data) {
          el.addEventListener('click', () => {
            if (onActivityClick) onActivityClick(point.data);
          });
        }

        const marker = new mapboxgl.Marker(el)
          .setLngLat([point.lng, point.lat])
          .addTo(map.current);

        newMarkers.push({ id: point.id, marker, element: el });
      }
    });

    // Remove markers that no longer exist in points
    existingMarkersMap.forEach(({ marker }, id) => {
      if (!existingMarkerIds.has(id)) {
        marker.remove();
      }
    });

    markersRef.current = newMarkers;

    // Fit bounds to show all markers - ONLY on initial load
    if (points.length > 0 && !initialFitDoneRef.current) {
      const coordinates = points.map(p => [p.lng, p.lat]);

      if (coordinates.length === 1) {
        map.current.flyTo({
          center: coordinates[0],
          zoom: 13,
          duration: 1000,
        });
      } else {
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 14,
          duration: 1000,
        });
      }

      initialFitDoneRef.current = true;
    }
  }, [getMapPoints, isLoaded, selectedActivityId, onActivityClick, createMarkerElement]);

  // Handle style change
  const toggleMapStyle = () => {
    const styles = ['streets', 'satellite-streets', 'outdoors', 'light'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    const newStyle = styles[nextIndex];

    setMapStyle(newStyle);
    if (map.current) {
      map.current.setStyle(`mapbox://styles/mapbox/${newStyle}-v12`);
      map.current.once('style.load', () => {
        setIsLoaded(true);
      });
    }
  };

  // Zoom controls
  const handleZoomIn = () => map.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map.current?.zoomOut({ duration: 300 });

  // Center on trip
  const handleCenter = () => {
    if (!map.current) return;

    const points = getMapPoints();
    if (points.length === 0) return;

    const coordinates = points.map(p => [p.lng, p.lat]);

    if (coordinates.length === 1) {
      map.current.flyTo({
        center: coordinates[0],
        zoom: 13,
        duration: 1000,
      });
    } else {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 14,
        duration: 1000,
      });
    }
  };

  // No token state
  if (!hasToken) {
    return (
      <div className={`relative w-full h-full bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Map unavailable
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            Add your Mapbox token to <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">.env</code> as <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">VITE_MAPBOX_TOKEN</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Gradient overlay for left panel edge */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/20 to-transparent pointer-events-none dark:from-gray-900/20" />

      {/* Custom controls - hidden in compact mode */}
      {!compact && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Zoom in"
          >
            <Plus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Zoom out"
          >
            <Minus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="w-10 h-px bg-gray-200 dark:bg-gray-700 mx-auto" />
          <button
            onClick={toggleMapStyle}
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Change map style"
          >
            <Layers className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={handleCenter}
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Center on trip"
          >
            <Navigation className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Legend - compact version for mobile, full version for desktop */}
      {compact ? (
        // Compact inline legend for mobile - positioned higher with text labels
        <div className="absolute bottom-6 left-2 right-2 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md text-xs">
            <div className="flex items-center gap-1">
              <span className="text-sm">🎯</span>
              <span className="text-gray-600 dark:text-gray-300">Trip</span>
            </div>
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-semibold">1</div>
              <span className="text-gray-600 dark:text-gray-300">Activity</span>
            </div>
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-1">
              <span className="text-sm">🏨</span>
              <span className="text-gray-600 dark:text-gray-300">Stay</span>
            </div>
          </div>
        </div>
      ) : (
        // Full legend for desktop
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span className="text-gray-600 dark:text-gray-300">Trip location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-semibold">1</div>
              <span className="text-gray-600 dark:text-gray-300">Activity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🏨</span>
              <span className="text-gray-600 dark:text-gray-300">Lodging</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMap;
