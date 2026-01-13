// client/src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, WifiOff, MapPin, Plane, Globe } from 'lucide-react';
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
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  useEffect(() => {
    const checkForOfflineData = async () => {
      if (!navigator.onLine && !isAuthenticated) {
        const hasOfflineData = await checkOfflineMode();
        if (hasOfflineData) {
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
  
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        // Error handled by auth store
      }
    }
  };
  
  // Offline mode UI
  if (!navigator.onLine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white mb-2">
              {t('offline.offline_title', 'You\'re offline')}
            </h1>
            
            {checkingOffline ? (
              <div className="mt-6 flex justify-center">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('offline.login_message', 'Check your internet connection and try again.')}
                </p>
                
                <Button
                  onClick={async () => {
                    const hasOfflineData = await checkOfflineMode();
                    if (hasOfflineData) {
                      navigate('/dashboard');
                    } else {
                      toast.error(t('offline.no_offline_data', 'No offline data available'));
                    }
                  }}
                  className="w-full"
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
  
  return (
    <div className="min-h-screen flex">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-nav relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-semibold text-white">Traveler</span>
          </div>
          
          {/* Main content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-display font-bold text-white leading-tight">
                {t('auth.welcomeTitle', 'Your next adventure awaits')}
              </h1>
              <p className="mt-4 text-lg text-gray-400 max-w-md">
                {t('auth.welcomeSubtitle', 'Plan trips, track expenses, and keep all your travel details in one beautiful place.')}
              </p>
            </div>
            
            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Plane className="w-5 h-5" />
                </div>
                <span>{t('auth.feature1', 'Organize flights, hotels & activities')}</span>
              </div>
              <div className="flex items-center gap-4 text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <span>{t('auth.feature2', 'Share trips with fellow travelers')}</span>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Traveler. {t('auth.allRights', 'All rights reserved.')}
          </p>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-semibold text-gray-900 dark:text-white">Traveler</span>
          </div>
          
          {/* Form card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
                {t('auth.welcomeBack', 'Welcome back')}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {t('auth.loginTagline', 'Sign in to continue planning')}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label={t('auth.email', 'Email')}
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                error={errors.email}
                required
                icon={<Mail className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label={t('auth.password', 'Password')}
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                error={errors.password}
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
              />
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('auth.rememberMe', 'Remember me')}
                  </span>
                </label>
                
                <Link 
                  to="/forgot-password" 
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {t('auth.forgotPassword', 'Forgot password?')}
                </Link>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
                icon={<LogIn className="h-5 w-5" />}
              >
                {t('auth.login', 'Sign in')}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('auth.noAccount', "Don't have an account?")}{' '}
                <Link to="/register" className="font-medium text-accent hover:underline">
                  {t('auth.signUpNow', 'Sign up')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
