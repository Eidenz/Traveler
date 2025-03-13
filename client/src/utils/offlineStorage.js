// client/src/utils/offlineStorage.js
/**
 * Utility functions for handling offline storage of trip data
 * Uses IndexedDB for storing trip details and document blobs
 * Updated to work with both legacy numeric IDs and new string IDs
 */

const DB_NAME = 'traveler_offline_db';
const DB_VERSION = 2; // Increment version to trigger migration
const TRIPS_STORE = 'trips';
const DOCUMENTS_STORE = 'documents';

/**
 * Ensure the ID is in the correct format for storage/retrieval
 * Handles both numeric IDs (legacy) and string IDs (new format)
 * 
 * @param {string|number} id - The ID to normalize
 * @returns {string|number} The normalized ID
 */
const normalizeId = (id) => {
  // If it's already a string that starts with 'trip_', return as is
  if (typeof id === 'string' && id.startsWith('trip_')) {
    return id;
  }
  
  // If it can be parsed as an integer, it's a legacy ID
  const numericId = parseInt(id, 10);
  if (!isNaN(numericId) && numericId.toString() === id.toString()) {
    return numericId;
  }
  
  // Otherwise, return as string
  return id.toString();
};

/**
 * Initialize the IndexedDB database
 * @returns {Promise} A promise that resolves when the database is ready
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create trips store or update it if needed
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        const tripsStore = db.createObjectStore(TRIPS_STORE, { keyPath: 'id' });
        tripsStore.createIndex('start_date', 'start_date', { unique: false });
        tripsStore.createIndex('end_date', 'end_date', { unique: false });
      }
      
      // Create documents store or update it if needed
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const documentsStore = db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
        documentsStore.createIndex('trip_id', 'trip_id', { unique: false });
        documentsStore.createIndex('reference_type', 'reference_type', { unique: false });
        documentsStore.createIndex('reference_id', 'reference_id', { unique: false });
      }
      
      // Migration: If we're upgrading from version 1 to 2, we don't need
      // to do anything to the existing data as the keyPath type is flexible
      console.log('IndexedDB upgraded to version', event.newVersion);
    };
  });
};

/**
 * Get a database connection
 * @returns {Promise} A promise that resolves with the database connection
 */
export const getDB = async () => {
  try {
    return await initDB();
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
};

/**
 * Save a trip data for offline use
 * @param {Object} tripData - The complete trip data object including nested arrays
 * @returns {Promise} A promise that resolves when the trip is saved
 */
export const saveTripOffline = async (tripData) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([TRIPS_STORE], 'readwrite');
    const store = transaction.objectStore(TRIPS_STORE);
    
    // Ensure ID is saved in the correct format
    const normalizedTripData = {
      ...tripData,
      id: normalizeId(tripData.id),
      offlineSavedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(normalizedTripData);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error saving trip offline:', error);
    throw error;
  }
};

/**
 * Save a document blob for offline use
 * @param {Object} documentInfo - Document metadata
 * @param {Blob} blob - The document blob
 * @returns {Promise} A promise that resolves when the document is saved
 */
