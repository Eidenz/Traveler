// client/src/pages/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, ArrowLeft } from 'lucide-react';
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
  const [message, setMessage] = useState(''); // To show success message

  const { loading, error: authError, clearError } = useAuthStore();
  const { t } = useTranslation();

  // Clear auth errors if they pop up (e.g., from interceptor)
  useEffect(() => {
    if (authError) {
      toast.error(authError);
      clearError();
    }
  }, [authError, clearError]);

  const handleChange = (e) => {
    setEmail(e.target.value);
    // Clear errors when user types
    if (error) setError('');
    if (message) setMessage(''); // Clear success message too
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
    setMessage(''); // Clear previous messages
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        const response = await authAPI.forgotPassword(email);
        setMessage(response.data.message || t('forgotPassword.requestSuccess')); // Use backend message or default
        toast.success(t('forgotPassword.requestSuccess'));
        setEmail(''); // Clear input on success
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('forgotPassword.title')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('forgotPassword.description')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Input
            label={t('auth.email')}
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={handleChange}
            placeholder={t('sharing.emailPlaceholder')}
            error={error}
            required
            icon={<Mail className="h-5 w-5 text-gray-400" />}
            disabled={isSubmitting}
          />

          {message && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            size="lg"
            loading={isSubmitting || loading} // Consider global loading state too
            icon={<Send className="h-5 w-5" />}
            disabled={isSubmitting}
          >
            {t('forgotPassword.sendLink')}
          </Button>

          <div className="text-center text-sm">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex items-center justify-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('common.back')} {t('auth.login').toLowerCase()}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;