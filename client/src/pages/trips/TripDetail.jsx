// client/src/pages/trips/TripDetail.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, WifiOff, Plane, Bed, FileText, Plus, Map, ChevronDown
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

// Real-time collaboration
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';

// Components
import Button from '../../components/ui/Button';
import TripMap from '../../components/trips/TripMap';
import TripTimeline from '../../components/trips/TripTimeline';
import TripPanelHeader from '../../components/trips/TripPanelHeader';
import TripMembers from '../../components/trips/TripMembers';
import TabNav from '../../components/trips/TabNav';
import TripChecklist from '../../components/trips/TripChecklist';
import DateGroupedList from '../../components/trips/DateGroupedList';
import BudgetWidget from '../../components/budget/BudgetWidget';

// Modals
import TransportModal from '../../components/trips/TransportModal';
import LodgingModal from '../../components/trips/LodgingModal';
import ActivityModal from '../../components/trips/ActivityModal';
import DocumentsModal from '../../components/trips/DocumentsModal';
import DocumentPanel from '../../components/trips/DocumentPanel';
import ShareModal from '../../components/trips/ShareModal';
import ItemWizard from '../../components/trips/ItemWizard';

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
  const [currentReferenceId, setCurrentReferenceId] = useState(null);
  const [currentDocumentItemName, setCurrentDocumentItemName] = useState('');
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);
  const [activityDefaultDate, setActivityDefaultDate] = useState(null);

  // Wizard state (replaces modals on desktop)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState(null); // 'activity' | 'lodging' | 'transport'
  const [wizardItemId, setWizardItemId] = useState(null);

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(() => {
    // Try to load saved width from localStorage
    const saved = localStorage.getItem('tripPanelWidth');
    return saved ? parseInt(saved, 10) : 480;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const MIN_PANEL_WIDTH = 450;
  const MAX_PANEL_WIDTH = 800;

  // Mobile view state: 'details' (fullscreen details) | 'split' (default) | 'map' (fullscreen map)
  const [mobileViewState, setMobileViewState] = useState('split');
  const [mobileMapHeight] = useState(280); // Height of mobile map in pixels
  const mobileScrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 50; // Pixels before transitioning states
  const latchDragStartY = useRef(0);
  const isDraggingLatch = useRef(false);

  // Note: Share state is now managed in ShareModal component

  // Check if Mapbox token is available
  const hasMapboxToken = import.meta.env.VITE_MAPBOX_TOKEN && import.meta.env.VITE_MAPBOX_TOKEN !== '';

  // Real-time update handlers
  const realtimeHandlers = useMemo(() => ({
    onActivityCreate: (activity) => {
      setActivities(prev => [...prev, activity]);
    },
    onActivityUpdate: (activity) => {
      setActivities(prev => prev.map(a => a.id === activity.id ? activity : a));
    },
    onActivityDelete: (activityId) => {
      setActivities(prev => prev.filter(a => a.id !== activityId));
    },
    onLodgingCreate: (lodging) => {
      setLodging(prev => [...prev, lodging]);
    },
    onLodgingUpdate: (updatedLodging) => {
      setLodging(prev => prev.map(l => l.id === updatedLodging.id ? updatedLodging : l));
    },
    onLodgingDelete: (lodgingId) => {
      setLodging(prev => prev.filter(l => l.id !== lodgingId));
    },
    onTransportCreate: (transport) => {
      setTransportation(prev => [...prev, transport]);
    },
    onTransportUpdate: (updatedTransport) => {
      setTransportation(prev => prev.map(t => t.id === updatedTransport.id ? updatedTransport : t));
    },
    onTransportDelete: (transportId) => {
      setTransportation(prev => prev.filter(t => t.id !== transportId));
    },
    onTripUpdate: (updatedTrip) => {
      setTrip(prev => ({ ...prev, ...updatedTrip }));
    },
    onMemberAdd: (member) => {
      setMembers(prev => [...prev, member]);
    },
    onMemberRemove: (userId) => {
      setMembers(prev => prev.filter(m => m.id !== userId));
    },
    onMemberRoleChange: ({ userId, role }) => {
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
    }
  }), []);

  // Initialize real-time updates
  const {
    isConnected: isRealtimeConnected,
    emitActivityCreate,
    emitActivityUpdate,
    emitActivityDelete,
    emitLodgingCreate,
    emitLodgingUpdate,
    emitLodgingDelete,
    emitTransportCreate,
    emitTransportUpdate,
    emitTransportDelete,
    emitTripUpdate,
    emitMemberAdd,
    emitMemberRemove,
    emitMemberRoleChange
  } = useRealtimeUpdates(tripId, realtimeHandlers);

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

  // Panel resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);

    setPanelWidth(clampedWidth);
  }, [isResizing, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // Save to localStorage
      localStorage.setItem('tripPanelWidth', panelWidth.toString());
    }
  }, [isResizing, panelWidth]);

  // Attach global mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      // Add cursor style to body during resize
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Mobile map scroll handling - 3 states: details, split, map
  const handleMobileScroll = useCallback((e) => {
    // Don't process scroll in fullscreen map mode or when dragging latch
    if (mobileViewState === 'map' || isDraggingLatch.current) return;

    const scrollTop = e.target.scrollTop;
    const scrollDelta = scrollTop - lastScrollY.current;

    // In split view
    if (mobileViewState === 'split') {
      // Scrolling down from top - go to fullscreen details
      if (scrollDelta > 0 && scrollTop > scrollThreshold) {
        setMobileViewState('details');
      }
    }
    // In details view
    else if (mobileViewState === 'details') {
      // Scrolling up near top - return to split
      if (scrollDelta < -10 && scrollTop < scrollThreshold) {
        setMobileViewState('split');
      }
    }

    lastScrollY.current = scrollTop;
  }, [scrollThreshold, mobileViewState]);

  // Touch handlers for detecting pull-up gesture when at top of scroll (to go from split to map)
  const panelTouchStartY = useRef(0);
  const isPanelDragging = useRef(false);

  const handlePanelTouchStart = useCallback((e) => {
    // Only track if in split mode and at top of scroll
    if (mobileViewState === 'split' && mobileScrollRef.current) {
      const scrollTop = mobileScrollRef.current.scrollTop;
      if (scrollTop <= 5) {
        panelTouchStartY.current = e.touches[0].clientY;
        isPanelDragging.current = true;
      }
    }
  }, [mobileViewState]);

  const handlePanelTouchMove = useCallback((e) => {
    if (!isPanelDragging.current || mobileViewState !== 'split') return;

    // Check if still at top
    if (mobileScrollRef.current && mobileScrollRef.current.scrollTop <= 5) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - panelTouchStartY.current;

      // User is pulling down (finger moving down = positive delta = trying to reveal more map)
      if (deltaY > 60) {
        setMobileViewState('map');
        isPanelDragging.current = false;
      }
    } else {
      // User scrolled down, stop tracking
      isPanelDragging.current = false;
    }
  }, [mobileViewState]);

  const handlePanelTouchEnd = useCallback(() => {
    isPanelDragging.current = false;
  }, []);

  // Latch Drag Handlers for mobile split view - 3 states
  const handleLatchTouchStart = (e) => {
    latchDragStartY.current = e.touches[0].clientY;
    isDraggingLatch.current = true;
    e.stopPropagation(); // Prevent scroll
  };

  const handleLatchTouchMove = (e) => {
    if (!isDraggingLatch.current) return;
    e.preventDefault(); // Prevent scroll while dragging latch
  };

  const handleLatchTouchEnd = (e) => {
    if (!isDraggingLatch.current) return;
    const endY = e.changedTouches[0].clientY;
    const deltaY = endY - latchDragStartY.current;
    isDraggingLatch.current = false;

    // Dragged DOWN (positive delta) -> Go to next state (more map)
    if (deltaY > 50) {
      if (mobileViewState === 'details') {
        setMobileViewState('split');
        // Scroll to top when returning to split
        if (mobileScrollRef.current) {
          mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else if (mobileViewState === 'split') {
        setMobileViewState('map');
      }
    }
    // Dragged UP (negative delta) -> Go to previous state (more details)
    else if (deltaY < -50) {
      if (mobileViewState === 'map') {
        setMobileViewState('split');
      } else if (mobileViewState === 'split') {
        setMobileViewState('details');
      }
    }
  };

  // Function to cycle mobile view states
  const cycleMobileView = () => {
    if (mobileViewState === 'details') {
      setMobileViewState('split');
      if (mobileScrollRef.current) {
        mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (mobileViewState === 'split') {
      setMobileViewState('map');
    } else {
      setMobileViewState('split');
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

  // Modal handlers - use wizard on desktop when map is available, otherwise use modals
  const handleOpenTransportModal = (transportId = null) => {
    // On desktop with map, use wizard; on mobile, use modal
    if (window.innerWidth >= 768 && hasMapboxToken) {
      setWizardType('transport');
      setWizardItemId(transportId);
      setShowWizard(true);
      setShowDocumentPanel(false);
    } else {
      setSelectedTransportId(transportId);
      setIsTransportModalOpen(true);
    }
  };

  const handleOpenLodgingModal = (lodgingId = null) => {
    // On desktop with map, use wizard; on mobile, use modal
    if (window.innerWidth >= 768 && hasMapboxToken) {
      setWizardType('lodging');
      setWizardItemId(lodgingId);
      setShowWizard(true);
      setShowDocumentPanel(false);
    } else {
      setSelectedLodgingId(lodgingId);
      setIsLodgingModalOpen(true);
    }
  };

  const handleOpenActivityModal = (activityOrDate = null) => {
    let itemId = null;
    let defaultDate = null;

    // If it's a date, set as default date for new activity
    if (activityOrDate instanceof Date || typeof activityOrDate === 'string') {
      defaultDate = activityOrDate;
    } else if (activityOrDate?.id) {
      // If it's an activity object, edit it
      itemId = activityOrDate.id;
    }

    // On desktop with map, use wizard; on mobile, use modal
    if (window.innerWidth >= 768 && hasMapboxToken) {
      setWizardType('activity');
      setWizardItemId(itemId);
      setActivityDefaultDate(defaultDate);
      setShowWizard(true);
      setShowDocumentPanel(false);
    } else {
      setSelectedActivityId(itemId);
      setActivityDefaultDate(defaultDate);
      setIsActivityModalOpen(true);
    }
  };

  // Close wizard
  const handleCloseWizard = () => {
    setShowWizard(false);
    setWizardType(null);
    setWizardItemId(null);
    setActivityDefaultDate(null);
  };

  // Document handling
  const handleViewDocument = async (referenceType, item) => {
    try {
      setCurrentReferenceType(referenceType);
      setCurrentDocumentItemName(item.name || item.from_location || '');

      if (!navigator.onLine && isAvailableOffline) {
        const offlineDocs = await getDocumentsForReference(referenceType, item.id);
        if (offlineDocs?.length > 0) {
          setCurrentDocuments(offlineDocs);
          // On mobile use modal, on desktop use panel
          if (window.innerWidth >= 768 && hasMapboxToken) {
            setShowDocumentPanel(true);
          } else {
            setIsDocumentsModalOpen(true);
          }
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
        setCurrentReferenceId(item.id);
      } else if (referenceType === 'lodging') {
        const response = await lodgingAPI.getLodging(item.id);
        documents = response.data.documents || [];
        setSelectedLodgingId(item.id);
        setCurrentReferenceId(item.id);
      } else if (referenceType === 'activity') {
        const response = await activityAPI.getActivity(item.id);
        documents = response.data.documents || [];
        setSelectedActivityId(item.id);
        setCurrentReferenceId(item.id);
      }

      if (documents.length === 0) {
        toast.error(t('documents.noDocuments', 'No documents found'));
        return;
      }

      setCurrentDocuments(documents);

      // On desktop with map, show document panel; on mobile, show modal
      if (window.innerWidth >= 768 && hasMapboxToken) {
        setShowDocumentPanel(true);
      } else {
        setIsDocumentsModalOpen(true);
      }
    } catch (error) {
      console.error('Error viewing documents:', error);
      toast.error(t('documents.viewFailed', 'Failed to load documents'));
    }
  };

  // Close document panel
  const handleCloseDocumentPanel = () => {
    setShowDocumentPanel(false);
    setCurrentDocuments([]);
    setCurrentDocumentItemName('');
    setCurrentReferenceId(null);
  };

  // Refresh documents after upload/delete
  const refreshDocuments = async () => {
    if (!currentReferenceType || !currentReferenceId) return;

    try {
      let documents = [];
      const refId = parseInt(currentReferenceId, 10);

      if (currentReferenceType === 'transport' || currentReferenceType === 'transportation') {
        const response = await transportAPI.getTransportation(refId);
        documents = response.data.documents || [];
        setTransportation(prev => prev.map(item =>
          item.id === refId ? { ...item, has_documents: documents.length } : item
        ));
      } else if (currentReferenceType === 'lodging') {
        const response = await lodgingAPI.getLodging(refId);
        documents = response.data.documents || [];
        setLodging(prev => prev.map(item =>
          item.id === refId ? { ...item, has_documents: documents.length } : item
        ));
      } else if (currentReferenceType === 'activity') {
        const response = await activityAPI.getActivity(refId);
        documents = response.data.documents || [];
        setActivities(prev => prev.map(item =>
          item.id === refId ? { ...item, has_documents: documents.length } : item
        ));
      }
      setCurrentDocuments(documents);
    } catch (error) {
      console.error('Error refreshing documents:', error);
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
      } catch {
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
      } catch {
        toast.error(t('offline.saveFailed', 'Failed to save for offline'));
      } finally {
        setIsSavingOffline(false);
      }
    }
  };


  // Tab definitions
  const tabs = [
    { id: 'timeline', label: t('trips.timeline', 'Timeline'), count: activities.length },
    { id: 'transport', label: t('transportation.title', 'Transport'), count: transportation.length },
    { id: 'lodging', label: t('lodging.title', 'Lodging'), count: lodging.length },
    { id: 'checklist', label: t('checklists.title', 'Checklists') },
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
    <>
      {/* Mobile layout with map */}
      <div className="md:hidden h-full flex flex-col overflow-hidden relative">
        {/* Mobile Map Container - fixed at top, hidden in details-only mode */}
        {hasMapboxToken && mobileViewState !== 'details' && (
          <div
            className="absolute top-0 left-0 right-0 z-0 transition-all duration-300 ease-out"
            style={{
              height: mobileViewState === 'map' ? '100%' : `${mobileMapHeight}px`,
            }}
          >
            <TripMap
              trip={trip}
              activities={activities}
              transportation={transportation}
              lodging={lodging}
              onActivityClick={handleOpenActivityModal}
              selectedActivityId={selectedActivityId}
              compact={mobileViewState === 'split'} // Full controls when in map mode
            />
          </div>
        )}

        {/* Mobile Content Panel - scrollable, floats over map */}
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          onTouchStart={handlePanelTouchStart}
          onTouchMove={handlePanelTouchMove}
          onTouchEnd={handlePanelTouchEnd}
          className={`flex-1 z-10 transition-all duration-300 ease-out ${mobileViewState !== 'details' ? 'shadow-[0_-4px_20px_rgba(0,0,0,0.15)]' : ''}`}
          style={{
            marginTop: mobileViewState === 'map'
              ? 'calc(100vh - 160px)' // Leave 160px visible at bottom in fullscreen map mode
              : mobileViewState === 'split'
                ? `${mobileMapHeight - 20}px` // Overlap map slightly
                : '0', // Full details
            borderTopLeftRadius: (hasMapboxToken && mobileViewState !== 'details') ? '24px' : '0',
            borderTopRightRadius: (hasMapboxToken && mobileViewState !== 'details') ? '24px' : '0',
            overflow: mobileViewState === 'map' ? 'hidden' : 'auto', // Disable scroll in fullscreen map
            zIndex: 10
          }}
        >
          <div className="bg-white dark:bg-gray-800 min-h-full">
            {/* Latch indicator - drag to switch views - always visible when map is available */}
            {hasMapboxToken && (
              <div
                className="flex justify-center py-3 touch-none flex-shrink-0 cursor-grab active:cursor-grabbing"
                onTouchStart={handleLatchTouchStart}
                onTouchMove={handleLatchTouchMove}
                onTouchEnd={handleLatchTouchEnd}
              >
                <div className="w-16 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full" />
              </div>
            )}

            {/* Back button - mobile */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <Link
                to="/trips"
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('common.back', 'Back')}
              </Link>

              {/* Map toggle button - cycles through states */}
              {hasMapboxToken && (
                <button
                  onClick={cycleMobileView}
                  className={`p-1.5 rounded-lg transition-colors ${mobileViewState === 'map'
                    ? 'bg-accent text-white'
                    : mobileViewState === 'details'
                      ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  title={
                    mobileViewState === 'map'
                      ? t('trips.hideMap', 'Hide map')
                      : mobileViewState === 'details'
                        ? t('trips.showMap', 'Show map')
                        : t('trips.expandMap', 'Expand map')
                  }
                >
                  <Map className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Trip header */}
            <TripPanelHeader
              trip={trip}
              members={members}
              isAvailableOffline={isAvailableOffline}
              isSavingOffline={isSavingOffline}
              onShare={() => setIsShareModalOpen(true)}
              onSaveOffline={handleSaveOffline}
              canEdit={canEdit()}
            />

            {/* Tab navigation */}
            <TabNav
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={tabs}
            />

            {/* Tab content */}
            <div className="min-h-[50vh]">
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
                    <DateGroupedList
                      items={transportation}
                      type="transport"
                      tripStartDate={trip?.start_date}
                      onItemClick={handleOpenTransportModal}
                    />
                  )}
                </div>
              )}

              {activeTab === 'lodging' && (
                <div className="p-4 space-y-3">
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
                    <DateGroupedList
                      items={lodging}
                      type="lodging"
                      tripStartDate={trip?.start_date}
                      onItemClick={handleOpenLodgingModal}
                    />
                  )}
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="p-4">
                  <TripChecklist
                    tripId={tripId}
                    canEdit={canEdit()}
                  />
                </div>
              )}
            </div>

            {/* Budget widget */}
            <BudgetWidget tripId={tripId} canEdit={canEdit()} />

            {/* Members footer */}
            <TripMembers
              members={members}
              onManageAccess={() => setIsShareModalOpen(true)}
              onAddMember={() => setIsShareModalOpen(true)}
              canManage={isOwner()}
            />
          </div>
        </div>
      </div>

      {/* Desktop layout - unchanged */}
      <div ref={containerRef} className="hidden md:flex h-full overflow-hidden">
        {/* Left Panel - Trip Timeline */}
        <div
          className="trip-left-panel w-full md:w-auto bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col min-h-0 flex-shrink-0"
          style={{
            // CSS variable for panel width - used by media query
            '--panel-width': hasMapboxToken ? `${panelWidth}px` : '100%',
          }}
        >
          {/* Responsive style for panel width */}
          <style>{`
            @media (min-width: 768px) {
              .trip-left-panel {
                width: var(--panel-width) !important;
              }
            }
          `}</style>
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
                  <DateGroupedList
                    items={transportation}
                    type="transport"
                    tripStartDate={trip?.start_date}
                    onItemClick={handleOpenTransportModal}
                  />
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
                  <DateGroupedList
                    items={lodging}
                    type="lodging"
                    tripStartDate={trip?.start_date}
                    onItemClick={handleOpenLodgingModal}
                  />
                )}
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="p-4">
                <TripChecklist
                  tripId={tripId}
                  canEdit={canEdit()}
                />
              </div>
            )}
          </div>

          {/* Budget widget */}
          <div className="flex-shrink-0">
            <BudgetWidget tripId={tripId} canEdit={canEdit()} />
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

        {/* Resize Handle - only show when map is visible */}
        {hasMapboxToken && (
          <div
            className="hidden md:flex w-1 bg-gray-200 dark:bg-gray-700 hover:bg-accent hover:w-1.5 cursor-col-resize transition-all duration-150 flex-shrink-0 group relative"
            onMouseDown={handleResizeStart}
          >
            {/* Visual indicator on hover */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full bg-gray-400 dark:bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Right Panel - Wizard, Documents, or Map */}
        {hasMapboxToken && (
          <div className="hidden md:flex flex-1 h-full relative min-w-0">
            {showWizard ? (
              <ItemWizard
                type={wizardType}
                itemId={wizardItemId}
                tripId={tripId}
                defaultDate={activityDefaultDate}
                tripStartDate={trip?.start_date}
                tripEndDate={trip?.end_date}
                onSuccess={() => {
                  fetchTripData();
                  handleCloseWizard();
                }}
                onDelete={(itemType, deletedItemId) => {
                  // Emit socket event for real-time deletion updates
                  if (itemType === 'activity') emitActivityDelete(deletedItemId);
                  else if (itemType === 'lodging') emitLodgingDelete(deletedItemId);
                  else if (itemType === 'transport') emitTransportDelete(deletedItemId);
                }}
                onClose={handleCloseWizard}
              />
            ) : showDocumentPanel ? (
              <DocumentPanel
                documents={currentDocuments}
                referenceType={currentReferenceType}
                referenceId={currentReferenceId}
                tripId={tripId}
                itemName={currentDocumentItemName}
                isOfflineMode={!navigator.onLine && isAvailableOffline}
                onClose={handleCloseDocumentPanel}
                onDocumentsChange={refreshDocuments}
                canEdit={canEdit()}
              />
            ) : (
              <TripMap
                trip={trip}
                activities={activities}
                transportation={transportation}
                lodging={lodging}
                onActivityClick={handleOpenActivityModal}
                selectedActivityId={selectedActivityId}
              />
            )}
          </div>
        )}
      </div>

      {/* Modals - shared between mobile and desktop */}
      <TransportModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        tripId={tripId}
        transportId={selectedTransportId}
        tripStartDate={trip?.start_date}
        tripEndDate={trip?.end_date}
        onSuccess={fetchTripData}
        onDelete={(itemType, deletedItemId) => emitTransportDelete(deletedItemId)}
      />

      <LodgingModal
        isOpen={isLodgingModalOpen}
        onClose={() => setIsLodgingModalOpen(false)}
        tripId={tripId}
        lodgingId={selectedLodgingId}
        tripStartDate={trip?.start_date}
        tripEndDate={trip?.end_date}
        onSuccess={fetchTripData}
        onDelete={(itemType, deletedItemId) => emitLodgingDelete(deletedItemId)}
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
        tripStartDate={trip?.start_date}
        tripEndDate={trip?.end_date}
        onSuccess={fetchTripData}
        onDelete={(itemType, deletedItemId) => emitActivityDelete(deletedItemId)}
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
        onDocumentsChange={refreshDocuments}
        canEdit={canEdit()}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={trip}
        members={members}
        tripId={tripId}
        onUpdate={fetchTripData}
        currentUserId={user?.id}
      />
    </>
  );
};

export default TripDetail;

