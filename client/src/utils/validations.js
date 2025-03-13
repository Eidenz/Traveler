// client/src/utils/validations.js
/**
 * Utility to validate if a trip ID is in the correct format
 * This should match the format from server/utils/idGenerator.js
 * 
 * @param {string} id - The trip ID to validate
 * @returns {boolean} True if the ID is a valid trip ID
 */
export const isValidTripId = (id) => {
    if (!id || typeof id !== 'string') return false;
    
    // Check if the ID matches our format: 'trip_' followed by 20 hex characters
    return /^trip_[0-9a-f]{20}$/.test(id);
  };
  
  /**
   * Function to validate a trip ID in the URL params
   * Can be used with react-router to validate URL parameters
   * 
   * @param {string} id - The ID from URL params
   * @returns {boolean} True if the ID is valid
   */
  export const validateTripIdParam = (id) => {
    // During migration, we need to accept both formats
    // Remove this condition once all IDs are migrated
    if (!isNaN(id) && parseInt(id) > 0) {
      return true; // Accept legacy numeric IDs during transition
    }
    
    return isValidTripId(id);
  };