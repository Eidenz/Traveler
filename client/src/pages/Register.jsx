// client/src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useTranslation } from 'react-i18next';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  
  const { register, isAuthenticated, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  // Show error toast if registration fails
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
    
    if (!formData.name.trim()) {
      newErrors.name = t('auth.nameRequired');
    }
    
    if (!formData.email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.passwordLength');
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('errors.passwordsMatch');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      try {
        // Don't send confirmPassword to the API
        const { confirmPassword, ...registerData } = formData;
        await register(registerData);
        toast.success(t('auth.registerSuccess'));
        navigate('/dashboard');
      } catch (error) {
        // Error is handled by the auth store
      }
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('auth.register')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('auth.registerTagline')}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label={t('auth.fullName')}
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('auth.fullNamePlaceholder')}
              error={errors.name}
              required
              icon={<User className="h-5 w-5 text-gray-400" />}
            />
            
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
            
            <Input
              label={t('auth.confirmPassword')}
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              error={errors.confirmPassword}
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
            />
          </div>
          
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            size="lg"
            loading={loading}
            icon={<UserPlus className="h-5 w-5" />}
          >
            {t('auth.register')}
          </Button>
          
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            {t('auth.login')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;