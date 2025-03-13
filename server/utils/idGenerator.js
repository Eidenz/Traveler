// server/utils/idGenerator.js
const crypto = require('crypto');

/**
 * Generates a secure random ID for trips
 * Format: 'trip_' prefix + 10 random bytes encoded as hex
 * This creates IDs like: trip_a1b2c3d4e5f67890
 * 
 * @returns {string} A random trip ID
 */
const generateTripId = () => {
  // Generate 10 random bytes (20 hex characters)
  const randomBytes = crypto.randomBytes(10).toString('hex');
  
  // Add 'trip_' prefix for readability and to ensure it starts with a letter
  return `trip_${randomBytes}`;
};

/**
 * Validates if a string is a valid trip ID format
 * 
 * @param {string} id - The ID to validate
 * @returns {boolean} True if the ID matches the expected format
 */
const isValidTripId = (id) => {
  // Check if the ID matches our format: 'trip_' followed by 20 hex characters
  return /^trip_[0-9a-f]{20}$/.test(id);
};

module.exports = {
  generateTripId,
  isValidTripId
};