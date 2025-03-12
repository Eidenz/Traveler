// client/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized errors (expired token, etc.)
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (formData) => api.put('/users/profile', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  changePassword: (passwordData) => api.put('/users/password', passwordData),
  searchUsers: (query) => api.get(`/users/search?query=${query}`),
};

// Trip API
export const tripAPI = {
  getUserTrips: () => api.get('/trips'),
  getTripById: (tripId) => api.get(`/trips/${tripId}`),
  createTrip: (tripData) => api.post('/trips', tripData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  updateTrip: (tripId, tripData) => api.put(`/trips/${tripId}`, tripData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  deleteTrip: (tripId) => api.delete(`/trips/${tripId}`),
  shareTrip: (tripId, shareData) => api.post(`/trips/${tripId}/share`, shareData),
  removeTripMember: (tripId, userId) => api.delete(`/trips/${tripId}/members/${userId}`),
};

// Transportation API
export const transportAPI = {
  getTripTransportation: (tripId) => api.get(`/transportation/trip/${tripId}`),
  getTransportation: (transportId) => api.get(`/transportation/${transportId}`),
  createTransportation: (tripId, transportData) => {
    // Ensure trip_id is included in the data for middleware
    const data = { ...transportData, trip_id: tripId };
    return api.post(`/transportation/trip/${tripId}`, data);
  },
  updateTransportation: (transportId, transportData, tripId) => {
    // Include tripId in the query parameters
    return api.put(`/transportation/${transportId}?tripId=${tripId}`, transportData);
  },
  deleteTransportation: (transportId, tripId) => api.delete(`/transportation/${transportId}?tripId=${tripId}`),
};

// Lodging API
export const lodgingAPI = {
  getTripLodging: (tripId) => api.get(`/lodging/trip/${tripId}`),
  getLodging: (lodgingId) => api.get(`/lodging/${lodgingId}`),
  createLodging: (tripId, lodgingData) => {
    // Ensure trip_id is included in the data for middleware
    const data = { ...lodgingData, trip_id: tripId };
    return api.post(`/lodging/trip/${tripId}`, data);
  },
  updateLodging: (lodgingId, lodgingData, tripId) => {
    // Include tripId in the query parameters
    return api.put(`/lodging/${lodgingId}?tripId=${tripId}`, lodgingData);
  },
  deleteLodging: (lodgingId, tripId) => api.delete(`/lodging/${lodgingId}?tripId=${tripId}`),
};

// Activity API
export const activityAPI = {
  getTripActivities: (tripId) => api.get(`/activities/trip/${tripId}`),
  getActivity: (activityId) => api.get(`/activities/${activityId}`),
  createActivity: (tripId, activityData) => {
    // Ensure trip_id is included in the data for middleware
    const data = { ...activityData, trip_id: tripId };
    return api.post(`/activities/trip/${tripId}`, data);
  },
  updateActivity: (activityId, activityData, tripId) => {
    // Include tripId in the query parameters
    return api.put(`/activities/${activityId}?tripId=${tripId}`, activityData);
  },
  deleteActivity: (activityId, tripId) => api.delete(`/activities/${activityId}?tripId=${tripId}`),
};

// Document API
export const documentAPI = {
  uploadDocument: (documentData) => api.post('/documents', documentData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getDocument: (documentId) => api.get(`/documents/${documentId}`),
  downloadDocument: (documentId) => api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  }),
  deleteDocument: (documentId, tripId) => api.delete(`/documents/${documentId}?tripId=${tripId}`),
  viewDocumentAsBlob: (documentId) => api.get(`/documents/${documentId}/view`, {
    responseType: 'blob',
  }),
};

export default api;