export const saveDocumentOffline = async (documentInfo, blob) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([DOCUMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    
    // Normalize IDs for storage
    const docToSave = {
      ...documentInfo,
      id: normalizeId(documentInfo.id),
      trip_id: normalizeId(documentInfo.trip_id),
      reference_id: normalizeId(documentInfo.reference_id),
      blob: blob,
      offlineSavedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(docToSave);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error saving document offline:', error);
    throw error;
  }
};

/**
 * Get a trip from offline storage
 * @param {number|string} tripId - The ID of the trip to retrieve
 * @returns {Promise<Object>} A promise that resolves with the trip data
 */
export const getTripOffline = async (tripId) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([TRIPS_STORE], 'readonly');
    const store = transaction.objectStore(TRIPS_STORE);
    
    // Normalize the ID for retrieval
    const normalizedId = normalizeId(tripId);
    
    return new Promise((resolve, reject) => {
      const request = store.get(normalizedId);
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error getting trip from offline storage:', error);
    throw error;
  }
};

/**
 * Get documents associated with a trip from offline storage
 * @param {number|string} tripId - The ID of the trip
 * @returns {Promise<Array>} A promise that resolves with an array of documents
 */
export const getTripDocumentsOffline = async (tripId) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([DOCUMENTS_STORE], 'readonly');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const tripIdIndex = store.index('trip_id');
    
    // Normalize the ID for retrieval
    const normalizedId = normalizeId(tripId);
    
    return new Promise((resolve, reject) => {
      const request = tripIdIndex.getAll(normalizedId);
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error getting trip documents from offline storage:', error);
    throw error;
  }
};

/**
 * Get a specific document from offline storage
 * @param {number|string} documentId - The ID of the document
 * @returns {Promise<Object>} A promise that resolves with the document data
 */
export const getDocumentOffline = async (documentId) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([DOCUMENTS_STORE], 'readonly');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    
    // Normalize the ID for retrieval
    const normalizedId = normalizeId(documentId);
    
    return new Promise((resolve, reject) => {
      const request = store.get(normalizedId);
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error getting document from offline storage:', error);
    throw error;
  }
};

/**
 * Get documents for a specific reference type and ID from offline storage
 * @param {string} referenceType - The type of reference ('transport', 'lodging', 'activity')
 * @param {number|string} referenceId - The ID of the reference
 * @returns {Promise<Array>} A promise that resolves with an array of documents
 */
export const getDocumentsForReference = async (referenceType, referenceId) => {
  try {
    const db = await getDB();
    const transaction = db.transaction([DOCUMENTS_STORE], 'readonly');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    
    // Normalize the reference ID
    const normalizedRefId = normalizeId(referenceId);
    
    // Get all documents and filter
    const allDocs = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
    
    // Filter the documents by reference type and normalized ID
    // Using loose comparison with toString() to handle both string and numeric IDs
    return allDocs.filter(doc => 
      doc.reference_type === referenceType && 
      normalizeId(doc.reference_id) === normalizedRefId
    );
  } catch (error) {
    console.error('Error getting documents by reference from offline storage:', error);
    throw error;
  }
};

/**
 * Check if a trip is available offline
 * @param {number|string} tripId - The ID of the trip to check
 * @returns {Promise<boolean>} A promise that resolves with true if the trip is available offline
 */
export const isTripAvailableOffline = async (tripId) => {
  try {
    const trip = await getTripOffline(tripId);
    return !!trip;
  } catch (error) {
    console.error('Error checking if trip is available offline:', error);
    return false;
  }
};

/**
 * Remove a trip and its documents from offline storage
 * @param {number|string} tripId - The ID of the trip to remove
 * @returns {Promise} A promise that resolves when the trip is removed
 */
export const removeTripOffline = async (tripId) => {
  try {
    const db = await getDB();
    
    // Normalize the trip ID
    const normalizedTripId = normalizeId(tripId);
    
    // First get all documents for this trip
    const documents = await getTripDocumentsOffline(tripId);
    
    // Now create a new transaction for documents if needed
    if (documents && documents.length > 0) {
      const docTx = db.transaction([DOCUMENTS_STORE], 'readwrite');
      const docStore = docTx.objectStore(DOCUMENTS_STORE);
      
      // Use Promise.all to handle all document deletions
      await Promise.all(documents.map(doc => {
        return new Promise((resolve, reject) => {
          const request = docStore.delete(normalizeId(doc.id));
          request.onsuccess = resolve;
          request.onerror = event => reject(event.target.error);
        });
      }));
    }
    
    // Create a separate transaction for deleting the trip
    const tripTx = db.transaction([TRIPS_STORE], 'readwrite');
    const tripStore = tripTx.objectStore(TRIPS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = tripStore.delete(normalizedTripId);
      request.onsuccess = () => resolve();
      request.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error removing trip from offline storage:', error);
    throw error;
  }
};

/**
 * Get all offline trips
 * @returns {Promise<Array>} A promise that resolves with an array of all offline trips
 */
export const getAllOfflineTrips = async () => {
  try {
    const db = await getDB();
    const transaction = db.transaction([TRIPS_STORE], 'readonly');
    const store = transaction.objectStore(TRIPS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error getting all offline trips:', error);
    throw error;
  }
};