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
  className = ''
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
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
  }, [trip, activities, hasToken]);

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

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error('Map initialization error:', error);
      setHasToken(false);
    }
  }, [hasToken, getMapPoints, getCenter, mapStyle]);

  // Update markers when data changes
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const points = getMapPoints();

    // Add connecting lines between activity points
    if (points.length > 1 && map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Get activity points in order for route line
    const activityPoints = points.filter(p => p.type === 'activity');
    if (activityPoints.length > 1) {
      const lineCoordinates = activityPoints.map(p => [p.lng, p.lat]);

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: lineCoordinates
          }
        }
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
    }

    // Add markers for each point
    points.forEach((point, index) => {
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'map-marker-wrapper';

      const isSelected = point.data?.id === selectedActivityId;
      const isMain = point.isMain;

      // Different styles based on type
      let bgColor = '#0f1419';
      let content = '📍';

      if (point.type === 'trip' && isMain) {
        bgColor = '#e63946';
        content = '🎯';
      } else if (point.type === 'activity') {
        bgColor = isSelected ? '#e63946' : '#8b5cf6';
        // Show step number instead of emoji
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

      // Click handler for activities
      if (point.type === 'activity' && point.data) {
        el.addEventListener('click', () => {
          if (onActivityClick) onActivityClick(point.data);
        });
      }

      // Hover effects
      el.addEventListener('mouseenter', () => {
        el.querySelector('.map-marker').style.transform = 'scale(1.2)';
        el.querySelector('.marker-tooltip').style.opacity = '1';
      });

      el.addEventListener('mouseleave', () => {
        if (!isSelected) {
          el.querySelector('.map-marker').style.transform = 'scale(1)';
        }
        el.querySelector('.marker-tooltip').style.opacity = '0';
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([point.lng, point.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (points.length > 0) {
      const coordinates = points.map(p => [p.lng, p.lat]);

      if (coordinates.length === 1) {
        // Single point - just center on it
        map.current.flyTo({
          center: coordinates[0],
          zoom: 13,
          duration: 1000,
        });
      } else {
        // Multiple points - fit bounds
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 14,
          duration: 1000,
        });
      }
    }
  }, [getMapPoints, isLoaded, selectedActivityId, onActivityClick]);

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

      {/* Custom controls */}
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

      {/* Legend */}
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
