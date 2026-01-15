// client/src/components/layout/MobileBottomNav.jsx
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Map, DollarSign, PlusCircle, Calendar, Menu, X, User, LogOut, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

const MobileBottomNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuthStore();

  // Main navigation items (always visible)
  const mainNavItems = [
    { to: '/trips', icon: Map, label: t('navigation.trips', 'Trips') },
    { to: '/budgets', icon: DollarSign, label: t('navigation.budget', 'Budget') },
  ];

  // More menu items
  const menuItems = [
    { to: '/calendar', icon: Calendar, label: t('navigation.calendar', 'Calendar') },
    { to: '/brainstorm', icon: Lightbulb, label: t('navigation.brainstorm', 'Brainstorm') },
    { to: '/profile', icon: User, label: t('navigation.profile', 'Profile') },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    toast.success(t('auth.logoutSuccess', 'Logged out successfully'));
    navigate('/login');
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Slide-up menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Menu panel */}
          <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl z-50 md:hidden animate-slide-up safe-area-inset-bottom">
            <div className="p-4">
              {/* Handle bar */}
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />

              {/* Menu items */}
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl
                      transition-colors duration-200
                      ${isActive(item.to)
                        ? 'bg-accent-soft text-accent'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                ))}

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t('auth.logout', 'Log out')}</span>
                </button>
              </nav>
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="bottom-nav md:hidden">
        {/* Main nav items */}
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`bottom-nav-item ${isActive(item.to) ? 'active' : ''}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Center add button */}
        <NavLink
          to="/trips/new"
          className="
            w-12 h-12 -mt-4
            bg-accent hover:bg-accent-hover
            rounded-full shadow-lg
            flex items-center justify-center
            text-white
            transition-all duration-200
            active:scale-95
          "
        >
          <PlusCircle className="w-6 h-6" />
        </NavLink>

        {/* Calendar */}
        <NavLink
          to="/calendar"
          className={`bottom-nav-item ${isActive('/calendar') ? 'active' : ''}`}
        >
          <Calendar className="w-5 h-5" />
          <span>{t('navigation.calendar', 'Calendar')}</span>
        </NavLink>

        {/* More menu */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`bottom-nav-item ${isMenuOpen ? 'active' : ''}`}
        >
          {isMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
          <span>{t('navigation.more', 'More')}</span>
        </button>
      </nav>
    </>
  );
};

export default MobileBottomNav;
