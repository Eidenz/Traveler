// client/src/utils/imageUtils.js

/**
 * Get the correct URL for an image path
 * @param {string} imagePath - The image path from the server (e.g., "/uploads/trips/image.jpg")
 * @returns {string} - The correctly formatted image URL
 */
export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    // If the path already starts with http, return it as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // In development, we can use the relative path because of Vite's proxy configuration
    if (import.meta.env.DEV) {
      // Make sure we're dealing with a path that starts with /uploads
      return imagePath.startsWith('/uploads') ? imagePath : `/uploads${imagePath}`;
    }
    
    // In production, use the base URL
    const baseUrl = import.meta.env.VITE_BASE_URL || '';
    return `${baseUrl}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
  };
  
  /**
   * Get a fallback image URL for when no image is provided
   * @param {string} type - The type of fallback image ('trip', 'profile', etc.)
   * @returns {string} - URL to a fallback image
   */
  export const getFallbackImageUrl = (type = 'trip') => {
    const fallbacks = {
      trip: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1',
      activity: 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c',
      lodging: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      transportation: 'https://images.unsplash.com/photo-1570125909232-eb263c186f2e',
      profile: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167',
    };
    
    return fallbacks[type] || fallbacks.trip;
  };