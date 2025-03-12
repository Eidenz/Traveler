// client/src/pages/trips/MyTrips.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusCircle, Calendar, MapPin, User, Trash2, Edit, Clock, Search
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';

const MyTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getUserTrips();
      setTrips(response.data.trips || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (tripId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTripId(tripId);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTrip = async () => {
    if (!selectedTripId) return;
    
    try {
      setIsDeleting(true);
      await tripAPI.deleteTrip(selectedTripId);
      setTrips(trips.filter(trip => trip.id !== selectedTripId));
      toast.success('Trip deleted successfully');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Failed to delete trip');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDateRangeString = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  };

  const getTripStatus = (startDate, endDate) => {
    const now = dayjs();
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    if (now < start) {
      return {
        label: 'Upcoming',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      };
    } else if (now > end) {
      return {
        label: 'Past',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      };
    } else {
      return {
        label: 'Active',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      };
    }
  };
  
  const getRoleLabel = (role) => {
    if (role === 'owner') {
      return {
        label: 'Owner',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      };
    } else if (role === 'editor') {
      return {
        label: 'Editor',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      };
    } else {
      return {
        label: 'Viewer',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      };
    }
  };

  const filteredTrips = trips.filter(trip => 
    trip.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.location && trip.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Trips</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage and explore your travel plans</p>
        </div>
        <Button
          variant="primary"
          className="mt-4 md:mt-0"
          onClick={() => navigate('/trips/new')}
          icon={<PlusCircle className="h-5 w-5" />}
        >
          New Trip
        </Button>
      </div>

      {/* Search and filters */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search trips by name or location..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Trips grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="animate-pulse">
              <div className="h-48 bg-gray-300 dark:bg-gray-700 rounded-t-xl"></div>
              <CardContent className="p-4">
                <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="flex space-x-2 mb-4">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                </div>
                <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => {
            const tripStatus = getTripStatus(trip.start_date, trip.end_date);
            const roleLabel = getRoleLabel(trip.role);
            
            return (
              <Link 
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="block group"
              >
                <Card className="h-full transition-transform hover:transform hover:scale-[1.01] hover:shadow-md">
                  <div className="h-48 relative">
                    <img 
                      src={trip.cover_image 
                        ? getImageUrl(trip.cover_image)
                        : getFallbackImageUrl('trip')
                      } 
                      alt={trip.name}
                      className="h-full w-full object-cover rounded-t-xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl"></div>
                    <div className="absolute top-3 right-3 flex space-x-2">
                      {/* Edit button */}
                      {(trip.role === 'owner' || trip.role === 'editor') && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/trips/${trip.id}/edit`);
                          }}
                          className="p-1.5 bg-white/80 hover:bg-white rounded-full text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      
                      {/* Delete button (only for owners) */}
                      {trip.role === 'owner' && (
                        <button
                          onClick={(e) => handleDeleteClick(trip.id, e)}
                          className="p-1.5 bg-white/80 hover:bg-white rounded-full text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">{trip.name}</h3>
                    
                    {trip.location && (
                      <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{trip.location}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{getDateRangeString(trip.start_date, trip.end_date)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tripStatus.className}`}>
                        {tripStatus.label}
                      </span>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleLabel.className}`}>
                        {roleLabel.label}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex -space-x-2">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-gray-800">
                          <User size={16} />
                        </div>
                      </div>
                      <button className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        View Trip →
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No trips found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {searchTerm 
              ? `No trips matching "${searchTerm}". Try a different search term.` 
              : "You haven't created any trips yet. Start planning your next adventure!"}
          </p>
          {!searchTerm && (
            <Button
              variant="primary"
              onClick={() => navigate('/trips/new')}
              icon={<PlusCircle className="h-5 w-5" />}
            >
              Create First Trip
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Trip"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this trip? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTrip}
              loading={isDeleting}
              icon={<Trash2 className="h-5 w-5" />}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyTrips;