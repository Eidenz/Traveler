// client/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusCircle, Calendar, Compass, Map, Clock, Bed, 
  ArrowRight, Package, Coffee, WifiOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { tripAPI } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getImageUrl, getFallbackImageUrl } from '../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { getAllOfflineTrips, getTripOffline } from '../utils/offlineStorage';

// Extend dayjs with relativeTime
dayjs.extend(relativeTime);

const Dashboard = () => {
  const [trips, setTrips] = useState([]);
  const [upcomingTrip, setUpcomingTrip] = useState(null);
  const [ongoingTrip, setOngoingTrip] = useState(null);
  const [ongoingTripDetails, setOngoingTripDetails] = useState(null);
  const [upcomingTripDetails, setUpcomingTripDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const navigate = useNavigate();
  const { t } = useTranslation();

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
    }
  }, [onlineStatus, t]);

  const fetchTripsFromServer = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getUserTrips();
      
      if (response.data.trips && response.data.trips.length > 0) {
        // Sort by start date (ascending)
        const sortedTrips = response.data.trips.sort((a, b) => 
          new Date(a.start_date) - new Date(b.start_date)
        );
        
        setTrips(sortedTrips);
        
        // Find current ongoing trip (where current date is between start_date and end_date)
        const today = new Date();
        const ongoingTrips = sortedTrips.filter(trip => {
          // Set end date to end of day (23:59:59)
          const tripEndDate = dayjs(trip.end_date).endOf('day').toDate();
          return new Date(trip.start_date) <= today && tripEndDate >= today;
        });
        
        if (ongoingTrips.length > 0) {
          setOngoingTrip(ongoingTrips[0]); // Set the first ongoing trip
        }
        
        // Find upcoming trip (closest start date in the future)
        const upcomingTrips = sortedTrips.filter(trip => 
          new Date(trip.start_date) > today
        );
        
        if (upcomingTrips.length > 0) {
          setUpcomingTrip(upcomingTrips[0]);
        }
      }
      
      setIsOfflineMode(false);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error(t('errors.failedFetch'));
      
      // If server fetch fails, try offline fallback
      fetchOfflineTrips();
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineTrips = async () => {
    try {
      setLoading(true);
      // Get all trips saved offline
      const offlineTrips = await getAllOfflineTrips();
      
      if (offlineTrips && offlineTrips.length > 0) {
        setIsOfflineMode(true);
        // Sort by start date
        const sortedTrips = offlineTrips.sort((a, b) => 
          new Date(a.start_date) - new Date(b.start_date)
        );
        
        setTrips(sortedTrips);
        
        // Find current ongoing trip
        const today = new Date();
        const ongoingTrips = sortedTrips.filter(trip => {
          const tripEndDate = dayjs(trip.end_date).endOf('day').toDate();
          return new Date(trip.start_date) <= today && tripEndDate >= today;
        });
        
        if (ongoingTrips.length > 0) {
          setOngoingTrip(ongoingTrips[0]);
          
          // Also set trip details for the ongoing trip
          if (ongoingTrips[0].transportation && ongoingTrips[0].lodging && ongoingTrips[0].activities) {
            setOngoingTripDetails(ongoingTrips[0]);
          }
        }
        
        // Find upcoming trip
        const upcomingTrips = sortedTrips.filter(trip => 
          new Date(trip.start_date) > today
        );
        
        if (upcomingTrips.length > 0) {
          setUpcomingTrip(upcomingTrips[0]);
          
          // Also set trip details for the upcoming trip
          if (upcomingTrips[0].transportation && upcomingTrips[0].lodging && upcomingTrips[0].activities) {
            setUpcomingTripDetails(upcomingTrips[0]);
          }
        }
        
        // Show a toast notification that we're in offline mode
        toast.success(t('offline.usingOfflineData', 'Using offline data'), {
          icon: <WifiOff size={16} />,
          duration: 3000,
        });
      } else {
        // No offline trips available
        setTrips([]);
        setOngoingTrip(null);
        setUpcomingTrip(null);
        setOngoingTripDetails(null);
        setUpcomingTripDetails(null);
      }
    } catch (error) {
      console.error('Error fetching offline trips:', error);
      setTrips([]);
      setOngoingTrip(null);
      setUpcomingTrip(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trip details when ongoing or upcoming trips are set
  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!ongoingTrip && !upcomingTrip) return;
      if (isOfflineMode) return; // Skip API calls in offline mode
      
      setDetailsLoading(true);
      
      try {
        // Fetch details for ongoing trip
        if (ongoingTrip) {
          try {
            const ongoingResponse = await tripAPI.getTripById(ongoingTrip.id);
            setOngoingTripDetails(ongoingResponse.data);
          } catch (error) {
            console.error('Error fetching ongoing trip details:', error);
            // Try offline fallback
            // No need to parse ID as integer
            const offlineTrip = await getTripOffline(ongoingTrip.id);
            if (offlineTrip) {
              setOngoingTripDetails(offlineTrip);
            }
          }
        }
        
        // Fetch details for upcoming trip
        if (upcomingTrip) {
          try {
            const upcomingResponse = await tripAPI.getTripById(upcomingTrip.id);
            setUpcomingTripDetails(upcomingResponse.data);
          } catch (error) {
            console.error('Error fetching upcoming trip details:', error);
            // Try offline fallback
            // No need to parse ID as integer
            const offlineTrip = await getTripOffline(upcomingTrip.id);
            if (offlineTrip) {
              setUpcomingTripDetails(offlineTrip);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching trip details:', error);
      } finally {
        setDetailsLoading(false);
      }
    };
    
    fetchTripDetails();
  }, [ongoingTrip, upcomingTrip, isOfflineMode]);

  const getDateRangeString = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  };

  // Function to render ongoing trip
  const renderOngoingTrip = () => {
    if (!ongoingTrip) {
      return null;
    }

    return (
      <Card>
        <CardHeader className="relative p-0 pb-0">
          <div className="h-48 w-full relative">
            <img 
              src={ongoingTrip.cover_image 
                ? getImageUrl(ongoingTrip.cover_image)
                : getFallbackImageUrl('trip')
              } 
              alt={ongoingTrip.name}
              className="h-full w-full object-cover rounded-t-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <div className="inline-block px-3 py-1 rounded-full bg-green-500 text-white text-sm font-medium mb-2">
                {t('dashboard.ongoing', 'Ongoing Trip')}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{ongoingTrip.name}</h2>
              <div className="flex items-center text-white/80">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{getDateRangeString(ongoingTrip.start_date, ongoingTrip.end_date)}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Quick Info Cards */}
            <div className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Map className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
              <div className="text-sm font-medium text-center">{ongoingTrip.location || t('common.noLocation')}</div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {(() => {
                  // Create a date object with time set to end of day (23:59:59)
                  const endDate = dayjs(ongoingTrip.end_date).endOf('day');
                  const daysLeft = endDate.diff(dayjs(), 'day');
                  return daysLeft + t('common.daysLeft');
                })()}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <Bed className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {detailsLoading || !ongoingTripDetails ? (
                  <span className="inline-block h-4 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
                ) : (
                  `${ongoingTripDetails.lodging?.length || 0} ${t('lodging.title')}`
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
              <Coffee className="h-6 w-6 text-orange-600 dark:text-orange-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {detailsLoading || !ongoingTripDetails ? (
                  <span className="inline-block h-4 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
                ) : (
                  `${ongoingTripDetails.activities?.length || 0} ${t('activities.title')}`
                )}
              </div>
            </div>
          </div>
          
          <Link 
            to={`/trips/${ongoingTrip.id}`}
            className="flex items-center justify-center w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {t('trips.viewDetails')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  };

  const renderUpcomingTrip = () => {
    if (!upcomingTrip) {
      return (
        <Card className="bg-gray-50 dark:bg-gray-800 border-dashed border-2">
          <CardContent className="py-12">
            <div className="text-center">
              <Compass className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('trips.noUpcomingTrips')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{t('trips.tagline')}</p>
              <Button
                variant="primary"
                icon={<PlusCircle className="h-5 w-5" />}
                onClick={() => navigate('/trips/new')}
                disabled={isOfflineMode}
              >
                {t('trips.createTrip')}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="relative p-0 pb-0">
          <div className="h-48 w-full relative">
            <img 
              src={upcomingTrip.cover_image 
                ? getImageUrl(upcomingTrip.cover_image)
                : getFallbackImageUrl('trip')
              } 
              alt={upcomingTrip.name}
              className="h-full w-full object-cover rounded-t-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h2 className="text-2xl font-bold text-white mb-1">{upcomingTrip.name}</h2>
              <div className="flex items-center text-white/80">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{getDateRangeString(upcomingTrip.start_date, upcomingTrip.end_date)}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Map className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
              <div className="text-sm font-medium text-center">{upcomingTrip.location || t('common.noLocation')}</div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {dayjs(upcomingTrip.start_date).diff(dayjs(), 'day') === 0 ? t('common.tomorrow') : dayjs(upcomingTrip.start_date).diff(dayjs(), 'day') + t('common.daysLeft')}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <Bed className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {detailsLoading || !upcomingTripDetails ? (
                  <span className="inline-block h-4 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
                ) : (
                  `${upcomingTripDetails.lodging?.length || 0} ${t('lodging.title')}`
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
              <Coffee className="h-6 w-6 text-orange-600 dark:text-orange-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {detailsLoading || !upcomingTripDetails ? (
                  <span className="inline-block h-4 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
                ) : (
                  `${upcomingTripDetails.activities?.length || 0} ${t('activities.title')}`
                )}
              </div>
            </div>
          </div>
          
          <Link 
            to={`/trips/${upcomingTrip.id}`}
            className="flex items-center justify-center w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {t('trips.viewDetails')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('dashboard.tagline')}</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate('/calendar')}
            icon={<Calendar className="h-5 w-5" />}
          >
            {t('navigation.calendar')}
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/trips/new')}
            icon={<PlusCircle className="h-5 w-5" />}
            disabled={isOfflineMode}
          >
            {t('trips.createTrip')}
          </Button>
        </div>
      </div>

      {/* Offline mode banner */}
      {isOfflineMode && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center">
            <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <p className="text-yellow-800 dark:text-yellow-200">
              {t('offline.offline_mode_message', "You're currently in offline mode. Only trips saved for offline use are shown.")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ongoing & Upcoming Trip Column */}
        <div className="md:col-span-2">
          {/* Ongoing Trip Section - Only show if there's an ongoing trip */}
          {ongoingTrip && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.ongoing', 'Ongoing Trip')}</h2>
              {loading ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full mb-4"></div>
                      <div className="h-6 w-48 bg-gray-300 dark:bg-gray-700 rounded-md mb-2"></div>
                      <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded-md mb-6"></div>
                      <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded-md"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                renderOngoingTrip()
              )}
            </>
          )}
          
          {/* Upcoming Trip Section */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 mt-6">{t('trips.upcoming')}</h2>
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full mb-4"></div>
                  <div className="h-6 w-48 bg-gray-300 dark:bg-gray-700 rounded-md mb-2"></div>
                  <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded-md mb-6"></div>
                  <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded-md"></div>
                </div>
              </CardContent>
            </Card>
          ) : (
            renderUpcomingTrip()
          )}
        </div>
        
        {/* Stats Column */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.travelStats')}</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mr-4">
                    <Compass className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalTrips')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {loading ? (
                        <div className="h-6 w-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                      ) : (
                        trips.length
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 mr-4">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.upcomingTrips')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {loading ? (
                        <div className="h-6 w-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                      ) : (
                        trips.filter(trip => new Date(trip.start_date) > new Date()).length
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 mr-4">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.sharedTrips')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {loading || isOfflineMode ? (
                        isOfflineMode ? "N/A" : (
                          <div className="h-6 w-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                        )
                      ) : (
                        trips.filter(trip => trip.role !== 'owner').length
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* View all trips link */}
            <Link 
              to="/trips" 
              className="flex items-center justify-center w-full px-4 py-3 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium transition-colors border border-blue-200 dark:border-blue-800"
            >
              {t('dashboard.viewAllTrips')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;