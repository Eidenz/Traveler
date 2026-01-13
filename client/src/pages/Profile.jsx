// client/src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { userAPI } from '../services/api';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import {
  User, Mail, Lock, Camera, Save, Trash2, LogOut, 
  AlertTriangle, Bell, BellOff, Shield, Eye, EyeOff, Check
} from 'lucide-react';

const Profile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    receiveEmails: true,
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [existingProfileImage, setExistingProfileImage] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [removeProfileImageFlag, setRemoveProfileImageFlag] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Account deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (!isDeleteModalOpen) {
      setDeleteConfirmation('');
      setDeletePassword('');
    }
  }, [isDeleteModalOpen]);

  const fetchUserProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      const userData = response.data.user;

      setProfileForm({
        name: userData.name || '',
        email: userData.email || '',
        receiveEmails: userData.receiveEmails !== undefined ? userData.receiveEmails : true,
      });

      if (userData.profile_image) {
        setExistingProfileImage(getImageUrl(userData.profile_image));
        setProfileImagePreview(getImageUrl(userData.profile_image));
      } else {
        setExistingProfileImage(null);
        setProfileImagePreview(null);
      }
      setRemoveProfileImageFlag(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error(t('errors.loadFailed', { item: t('auth.profile').toLowerCase() }));
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
    if (profileErrors[name]) {
      setProfileErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setRemoveProfileImageFlag(false);
      const reader = new FileReader();
      reader.onload = () => setProfileImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    setRemoveProfileImageFlag(true);
  };

  const validateProfileForm = () => {
    const newErrors = {};
    if (!profileForm.name.trim()) {
      newErrors.name = t('auth.nameRequired');
    }
    setProfileErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (validateProfileForm()) {
      try {
        setIsUpdatingProfile(true);
        const formData = new FormData();
        formData.append('name', profileForm.name);
        formData.append('receiveEmails', profileForm.receiveEmails);
        if (removeProfileImageFlag) {
          formData.append('remove_profile_image', 'true');
        } else if (profileImage) {
          formData.append('profile_image', profileImage);
        }

        const response = await userAPI.updateProfile(formData);
        updateUser(response.data.user);
        toast.success(t('auth.profileUpdated'));
        fetchUserProfile();
      } catch (error) {
        toast.error(error.response?.data?.message || t('errors.saveFailed'));
      } finally {
        setIsUpdatingProfile(false);
      }
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validatePasswordForm = () => {
    const newErrors = {};
    if (!passwordForm.current_password) {
      newErrors.current_password = t('auth.currentPasswordRequired');
    }
    if (!passwordForm.new_password) {
      newErrors.new_password = t('auth.newPasswordRequired');
    } else if (passwordForm.new_password.length < 6) {
      newErrors.new_password = t('auth.passwordLength');
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      newErrors.confirm_password = t('errors.passwordsMatch');
    }
    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (validatePasswordForm()) {
      try {
        setIsChangingPassword(true);
        await userAPI.changePassword({
          currentPassword: passwordForm.current_password,
          newPassword: passwordForm.new_password
        });
        toast.success(t('auth.passwordChanged'));
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      } catch (error) {
        toast.error(error.response?.data?.message || t('errors.saveFailed'));
      } finally {
        setIsChangingPassword(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error(t('auth.typeDelete'));
      return;
    }
    try {
      setIsDeleting(true);
      await userAPI.deleteAccount({ password: deletePassword });
      toast.success(t('auth.accountDeleted'));
      logout();
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success(t('auth.logoutSuccess'));
    navigate('/login');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            {t('auth.profile', 'Profile')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('auth.manageProfile', 'Manage your account settings')}
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('auth.personalInfo', 'Personal Information')}
                </h2>
              </div>
            </div>
            
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt={profileForm.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-medium text-white">
                        {profileForm.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-accent-hover transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('auth.profilePhoto', 'Profile photo')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('auth.photoHelp', 'JPG, PNG or GIF. Max 5MB.')}
                  </p>
                  {profileImagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-sm text-red-600 hover:underline mt-2"
                    >
                      {t('common.remove', 'Remove')}
                    </button>
                  )}
                </div>
              </div>

              <Input
                label={t('auth.fullName', 'Full name')}
                id="name"
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                error={profileErrors.name}
                required
              />

              <Input
                label={t('auth.email', 'Email')}
                id="email"
                name="email"
                value={profileForm.email}
                disabled
                className="opacity-60"
              />

              {/* Email notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  {profileForm.receiveEmails ? (
                    <Bell className="w-5 h-5 text-accent" />
                  ) : (
                    <BellOff className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('auth.emailNotifications', 'Email notifications')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('auth.emailNotificationsHelp', 'Receive updates about your trips')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileForm(prev => ({ ...prev, receiveEmails: !prev.receiveEmails }))}
                  className={`
                    relative w-12 h-7 rounded-full transition-colors
                    ${profileForm.receiveEmails ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <div className={`
                    absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform
                    ${profileForm.receiveEmails ? 'left-6' : 'left-1'}
                  `} />
                </button>
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={isUpdatingProfile} icon={<Check className="w-4 h-4" />}>
                  {t('common.saveChanges', 'Save changes')}
                </Button>
              </div>
            </form>
          </div>

          {/* Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('auth.security', 'Security')}
                </h2>
              </div>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
              <div className="relative">
                <Input
                  label={t('auth.currentPassword', 'Current password')}
                  type={showPasswords.current ? 'text' : 'password'}
                  id="current_password"
                  name="current_password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  error={passwordErrors.current_password}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="relative">
                  <Input
                    label={t('auth.newPassword', 'New password')}
                    type={showPasswords.new ? 'text' : 'password'}
                    id="new_password"
                    name="new_password"
                    value={passwordForm.new_password}
                    onChange={handlePasswordChange}
                    error={passwordErrors.new_password}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label={t('auth.confirmPassword', 'Confirm password')}
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirm_password"
                    name="confirm_password"
                    value={passwordForm.confirm_password}
                    onChange={handlePasswordChange}
                    error={passwordErrors.confirm_password}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={isChangingPassword} icon={<Lock className="w-4 h-4" />}>
                  {t('auth.changePassword', 'Change password')}
                </Button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
            <div className="p-6 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-medium text-red-600 dark:text-red-400">
                  {t('auth.dangerZone', 'Danger Zone')}
                </h2>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('auth.logout', 'Log out')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('auth.logoutHelp', 'Sign out of your account')}
                  </p>
                </div>
                <Button variant="secondary" onClick={handleLogout} icon={<LogOut className="w-4 h-4" />}>
                  {t('auth.logout', 'Log out')}
                </Button>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {t('auth.deleteAccount', 'Delete account')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('auth.deleteAccountHelp', 'Permanently delete your account and all data')}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)} icon={<Trash2 className="w-4 h-4" />}>
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('auth.deleteAccount', 'Delete Account')}
        size="md"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">
                {t('auth.deleteWarningTitle', 'This action cannot be undone')}
              </p>
              <p className="text-sm text-red-500 dark:text-red-300">
                {t('auth.deleteWarning', 'All your trips, data, and account information will be permanently deleted.')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label={t('auth.enterPassword', 'Enter your password')}
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.typeDeleteConfirm', 'Type DELETE to confirm')}
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={isDeleting}
              disabled={deleteConfirmation !== 'DELETE' || !deletePassword}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {t('auth.deleteAccount', 'Delete account')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;
