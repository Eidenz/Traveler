// client/src/utils/offlineStorage.js

/**
 * Utility functions for handling offline storage of trip data
 * Uses IndexedDB for storing trip details and document blobs
 */

const DB_NAME = 'traveler_offline_db';
const DB_VERSION = 1;
const TRIPS_STORE = 'trips';
const DOCUMENTS_STORE = 'documents';

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
      
      // Create trips store
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        const tripsStore = db.createObjectStore(TRIPS_STORE, { keyPath: 'id' });
        tripsStore.createIndex('start_date', 'start_date', { unique: false });
        tripsStore.createIndex('end_date', 'end_date', { unique: false });
      }
      
      // Create documents store
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const documentsStore = db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
        documentsStore.createIndex('trip_id', 'trip_id', { unique: false });
        documentsStore.createIndex('reference_type', 'reference_type', { unique: false });
        documentsStore.createIndex('reference_id', 'reference_id', { unique: false });
      }
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
    
    // Add timestamp for when it was saved
    const tripToSave = {
      ...tripData,
      offlineSavedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(tripToSave);
      
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
    
    const docToSave = {
      ...documentInfo,
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
    
    return new Promise((resolve, reject) => {
      const request = store.get(parseInt(tripId, 10));
      
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
    
    return new Promise((resolve, reject) => {
      const request = tripIdIndex.getAll(parseInt(tripId, 10));
      
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
    
    return new Promise((resolve, reject) => {
      const request = store.get(parseInt(documentId, 10));
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error getting document from offline storage:', error);
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
    
    // Remove trip
    const tripTx = db.transaction([TRIPS_STORE], 'readwrite');
    const tripStore = tripTx.objectStore(TRIPS_STORE);
    
    // Get all documents for this trip
    const documents = await getTripDocumentsOffline(tripId);
    
    // Remove each document
    if (documents && documents.length > 0) {
      const docTx = db.transaction([DOCUMENTS_STORE], 'readwrite');
      const docStore = docTx.objectStore(DOCUMENTS_STORE);
      
      for (const doc of documents) {
        docStore.delete(doc.id);
      }
    }
    
    return new Promise((resolve, reject) => {
      const request = tripStore.delete(parseInt(tripId, 10));
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
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