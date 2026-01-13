// client/src/pages/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, ArrowLeft, MapPin, CheckCircle2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { loading, error: authError, clearError } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      clearError();
    }
  }, [authError, clearError]);

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const validateForm = () => {
    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t('auth.invalidEmail'));
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await authAPI.forgotPassword(email);
        setIsSuccess(true);
        toast.success(t('forgotPassword.requestSuccess'));
      } catch (err) {
        console.error('Forgot password error:', err);
        const errorMsg = err.response?.data?.message || t('errors.serverError');
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-nav relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-32 right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-32 left-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-semibold text-white">Traveler</span>
          </div>
          
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-display font-bold text-white leading-tight">
                {t('forgotPassword.heroTitle', 'Don\'t worry')}
              </h1>
              <p className="mt-4 text-lg text-gray-400 max-w-md">
                {t('forgotPassword.heroSubtitle', 'It happens to the best of us. We\'ll help you get back to planning your adventures.')}
              </p>
            </div>
            
            <div className="w-32 h-32 rounded-3xl bg-white/5 backdrop-blur-sm flex items-center justify-center">
              <KeyRound className="w-16 h-16 text-white/50" />
            </div>
          </div>
          
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
          
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8">
            {isSuccess ? (
              /* Success state */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white mb-2">
                  {t('forgotPassword.checkEmail', 'Check your email')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('forgotPassword.sentTo', 'We sent a password reset link to')}
                  <br />
                  <span className="font-medium text-gray-900 dark:text-white">{email}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {t('forgotPassword.checkSpam', 'Didn\'t receive it? Check your spam folder.')}
                </p>
                
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      setIsSuccess(false);
                      setEmail('');
                    }}
                    variant="secondary"
                    className="w-full"
                  >
                    {t('forgotPassword.tryAnother', 'Try another email')}
                  </Button>
                  
                  <Link to="/login">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {t('forgotPassword.backToLogin', 'Back to login')}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent-soft flex items-center justify-center">
                    <KeyRound className="w-7 h-7 text-accent" />
                  </div>
                  <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
                    {t('forgotPassword.title', 'Reset your password')}
                  </h2>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {t('forgotPassword.description', 'Enter your email and we\'ll send you a reset link')}
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label={t('auth.email', 'Email')}
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    error={error}
                    required
                    icon={<Mail className="h-5 w-5 text-gray-400" />}
                    disabled={isSubmitting}
                  />
                  
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    loading={isSubmitting || loading}
                    icon={<Send className="h-5 w-5" />}
                    disabled={isSubmitting}
                  >
                    {t('forgotPassword.sendLink', 'Send reset link')}
                  </Button>
                </form>
                
                <div className="mt-6 text-center">
                  <Link 
                    to="/login" 
                    className="inline-flex items-center text-sm font-medium text-accent hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t('forgotPassword.backToLogin', 'Back to login')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
