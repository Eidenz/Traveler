// client/src/pages/trips/TripDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, WifiOff, Plane, Bed, FileText, Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// API and stores
import { tripAPI, transportAPI, lodgingAPI, activityAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { 
  isTripAvailableOffline, saveTripOffline, removeTripOffline, 
  getDocumentsForReference, getTripOffline 
} from '../../utils/offlineStorage';

// Components
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import TripMap from '../../components/trips/TripMap';
import TripTimeline from '../../components/trips/TripTimeline';
import TripPanelHeader from '../../components/trips/TripPanelHeader';
import TripMembers from '../../components/trips/TripMembers';
import TabNav from '../../components/trips/TabNav';

// Modals
import TransportModal from '../../components/trips/TransportModal';
import LodgingModal from '../../components/trips/LodgingModal';
import ActivityModal from '../../components/trips/ActivityModal';
import DocumentsModal from '../../components/trips/DocumentsModal';

const TripDetail = () => {
  const { tripId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Core state
  const [activeTab, setActiveTab] = useState('timeline');
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [lodging, setLodging] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Offline state
  const [isAvailableOffline, setIsAvailableOffline] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);

  // Modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isLodgingModalOpen, setIsLodgingModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  
  // Selection state
  const [selectedTransportId, setSelectedTransportId] = useState(null);
  const [selectedLodgingId, setSelectedLodgingId] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [currentDocuments, setCurrentDocuments] = useState([]);
  const [currentReferenceType, setCurrentReferenceType] = useState('');
  const [activityDefaultDate, setActivityDefaultDate] = useState(null);

  // Share state
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [isSharing, setIsSharing] = useState(false);

  // Fetch trip data
  useEffect(() => {
    fetchTripData();
    checkOfflineAvailability();
  }, [tripId]);

  const checkOfflineAvailability = async () => {
    const available = await isTripAvailableOffline(tripId);
    setIsAvailableOffline(available);
  };

  const fetchTripData = async () => {
    try {
      setLoading(true);
      
      const isOffline = !navigator.onLine;
      const offlineAvailable = await isTripAvailableOffline(tripId);
      setIsAvailableOffline(offlineAvailable);

      if (isOffline && offlineAvailable) {
        const offlineTrip = await getTripOffline(tripId);
        if (offlineTrip) {
          setTrip(offlineTrip);
          setMembers(offlineTrip.members || []);
          setTransportation(offlineTrip.transportation || []);
          setLodging(offlineTrip.lodging || []);
          setActivities(offlineTrip.activities || []);
          toast.info(t('offline.usingOfflineData', 'Using offline data'), {
            icon: <WifiOff size={16} />,
          });
          return;
        }
      }

      const response = await tripAPI.getTripById(tripId);
      setTrip(response.data.trip);
      setMembers(response.data.members);
      setTransportation(response.data.transportation);
      setLodging(response.data.lodging);
      setActivities(response.data.activities);
    } catch (error) {
      console.error('Error fetching trip:', error);
      
      if (!navigator.onLine) {
        const offlineTrip = await getTripOffline(tripId);
        if (offlineTrip) {
          setTrip(offlineTrip);
          setMembers(offlineTrip.members || []);
          setTransportation(offlineTrip.transportation || []);
          setLodging(offlineTrip.lodging || []);
          setActivities(offlineTrip.activities || []);
          return;
        }
      }
      
      toast.error(t('errors.failedFetch'));
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  // Permission helpers
  const canEdit = () => {
    if (!trip || !members || !user) return false;
    const userMember = members.find(m => m.id === user.id);
    return userMember && (userMember.role === 'owner' || userMember.role === 'editor');
  };

  const isOwner = () => {
    if (!trip || !members || !user) return false;
    const userMember = members.find(m => m.id === user.id);
    return userMember && userMember.role === 'owner';
  };

  // Modal handlers
  const handleOpenTransportModal = (transportId = null) => {
    setSelectedTransportId(transportId);
    setIsTransportModalOpen(true);
  };

  const handleOpenLodgingModal = (lodgingId = null) => {
    setSelectedLodgingId(lodgingId);
    setIsLodgingModalOpen(true);
  };

  const handleOpenActivityModal = (activityOrDate = null) => {
    // If it's a date, set as default date for new activity
    if (activityOrDate instanceof Date || typeof activityOrDate === 'string') {
      setActivityDefaultDate(activityOrDate);
      setSelectedActivityId(null);
    } else if (activityOrDate?.id) {
      // If it's an activity object, edit it
      setSelectedActivityId(activityOrDate.id);
      setActivityDefaultDate(null);
    } else {
      setSelectedActivityId(null);
      setActivityDefaultDate(null);
    }
    setIsActivityModalOpen(true);
  };

  // Document handling
  const handleViewDocument = async (referenceType, item) => {
    try {
      setCurrentReferenceType(referenceType);
      
      if (!navigator.onLine && isAvailableOffline) {
        const offlineDocs = await getDocumentsForReference(referenceType, item.id);
        if (offlineDocs?.length > 0) {
          setCurrentDocuments(offlineDocs);
          setIsDocumentsModalOpen(true);
          return;
        }
        toast.error(t('documents.notAvailableOffline', 'Documents not available offline'));
        return;
      }

      let documents = [];
      if (referenceType === 'transport') {
        const response = await transportAPI.getTransportation(item.id);
        documents = response.data.documents || [];
        setSelectedTransportId(item.id);
      } else if (referenceType === 'lodging') {
        const response = await lodgingAPI.getLodging(item.id);
        documents = response.data.documents || [];
        setSelectedLodgingId(item.id);
      } else if (referenceType === 'activity') {
        const response = await activityAPI.getActivity(item.id);
        documents = response.data.documents || [];
        setSelectedActivityId(item.id);
      }

      if (documents.length === 0) {
        toast.error(t('documents.noDocuments', 'No documents found'));
        return;
      }

      setCurrentDocuments(documents);
      setIsDocumentsModalOpen(true);
    } catch (error) {
      console.error('Error viewing documents:', error);
      toast.error(t('documents.viewFailed', 'Failed to load documents'));
    }
  };

  // Offline handling
  const handleSaveOffline = async () => {
    if (isAvailableOffline) {
      try {
        setIsSavingOffline(true);
        await removeTripOffline(tripId);
        setIsAvailableOffline(false);
        toast.success(t('offline.removed', 'Removed from offline storage'));
      } catch (error) {
        toast.error(t('offline.removeFailed', 'Failed to remove offline data'));
      } finally {
        setIsSavingOffline(false);
      }
    } else {
      try {
        setIsSavingOffline(true);
        await saveTripOffline({
          id: tripId,
          ...trip,
          members,
          transportation,
          lodging,
          activities,
        });
        setIsAvailableOffline(true);
        toast.success(t('offline.saved', 'Saved for offline use'));
      } catch (error) {
        toast.error(t('offline.saveFailed', 'Failed to save for offline'));
      } finally {
        setIsSavingOffline(false);
      }
    }
  };

  // Share handling
  const handleShareTrip = async (e) => {
    e.preventDefault();
    if (!shareEmail) {
      toast.error(t('errors.required', { field: t('auth.email') }));
      return;
    }

    try {
      setIsSharing(true);
      await tripAPI.shareTrip(tripId, { email: shareEmail, role: shareRole });
      toast.success(t('sharing.shareSuccess'));
      setShareEmail('');
      fetchTripData();
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  // Tab definitions - removed activities tab (now in timeline)
  const tabs = [
    { id: 'timeline', label: t('trips.timeline', 'Timeline'), count: activities.length },
    { id: 'transport', label: t('transportation.title', 'Transport'), count: transportation.length },
    { id: 'lodging', label: t('lodging.title', 'Lodging'), count: lodging.length },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Panel - Trip Timeline */}
      <div className="w-full md:w-[480px] lg:w-[520px] bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col min-h-0">
        {/* Back button - mobile only */}
        <div className="md:hidden px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <Link 
            to="/trips" 
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('common.back', 'Back')}
          </Link>
        </div>

        {/* Trip header */}
        <div className="flex-shrink-0">
          <TripPanelHeader
            trip={trip}
            members={members}
            isAvailableOffline={isAvailableOffline}
            isSavingOffline={isSavingOffline}
            onShare={() => setIsShareModalOpen(true)}
            onSaveOffline={handleSaveOffline}
            canEdit={canEdit()}
          />
        </div>

        {/* Tab navigation */}
        <div className="flex-shrink-0">
          <TabNav
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={tabs}
          />
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {activeTab === 'timeline' && (
            <TripTimeline
              trip={trip}
              transportation={transportation}
              lodging={lodging}
              activities={activities}
              onTransportClick={(item) => handleOpenTransportModal(item?.id)}
              onLodgingClick={(item) => handleOpenLodgingModal(item?.id)}
              onActivityClick={handleOpenActivityModal}
              onAddActivity={handleOpenActivityModal}
              onDocumentClick={handleViewDocument}
              canEdit={canEdit()}
            />
          )}

          {activeTab === 'transport' && (
            <div className="p-4 space-y-3">
              {/* Add button */}
              {canEdit() && (
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={() => handleOpenTransportModal()} icon={<Plus className="w-4 h-4" />}>
                    {t('transportation.add', 'Add transport')}
                  </Button>
                </div>
              )}
              
              {transportation.length === 0 ? (
                <div className="text-center py-12">
                  <Plane className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">{t('transportation.noTransportation', 'No transportation added')}</p>
                  {canEdit() && (
                    <Button onClick={() => handleOpenTransportModal()} className="mt-4">
                      {t('transportation.add', 'Add transport')}
                    </Button>
                  )}
                </div>
              ) : (
                transportation.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-200" 
                    onClick={() => handleOpenTransportModal(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.from_location} → {item.to_location}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayjs(item.departure_date).format('MMM D')} • {item.company || item.type}
                          </p>
                        </div>
                      </div>
                      {item.has_documents > 0 && (
                        <FileText className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'lodging' && (
            <div className="p-4 space-y-3">
              {/* Add button */}
              {canEdit() && (
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={() => handleOpenLodgingModal()} icon={<Plus className="w-4 h-4" />}>
                    {t('lodging.add', 'Add lodging')}
                  </Button>
                </div>
              )}
              
              {lodging.length === 0 ? (
                <div className="text-center py-12">
                  <Bed className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">{t('lodging.noLodging', 'No lodging added')}</p>
                  {canEdit() && (
                    <Button onClick={() => handleOpenLodgingModal()} className="mt-4">
                      {t('lodging.add', 'Add lodging')}
                    </Button>
                  )}
                </div>
              ) : (
                lodging.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-200" 
                    onClick={() => handleOpenLodgingModal(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayjs(item.check_in).format('MMM D')} - {dayjs(item.check_out).format('MMM D')}
                          </p>
                        </div>
                      </div>
                      {item.has_documents > 0 && (
                        <FileText className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Members footer */}
        <div className="flex-shrink-0">
          <TripMembers
            members={members}
            onManageAccess={() => setIsShareModalOpen(true)}
            onAddMember={() => setIsShareModalOpen(true)}
            canManage={isOwner()}
          />
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="hidden md:flex flex-1 relative">
        <TripMap
          trip={trip}
          activities={activities}
          transportation={transportation}
          lodging={lodging}
          onActivityClick={handleOpenActivityModal}
          selectedActivityId={selectedActivityId}
        />
      </div>

      {/* Modals */}
      <TransportModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        tripId={tripId}
        transportId={selectedTransportId}
        onSuccess={fetchTripData}
      />

      <LodgingModal
        isOpen={isLodgingModalOpen}
        onClose={() => setIsLodgingModalOpen(false)}
        tripId={tripId}
        lodgingId={selectedLodgingId}
        onSuccess={fetchTripData}
      />

      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => {
          setIsActivityModalOpen(false);
          setActivityDefaultDate(null);
        }}
        tripId={tripId}
        activityId={selectedActivityId}
        defaultDate={activityDefaultDate}
        onSuccess={fetchTripData}
      />

      <DocumentsModal
        isOpen={isDocumentsModalOpen}
        onClose={() => setIsDocumentsModalOpen(false)}
        documents={currentDocuments}
        referenceType={currentReferenceType}
        referenceId={
          currentReferenceType === 'transport' ? selectedTransportId :
          currentReferenceType === 'lodging' ? selectedLodgingId :
          selectedActivityId
        }
        tripId={tripId}
        isOfflineMode={!navigator.onLine && isAvailableOffline}
      />

      {/* Share Modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={t('sharing.shareTrip', 'Share Trip')}
        size="md"
      >
        <div className="p-6">
          <form onSubmit={handleShareTrip}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('sharing.inviteByEmail', 'Invite by email')}</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('sharing.emailPlaceholder', 'Enter email address')}
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                />
                <Button type="submit" loading={isSharing}>
                  {t('sharing.invite', 'Invite')}
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('sharing.permissionLevel', 'Permission')}</label>
              <select
                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
              >
                <option value="editor">{t('sharing.canEdit', 'Can edit')}</option>
                <option value="viewer">{t('sharing.canView', 'Can view')}</option>
              </select>
            </div>
          </form>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">{t('sharing.shareLink', 'Share link')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/invite/${tripId}`}
                readOnly
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-500 text-sm"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/invite/${tripId}`);
                  toast.success(t('sharing.linkCopied', 'Link copied!'));
                }}
              >
                {t('common.copy', 'Copy')}
              </Button>
            </div>
          </div>

          {/* Current members */}
          <div>
            <label className="block text-sm font-medium mb-3">{t('sharing.currentMembers', 'Current members')}</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {member.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                    </div>
                  </div>
                  <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${member.role === 'owner' 
                      ? 'bg-accent/10 text-accent' 
                      : member.role === 'editor'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }
                  `}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TripDetail;
