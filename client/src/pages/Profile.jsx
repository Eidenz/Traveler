// client/src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { userAPI } from '../services/api';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { 
  User, Mail, Lock, Upload, X, Camera, Save, 
  Trash2, LogOut, AlertTriangle, ShieldAlert 
} from 'lucide-react';

const Profile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [existingProfileImage, setExistingProfileImage] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [deletePassword, setDeletePassword] = useState('');

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Account deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  // Reset password and confirmation when modal closes
  useEffect(() => {
    if (!isDeleteModalOpen) {
      setDeleteConfirmation('');
      setDeletePassword('');
    }
  }, [isDeleteModalOpen]);

  // Fetch additional user data if needed
  const fetchUserProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      const userData = response.data.user;
      
      setProfileForm({
        name: userData.name || '',
        email: userData.email || ''
      });
      
      if (userData.profile_image) {
        setExistingProfileImage(getImageUrl(userData.profile_image));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error(t('errors.loadFailed', { item: t('auth.profile').toLowerCase() }));
    }
  };

  // Handle profile form change
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user types
    if (profileErrors[name]) {
      setProfileErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle profile image change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      setProfileImage(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Clear error for profile image
      if (profileErrors.profile_image) {
        setProfileErrors(prev => ({ ...prev, profile_image: '' }));
      }
    }
  };

  // Handle remove image
  const handleRemoveImage = () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    setExistingProfileImage(null);
  };

  // Validate profile form
  const validateProfileForm = () => {
    const errors = {};
    
    if (!profileForm.name.trim()) {
      errors.name = t('errors.required', { field: t('auth.fullName') });
    }
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    if (validateProfileForm()) {
      try {
        setIsUpdatingProfile(true);
        
        // Create FormData object for multipart request
        const formData = new FormData();
        formData.append('name', profileForm.name);
        
        // Add profile image if exists
        if (profileImage) {
          formData.append('profile_image', profileImage);
        } else if (existingProfileImage === null) {
          // If image was removed, send an empty string to remove it
          formData.append('profile_image', '');
        }
        
        const response = await userAPI.updateProfile(formData);
        
        // Update user in auth store
        if (response.data.user) {
          updateUser(response.data.user);
        }
        
        toast.success(t('profile.updateSuccess'));
      } catch (error) {
        console.error('Error updating profile:', error);
        toast.error(error.response?.data?.message || t('errors.saveFailed', { item: t('auth.profile').toLowerCase() }));
      } finally {
        setIsUpdatingProfile(false);
      }
    }
  };

  // Handle password form change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user types
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate password form
  const validatePasswordForm = () => {
    const errors = {};
    
    if (!passwordForm.current_password) {
      errors.current_password = t('errors.required', { field: t('profile.currentPassword') });
    }
    
    if (!passwordForm.new_password) {
      errors.new_password = t('errors.required', { field: t('profile.newPassword') });
    } else if (passwordForm.new_password.length < 6) {
      errors.new_password = t('errors.minLength', { field: t('profile.newPassword'), length: 6 });
    }
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      errors.confirm_password = t('errors.passwordsMatch');
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (validatePasswordForm()) {
      try {
        setIsChangingPassword(true);
        
        // Only send current and new password to API
        const { confirm_password, ...passwordData } = passwordForm;
        
        await userAPI.changePassword(passwordData);
        
        // Reset form
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        
        toast.success(t('profile.passwordChangeSuccess'));
      } catch (error) {
        console.error('Error changing password:', error);
        
        // Handle specific errors
        if (error.response?.data?.message === 'Current password is incorrect') {
          setPasswordErrors({ current_password: t('profile.incorrectPassword') });
        } else {
          toast.error(error.response?.data?.message || t('errors.saveFailed', { item: t('profile.password').toLowerCase() }));
        }
      } finally {
        setIsChangingPassword(false);
      }
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== user.email) {
      toast.error(t('profile.confirmEmailToDelete'));
      return;
    }
    
    if (!deletePassword) {
      toast.error(t('errors.required', { field: t('auth.password') }));
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Call the API to delete the account
      await userAPI.deleteAccount(deletePassword);
      
      // Log out the user after deletion
      logout();
      toast.success(t('profile.accountDeletedSuccess'));
      navigate('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      
      // Handle specific error for wrong password
      if (error.response?.status === 400 && error.response?.data?.message === 'Incorrect password') {
        toast.error(t('profile.incorrectPassword'));
      } else {
        toast.error(error.response?.data?.message || t('errors.deleteFailed', { item: t('profile.account').toLowerCase() }));
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="animate-pulse">
          <div className="h-10 w-64 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
          <div className="h-96 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('profile.title')}</h1>
      
      {/* Profile Information Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('profile.personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit}>
            {/* Profile Image */}
            <div className="mb-6 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  {profileImagePreview || existingProfileImage ? (
                    <img 
                      src={profileImagePreview || existingProfileImage} 
                      alt={profileForm.name} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-full w-full p-6 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0">
                  <label 
                    htmlFor="profile_image" 
                    className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white flex items-center justify-center cursor-pointer shadow-md"
                  >
                    <Camera className="h-5 w-5" />
                    <input
                      id="profile_image"
                      name="profile_image"
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>
              
              {/* Remove image button if there's an image */}
              {(profileImagePreview || existingProfileImage) && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {t('profile.removePhoto')}
                </button>
              )}
            </div>
            
            {/* Name Field */}
            <div className="mb-4">
              <Input
                label={t('auth.fullName')}
                id="name"
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                placeholder={t('auth.fullNamePlaceholder')}
                error={profileErrors.name}
                required
                icon={<User className="h-5 w-5 text-gray-400" />}
              />
            </div>
            
            {/* Email Field - Display only */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={user.email}
                  className="block w-full pl-10 py-2 pr-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md opacity-75 cursor-not-allowed"
                  disabled
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('profile.emailChangeNotAllowed')}
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                icon={<Save className="h-5 w-5" />}
                loading={isUpdatingProfile}
              >
                {t('profile.saveChanges')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Password Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('profile.changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4">
              <Input
                label={t('profile.currentPassword')}
                type="password"
                id="current_password"
                name="current_password"
                value={passwordForm.current_password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                error={passwordErrors.current_password}
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label={t('profile.newPassword')}
                type="password"
                id="new_password"
                name="new_password"
                value={passwordForm.new_password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                error={passwordErrors.new_password}
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label={t('profile.confirmNewPassword')}
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                error={passwordErrors.confirm_password}
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
              />
            </div>
            
            <div className="flex justify-end mt-6">
              <Button
                type="submit"
                variant="primary"
                icon={<ShieldAlert className="h-5 w-5" />}
                loading={isChangingPassword}
              >
                {t('profile.updatePassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Danger Zone Section */}
      <Card className="border-red-300 dark:border-red-700">
        <CardHeader className="bg-red-50 dark:bg-red-900/20 border-b border-red-300 dark:border-red-700">
          <CardTitle className="text-red-700 dark:text-red-400 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {t('profile.dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <div>
            <h3 className="text-lg font-medium mb-2">{t('profile.deleteAccount')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('profile.deleteAccountWarning')}
            </p>
            <Button
              variant="danger"
              icon={<Trash2 className="h-5 w-5" />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              {t('profile.deleteMyAccount')}
            </Button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">{t('profile.logout')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('profile.logoutDescription')}
            </p>
            <Button
              variant="secondary"
              icon={<LogOut className="h-5 w-5" />}
              onClick={() => {
                logout();
                navigate('/login');
                toast.success(t('auth.logoutSuccess'));
              }}
            >
              {t('auth.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('profile.confirmDeletion')}
        size="md"
      >
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t('profile.warningTitle')}
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-200">
                  <p>{t('profile.deleteWarningDescription')}</p>
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {t('profile.enterEmailToDelete')}
          </p>
          
          <Input
            label={t('auth.email')}
            type="email"
            id="delete_confirmation"
            name="delete_confirmation"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder={user.email}
            required
            icon={<Mail className="h-5 w-5 text-gray-400" />}
          />
          
          <div className="mt-4">
            <Input
              label={t('auth.password')}
              type="password"
              id="delete_password"
              name="delete_password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
            />
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={isDeleting}
              icon={<Trash2 className="h-5 w-5" />}
              disabled={deleteConfirmation !== user.email || !deletePassword}
            >
              {t('profile.permanentlyDeleteAccount')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;