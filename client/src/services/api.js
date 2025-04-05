// client/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api'; // Use relative path for production

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
        // Only logout if not on login/register/reset pages
         const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
         if (!publicPaths.some(path => window.location.pathname.startsWith(path))) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login?sessionExpired=true'; // Redirect with flag
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
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }), // Added
  resetPassword: (token, passwordData) => api.post(`/auth/reset-password/${token}`, passwordData), // Added
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (formData) => api.put('/users/profile', formData, { // Uses FormData now
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
    const formData = new FormData();
    for (const key in transportData) {
       if (transportData[key] !== null && transportData[key] !== undefined) {
            formData.append(key, transportData[key]);
       }
    }
    // Ensure trip_id is included for middleware
    formData.append('trip_id', tripId);

    return api.post(`/transportation/trip/${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
 updateTransportation: (transportId, transportData, tripId) => {
    const formData = new FormData();
     for (const key in transportData) {
       if (transportData[key] !== null && transportData[key] !== undefined) {
         // Handle remove flag explicitly
         if (key === 'remove_banner' && transportData[key]) {
            formData.append('remove_banner', 'true');
         } else if (key !== 'remove_banner') {
             formData.append(key, transportData[key]);
         }
       }
     }
    // Include tripId for middleware
    formData.append('trip_id', tripId);

    return api.put(`/transportation/${transportId}?tripId=${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteTransportation: (transportId, tripId) => api.delete(`/transportation/${transportId}?tripId=${tripId}`),
};

// Lodging API
export const lodgingAPI = {
  getTripLodging: (tripId) => api.get(`/lodging/trip/${tripId}`),
  getLodging: (lodgingId) => api.get(`/lodging/${lodgingId}`),
  createLodging: (tripId, lodgingData) => {
    const formData = new FormData();
    for (const key in lodgingData) {
       if (lodgingData[key] !== null && lodgingData[key] !== undefined) {
            formData.append(key, lodgingData[key]);
       }
    }
    // Ensure trip_id is included for middleware
    formData.append('trip_id', tripId);

    return api.post(`/lodging/trip/${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  updateLodging: (lodgingId, lodgingData, tripId) => {
     const formData = new FormData();
     for (const key in lodgingData) {
       if (lodgingData[key] !== null && lodgingData[key] !== undefined) {
         // Handle remove flag explicitly
         if (key === 'remove_banner' && lodgingData[key]) {
            formData.append('remove_banner', 'true');
         } else if (key !== 'remove_banner') {
             formData.append(key, lodgingData[key]);
         }
       }
     }
    // Include tripId for middleware
    formData.append('trip_id', tripId);

    return api.put(`/lodging/${lodgingId}?tripId=${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteLodging: (lodgingId, tripId) => api.delete(`/lodging/${lodgingId}?tripId=${tripId}`),
};

// Activity API
export const activityAPI = {
  getTripActivities: (tripId) => api.get(`/activities/trip/${tripId}`),
  getActivity: (activityId) => api.get(`/activities/${activityId}`),
  createActivity: (tripId, activityData) => {
    const formData = new FormData();
    for (const key in activityData) {
       if (activityData[key] !== null && activityData[key] !== undefined) {
           formData.append(key, activityData[key]);
       }
    }
    // Ensure trip_id is included for middleware
    formData.append('trip_id', tripId);

    return api.post(`/activities/trip/${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  updateActivity: (activityId, activityData, tripId) => {
     const formData = new FormData();
     for (const key in activityData) {
       if (activityData[key] !== null && activityData[key] !== undefined) {
         // Handle remove flag explicitly
         if (key === 'remove_banner' && activityData[key]) {
            formData.append('remove_banner', 'true');
         } else if (key !== 'remove_banner') {
             formData.append(key, activityData[key]);
         }
       }
     }
    // Include tripId for middleware
    formData.append('trip_id', tripId);

    return api.put(`/activities/${activityId}?tripId=${tripId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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
  deleteChecklist: (checklistId, tripId) => api.delete(`/checklists/${checklistId}?tripId=${tripId}`), // Pass tripId for auth
  createChecklistItem: (checklistId, itemData, tripId) => api.post(`/checklists/${checklistId}/items`, { ...itemData, trip_id: tripId }),
  updateChecklistItem: (itemId, itemData, tripId) => api.put(`/checklists/items/${itemId}`, { ...itemData, trip_id: tripId }),
  updateUserItemStatus: (itemId, status, tripId) => api.patch(`/checklists/items/${itemId}/user-status`, { status, trip_id: tripId }),
  deleteChecklistItem: (itemId, tripId) => api.delete(`/checklists/items/${itemId}?tripId=${tripId}`),
};

// Budget API
export const budgetAPI = {
  getTripBudget: (tripId) => api.get(`/budgets/trip/${tripId}`),
  createBudget: (tripId, budgetData) => api.post(`/budgets/trip/${tripId}`, budgetData),
  updateBudget: (budgetId, budgetData, tripId) => api.put(`/budgets/${budgetId}?tripId=${tripId}`, budgetData), // Pass tripId
  addExpense: (budgetId, expenseData, tripId) => api.post(`/budgets/${budgetId}/expenses?tripId=${tripId}`, expenseData), // Pass tripId
  updateExpense: (expenseId, expenseData, tripId) => api.put(`/budgets/expenses/${expenseId}?tripId=${tripId}`, expenseData), // Pass tripId
  deleteExpense: (expenseId, tripId) => api.delete(`/budgets/expenses/${expenseId}?tripId=${tripId}`), // Pass tripId
  deleteBudget: (budgetId, tripId) => api.delete(`/budgets/${budgetId}?tripId=${tripId}`),
};

export default api;