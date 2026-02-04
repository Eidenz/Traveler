// server/utils/weatherService.js
// Weather service using Open-Meteo (free, no API key required)

/**
 * Weather code to condition mapping based on WMO codes
 * https://open-meteo.com/en/docs
 */
const weatherCodeToCondition = {
    0: { condition: 'Clear sky', icon: '☀️' },
    1: { condition: 'Mainly clear', icon: '🌤️' },
    2: { condition: 'Partly cloudy', icon: '⛅' },
    3: { condition: 'Overcast', icon: '☁️' },
    45: { condition: 'Foggy', icon: '🌫️' },
    48: { condition: 'Depositing rime fog', icon: '🌫️' },
    51: { condition: 'Light drizzle', icon: '🌧️' },
    53: { condition: 'Moderate drizzle', icon: '🌧️' },
    55: { condition: 'Dense drizzle', icon: '🌧️' },
    56: { condition: 'Light freezing drizzle', icon: '🌧️' },
    57: { condition: 'Dense freezing drizzle', icon: '🌧️' },
    61: { condition: 'Slight rain', icon: '🌧️' },
    63: { condition: 'Moderate rain', icon: '🌧️' },
    65: { condition: 'Heavy rain', icon: '🌧️' },
    66: { condition: 'Light freezing rain', icon: '🌧️' },
    67: { condition: 'Heavy freezing rain', icon: '🌧️' },
    71: { condition: 'Slight snow', icon: '🌨️' },
    73: { condition: 'Moderate snow', icon: '🌨️' },
    75: { condition: 'Heavy snow', icon: '❄️' },
    77: { condition: 'Snow grains', icon: '🌨️' },
    80: { condition: 'Slight rain showers', icon: '🌦️' },
    81: { condition: 'Moderate rain showers', icon: '🌦️' },
    82: { condition: 'Violent rain showers', icon: '⛈️' },
    85: { condition: 'Slight snow showers', icon: '🌨️' },
    86: { condition: 'Heavy snow showers', icon: '❄️' },
    95: { condition: 'Thunderstorm', icon: '⛈️' },
    96: { condition: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { condition: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

/**
 * Get coordinates for a location using Open-Meteo's geocoding API
 * @param {string} locationName - Name of the location (city, address, etc.)
 * @returns {Promise<{lat: number, lon: number, name: string} | null>}
 */
const geocodeLocation = async (locationName) => {
    if (!locationName || locationName.trim() === '') {
        return null;
    }

    try {
        const encodedLocation = encodeURIComponent(locationName.trim());
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodedLocation}&count=1&language=en&format=json`
        );

        if (!response.ok) {
            console.error(`Geocoding API error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            console.log(`No geocoding results found for: ${locationName}`);
            return null;
        }

        const result = data.results[0];
        return {
            lat: result.latitude,
            lon: result.longitude,
            name: result.name,
            country: result.country || '',
        };
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
};

/**
 * Get weather forecast for a specific date and location
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{temp: number, tempMax: number, tempMin: number, condition: string, icon: string} | null>}
 */
const getWeatherForDate = async (latitude, longitude, date) => {
    try {
        // Open-Meteo allows forecasting up to 16 days ahead
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${date}&end_date=${date}`
        );

        if (!response.ok) {
            console.error(`Weather API error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
            console.log(`No weather data found for date: ${date}`);
            return null;
        }

        const tempMax = data.daily.temperature_2m_max[0];
        const tempMin = data.daily.temperature_2m_min[0];
        const weatherCode = data.daily.weathercode[0];

        // Get condition info from weather code
        const conditionInfo = weatherCodeToCondition[weatherCode] || {
            condition: 'Unknown',
            icon: '🌡️'
        };

        // Calculate average temperature
        const avgTemp = Math.round((tempMax + tempMin) / 2);

        return {
            temp: avgTemp,
            tempMax: Math.round(tempMax),
            tempMin: Math.round(tempMin),
            condition: conditionInfo.condition,
            icon: conditionInfo.icon,
        };
    } catch (error) {
        console.error('Weather fetch error:', error.message);
        return null;
    }
};

/**
 * Get weather for a trip location on a specific date
 * This is the main function to use - it handles geocoding and weather fetching
 * @param {string} locationName - Name of the trip destination
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{temp: number, tempMax: number, tempMin: number, condition: string, icon: string, locationName: string} | null>}
 */
const getWeatherForTrip = async (locationName, date) => {
    try {
        // Step 1: Geocode the location
        const coords = await geocodeLocation(locationName);
        if (!coords) {
            console.log(`Could not geocode location: ${locationName}`);
            return null;
        }

        // Step 2: Get weather for the date
        const weather = await getWeatherForDate(coords.lat, coords.lon, date);
        if (!weather) {
            console.log(`Could not get weather for: ${coords.name} on ${date}`);
            return null;
        }

        return {
            ...weather,
            locationName: coords.name,
            country: coords.country,
        };
    } catch (error) {
        console.error('getWeatherForTrip error:', error.message);
        return null;
    }
};

module.exports = {
    geocodeLocation,
    getWeatherForDate,
    getWeatherForTrip,
    weatherCodeToCondition,
};
