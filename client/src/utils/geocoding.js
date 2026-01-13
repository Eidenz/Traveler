// client/src/utils/geocoding.js
/**
 * Geocoding utilities using Mapbox Geocoding API
 */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

/**
 * Geocode a location string to coordinates
 * @param {string} location - Location text (e.g., "Tokyo, Japan")
 * @returns {Promise<{lng: number, lat: number} | null>} Coordinates or null if not found
 */
export const geocodeLocation = async (location) => {
    if (!location || !MAPBOX_TOKEN) {
        return null;
    }

    try {
        const encodedLocation = encodeURIComponent(location);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${MAPBOX_TOKEN}&limit=1`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lng, lat };
        }

        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};

/**
 * Batch geocode multiple locations
 * @param {Array<{id: string, location: string}>} items - Items with location text
 * @returns {Promise<Array<{id: string, lng: number, lat: number}>>} Geocoded coordinates
 */
export const batchGeocode = async (items) => {
    const results = [];

    for (const item of items) {
        if (item.location) {
            const coords = await geocodeLocation(item.location);
            if (coords) {
                results.push({
                    id: item.id,
                    ...coords
                });
            }
        }
    }

    return results;
};
