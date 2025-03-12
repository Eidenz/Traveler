// client/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusCircle, Calendar, Compass, Map, Clock, Bed, 
  ArrowRight, Package, Coffee 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { tripAPI } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime
dayjs.extend(relativeTime);

const Dashboard = () => {
  const [trips, setTrips] = useState([]);
  const [upcomingTrip, setUpcomingTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        setLoading(true);
        const response = await tripAPI.getUserTrips();
        
        if (response.data.trips && response.data.trips.length > 0) {
          // Sort by start date (ascending)
          const sortedTrips = response.data.trips.sort((a, b) => 
            new Date(a.start_date) - new Date(b.start_date)
          );
          
          setTrips(sortedTrips);
          
          // Find upcoming trip (closest start date in the future)
          const today = new Date();
          const upcomingTrips = sortedTrips.filter(trip => 
            new Date(trip.start_date) > today
          );
          
          if (upcomingTrips.length > 0) {
            setUpcomingTrip(upcomingTrips[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching trips:', error);
        toast.error('Failed to load trips');
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, []);

  const getDateRangeString = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  };

  const renderUpcomingTrip = () => {
    if (!upcomingTrip) {
      return (
        <Card className="bg-gray-50 dark:bg-gray-800 border-dashed border-2">
          <CardContent className="py-12">
            <div className="text-center">
              <Compass className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No upcoming trips</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Plan your next adventure now!</p>
              <Button
                variant="primary"
                icon={<PlusCircle className="h-5 w-5" />}
                onClick={() => navigate('/trips/new')}
              >
                Create New Trip
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
                ? `${import.meta.env.VITE_API_URL}${upcomingTrip.cover_image}`
                : 'https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1'
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
              <div className="text-sm font-medium text-center">{upcomingTrip.location || 'No location'}</div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
              <div className="text-sm font-medium text-center">
                {dayjs(upcomingTrip.start_date).diff(dayjs(), 'day')} days left
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <Bed className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-sm font-medium text-center">Lodging</div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
              <Coffee className="h-6 w-6 text-orange-600 dark:text-orange-400 mb-2" />
              <div className="text-sm font-medium text-center">Activities</div>
            </div>
          </div>
          
          <Link 
            to={`/trips/${upcomingTrip.id}`}
            className="flex items-center justify-center w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            View Trip Details
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back to your travel dashboard</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate('/calendar')}
            icon={<Calendar className="h-5 w-5" />}
          >
            Calendar
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/trips/new')}
            icon={<PlusCircle className="h-5 w-5" />}
          >
            New Trip
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upcoming Trip Column */}
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Trip</h2>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Travel Stats</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mr-4">
                    <Compass className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Trips</div>
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">Upcoming Trips</div>
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">Shared Trips</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {loading ? (
                        <div className="h-6 w-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
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
              View All Trips
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;