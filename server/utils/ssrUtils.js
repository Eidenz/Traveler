// server/utils/ssrUtils.js

/**
 * Get a fallback image URL for SSR meta tags.
 * This is a server-side utility.
 * @param {string} type - The type of fallback image ('trip', 'profile', etc.)
 * @returns {string} - URL to a fallback image
 */
const getFallbackImageUrl = (type = 'trip') => {
  const fallbacks = {
    trip: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1',
    // We can add other types here if needed for future SSR features
  };
  return fallbacks[type] || fallbacks.trip;
};

module.exports = {
  getFallbackImageUrl
};