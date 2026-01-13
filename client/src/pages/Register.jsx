// client/src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, MapPin, CheckCircle2 } from 'lucide-react';
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
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
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
        const { confirmPassword, ...registerData } = formData;
        await register(registerData);
        toast.success(t('auth.registerSuccess'));
        navigate('/dashboard');
      } catch (error) {
        // Error handled by auth store
      }
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { strength: 0, label: '' };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const labels = ['', t('auth.weak', 'Weak'), t('auth.fair', 'Fair'), t('auth.good', 'Good'), t('auth.strong', 'Strong'), t('auth.veryStrong', 'Very strong')];
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
    
    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();
  
  return (
    <div className="min-h-screen flex">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-nav relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-40 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
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
                {t('auth.startJourney', 'Start your journey')}
              </h1>
              <p className="mt-4 text-lg text-gray-400 max-w-md">
                {t('auth.registerSubtitle', 'Create an account and start planning unforgettable trips.')}
              </p>
            </div>
            
            {/* Benefits list */}
            <div className="space-y-4">
              {[
                t('auth.benefit1', 'Free forever for personal use'),
                t('auth.benefit2', 'Collaborate with unlimited travelers'),
                t('auth.benefit3', 'Access your trips offline'),
                t('auth.benefit4', 'Beautiful timeline & map views'),
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
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
                {t('auth.createAccount', 'Create your account')}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {t('auth.registerTagline', 'Join thousands of travelers')}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label={t('auth.fullName', 'Full name')}
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={t('auth.fullNamePlaceholder', 'John Doe')}
                error={errors.name}
                required
                icon={<User className="h-5 w-5 text-gray-400" />}
              />
              
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
              
              <div>
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
                {/* Password strength */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div 
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength.strength 
                              ? passwordStrength.color 
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{passwordStrength.label}</p>
                  </div>
                )}
              </div>
              
              <Input
                label={t('auth.confirmPassword', 'Confirm password')}
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                error={errors.confirmPassword}
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
              />
              
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
                icon={<UserPlus className="h-5 w-5" />}
              >
                {t('auth.createAccount', 'Create account')}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('auth.hasAccount', 'Already have an account?')}{' '}
                <Link to="/login" className="font-medium text-accent hover:underline">
                  {t('auth.login', 'Sign in')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
