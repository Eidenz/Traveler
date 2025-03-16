// client/src/pages/trips/TripDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, ChevronDown, Map, Bed, User, Coffee, Ticket, PlusCircle, 
  Clock, Share2, Bell, Edit, Trash2, Home, ArrowLeft, Package,
  Plane, Train, Bus, Car, Ship, Download, FileText, Wifi, WifiOff, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import TransportModal from '../../components/trips/TransportModal';
import LodgingModal from '../../components/trips/LodgingModal';
import ActivityModal from '../../components/trips/ActivityModal';
import DocumentsModal from '../../components/trips/DocumentsModal';
import TripChecklist from '../../components/trips/TripChecklist';
import { tripAPI, transportAPI, lodgingAPI, activityAPI, documentAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { 
  isTripAvailableOffline, saveTripOffline, removeTripOffline, 
  saveDocumentOffline, getDocumentOffline, getDocumentsForReference, 
  getTripOffline 
} from '../../utils/offlineStorage';

const TripDetail = () => {
  const { tripId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
  const [selectedTransportId, setSelectedTransportId] = useState(null);
  const [selectedLodgingId, setSelectedLodgingId] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [isSharing, setIsSharing] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState({ type: '', id: null });
  const [isAvailableOffline, setIsAvailableOffline] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineSaveSuccess, setOfflineSaveSuccess] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [currentDocuments, setCurrentDocuments] = useState([]);
  const [currentReferenceType, setCurrentReferenceType] = useState('');

  useEffect(() => {
    fetchTripData();
    
    // Check if trip is available offline
    const checkOfflineAvailability = async () => {
      const available = await isTripAvailableOffline(tripId);
      setIsAvailableOffline(available);
    };
    
    checkOfflineAvailability();
  }, [tripId]);

  const fetchTripData = async () => {
    try {
      setLoading(true);
      
      // First check if trip is available offline
      const isOffline = !navigator.onLine;
      const offlineAvailable = await isTripAvailableOffline(tripId);
      setIsAvailableOffline(offlineAvailable);
      
      // If we're offline and the trip is available offline, use that data
      if ((isOffline || navigator.connection?.effectiveType === '2g') && offlineAvailable) {
        console.log('Loading trip from offline storage');
        // Get trip data from IndexedDB
        const offlineTrip = await getTripOffline(tripId);
        
        if (offlineTrip) {
          setTrip(offlineTrip);
          setMembers(offlineTrip.members || []);
          setTransportation(offlineTrip.transportation || []);
          setLodging(offlineTrip.lodging || []);
          setActivities(offlineTrip.activities || []);
          
          // Set a toast notification to indicate offline mode
          toast.info(t('offline.usingOfflineData') || 'Using offline data', {
            icon: <WifiOff size={16} />,
            duration: 3000,
          });
          
          setLoading(false);
          return;
        }
      }
      
      // If not available offline or we're online, fetch from API
      const response = await tripAPI.getTripById(tripId);
      
      setTrip(response.data.trip);
      setMembers(response.data.members);
      setTransportation(response.data.transportation);
      setLodging(response.data.lodging);
      setActivities(response.data.activities);
    } catch (error) {
      console.error('Error fetching trip:', error);
      
      // If we're offline, check again for offline data as a fallback
      const isOffline = !navigator.onLine;
      if (isOffline) {
        const offlineTrip = await getTripOffline(tripId);
        if (offlineTrip) {
          setTrip(offlineTrip);
          setMembers(offlineTrip.members || []);
          setTransportation(offlineTrip.transportation || []);
          setLodging(offlineTrip.lodging || []);
          setActivities(offlineTrip.activities || []);
          
          toast.info(t('offline.usingOfflineData') || 'Using offline data', {
            icon: <WifiOff size={16} />,
            duration: 3000,
          });
          
          setLoading(false);
          return;
        }
      }
      
      toast.error(t('errors.failedFetch'));
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    try {
      setIsDeleting(true);
      await tripAPI.deleteTrip(tripId);
      toast.success(t('trips.deleteSuccess'));
      navigate('/trips');
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error(t('errors.deleteFailed', { item: t('trips.title').toLowerCase() }));
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
        toast.success(t('transportation.deleteSuccess'));
      } else if (itemToDelete.type === 'lodging') {
        await lodgingAPI.deleteLodging(itemToDelete.id, tripId);
        toast.success(t('lodging.deleteSuccess'));
      } else if (itemToDelete.type === 'activity') {
        await activityAPI.deleteActivity(itemToDelete.id, tripId);
        toast.success(t('activities.deleteSuccess'));
      }
      
      fetchTripData(); // Refresh data
      setShowConfirmDeleteModal(false);
    } catch (error) {
      console.error(`Error deleting ${itemToDelete.type}:`, error);
      
      if (error.response && error.response.status === 403) {
        toast.error(t('errors.permissionDenied'));
      } else {
        toast.error(t('errors.deleteFailed', { 
          item: itemToDelete.type === 'transport' 
            ? t('transportation.title').toLowerCase() 
            : itemToDelete.type === 'lodging' 
              ? t('lodging.title').toLowerCase() 
              : t('activities.title').toLowerCase() 
        }));
      }
    }
  };
  
  // Handle trip sharing
  const handleShareTrip = async (e) => {
    e.preventDefault();
    
    if (!shareEmail) {
      toast.error(t('errors.required', { field: t('auth.email') }));
      return;
    }
    
    try {
      setIsSharing(true);
      
      await tripAPI.shareTrip(tripId, {
        email: shareEmail,
        role: shareRole
      });
      
      toast.success(t('sharing.shareSuccess'));
      setShareEmail('');
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error sharing trip:', error);
      toast.error(error.response?.data?.message || t('errors.saveFailed', { item: t('trips.title').toLowerCase() }));
    } finally {
      setIsSharing(false);
    }
  };
  
  // Handle remove member
  const handleRemoveMember = async (userId) => {
    try {
      await tripAPI.removeTripMember(tripId, userId);
      toast.success(t('sharing.memberRemoved'));
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error(t('errors.deleteFailed', { item: t('sharing.currentMembers').toLowerCase() }));
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
      
      toast.success(t('sharing.memberRoleUpdated'));
      fetchTripData(); // Refresh members list
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error(t('errors.saveFailed', { item: t('sharing.permissionLevel').toLowerCase() }));
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
      toast.error(t('documents.downloadFailed'));
    }
  };
  
  // Handle document view/download
  const handleViewDocument = async (referenceType, referenceId) => {
    try {
      // Check if we're offline
      const isOffline = !navigator.onLine;
      
      // If we're offline but have offline data available, get documents from offline storage
      if (isOffline && isAvailableOffline) {
        try {
          // Get the full offline trip data
          const offlineTrip = await getTripOffline(tripId);
          
          // Find the correct item based on reference type and ID
          let item = null;
          if (referenceType === 'transport') {
            item = offlineTrip.transportation.find(t => t.id === referenceId);
          } else if (referenceType === 'lodging') {
            item = offlineTrip.lodging.find(l => l.id === referenceId);
          } else if (referenceType === 'activity') {
            item = offlineTrip.activities.find(a => a.id === referenceId);
          }
          
          if (!item || !item.has_documents) {
            toast.error('No documents available offline for this item');
            return;
          }
          
          // Get all documents for this item type from offline storage
          const offlineDocs = await getDocumentsForReference(referenceType, referenceId);
          
          if (!offlineDocs || offlineDocs.length === 0) {
            toast.error('No documents available offline for this item');
            return;
          }
          
          // Set the documents for the modal
          setCurrentDocuments(offlineDocs);
          setCurrentReferenceType(referenceType);
          setIsDocumentsModalOpen(true);
          return;
        } catch (offlineError) {
          console.error('Error retrieving offline document:', offlineError);
          toast.error('Failed to retrieve offline document');
          return;
        }
      }
      
      // Online mode - proceed with normal API calls
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
        toast.error(t('documents.fileTypes'));
        return;
      }
      
      // Set the documents for the modal
      setCurrentDocuments(documents);
      setCurrentReferenceType(referenceType);
      setIsDocumentsModalOpen(true);
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error(t('documents.viewFailed'));
    }
  };
  
  // Save trip for offline use
  const handleSaveOffline = async () => {
    try {
      setIsSavingOffline(true);
      
      // First save the trip data
      // Ensure we're passing the ID as-is without any conversions
      await saveTripOffline({
        id: tripId, // Don't use parseInt here
        ...trip,
        members,
        transportation,
        lodging,
        activities
      });
      
      // Save each document
      let docCount = 0;
      
      // Helper function to fetch and save documents
      const fetchAndSaveDocuments = async (items, refType) => {
        for (const item of items) {
          if (item.has_documents) {
            let response;
            try {
              // Get the document details based on reference type
              if (refType === 'transport') {
                response = await transportAPI.getTransportation(item.id);
              } else if (refType === 'lodging') {
                response = await lodgingAPI.getLodging(item.id);
              } else if (refType === 'activity') {
                response = await activityAPI.getActivity(item.id);
              }
              
              const documents = response?.data?.documents || [];
              
              for (const doc of documents) {
                try {
                  // Fetch the document blob
                  const blobResponse = await documentAPI.viewDocumentAsBlob(doc.id);
                  
                  // Save the document and blob to IndexedDB
                  // Make sure to pass IDs as-is
                  await saveDocumentOffline({
                    ...doc,
                    trip_id: tripId, // Keep as string
                    reference_type: refType,
                    reference_id: item.id, // No need to parse
                    id: doc.id // No need to parse
                  }, blobResponse.data);
                  
                  docCount++;
                } catch (docError) {
                  console.error(`Error saving document ${doc.id}:`, docError);
                }
              }
            } catch (itemError) {
              console.error(`Error fetching ${refType} ${item.id} documents:`, itemError);
            }
          }
        }
      };
      
      // Save documents for each type
      await fetchAndSaveDocuments(transportation, 'transport');
      await fetchAndSaveDocuments(lodging, 'lodging');
      await fetchAndSaveDocuments(activities, 'activity');
      
      // Show success notification
      toast.success(`Trip saved for offline use with ${docCount} documents`);
      setIsAvailableOffline(true);
      setOfflineSaveSuccess(true);
      
      // Reset success indicator after 3 seconds
      setTimeout(() => {
        setOfflineSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving trip for offline use:', error);
      toast.error('Failed to save trip for offline use');
    } finally {
      setIsSavingOffline(false);
    }
  };
  
  // Remove trip from offline storage
  const handleRemoveOffline = async () => {
    try {
      setIsSavingOffline(true);
      await removeTripOffline(tripId);
      toast.success('Trip removed from offline storage');
      setIsAvailableOffline(false);
    } catch (error) {
      console.error('Error removing trip from offline storage:', error);
      toast.error('Failed to remove trip from offline storage');
    } finally {
      setIsSavingOffline(false);
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
          {t('common.back', 'Back to trips')}
        </Link>
      </div>

      {/* Offline mode banner */}
      {!navigator.onLine && isAvailableOffline && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center">
            <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <p className="text-yellow-800 dark:text-yellow-200">
              {t('offline.offline_mode_message', "You're currently in offline mode. You're viewing a saved offline version of this trip.")}
            </p>
          </div>
        </div>
      )}

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
          <div className="flex flex-col md:flex-row md:justify-between md:items-end">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{trip.name}</h1>
              <div className="flex items-center text-white mt-2">
                <Clock size={16} className="mr-2 flex-shrink-0" />
                <span className="text-sm md:text-base">{formatDateRange(trip.start_date, trip.end_date)}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              {canEdit() && (
                <Button 
                  variant="secondary"
                  icon={<Edit className="h-5 w-5" />}
                  onClick={() => navigate(`/trips/${tripId}/edit`)}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  {t('trips.editTrip')}
                </Button>
              )}
              
              {/* Offline button */}
              <Button
                variant={isAvailableOffline ? "transparent" : "secondary"}
                onClick={isAvailableOffline ? handleRemoveOffline : handleSaveOffline}
                size="sm"
                loading={isSavingOffline}
                className={`whitespace-nowrap ${isAvailableOffline ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : ''} ${offlineSaveSuccess ? 'animate-pulse' : ''}`}
                icon={
                  isAvailableOffline ? 
                    <WifiOff className="h-5 w-5" /> : 
                    <Wifi className="h-5 w-5" />
                }
              >
                {isAvailableOffline ? t('offline.removeOffline') : t('offline.saveOffline')}
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
            {t('trips.tripOverview')}
          </button>
          
          <button 
            onClick={() => setActiveTab('transport')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'transport' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('transportation.title')}
          </button>
          
          <button 
            onClick={() => setActiveTab('lodging')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'lodging' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('lodging.title')}
          </button>
          
          <button 
            onClick={() => setActiveTab('activities')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'activities' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('activities.title')}
          </button>

          {/* Add Checklist Tab button here */}
          <button 
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'checklist' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Checklists
          </button>
          
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'calendar' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('calendar.title')}
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
                  <CardTitle>{t('trips.tripOverview')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Quick Info Cards */}
                    <div className="flex items-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 
                                  transition-all duration-200 
                                  hover:shadow-md 
                                  hover:translate-y-[-2px]">
                      <Map className="text-blue-500 dark:text-blue-400 mr-4" size={24} />
                      <div 
                        className={`${trip.location ? 'cursor-pointer' : ''}`}
                        onClick={() => trip.location ? window.open(`https://www.google.com/maps/search/${trip.location}`) : null}
                      >
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('trips.destination')}</div>
                        <div className="font-medium">{trip.location || t('common.noLocation')}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30
                                  transition-all duration-200 
                                  hover:shadow-md 
                                  hover:translate-y-[-2px]">
                      <Calendar className="text-purple-500 dark:text-purple-400 mr-4" size={24} />
                      <div
                        className='cursor-pointer'
                        onClick={() => setActiveTab('calendar')}
                      >
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('trips.duration')}</div>
                        <div className="font-medium">
                          {dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day')} {t('trips.days')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-green-50 dark:bg-green-900/30
                                  transition-all duration-200 
                                  hover:shadow-md 
                                  hover:translate-y-[-2px]">
                      <Bed className="text-green-500 dark:text-green-400 mr-4" size={24} />
                      <div
                        className='cursor-pointer'
                        onClick={() => setActiveTab('lodging')}
                      >
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('lodging.title')}</div>
                        <div className="font-medium">{lodging.length} {t('lodging.title').toLowerCase()}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/30
                                  transition-all duration-200 
                                  hover:shadow-md 
                                  hover:translate-y-[-2px]">
                      <Coffee className="text-orange-500 dark:text-orange-400 mr-4" size={24} />
                      <div
                        className='cursor-pointer'
                        onClick={() => setActiveTab('activities')}
                      >
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('activities.title')}</div>
                        <div className="font-medium">{activities.length} {t('activities.title').toLowerCase()}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Trip Description */}
                  {trip.description && (
                    <div className="mb-6">
                      <h3 className="font-medium mb-2">{t('trips.description')}</h3>
                      <p className="text-gray-600 dark:text-gray-300" style={{whiteSpace: 'pre-wrap'}}>{trip.description}</p>
                    </div>
                  )}
                  
                  {/* Upcoming Events */}
                  <div>
                    <h3 className="font-medium mb-3">{t('calendar.upcomingTrips')}</h3>
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
                                {activity.has_documents > 0 ? t('transportation.ticketAttached') : t('transportation.noTicket')}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <Coffee className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400">{t('activities.noActivities')}</p>
                          {canEdit() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              icon={<PlusCircle className="h-4 w-4" />}
                              onClick={() => setActiveTab('activities')}
                            >
                              {t('activities.add')}
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
                    {t('trips.deleteTrip')}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Trip Members */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('sharing.currentMembers')}</CardTitle>
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
                              <User className="h-full w-full p-1 text-gray-500 dark:text-gray-400" />
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
                            <option value="editor">{t('trips.editor')}</option>
                            <option value="viewer">{t('trips.viewer')}</option>
                            <option value="remove">{t('sharing.remove')}</option>
                          </select>
                        ) : (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'owner' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                              : member.role === 'editor'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {t(`trips.${member.role}`)}
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
                      {t('sharing.invite')}
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
              <h2 className="text-xl font-semibold">{t('transportation.title')}</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenTransportModal()}
                >
                  {t('transportation.add')}
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
                          <h3 className="font-semibold">{t(`transportation.${item.type.toLowerCase()}`)} - {item.company || t('common.noLocation')}</h3>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{item.departure_date}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {item.has_documents > 0 && (
                          <div className="flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 mr-3">
                            <Ticket size={12} className="mr-1" />
                            {t('transportation.ticketAttached')}
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
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('transportation.from')}</div>
                          <div className="font-medium">{item.from_location}</div>
                          <div className="mt-1 text-sm">{item.departure_date}, {item.departure_time || t('transportation.departureTime')}</div>
                        </div>
                        
                        <div className="hidden md:flex items-center px-4">
                          <div className="h-0.5 w-24 bg-gray-300 dark:bg-gray-600"></div>
                          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 mx-2">
                            {getTransportIcon(item.type)}
                          </div>
                          <div className="h-0.5 w-24 bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('transportation.to')}</div>
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
                              <div className="text-sm text-gray-500 dark:text-gray-400">{t('transportation.confirmationCode')}</div>
                              <div className="font-mono font-medium">{item.confirmation_code ? item.confirmation_code : "-"}</div>
                            </div>
                            
                            {/* Document buttons - show to all users, but different actions for editors vs viewers */}
                            {item.has_documents > 0 ? (
                              <Button
                                variant="secondary"
                                icon={<FileText className="h-5 w-5" />}
                                onClick={() => handleViewDocument('transport', item.id)}
                              >
                                {t('transportation.viewTicket')}
                              </Button>
                            ) : canEdit() && (
                              <Button
                                variant="primary"
                                icon={<PlusCircle className="h-5 w-5" />}
                                onClick={() => handleOpenTransportModal(item.id)}
                              >
                                {t('transportation.attachTicket')}
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('transportation.noTransport')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {t('transportation.noTransportMessage')}
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenTransportModal()}
                    >
                      {t('transportation.add')}
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
              <h2 className="text-xl font-semibold">{t('lodging.title')}</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenLodgingModal()}
                >
                  {t('lodging.add')}
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lodging.length > 0 ? (
                lodging.map(lodge => (
                  <Card key={lodge.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="p-0 relative h-48">
                      <img 
                        src={lodge.banner_image 
                          ? getImageUrl(lodge.banner_image)
                          : getFallbackImageUrl('lodging')}
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
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('lodging.address')}</div>
                          <div className="mt-1 mb-4">{lodge.address}</div>
                        </>
                      )}
                      
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex justify-between">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{t('lodging.confirmationCode')}</div>
                              <div className="font-mono font-medium">{lodge.confirmation_code ? lodge.confirmation_code : "-"}</div>
                            </div>
                            
                            {/* Document buttons - show to all users, but different actions for editors vs viewers */}
                            {lodge.has_documents > 0 ? (
                              <Button
                                variant="secondary"
                                icon={<FileText className="h-5 w-5" />}
                                onClick={() => handleViewDocument('lodging', lodge.id)}
                              >
                                {t('lodging.viewReservation')}
                              </Button>
                            ) : canEdit() && (
                              <Button
                                variant="primary"
                                icon={<PlusCircle className="h-5 w-5" />}
                                onClick={() => handleOpenLodgingModal(lodge.id)}
                              >
                                {t('lodging.attachReservation')}
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('lodging.noLodging')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {t('lodging.noLodgingMessage')}
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenLodgingModal()}
                    >
                      {t('lodging.add')}
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
              <h2 className="text-xl font-semibold">{t('activities.title')}</h2>
              {canEdit() && (
                <Button
                  variant="primary"
                  icon={<PlusCircle className="h-5 w-5" />}
                  onClick={() => handleOpenActivityModal()}
                >
                  {t('activities.add')}
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.length > 0 ? (
                activities.map(activity => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="p-0 relative h-40">
                      <img 
                        src={activity.banner_image 
                          ? getImageUrl(activity.banner_image)
                          : getFallbackImageUrl('activity')}
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
                            {t('transportation.ticketAttached')}
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
                          <div className="text-gray-500 dark:text-gray-400">{t('activities.confirmationCode')}:</div>
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
                            {t('activities.viewTicket')}
                          </Button>
                        ) : canEdit() && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<PlusCircle className="h-4 w-4" />}
                            onClick={() => handleOpenActivityModal(activity.id)}
                          >
                            {t('activities.attachTicket')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow col-span-full">
                  <Coffee className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('activities.noActivities')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {t('activities.noActivitiesMessage')}
                  </p>
                  {canEdit() && (
                    <Button
                      variant="primary"
                      icon={<PlusCircle className="h-5 w-5" />}
                      onClick={() => handleOpenActivityModal()}
                    >
                      {t('activities.add')}
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
              <h2 className="text-xl font-semibold">{t('calendar.title')}</h2>
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
                                {t('common.today')}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-3 min-h-32">
                          {dayActivities.length === 0 && transports.length === 0 && lodgings.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                              {t('calendar.noEvents')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {transports.map(transport => (
                                <div
                                  key={`transport-${transport.id}`}
                                  className="p-2 rounded-md text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                >
                                  <div className="font-medium">{t(`transportation.${transport.type.toLowerCase()}`)}: {transport.from_location}</div>
                                  <div>{transport.departure_time || t('transportation.departureTime')}</div>
                                </div>
                              ))}
                              
                              {lodgings.map(lodge => (
                                <div
                                  key={`lodge-${lodge.id}`}
                                  className="p-2 rounded-md text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                >
                                  <div className="font-medium">{t('lodging.stay')}: {lodge.name}</div>
                                </div>
                              ))}
                              
                              {dayActivities.map(activity => (
                                <div
                                  key={`activity-${activity.id}`}
                                  className="p-2 rounded-md text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                                >
                                  <div className="font-medium">{activity.name}</div>
                                  <div>{activity.time ? activity.time.split(' - ')[0] : t('activities.time')}</div>
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

        {/* Checklist Tab */}
        {activeTab === 'checklist' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t('trips.checklists')}</h2>
            </div>
            
            <TripChecklist 
              tripId={tripId} 
              canEdit={canEdit()}
            />
          </div>
        )}
      </div>
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('trips.deleteTrip')}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('trips.deleteConfirm')}
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTrip}
              loading={isDeleting}
              icon={<Trash2 className="h-5 w-5" />}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Item delete confirmation modal */}
      <Modal
        isOpen={showConfirmDeleteModal}
        onClose={() => setShowConfirmDeleteModal(false)}
        title={itemToDelete.type === 'transport' 
          ? t('transportation.delete') 
          : itemToDelete.type === 'lodging' 
            ? t('lodging.delete') 
            : t('activities.delete')}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {itemToDelete.type === 'transport' 
              ? t('transportation.deleteConfirm')
              : itemToDelete.type === 'lodging' 
                ? t('lodging.deleteConfirm')
                : t('activities.deleteConfirm')}
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmDeleteModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              icon={<Trash2 className="h-5 w-5" />}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Share modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={t('sharing.shareTrip')}
        size="md"
      >
        <div className="p-6">
          <form onSubmit={handleShareTrip}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('sharing.inviteByEmail')}</label>
              <div className="flex">
                <input
                  type="email"
                  placeholder={t('sharing.emailPlaceholder')}
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
                  {t('sharing.invite')}
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('sharing.permissionLevel')}</label>
              <select 
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
              >
                <option value="editor">{t('sharing.canEdit')}</option>
                <option value="viewer">{t('sharing.canView')}</option>
              </select>
            </div>
          </form>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">{t('sharing.shareLink')}</label>
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
                  toast.success(t('sharing.linkCopied'));
                }}
              >
                {t('common.copy', 'Copy')}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-sm mb-2">{t('sharing.currentMembers')}</h4>
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
                    <option value="editor">{t('trips.editor')}</option>
                    <option value="viewer">{t('trips.viewer')}</option>
                    <option value="remove">{t('sharing.remove')}</option>
                  </select>
                ) : (
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.role === 'owner' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                      : member.role === 'editor'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {t(`trips.${member.role}`)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
      
      {/* Documents Modal */}
      <DocumentsModal
        isOpen={isDocumentsModalOpen}
        onClose={() => setIsDocumentsModalOpen(false)}
        documents={currentDocuments}
        referenceType={currentReferenceType}
        referenceId={currentReferenceType === 'transport' 
          ? selectedTransportId 
          : currentReferenceType === 'lodging' 
            ? selectedLodgingId 
            : selectedActivityId}
        tripId={tripId}
        isOfflineMode={!navigator.onLine && isAvailableOffline}
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