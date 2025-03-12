// client/src/components/ProtectedRoute.jsx
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  // If not authenticated, redirect to login with the return URL
  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Return children if authenticated
  return children;
};

export default ProtectedRoute;