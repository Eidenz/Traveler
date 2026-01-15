// client/src/components/layout/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Search, User, LogOut, Sun, Moon, ChevronDown, Users } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useThemeStore from '../../stores/themeStore';
import { getImageUrl } from '../../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import toast from 'react-hot-toast';
import { useSocket } from '../../contexts/SocketContext';

const Header = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isConnected, roomMembers } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const dropdownRef = useRef(null);

  // Check if we're on a trip-related page (trip details, brainstorm, or budget)
  const isOnTripPage = location.pathname.includes('/trips/') ||
    location.pathname.includes('/brainstorm') ||
    location.pathname.includes('/budgets/');

  // Filter out current user from room members for display
  const otherCollaborators = roomMembers.filter(m => m.userId !== user?.id).slice(0, 4);

  // Generate initials from name for avatars
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate consistent color from name
  const getAvatarColor = (name) => {
    const colors = [
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
      'from-emerald-500 to-teal-500',
      'from-sky-500 to-blue-500',
      'from-violet-500 to-purple-500',
      'from-pink-500 to-rose-500',
    ];
    const hash = name?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
    return colors[hash % colors.length];
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success(t('auth.logoutSuccess', 'Logged out successfully'));
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/trips?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="h-14 bg-nav px-4 md:px-6 flex items-center justify-between flex-shrink-0">
      {/* Left side - Logo & Search */}
      <div className="flex items-center gap-4 md:gap-8">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 text-white hover:text-white">
          <img
            src="/logo.svg"
            alt="Traveler Logo"
            className="w-8 h-8 rounded-lg"
          />
          <span className="hidden sm:block text-lg font-display font-semibold tracking-tight">
            Traveler
          </span>
        </Link>

        {/* Search bar - hidden on mobile */}
        <form onSubmit={handleSearch} className="hidden md:block">
          <div
            className={`
              flex items-center gap-2 bg-white/10 rounded-full px-4 py-2
              transition-all duration-300
              ${isSearchFocused ? 'w-80 bg-white/15 ring-1 ring-white/20' : 'w-64'}
            `}
          >
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={t('common.searchTrips', 'Search trips...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-400 w-full"
            />
          </div>
        </form>
      </div>

      {/* Right side - Theme, User */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Live collaborators indicator - show when on trip page with other users */}
        {isOnTripPage && isConnected && otherCollaborators.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 mr-1">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">
                {t('realtime.live', 'Live')}
              </span>
            </div>
            <div className="flex -space-x-2">
              {otherCollaborators.map((collaborator, idx) => (
                <div
                  key={collaborator.userId}
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(collaborator.userName)} flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-nav`}
                  style={{ zIndex: otherCollaborators.length - idx }}
                  title={collaborator.userName}
                >
                  {getInitials(collaborator.userName)}
                </div>
              ))}
              {roomMembers.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-nav">
                  +{roomMembers.length - 5}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 hidden lg:inline">
              {t('realtime.editing', '{{count}} editing', { count: roomMembers.length })}
            </span>
          </div>
        )}

        {/* Language switcher */}
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
          title={theme === 'dark' ? t('common.lightMode', 'Light mode') : t('common.darkMode', 'Dark mode')}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
              {user?.profile_image ? (
                <img
                  src={getImageUrl(user.profile_image)}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <span className="hidden lg:block text-sm text-white font-medium">
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className={`
              hidden lg:block w-4 h-4 text-gray-400 transition-transform duration-200
              ${isProfileOpen ? 'rotate-180' : ''}
            `} />
          </button>

          {/* Dropdown menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-slide-up">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  {t('navigation.profile', 'Profile')}
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t('auth.logout', 'Log out')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
