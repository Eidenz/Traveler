// client/src/pages/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(''); // For errors from the API
  const [success, setSuccess] = useState(false); // To show success state

  const { token: urlToken } = useParams(); // Get token from URL
  const { login: storeLogin } = useAuthStore(); // Get login function from store
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Clear API errors when form changes
  useEffect(() => {
    if (apiError) setApiError('');
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear specific field error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.password) {
      newErrors.password = t('errors.required', { field: t('profile.newPassword') });
    } else if (formData.password.length < 6) {
      newErrors.password = t('errors.minLength', { field: t('profile.newPassword'), length: 6 });
    }
    if (!formData.confirm_password) {
      newErrors.confirm_password = t('errors.required', { field: t('profile.confirmNewPassword') });
    } else if (formData.password && formData.password !== formData.confirm_password) {
      newErrors.confirm_password = t('errors.passwordsMatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(''); // Clear previous API errors
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        const response = await authAPI.resetPassword(urlToken, formData);
        setSuccess(true);
        toast.success(t('resetPassword.successMessage'));

        // Log the user in automatically using the returned data
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        storeLogin({ email: user.email, password: formData.password }); // Trigger store update

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);

      } catch (err) {
        console.error('Reset password error:', err);
        const errorMsg = err.response?.data?.message || t('resetPassword.invalidToken') || t('errors.serverError');
        setApiError(errorMsg);
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {success ? t('resetPassword.successTitle') : t('resetPassword.title')}
          </h1>
          {!success && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('resetPassword.description')}
            </p>
          )}
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {t('resetPassword.successInfo')}
            </p>
            <Link to="/dashboard" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              {t('resetPassword.goToDashboard')}
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                {apiError}
              </div>
            )}
            <Input
              label={t('profile.newPassword')}
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              error={errors.password}
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
              disabled={isSubmitting}
            />
            <Input
              label={t('profile.confirmNewPassword')}
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              placeholder="••••••••"
              error={errors.confirm_password}
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
              disabled={isSubmitting}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              loading={isSubmitting}
              icon={<Lock className="h-5 w-5" />}
              disabled={isSubmitting}
            >
              {t('resetPassword.buttonText')}
            </Button>

            <div className="text-center text-sm">
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                {t('common.cancel')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;