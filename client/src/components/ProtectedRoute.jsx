// client/src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, checkOfflineMode } = useAuthStore();
  const location = useLocation();
  const [checkingOfflineMode, setCheckingOfflineMode] = useState(!navigator.onLine);

  // Check for offline data if not authenticated and offline
  useEffect(() => {
    const checkOfflineData = async () => {
      if (!isAuthenticated && !navigator.onLine && !loading) {
        const hasOfflineData = await checkOfflineMode();
        setCheckingOfflineMode(false);
        // If offline mode was entered, authentication state will be updated
      } else {
        setCheckingOfflineMode(false);
      }
    };

    if (checkingOfflineMode) {
      checkOfflineData();
    }
  }, [isAuthenticated, loading, checkOfflineMode, checkingOfflineMode]);

  // Show loading spinner while checking offline data
  if (loading || checkingOfflineMode) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Now we can safely check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Render the protected route
  return children;
};

export default ProtectedRoute;