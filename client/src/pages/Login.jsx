// client/src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [checkingOffline, setCheckingOffline] = useState(!navigator.onLine);
  
  const { login, isAuthenticated, loading, error, clearError, checkOfflineMode } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  // Check for offline data when offline
  useEffect(() => {
    const checkForOfflineData = async () => {
      if (!navigator.onLine && !isAuthenticated) {
        const hasOfflineData = await checkOfflineMode();
        if (hasOfflineData) {
          // If we got offline data, the auth store will handle authentication
          navigate('/dashboard');
        }
        setCheckingOffline(false);
      } else {
        setCheckingOffline(false);
      }
    };

    if (checkingOffline) {
      checkForOfflineData();
    }
  }, [checkOfflineMode, navigate, isAuthenticated, checkingOffline]);
  
  // Show error toast if login fails
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      try {
        await login(formData);
        toast.success(t('auth.loginSuccess'));
        navigate('/dashboard');
      } catch (error) {
        // Error is handled by the auth store
      }
    }
  };
  
  // Show offline mode UI when offline
  if (!navigator.onLine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
          <div className="text-center">
            <WifiOff className="mx-auto h-12 w-12 text-yellow-500" />
            <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {t('offline.offline_title', 'You are offline')}
            </h1>
            
            {checkingOffline ? (
              <div className="mt-4 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('offline.login_message', 'You are currently offline. Please check your internet connection and try again.')}
                </p>
                
                <Button
                  type="button"
                  variant="primary"
                  className="w-full mt-6"
                  onClick={async () => {
                    const hasOfflineData = await checkOfflineMode();
                    if (hasOfflineData) {
                      navigate('/dashboard');
                    } else {
                      toast.error(t('offline.no_offline_data', 'No offline data available'));
                    }
                  }}
                >
                  {t('offline.check_offline_data', 'Check for Offline Data')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Regular login form when online
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('auth.welcomeBack')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('auth.loginTagline')}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('sharing.emailPlaceholder')}
              error={errors.email}
              required
              icon={<Mail className="h-5 w-5 text-gray-400" />}
            />
            
            <Input
              label={t('auth.password')}
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('auth.passwordPlaceholder')}
              error={errors.password}
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              {t('auth.rememberMe')}
              </label>
            </div>
            
            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              {t('auth.forgotPassword')}
              </Link>
            </div>
          </div>
          
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            size="lg"
            loading={loading}
            icon={<LogIn className="h-5 w-5" />}
          >
            {t('auth.login')}
          </Button>
          
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            {t('auth.signUpNow')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;