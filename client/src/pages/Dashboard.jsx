// client/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusCircle, Calendar, MapPin, Clock, ArrowRight, Plane, Building2, 
  Ticket, ChevronRight, Sparkles, WifiOff
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import { tripAPI } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getImageUrl, getFallbackImageUrl } from '../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { getAllOfflineTrips, getTripOffline } from '../utils/offlineStorage';
import useAuthStore from '../stores/authStore';

dayjs.extend(relativeTime);

// Featured trip card (large)
const FeaturedTripCard = ({ trip, type = 'active' }) => {
  const { t } = useTranslation();
  
  if (!trip) return null;

  const nights = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day');
  const daysUntil = dayjs(trip.start_date).diff(dayjs(), 'day');

  return (
    <Link to={`/trips/${trip.id}`} className="block group">
      <div className="relative h-72 md:h-80 rounded-3xl overflow-hidden shadow-lg">
        <img
          src={trip.cover_image ? getImageUrl(trip.cover_image) : getFallbackImageUrl('trip')}
          alt={trip.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        {/* Top badge */}
        <div className="absolute top-4 left-4">
          <div className={`
            px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm
            ${type === 'active' 
              ? 'bg-green-500/90 text-white' 
              : 'bg-accent/90 text-white'
            }
          `}>
            {type === 'active' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {t('dashboard.currentlyTraveling', 'Currently traveling')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {daysUntil === 0 
                  ? t('dashboard.startsToday', 'Starts today!') 
                  : daysUntil === 1 
                    ? t('dashboard.startsTomorrow', 'Starts tomorrow!')
                    : t('dashboard.daysUntil', { count: daysUntil })}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">
            {trip.name}
          </h2>
          
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm mb-4">
            {trip.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{trip.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{nights} {nights === 1 ? t('common.night') : t('common.nights')}</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-6">
            {trip.transportation_count > 0 && (
              <div className="flex items-center gap-2 text-white/70">
                <Plane className="w-4 h-4" />
                <span className="text-sm">{trip.transportation_count} {t('transportation.title')}</span>
              </div>
            )}
            {trip.lodging_count > 0 && (
              <div className="flex items-center gap-2 text-white/70">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">{trip.lodging_count} {t('lodging.title')}</span>
              </div>
            )}
            {trip.activities_count > 0 && (
              <div className="flex items-center gap-2 text-white/70">
                <Ticket className="w-4 h-4" />
                <span className="text-sm">{trip.activities_count} {t('activities.title')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hover arrow */}
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
          <ArrowRight className="w-5 h-5 text-white" />
        </div>
      </div>
    </Link>
  );
};

// Small trip card
const SmallTripCard = ({ trip }) => {
  const { t } = useTranslation();
  
  const getTripStatus = () => {
    const now = dayjs();
    const start = dayjs(trip.start_date);
    const end = dayjs(trip.end_date);
    
    if (now.isBefore(start)) return 'upcoming';
    if (now.isAfter(end)) return 'completed';
    return 'active';
  };

  return (
    <Link to={`/trips/${trip.id}`} className="group">
      <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={trip.cover_image ? getImageUrl(trip.cover_image) : getFallbackImageUrl('trip')}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-accent transition-colors">
            {trip.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D')}
          </p>
        </div>

        {/* Status */}
        <StatusBadge status={getTripStatus()} size="xs" />
        
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-accent transition-colors" />
      </div>
    </Link>
  );
};

const Dashboard = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (onlineStatus) {
      fetchTripsFromServer();
    } else {
      fetchOfflineTrips();
    }
  }, [onlineStatus]);

  const fetchTripsFromServer = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getUserTrips();
      setTrips(response.data.trips || []);
      setIsOfflineMode(false);
    } catch (error) {
      console.error('Error fetching trips:', error);
      fetchOfflineTrips();
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineTrips = async () => {
    try {
      setLoading(true);
      const offlineData = await getAllOfflineTrips();
      setTrips(offlineData || []);
      setIsOfflineMode(true);
    } catch (error) {
      console.error('Error fetching offline trips:', error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Categorize trips
  const now = dayjs();
  const activeTrip = trips.find(t => {
    const start = dayjs(t.start_date);
    const end = dayjs(t.end_date).endOf('day');
    return now.isAfter(start) && now.isBefore(end);
  });

  const upcomingTrips = trips
    .filter(t => dayjs(t.start_date).isAfter(now))
    .sort((a, b) => dayjs(a.start_date).diff(dayjs(b.start_date)));

  const nextUpcomingTrip = upcomingTrips[0];

  const recentTrips = trips
    .filter(t => t.id !== activeTrip?.id && t.id !== nextUpcomingTrip?.id)
    .slice(0, 5);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour < 12) return t('dashboard.goodMorning', 'Good morning');
    if (hour < 18) return t('dashboard.goodAfternoon', 'Good afternoon');
    return t('dashboard.goodEvening', 'Good evening');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-gray-900 dark:text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] || t('common.traveler', 'Traveler')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {activeTrip 
              ? t('dashboard.enjoyTrip', 'Enjoy your trip!')
              : nextUpcomingTrip 
                ? t('dashboard.nextAdventure', 'Your next adventure awaits')
                : t('dashboard.planNext', 'Ready to plan your next adventure?')
            }
          </p>
        </div>

        {/* Offline banner */}
        {isOfflineMode && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t('offline.offlineMode', 'Offline Mode')}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                {t('offline.showingSaved', 'Showing saved trips')}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          /* Loading skeleton */
          <div className="space-y-8">
            <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-3xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : trips.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-accent-soft flex items-center justify-center">
              <MapPin className="w-12 h-12 text-accent" />
            </div>
            <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white mb-3">
              {t('dashboard.welcomeTitle', 'Welcome to Traveler!')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
              {t('dashboard.welcomeMessage', 'Start planning your first trip and keep all your travel details in one place.')}
            </p>
            <Button
              onClick={() => navigate('/trips/new')}
              icon={<PlusCircle className="w-5 h-5" />}
              size="lg"
            >
              {t('trips.createFirst', 'Create your first trip')}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured trip (active or next upcoming) */}
            {(activeTrip || nextUpcomingTrip) && (
              <section>
                <FeaturedTripCard 
                  trip={activeTrip || nextUpcomingTrip} 
                  type={activeTrip ? 'active' : 'upcoming'}
                />
              </section>
            )}

            {/* Upcoming trips (if there's an active trip, show upcoming) */}
            {activeTrip && upcomingTrips.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white">
                    {t('dashboard.upNext', 'Up Next')}
                  </h2>
                  <Link to="/trips?filter=upcoming" className="text-sm text-accent font-medium hover:underline flex items-center gap-1">
                    {t('common.viewAll', 'View all')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {upcomingTrips.slice(0, 3).map(trip => (
                    <SmallTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}

            {/* Recent trips */}
            {recentTrips.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white">
                    {t('dashboard.recentTrips', 'Recent Trips')}
                  </h2>
                  <Link to="/trips" className="text-sm text-accent font-medium hover:underline flex items-center gap-1">
                    {t('common.viewAll', 'View all')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {recentTrips.map(trip => (
                    <SmallTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick actions */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/trips/new')}
                className="p-6 bg-accent text-white rounded-2xl text-left hover:bg-accent-hover transition-colors group"
              >
                <PlusCircle className="w-8 h-8 mb-3" />
                <h3 className="font-display font-medium text-lg">
                  {t('dashboard.planNewTrip', 'Plan a new trip')}
                </h3>
                <p className="text-white/80 text-sm mt-1">
                  {t('dashboard.startPlanning', 'Start planning your next adventure')}
                </p>
              </button>

              <button
                onClick={() => navigate('/budgets')}
                className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-left hover:border-accent hover:shadow-lg transition-all group"
              >
                <div className="w-8 h-8 mb-3 text-emerald-600">$</div>
                <h3 className="font-display font-medium text-lg text-gray-900 dark:text-white">
                  {t('dashboard.manageBudgets', 'Manage budgets')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {t('dashboard.trackExpenses', 'Track your travel expenses')}
                </p>
              </button>

              <button
                onClick={() => navigate('/calendar')}
                className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-left hover:border-accent hover:shadow-lg transition-all group"
              >
                <Calendar className="w-8 h-8 mb-3 text-blue-600" />
                <h3 className="font-display font-medium text-lg text-gray-900 dark:text-white">
                  {t('dashboard.viewCalendar', 'View calendar')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {t('dashboard.seeSchedule', 'See your travel schedule')}
                </p>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
