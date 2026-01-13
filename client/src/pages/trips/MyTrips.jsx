// client/src/pages/trips/MyTrips.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  PlusCircle, Calendar, MapPin, User, Trash2, Edit, Clock, Search,
  WifiOff, Filter, Grid, List, ChevronRight, Plane, Building2, Ticket
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { getAllOfflineTrips, removeTripOffline } from '../../utils/offlineStorage';

const TripCard = ({ trip, isOfflineMode, isOfflineAvailable, onDelete, onEdit }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Get trip status
  const getTripStatus = () => {
    const now = dayjs();
    const start = dayjs(trip.start_date);
    const end = dayjs(trip.end_date);
    
    if (now.isBefore(start)) return 'upcoming';
    if (now.isAfter(end)) return 'completed';
    return 'active';
  };

  // Calculate duration
  const getDuration = () => {
    const nights = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day');
    return nights;
  };

  // Format date
  const formatDate = () => {
    const start = dayjs(trip.start_date);
    const end = dayjs(trip.end_date);
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  };

  const status = getTripStatus();
  const nights = getDuration();

  return (
    <Link 
      to={`/trips/${trip.id}`}
      className="group block animate-fade-in"
      style={{ animationDelay: `${Math.random() * 0.2}s` }}
    >
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        {/* Cover image */}
        <div className="relative h-44 overflow-hidden">
          <img 
            src={trip.cover_image ? getImageUrl(trip.cover_image) : getFallbackImageUrl('trip')} 
            alt={trip.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <StatusBadge status={status} size="sm" />
            
            <div className="flex items-center gap-1.5">
              {isOfflineAvailable && (
                <div className="p-1.5 bg-emerald-500/90 rounded-full" title={t('offline.availableOffline')}>
                  <WifiOff className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              
              {!isOfflineMode && (trip.role === 'owner' || trip.role === 'editor') && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(trip.id);
                  }}
                  className="p-1.5 bg-white/90 hover:bg-white rounded-full text-gray-700 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}
              
              {(isOfflineMode || trip.role === 'owner') && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(trip.id);
                  }}
                  className="p-1.5 bg-white/90 hover:bg-white rounded-full text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-display font-semibold text-white mb-1 truncate">
              {trip.name}
            </h3>
            {trip.location && (
              <div className="flex items-center text-white/80 text-sm">
                <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                <span className="truncate">{trip.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card content */}
        <div className="p-4">
          {/* Date and duration */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="w-4 h-4 mr-1.5" />
              <span>{formatDate()}</span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {nights} {nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
            </span>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mb-4">
            {trip.transportation_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Plane className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>{trip.transportation_count}</span>
              </div>
            )}
            {trip.lodging_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span>{trip.lodging_count}</span>
              </div>
            )}
            {trip.activities_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Ticket className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                </div>
                <span>{trip.activities_count}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            {/* Role badge or members */}
            {!isOfflineMode && trip.role && (
              <StatusBadge status={trip.role} size="xs" showDot={false} />
            )}
            {isOfflineMode && (
              <span className="text-xs text-gray-500">{t('offline.savedOffline', 'Saved offline')}</span>
            )}
            
            {/* View link */}
            <span className="text-sm font-medium text-accent group-hover:underline flex items-center gap-1">
              {t('trips.viewDetails', 'View')}
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const MyTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineTrips, setOfflineTrips] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const [filter, setFilter] = useState('all'); // all, upcoming, active, past
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  const navigate = useNavigate();

  // Check for search param from header
  useEffect(() => {
    const search = searchParams.get('search');
    if (search) setSearchTerm(search);
  }, [searchParams]);

  // Monitor online/offline status
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

  // Fetch trips based on online status
  useEffect(() => {
    if (onlineStatus) {
      fetchTripsFromServer();
    } else {
      fetchOfflineTrips();
      setIsOfflineMode(true);
    }
  }, [onlineStatus]);

  const fetchTripsFromServer = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getUserTrips();
      setTrips(response.data.trips || []);
      fetchOfflineTrips(false);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error(t('errors.failedFetch'));
      fetchOfflineTrips();
      setIsOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineTrips = async (setAsMainTrips = true) => {
    try {
      const offlineData = await getAllOfflineTrips();
      if (setAsMainTrips) {
        setTrips(offlineData || []);
      } else {
        setOfflineTrips(offlineData || []);
      }
    } catch (error) {
      console.error('Error fetching offline trips:', error);
      if (setAsMainTrips) setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (tripId) => {
    setSelectedTripId(tripId);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTrip = async () => {
    if (!selectedTripId) return;
    
    try {
      setIsDeleting(true);
      
      if (isOfflineMode) {
        await removeTripOffline(selectedTripId);
        setTrips(trips.filter(trip => trip.id !== selectedTripId));
        toast.success(t('trips.deleteSuccess'));
      } else {
        await tripAPI.deleteTrip(selectedTripId);
        setTrips(trips.filter(trip => trip.id !== selectedTripId));
        try {
          await removeTripOffline(selectedTripId);
        } catch (err) { /* ignore */ }
        toast.success(t('trips.deleteSuccess'));
      }
      
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error(t('errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const isTripOffline = (tripId) => {
    return offlineTrips.some(trip => trip.id === tripId);
  };

  // Filter trips
  const getFilteredTrips = () => {
    let filtered = trips;
    
    // Apply status filter
    if (filter !== 'all') {
      const now = dayjs();
      filtered = trips.filter(trip => {
        const start = dayjs(trip.start_date);
        const end = dayjs(trip.end_date);
        
        if (filter === 'upcoming') return now.isBefore(start);
        if (filter === 'active') return now.isAfter(start) && now.isBefore(end);
        if (filter === 'past') return now.isAfter(end);
        return true;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(trip => 
        trip.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const filteredTrips = getFilteredTrips();

  // Group trips by status for display
  const groupedTrips = {
    active: filteredTrips.filter(t => {
      const now = dayjs();
      return now.isAfter(dayjs(t.start_date)) && now.isBefore(dayjs(t.end_date));
    }),
    upcoming: filteredTrips.filter(t => dayjs().isBefore(dayjs(t.start_date))),
    past: filteredTrips.filter(t => dayjs().isAfter(dayjs(t.end_date))),
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-gray-900 dark:text-white">
              {t('trips.title', 'My Trips')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isOfflineMode 
                ? t('offline.viewingOffline', 'Viewing offline trips')
                : `${trips.length} ${trips.length === 1 ? t('common.trip', 'trip') : t('common.trips', 'trips')}`
              }
            </p>
          </div>
          
          <Button
            onClick={() => navigate('/trips/new')}
            icon={<PlusCircle className="w-5 h-5" />}
            disabled={isOfflineMode}
          >
            {t('trips.create', 'New Trip')}
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {['all', 'active', 'upcoming', 'past'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                  transition-all duration-200
                  ${filter === f 
                    ? 'bg-nav dark:bg-white text-white dark:text-gray-900' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                {f === 'all' && t('common.all', 'All')}
                {f === 'active' && t('trips.active', 'Active')}
                {f === 'upcoming' && t('trips.upcoming', 'Upcoming')}
                {f === 'past' && t('trips.past', 'Past')}
                {f !== 'all' && (
                  <span className="ml-1.5 opacity-60">
                    {f === 'active' && groupedTrips.active.length}
                    {f === 'upcoming' && groupedTrips.upcoming.length}
                    {f === 'past' && groupedTrips.past.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('trips.search', 'Search trips...')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-44 bg-gray-200 dark:bg-gray-700 rounded-t-2xl" />
                <div className="bg-white dark:bg-gray-800 rounded-b-2xl p-4 border border-gray-100 dark:border-gray-700 border-t-0">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-6" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="space-y-8">
            {/* Active trips section */}
            {groupedTrips.active.length > 0 && (filter === 'all' || filter === 'active') && (
              <section>
                <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {t('trips.activeTrips', 'Active Trips')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedTrips.active.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isOfflineMode={isOfflineMode}
                      isOfflineAvailable={isOfflineMode || isTripOffline(trip.id)}
                      onDelete={handleDeleteClick}
                      onEdit={(id) => navigate(`/trips/${id}/edit`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming trips section */}
            {groupedTrips.upcoming.length > 0 && (filter === 'all' || filter === 'upcoming') && (
              <section>
                <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white mb-4">
                  {t('trips.upcomingTrips', 'Upcoming Trips')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedTrips.upcoming.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isOfflineMode={isOfflineMode}
                      isOfflineAvailable={isOfflineMode || isTripOffline(trip.id)}
                      onDelete={handleDeleteClick}
                      onEdit={(id) => navigate(`/trips/${id}/edit`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past trips section */}
            {groupedTrips.past.length > 0 && (filter === 'all' || filter === 'past') && (
              <section>
                <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white mb-4">
                  {t('trips.pastTrips', 'Past Trips')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedTrips.past.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isOfflineMode={isOfflineMode}
                      isOfflineAvailable={isOfflineMode || isTripOffline(trip.id)}
                      onDelete={handleDeleteClick}
                      onEdit={(id) => navigate(`/trips/${id}/edit`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-display font-medium text-gray-900 dark:text-white mb-2">
              {isOfflineMode 
                ? t('offline.noOfflineTrips', 'No offline trips')
                : searchTerm 
                  ? t('trips.noResults', 'No trips found')
                  : t('trips.noTrips', 'No trips yet')
              }
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {isOfflineMode 
                ? t('offline.saveTripsMessage', 'Save trips for offline use by visiting a trip and clicking "Save Offline"')
                : searchTerm 
                  ? t('trips.tryDifferentSearch', 'Try a different search term')
                  : t('trips.createFirstMessage', 'Start planning your next adventure')
              }
            </p>
            {!isOfflineMode && !searchTerm && (
              <Button
                onClick={() => navigate('/trips/new')}
                icon={<PlusCircle className="w-5 h-5" />}
                size="lg"
              >
                {t('trips.createFirst', 'Create your first trip')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={isOfflineMode ? t('offline.removeTrip', 'Remove Offline Trip') : t('trips.deleteTrip', 'Delete Trip')}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {isOfflineMode
              ? t('offline.removeConfirm', 'Remove this trip from offline storage?')
              : t('trips.deleteConfirm', 'Are you sure you want to delete this trip? This action cannot be undone.')
            }
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTrip}
              loading={isDeleting}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isOfflineMode ? t('common.remove', 'Remove') : t('common.delete', 'Delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyTrips;
