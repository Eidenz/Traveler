// client/src/stores/authStore.js
import { create } from 'zustand';
import { authAPI } from '../services/api';
import { jwtDecode } from 'jwt-decode'; // Note: using named export here for v4

const getStoredAuth = () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  let user = null;
  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Failed to parse stored user:', error);
    localStorage.removeItem('user');
  }
  
  // Check if token is valid and not expired
  if (token) {
    try {
      const decodedToken = jwtDecode(token); // Using named export directly
      const currentTime = Date.now() / 1000;
      
      if (decodedToken.exp < currentTime) {
        // Token expired
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { token: null, user: null, isAuthenticated: false };
      }
    } catch (error) {
      console.error('Invalid token:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { token: null, user: null, isAuthenticated: false };
    }
  }
  
  return {
    token,
    user,
    isAuthenticated: !!token && !!user
  };
};

const useAuthStore = create((set, get) => ({
  ...getStoredAuth(),
  loading: false,
  error: null,

  // Register a new user
  register: async (userData) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.register(userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        error: null
      });
      
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Registration failed';
      set({ loading: false, error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  // Login a user
  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        error: null
      });
      
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Login failed';
      set({ loading: false, error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  // Logout a user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  // Update user information
  updateUser: (userData) => {
    const updatedUser = { ...get().user, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  // Clear any errors
  clearError: () => set({ error: null })
}));

export default useAuthStore;