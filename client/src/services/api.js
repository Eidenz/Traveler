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
  deleteAccount: (password) => api.delete('/users/account', { 
    data: { password } 
  }),
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
    // Check if data contains banner_image, if so use FormData
    if (transportData.banner_image instanceof File) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in transportData) {
        if (key === 'banner_image') {
          formData.append('banner_image', transportData.banner_image);
        } else {
          formData.append(key, transportData[key]);
        }
      }
      // Ensure trip_id is included in the data for middleware
      formData.append('trip_id', tripId);
      
      return api.post(`/transportation/trip/${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Regular JSON request if no file
      const data = { ...transportData, trip_id: tripId };
      return api.post(`/transportation/trip/${tripId}`, data);
    }
  },
  updateTransportation: (transportId, transportData, tripId) => {
    // Check if data contains banner_image or remove_banner flag
    if (transportData.banner_image instanceof File || transportData.remove_banner) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in transportData) {
        if (key === 'banner_image' && transportData[key] instanceof File) {
          formData.append('banner_image', transportData[key]);
        } else if (key !== 'banner_image' || typeof transportData[key] === 'string') {
          formData.append(key, transportData[key]);
        }
      }
      // Include tripId for middleware
      formData.append('trip_id', tripId);
      
      return api.put(`/transportation/${transportId}?tripId=${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Include tripId in the query parameters
      return api.put(`/transportation/${transportId}?tripId=${tripId}`, transportData);
    }
  },
  deleteTransportation: (transportId, tripId) => api.delete(`/transportation/${transportId}?tripId=${tripId}`),
};

// Lodging API
export const lodgingAPI = {
  getTripLodging: (tripId) => api.get(`/lodging/trip/${tripId}`),
  getLodging: (lodgingId) => api.get(`/lodging/${lodgingId}`),
  createLodging: (tripId, lodgingData) => {
    // Check if data contains banner_image, if so use FormData
    if (lodgingData.banner_image instanceof File) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in lodgingData) {
        if (key === 'banner_image') {
          formData.append('banner_image', lodgingData.banner_image);
        } else {
          formData.append(key, lodgingData[key]);
        }
      }
      // Ensure trip_id is included in the data for middleware
      formData.append('trip_id', tripId);
      
      return api.post(`/lodging/trip/${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Regular JSON request if no file
      const data = { ...lodgingData, trip_id: tripId };
      return api.post(`/lodging/trip/${tripId}`, data);
    }
  },
  updateLodging: (lodgingId, lodgingData, tripId) => {
    // Check if data contains banner_image or remove_banner flag
    if (lodgingData.banner_image instanceof File || lodgingData.remove_banner) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in lodgingData) {
        if (key === 'banner_image' && lodgingData[key] instanceof File) {
          formData.append('banner_image', lodgingData[key]);
        } else if (key !== 'banner_image' || typeof lodgingData[key] === 'string') {
          formData.append(key, lodgingData[key]);
        }
      }
      // Include tripId for middleware
      formData.append('trip_id', tripId);
      
      return api.put(`/lodging/${lodgingId}?tripId=${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Include tripId in the query parameters
      return api.put(`/lodging/${lodgingId}?tripId=${tripId}`, lodgingData);
    }
  },
  deleteLodging: (lodgingId, tripId) => api.delete(`/lodging/${lodgingId}?tripId=${tripId}`),
};

// Activity API
export const activityAPI = {
  getTripActivities: (tripId) => api.get(`/activities/trip/${tripId}`),
  getActivity: (activityId) => api.get(`/activities/${activityId}`),
  createActivity: (tripId, activityData) => {
    // Check if data contains banner_image, if so use FormData
    if (activityData.banner_image instanceof File) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in activityData) {
        if (key === 'banner_image') {
          formData.append('banner_image', activityData.banner_image);
        } else {
          formData.append(key, activityData[key]);
        }
      }
      // Ensure trip_id is included in the data for middleware
      formData.append('trip_id', tripId);
      
      return api.post(`/activities/trip/${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Regular JSON request if no file
      const data = { ...activityData, trip_id: tripId };
      return api.post(`/activities/trip/${tripId}`, data);
    }
  },
  updateActivity: (activityId, activityData, tripId) => {
    // Check if data contains banner_image or remove_banner flag
    if (activityData.banner_image instanceof File || activityData.remove_banner) {
      const formData = new FormData();
      // Add all other fields to the form data
      for (const key in activityData) {
        if (key === 'banner_image' && activityData[key] instanceof File) {
          formData.append('banner_image', activityData[key]);
        } else if (key !== 'banner_image' || typeof activityData[key] === 'string') {
          formData.append(key, activityData[key]);
        }
      }
      // Include tripId for middleware
      formData.append('trip_id', tripId);
      
      return api.put(`/activities/${activityId}?tripId=${tripId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // Include tripId in the query parameters
      return api.put(`/activities/${activityId}?tripId=${tripId}`, activityData);
    }
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

// Checklist API
export const checklistAPI = {
  getTripChecklists: (tripId) => api.get(`/checklists/trip/${tripId}`),
  getChecklist: (checklistId) => api.get(`/checklists/${checklistId}`),
  createChecklist: (tripId, name) => api.post(`/checklists/trip/${tripId}`, { name }),
  updateChecklist: (checklistId, name, tripId) => api.put(`/checklists/${checklistId}`, { name, tripId }),
  deleteChecklist: (checklistId, tripId) => api.delete(`/checklists/${checklistId}`),
  createChecklistItem: (checklistId, itemData, tripId) => api.post(`/checklists/${checklistId}/items`, { ...itemData, trip_id: tripId }),
  updateChecklistItem: (itemId, itemData, tripId) => api.put(`/checklists/items/${itemId}`, { ...itemData, trip_id: tripId }),
  updateUserItemStatus: (itemId, status, tripId) => api.patch(`/checklists/items/${itemId}/user-status`, { status, trip_id: tripId }),
  deleteChecklistItem: (itemId, tripId) => api.delete(`/checklists/items/${itemId}?tripId=${tripId}`),
};

// Budget API
export const budgetAPI = {
  getTripBudget: (tripId) => api.get(`/budgets/trip/${tripId}`),
  createBudget: (tripId, budgetData) => api.post(`/budgets/trip/${tripId}`, budgetData),
  updateBudget: (budgetId, budgetData) => api.put(`/budgets/${budgetId}`, budgetData),
  addExpense: (budgetId, expenseData) => api.post(`/budgets/${budgetId}/expenses`, expenseData),
  updateExpense: (expenseId, expenseData) => api.put(`/budgets/expenses/${expenseId}`, expenseData),
  deleteExpense: (expenseId) => api.delete(`/budgets/expenses/${expenseId}`),
  deleteBudget: (budgetId, tripId) => api.delete(`/budgets/${budgetId}?tripId=${tripId}`),
};

export default api;