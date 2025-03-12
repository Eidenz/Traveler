// client/src/pages/trips/TripDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, ChevronDown, Map, Bed, User, Coffee, Ticket, PlusCircle, 
  Clock, Share2, Bell, Edit, Trash2, Home, ArrowLeft, Package,
  Plane, Train, Bus, Car, Ship, Download, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import TransportModal from '../../components/trips/TransportModal';
import LodgingModal from '../../components/trips/LodgingModal';
import ActivityModal from '../../components/trips/ActivityModal';
import PDFViewerModal from '../../components/trips/PDFViewerModal';
import { tripAPI, transportAPI, lodgingAPI, activityAPI, documentAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';

const TripDetail = () => {
  const { tripId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [lodging, setLodging] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isLodgingModalOpen, setIsLodgingModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [selectedTransportId, setSelectedTransportId] = useState(null);
  const [selectedLodgingId, setSelectedLodgingId] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [isSharing, setIsSharing] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState({ type: '', id: null });

  useEffect(() => {
    fetchTripData();
  }, [tripId]);

  const fetchTripData = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getTripById(tripId);
      
      setTrip(response.data.trip);
      setMembers(response.data.members);
      setTransportation(response.data.transportation);
      setLodging(response.data.lodging);
      setActivities(response.data.activities);
    } catch (error) {
      console.error('Error fetching trip:', error);
      toast.error('Failed to load trip details');
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    try {
      setIsDeleting(true);
      await tripAPI.deleteTrip(tripId);
      toast.success('Trip deleted successfully');
      navigate('/trips');
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Failed to delete trip');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };
  
  // Handle opening the transport modal
  const handleOpenTransportModal = (transportId = null) => {
    setSelectedTransportId(transportId);
    setIsTransportModalOpen(true);
  };
  
  // Handle opening the lodging modal
  const handleOpenLodgingModal = (lodgingId = null) => {
    setSelectedLodgingId(lodgingId);
    setIsLodgingModalOpen(true);
  };
  
  // Handle opening the activity modal
  const handleOpenActivityModal = (activityId = null) => {
    setSelectedActivityId(activityId);
    setIsActivityModalOpen(true);
  };
  
  // Delete confirmation helpers
  const confirmDelete = (type, id) => {
    setItemToDelete({ type, id });
    setShowConfirmDeleteModal(true);
  };
  
  const handleConfirmDelete = async () => {
    try {
      if (itemToDelete.type === 'transport') {
        await transportAPI.deleteTransportation(itemToDelete.id, tripId);
        toast.success('Transportation deleted successfully');
      } else if (itemToDelete.type === 'lodging') {
        await lodgingAPI.deleteLodging(itemToDelete.id, tripId);
        toast.success('Accommodation deleted successfully');
      } else if (itemToDelete.type === 'activity') {
        await activityAPI.deleteActivity(itemToDelete.id, tripId);
        toast.success('Activity deleted successfully');
      }
      
      fetchTripData(); // Refresh data
      setShowConfirmDeleteModal(false);
    } catch (error) {
      console.error(`Error deleting ${itemToDelete.type}:`, error);
      
      if (error.response && error.response.status === 403) {
        toast.error(`Permission denied. Make sure you have edit access to this trip.`);
      } else {
        toast.error(`Failed to delete ${itemToDelete.type}`);
      }
    }
  };
  
  // Handle trip sharing
  const handleShareTrip = async (e) => {
    e.preventDefault();
    
    if (!shareEmail) {
      toast.error('Please enter an email address');
      return;
    }
    
    try {
      setIsSharing(true);
      
      await tripAPI.shareTrip(tripId, {
        email: shareEmail,
        role: shareRole
      });
      
      toast.success(`Trip shared successfully with ${shareEmail}`);
      setShareEmail('');
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error sharing trip:', error);
      toast.error(error.response?.data?.message || 'Failed to share trip');
    } finally {
      setIsSharing(false);
    }
  };
  
  // Handle remove member
  const handleRemoveMember = async (userId) => {
    try {
      await tripAPI.removeTripMember(tripId, userId);
      toast.success('Member removed successfully');
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };
  
  // Handle change member role
  const handleChangeMemberRole = async (userId, newRole) => {
    if (newRole === 'remove') {
      handleRemoveMember(userId);
      return;
    }
    
    try {
      // Find member email
      const member = members.find(m => m.id === userId);
      if (!member) return;
      
      await tripAPI.shareTrip(tripId, {
        email: member.email,
        role: newRole
      });
      
      toast.success(`Member role updated successfully`);
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Failed to update member role');
    }
  };
  
  // Handle document download
  const handleDownloadDocument = async (documentId, fileName) => {
    try {
      const response = await documentAPI.downloadDocument(documentId);
      
      // Create blob from response data
      const blob = new Blob([response.data]);
      
      // Create download link and trigger click
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up URL object
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };
  
  // Handle document view/download
  const handleViewDocument = async (referenceType, referenceId) => {
    try {
      let documents = [];
      
      // Get documents based on the reference type
      if (referenceType === 'transport') {
        const response = await transportAPI.getTransportation(referenceId);
        documents = response.data.documents || [];
      } else if (referenceType === 'lodging') {
        const response = await lodgingAPI.getLodging(referenceId);
        documents = response.data.documents || [];
      } else if (referenceType === 'activity') {
        const response = await activityAPI.getActivity(referenceId);
        documents = response.data.documents || [];
      }
      
      // If no documents found
      if (!documents.length) {
        toast.error('No documents attached');
        return;
      }
      
      // Get the first document
      const doc = documents[0];
      
      // Check if it's a PDF
      if (doc.file_type.includes('pdf')) {
        // Create URL for PDF viewer
        const baseUrl = import.meta.env.VITE_BASE_URL || '';
        // Make sure the URL is correct for the file path
        const pdfUrl = `${baseUrl}/api/documents/${doc.id}/view`;
        setCurrentPdfUrl(pdfUrl);
        setCurrentPdfName(doc.file_name);
        setCurrentDocumentId(doc.id);
        setIsPdfViewerOpen(true);
      } else {
        // For other types, just download
        handleDownloadDocument(doc.id, doc.file_name);
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to retrieve document');
    }
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  };

  const canEdit = () => {
    if (!trip || !members || !user) return false;
    
    const userMember = members.find(member => member.id === user.id);
    return userMember && (userMember.role === 'owner' || userMember.role === 'editor');
  };

  const isOwner = () => {
    if (!trip || !members || !user) return false;
    
    const userMember = members.find(member => member.id === user.id);
    return userMember && userMember.role === 'owner';
  };

  // Calendar date generation for tab
  const generateCalendarDates = () => {
    if (!trip) return [];
    
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    const dates = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };
  
  const calendarDates = generateCalendarDates();
  
  // Find activities for a specific date
  const getActivitiesForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return activities.filter(activity => {
      const activityDate = new Date(activity.date);
      return dateString === activityDate.toISOString().split('T')[0];
    });
  };
  
  // Get transport for a specific date
  const getTransportForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return transportation.filter(transport => {
      const transportDate = new Date(transport.departure_date);
      return dateString === transportDate.toISOString().split('T')[0];
    });
  };
  
  // Get lodging for a specific date
  const getLodgingForDate = (date) => {
    return lodging.filter(lodge => {
      const checkInDate = new Date(lodge.check_in);
      const checkOutDate = new Date(lodge.check_out);
      return date >= checkInDate && date < checkOutDate;
    });
  };
  
  // Get transport icon based on type
  const getTransportIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'flight':
        return <Plane className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
      case 'train':
        return <Train className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
      case 'bus':
        return <Bus className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
      case 'car':
        return <Car className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
      case 'ship':
      case 'ferry':
        return <Ship className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
      default:
        return <Package className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        {/* Skeleton loader */}
        <div className="animate-pulse">
          <div className="h-64 w-full bg-gray-300 dark:bg-gray-700 rounded-xl mb-6"></div>
          <div className="h-8 w-64 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-6"></div>
          <div className="flex space-x-6 mb-6">
            <div className="h-10 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-10 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-10 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="h-96 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/trips" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to trips
        </Link>
      </div>

      {/* Trip Header */}
      <div className="relative h-64 w-full mb-6">
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10 rounded-xl"></div>
        <img 
          src={trip.cover_image 
            ? getImageUrl(trip.cover_image)
            : getFallbackImageUrl('trip')
          } 
          alt={trip.name}
          className="w-full h-full object-cover rounded-xl"
        />
        <div className="absolute bottom-0 left-0 p-6 z-20 w-full">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-white">{trip.name}</h1>
              <div className="flex items-center text-white mt-2">
                <Clock size={16} className="mr-2" />
                <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              {canEdit() && (
                <Button 
                  variant="secondary"
                  icon={<Edit className="h-5 w-5" />}
                  onClick={() => navigate(`/trips/${tripId}/edit`)}
                >
                  Edit Trip
                </Button>
              )}
              <Button 
                variant="primary"
                icon={<Share2 className="h-5 w-5" />}
                onClick={() => setIsShareModalOpen(true)}
              >
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex overflow-x-auto">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'overview' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          
          <button 
            onClick={() => setActiveTab('transport')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'transport' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Transport
          </button>
          
          <button 
            onClick={() => setActiveTab('lodging')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'lodging' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Lodging
          </button>
          
          <button 
            onClick={() => setActiveTab('activities')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'activities' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Activities
          </button>
          
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'calendar' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Calendar
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Trip Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Quick Info Cards */}
                    <div className="flex items-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <Map className="text-blue-500 dark:text-blue-400 mr-4" size={24} />
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Destination</div>
                        <div className="font-medium">{trip.location || 'Not specified'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                      <Calendar className="text-purple-500 dark:text-purple-400 mr-4" size={24} />
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Duration</div>
                        <div className="font-medium">
                          {dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day')} days
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-green-50 dark:bg-green-900/30">
                      <Bed className="text-green-500 dark:text-green-400 mr-4" size={24} />
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Accommodations</div>
                        <div className="font-medium">{lodging.length} places</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                      <Coffee className="text-orange-500 dark:text-orange-400 mr-4" size={24} />
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Activities</div>
                        <div className="font-medium">{activities.length} planned</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Trip Description */}
                  {trip.description && (
                    <div className="mb-6">
                      <h3 className="font-medium mb-2">Description</h3>
                      <p className="text-gray-600 dark:text-gray-300" style={{whiteSpace: 'pre-wrap'}}>{trip.description}</p>
                    </div>
                  )}
                  
                  {/* Upcoming Events */}
                  <div>
                    <h3 className="font-medium mb-3">Upcoming Events</h3>
                    <div className="space-y-3">
                      {activities.length > 0 ? (
                        activities.slice(0, 3).map(activity => (
                          <div 
                            key={activity.id} 
                            className={`p-3 rounded-lg border-l-4 ${
                              activity.has_documents > 0 
                                ? 'border-green-500 dark:border-green-400' 
                                : 'border-yellow-500 dark:border-yellow-400'
                            } bg-gray-50 dark:bg-gray-800`}
                          >
                            <div className="font-medium">{activity.name}</div>
                            <div className="flex justify-between text-sm mt-1">
                              <div className="text-gray-500 dark:text-gray-400">{activity.date}</div>
                              <div className={
                                activity.has_documents > 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-yellow-600 dark:text-yellow-400'
                              }>
                                {activity.has_documents > 0 ? 'Ticket attached' : 'No ticket'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <Coffee className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400">No activities planned yet</p>
                          {canEdit() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              icon={<PlusCircle className="h-4 w-4" />}
                              onClick={() => setActiveTab('activities')}
                            >
                              Add Activity
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isOwner() && (
                <div className="mt-6">
                  <Button
                    variant="danger"
                    icon={<Trash2 className="h-5 w-5" />}
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete Trip
                  </Button>
                </div>
              )}
            </div>
            
            {/* Trip Members */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Trip Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mr-3">
                            {member.profile_image ? (
                              <img 
                                src={getImageUrl(member.profile_image)} 
                                alt={member.name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-full w-full p-2 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                          </div>
                        </div>
                        
                        {isOwner() && member.id !== user.id ? (
                          <select 
                            className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                            defaultValue={member.role}
                            onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                            <option value="remove">Remove</option>
                          </select>
                        ) : (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'owner' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                              : member.role === 'editor'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {isOwner() && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      icon={<User className="h-5 w-5" />}
                      onClick={() => setIsShareModalOpen(true)}
                    >
                      Invite People
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        {/* Transport Tab */}
        {activeTab === 'transport' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Transportation</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenTransportModal()}
                >
                  Add Transport
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {transportation.length > 0 ? (
                transportation.map(item => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="bg-blue-50 dark:bg-blue-900/20 flex flex-row justify-between items-center p-4">
                      <div className="flex items-center">
                        <div className="p-2 rounded-full bg-white dark:bg-gray-800 mr-4">
                          {getTransportIcon(item.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{item.type} - {item.company || 'Not specified'}</h3>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{item.departure_date}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {item.has_documents > 0 && (
                          <div className="flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 mr-3">
                            <Ticket size={12} className="mr-1" />
                            Ticket attached
                          </div>
                        )}
                        
                        {canEdit() && (
                          <div className="flex ml-3">
                            <button
                              onClick={() => handleOpenTransportModal(item.id)}
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 mr-1"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => confirmDelete('transport', item.id)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-full text-red-600 dark:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row justify-between mb-4">
                        <div className="mb-4 md:mb-0">
                          <div className="text-sm text-gray-500 dark:text-gray-400">From</div>
                          <div className="font-medium">{item.from_location}</div>
                          <div className="mt-1 text-sm">{item.departure_date}, {item.departure_time || 'Time not specified'}</div>
                        </div>
                        
                        <div className="hidden md:flex items-center px-4">
                          <div className="h-0.5 w-24 bg-gray-300 dark:bg-gray-600"></div>
                          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 mx-2">
                            {getTransportIcon(item.type)}
                          </div>
                          <div className="h-0.5 w-24 bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">To</div>
                          <div className="font-medium">{item.to_location}</div>
                          <div className="mt-1 text-sm">
                            {item.arrival_date || item.departure_date}, 
                            {item.arrival_time ? ` ${item.arrival_time}` : ' Time not specified'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex justify-between">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Confirmation code</div>
                              <div className="font-mono font-medium">{item.confirmation_code ? item.confirmation_code : "-"}</div>
                            </div>
                            
                            {/* Document buttons - show to all users, but different actions for editors vs viewers */}
                            {item.has_documents > 0 ? (
                              <Button
                                variant="secondary"
                                icon={<FileText className="h-5 w-5" />}
                                onClick={() => handleViewDocument('transport', item.id)}
                              >
                                View Ticket
                              </Button>
                            ) : canEdit() && (
                              <Button
                                variant="primary"
                                icon={<PlusCircle className="h-5 w-5" />}
                                onClick={() => handleOpenTransportModal(item.id)}
                              >
                                Attach Ticket
                              </Button>
                            )}
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No transportation added</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Add your flights, trains, or other transportation details to keep all your travel information in one place.
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenTransportModal()}
                    >
                      Add First Transportation
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Lodging Tab */}
        {activeTab === 'lodging' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Accommodations</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenLodgingModal()}
                >
                  Add Accommodation
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lodging.length > 0 ? (
                lodging.map(lodge => (
                  <Card key={lodge.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="p-0 relative h-48">
                      <img 
                        src="https://images.unsplash.com/photo-1566073771259-6a8506099945"
                        alt={lodge.name}
                        className="w-full h-full object-cover rounded-t-xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl"></div>
                      
                      {canEdit() && (
                        <div className="absolute top-3 right-3 flex space-x-2 z-10">
                          <button
                            onClick={() => handleOpenLodgingModal(lodge.id)}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-gray-700 hover:text-gray-900 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => confirmDelete('lodging', lodge.id)}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 p-4 z-10">
                        <h3 className="text-xl font-semibold text-white">{lodge.name}</h3>
                        <div className="text-sm text-gray-200 mt-1">
                          {dayjs(lodge.check_in).format('MMM D')} - {dayjs(lodge.check_out).format('MMM D, YYYY')}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4">
                      {lodge.address && (
                        <>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Address</div>
                          <div className="mt-1 mb-4">{lodge.address}</div>
                        </>
                      )}
                      
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex justify-between">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Confirmation code</div>
                              <div className="font-mono font-medium">{lodge.confirmation_code ? lodge.confirmation_code : "-"}</div>
                            </div>
                            
                            {/* Document buttons - show to all users, but different actions for editors vs viewers */}
                            {lodge.has_documents > 0 ? (
                              <Button
                                variant="secondary"
                                icon={<FileText className="h-5 w-5" />}
                                onClick={() => handleViewDocument('lodging', lodge.id)}
                              >
                                View Reservation
                              </Button>
                            ) : canEdit() && (
                              <Button
                                variant="primary"
                                icon={<PlusCircle className="h-5 w-5" />}
                                onClick={() => handleOpenLodgingModal(lodge.id)}
                              >
                                Attach Reservation
                              </Button>
                            )}
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow col-span-full">
                  <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No accommodations added</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Add your hotels, rentals, or other lodging information to keep track of where you'll be staying.
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenLodgingModal()}
                    >
                      Add First Accommodation
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Activities</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenActivityModal()}
                >
                  Add Activity
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.length > 0 ? (
                activities.map(activity => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="p-0 relative h-40">
                      <img 
                        src="https://images.unsplash.com/photo-1527786356703-4b100091cd2c"
                        alt={activity.name}
                        className="w-full h-full object-cover rounded-t-xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl"></div>
                      
                      {canEdit() && (
                        <div className="absolute top-2 right-2 flex space-x-2 z-10">
                          <button
                            onClick={() => handleOpenActivityModal(activity.id)}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-gray-700 hover:text-gray-900 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => confirmDelete('activity', activity.id)}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      
                      <div className="absolute top-2 left-2">
                        {activity.has_documents > 0 && (
                          <div className="flex items-center px-3 py-1 rounded-full text-xs bg-green-500 text-white">
                            <Ticket size={12} className="mr-1" />
                            Ticket
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 p-4 z-10">
                        <h3 className="text-lg font-semibold text-white">{activity.name}</h3>
                        <div className="text-sm text-gray-200 mt-1">{activity.date}</div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4">
                      {activity.time && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                          <Clock size={14} className="mr-2" />
                          {activity.time}
                        </div>
                      )}
                      
                      {activity.location && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                          <Map size={14} className="mr-2" />
                          {activity.location}
                        </div>
                      )}
                      
                      {activity.confirmation_code && (
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm mb-4">
                          <div className="text-gray-500 dark:text-gray-400">Confirmation:</div>
                          <div className="font-mono font-medium">{activity.confirmation_code}</div>
                        </div>
                      )}
                      
                      <div className="flex justify-end">
                        {activity.has_documents > 0 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<FileText className="h-4 w-4" />}
                            onClick={() => handleViewDocument('activity', activity.id)}
                          >
                            View Ticket
                          </Button>
                        ) : canEdit() && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<PlusCircle className="h-4 w-4" />}
                            onClick={() => handleOpenActivityModal(activity.id)}
                          >
                            Add Ticket
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow col-span-full">
                  <Coffee className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activities planned</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Add tours, excursions, or other activities to make the most of your trip.
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenActivityModal()}
                    >
                      Add First Activity
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Trip Calendar</h2>
            </div>
            
            <Card>
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {dayjs(trip.start_date).format('MMMM YYYY')}
                  </h3>
                </div>
              </CardHeader>
              
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {calendarDates.map((date, index) => {
                    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const dayActivities = getActivitiesForDate(date);
                    const transports = getTransportForDate(date);
                    const lodgings = getLodgingForDate(date);
                    
                    const isToday = dayjs().format('YYYY-MM-DD') === dayjs(date).format('YYYY-MM-DD');
                    
                    return (
                      <div 
                        key={dateString}
                        className={`rounded-lg ${isToday 
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'bg-gray-50 dark:bg-gray-800'
                        }`}
                      >
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <div className={`font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                              {dateString}
                            </div>
                            {isToday && (
                              <div className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Today
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-3 min-h-32">
                          {dayActivities.length === 0 && transports.length === 0 && lodgings.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                              No events
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {transports.map(transport => (
                                <div
                                  key={`transport-${transport.id}`}
                                  className="p-2 rounded-md text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                >
                                  <div className="font-medium">{transport.type}: {transport.from_location}</div>
                                  <div>{transport.departure_time || 'No time specified'}</div>
                                </div>
                              ))}
                              
                              {lodgings.map(lodge => (
                                <div
                                  key={`lodge-${lodge.id}`}
                                  className="p-2 rounded-md text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                >
                                  <div className="font-medium">Stay: {lodge.name}</div>
                                </div>
                              ))}
                              
                              {dayActivities.map(activity => (
                                <div
                                  key={`activity-${activity.id}`}
                                  className="p-2 rounded-md text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                                >
                                  <div className="font-medium">{activity.name}</div>
                                  <div>{activity.time ? activity.time.split(' - ')[0] : 'No time specified'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Trip"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this trip? This action cannot be undone and will remove all associated data including transportation, lodging, activities, and documents.
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
      
      {/* Item delete confirmation modal */}
      <Modal
        isOpen={showConfirmDeleteModal}
        onClose={() => setShowConfirmDeleteModal(false)}
        title={`Delete ${itemToDelete.type === 'transport' ? 'Transportation' : 
                itemToDelete.type === 'lodging' ? 'Accommodation' : 'Activity'}`}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this {
              itemToDelete.type === 'transport' ? 'transportation' : 
              itemToDelete.type === 'lodging' ? 'accommodation' : 'activity'
            }? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              icon={<Trash2 className="h-5 w-5" />}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Share modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Trip"
        size="md"
      >
        <div className="p-6">
          <form onSubmit={handleShareTrip}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Invite by email</label>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Email address"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  required
                />
                <Button 
                  type="submit" 
                  className="rounded-l-none rounded-r-lg"
                  loading={isSharing}
                >
                  Invite
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Permission level</label>
              <select 
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
            </div>
          </form>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Share link</label>
            <div className="flex">
              <input
                type="text"
                value={`${window.location.origin}/invite/${tripId}`}
                readOnly
                className="flex-1 px-3 py-2 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
              />
              <Button 
                variant="secondary" 
                className="rounded-l-none rounded-r-lg"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/invite/${tripId}`);
                  toast.success('Link copied to clipboard');
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-sm mb-2">Current members</h4>
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mr-3">
                    {member.profile_image ? (
                      <img 
                        src={getImageUrl(member.profile_image)} 
                        alt={member.name} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-full w-full p-1.5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{member.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                  </div>
                </div>
                
                {isOwner() && member.id !== user.id ? (
                  <select 
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    defaultValue={member.role}
                    onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                    <option value="remove">Remove</option>
                  </select>
                ) : (
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.role === 'owner' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                      : member.role === 'editor'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
      
      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        documentUrl={currentPdfUrl}
        documentName={currentPdfName}
        onDownload={() => {
          if (currentDocumentId) {
            handleDownloadDocument(currentDocumentId, currentPdfName);
          }
        }}
      />
      
      {/* Transport Modal */}
      <TransportModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        tripId={tripId}
        transportId={selectedTransportId}
        onSuccess={fetchTripData}
      />
      
      {/* Lodging Modal */}
      <LodgingModal
        isOpen={isLodgingModalOpen}
        onClose={() => setIsLodgingModalOpen(false)}
        tripId={tripId}
        lodgingId={selectedLodgingId}
        onSuccess={fetchTripData}
      />
      
      {/* Activity Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        tripId={tripId}
        activityId={selectedActivityId}
        onSuccess={fetchTripData}
      />
    </div>
  );
};

export default TripDetail;