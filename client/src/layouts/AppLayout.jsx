// client/src/layouts/AppLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { 
  Menu, X, Search, User, LogOut, Settings, Sun, Moon, PlusCircle,
  Compass, Calendar, Home, DollarSign
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUtils';
import { tripAPI } from '../services/api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuthStore();

  // Fetch user trips for the sidebar
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await tripAPI.getUserTrips();
        setTrips(response.data.trips || []);
      } catch (error) {
        console.error('Error fetching trips for sidebar:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, []);

  // Filter trips by category
  const upcomingTrips = trips.filter(trip => 
    new Date(trip.start_date) > new Date()
  ).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const pastTrips = trips.filter(trip => 
    new Date(trip.end_date) < new Date()
  ).sort((a, b) => new Date(b.end_date) - new Date(a.end_date));

  const sharedTrips = trips.filter(trip => 
    trip.role !== 'owner'
  );

  // Close sidebar when navigating on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state based on window size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
          transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:z-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <img className="mr-3" src="/logo.svg" width={40} alt="logo"/>
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-500">{t('app.name')}</h1>
          <button 
            className="lg:hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <nav className="space-y-6">
            <div>
              <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('navigation.main')}
              </p>
              <ul className="space-y-1">
                <li>
                  <NavLink 
                    to="/dashboard" 
                    className={({ isActive }) => `
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Home className="mr-3 h-5 w-5" />
                    {t('navigation.dashboard')}
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/trips" 
                    className={({ isActive }) => `
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Compass className="mr-3 h-5 w-5" />
                    {t('navigation.myTrips')}
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/budgets" 
                    className={({ isActive }) => `
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <DollarSign className="mr-3 h-5 w-5" />
                    {t('budget.title')}
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/calendar" 
                    className={({ isActive }) => `
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Calendar className="mr-3 h-5 w-5" />
                    {t('navigation.calendar')}
                  </NavLink>
                </li>
              </ul>
            </div>

            <div>
              <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('navigation.yourTrips')}
              </p>
              {loading ? (
                <div className="animate-pulse space-y-2 px-2">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <ul className="space-y-1">
                  {upcomingTrips.length > 0 && (
                    <>
                      <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 mt-2">{t('trips.upcoming')}</p>
                      {upcomingTrips.slice(0, 3).map(trip => (
                        <li key={`upcoming-${trip.id}`}>
                          <Link 
                            to={`/trips/${trip.id}`}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="mr-3 h-2 w-2 rounded-full bg-green-500"></span>
                            <span className="truncate">{trip.name}</span>
                          </Link>
                        </li>
                      ))}
                    </>
                  )}

                  {sharedTrips.length > 0 && (
                    <>
                      <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 mt-2">{t('trips.shared')}</p>
                      {sharedTrips.slice(0, 3).map(trip => (
                        <li key={`shared-${trip.id}`}>
                          <Link 
                            to={`/trips/${trip.id}`}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="mr-3 h-2 w-2 rounded-full bg-yellow-500"></span>
                            <span className="truncate">{trip.name}</span>
                          </Link>
                        </li>
                      ))}
                    </>
                  )}

                  {pastTrips.length > 0 && (
                    <>
                      <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 mt-2">{t('trips.past')}</p>
                      {pastTrips.slice(0, 3).map(trip => (
                        <li key={`past-${trip.id}`}>
                          <Link 
                            to={`/trips/${trip.id}`}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="mr-3 h-2 w-2 rounded-full bg-purple-500"></span>
                            <span className="truncate">{trip.name}</span>
                          </Link>
                        </li>
                      ))}
                    </>
                  )}
                  
                  {trips.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {t('trips.noTrips')}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </nav>

          <div className="mt-6">
            <button 
              onClick={() => navigate('/trips/new')}
              className="flex items-center justify-center w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              {t('navigation.createTrip')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
          <button 
            className="p-1 mr-4 rounded-full lg:hidden hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="flex items-center ml-auto space-x-4">
            {/* Language switcher */}
            <LanguageSwitcher />
            
            {/* Theme toggle */}
            <button 
              onClick={toggleTheme}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {theme === 'dark' ? (
                <Sun className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative profile-dropdown">
              <button 
                className="flex items-center focus:outline-none"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              >
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  {user?.profile_image ? (
                    <img 
                      src={getImageUrl(user.profile_image)} 
                      alt={user.name} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-full w-full p-1 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
                  {user?.name}
                </span>
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-gray-800 py-2 shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 my-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button 
                    onClick={handleProfile}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <User className="h-4 w-4 mr-3 text-gray-500 dark:text-gray-400" />
                    {t('auth.profile')}
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LogOut className="h-4 w-4 mr-3 text-red-500" />
                    {t('auth.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;