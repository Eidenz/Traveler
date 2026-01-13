// client/src/pages/trips/PublicTripView.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Plane, Bed, Calendar, MapPin, Users, AlertCircle, Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

import { tripAPI } from '../../services/api';
import TripMap from '../../components/trips/TripMap';
import TripTimeline from '../../components/trips/TripTimeline';
import TabNav from '../../components/trips/TabNav';
import { getImageUrl } from '../../utils/imageUtils';

const PublicTripView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [lodging, setLodging] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  // Mobile map scroll state
  const [mobileMapVisible, setMobileMapVisible] = useState(true);
  const [mobileMapHeight] = useState(280);
  const mobileScrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 50;

  const hasMapboxToken = import.meta.env.VITE_MAPBOX_TOKEN && import.meta.env.VITE_MAPBOX_TOKEN !== '';

  useEffect(() => {
    const fetchPublicTrip = async () => {
      try {
        setLoading(true);
        const response = await tripAPI.getTripByPublicToken(token);
        setTrip(response.data.trip);
        setMembers(response.data.members);
        setTransportation(response.data.transportation);
        setLodging(response.data.lodging);
        setActivities(response.data.activities);
      } catch (error) {
        console.error('Error fetching public trip:', error);
        toast.error(t('errors.invalidLink', 'Invalid or expired share link'));
        setTimeout(() => navigate('/'), 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicTrip();
  }, [token, navigate, t]);

  // Mobile map scroll handling
  const handleMobileScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    const scrollDelta = scrollTop - lastScrollY.current;

    if (scrollDelta > 0 && scrollTop > scrollThreshold) {
      setMobileMapVisible(false);
    } else if (scrollDelta < -10) {
      setMobileMapVisible(true);
    }

    lastScrollY.current = scrollTop;
  }, [scrollThreshold]);

  const toggleMobileMap = () => {
    setMobileMapVisible(prev => !prev);
    if (!mobileMapVisible && mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabs = [
    { id: 'timeline', label: t('trips.timeline', 'Timeline'), count: activities.length },
    { id: 'transport', label: t('transportation.title', 'Transport'), count: transportation.length },
    { id: 'lodging', label: t('lodging.title', 'Lodging'), count: lodging.length },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  // Shared content components to avoid duplication
  const TripHeader = () => (
    <div className="flex-shrink-0">
      {/* Cover image */}
      {trip.cover_image && (
        <div className="h-48 relative overflow-hidden">
          <img
            src={getImageUrl(trip.cover_image)}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Trip info */}
      <div className={`p-6 ${trip.cover_image ? '-mt-20 relative z-10' : ''}`}>
        <h1 className={`text-3xl font-bold mb-2 ${trip.cover_image ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {trip.name}
        </h1>

        {trip.description && (
          <p className={`mb-4 ${trip.cover_image ? 'text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
            {trip.description}
          </p>
        )}

        <div className={`flex flex-wrap gap-4 text-sm ${trip.cover_image ? 'text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
          {trip.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{trip.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>
              {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D, YYYY')}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="mx-6 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
        <div className="flex gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-900 dark:text-yellow-100">
            {t('sharing.publicViewNotice', 'This is a public view. Sensitive information like confirmation codes and documents are hidden.')}
          </p>
        </div>
      </div>
    </div>
  );

  const TabContent = () => (
    <>
      {activeTab === 'timeline' && (
        <TripTimeline
          trip={trip}
          transportation={transportation}
          lodging={lodging}
          activities={activities}
          canEdit={false}
          isPublicView={true}
        />
      )}

      {activeTab === 'transport' && (
        <div className="p-4 space-y-3">
          {transportation.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('transportation.noTransportation', 'No transportation added')}
              </p>
            </div>
          ) : (
            transportation.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.from_location} → {item.to_location}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {dayjs(item.departure_date).format('MMM D')} • {item.company || item.type}
                    </p>
                  </div>
                </div>
                {item.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{item.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'lodging' && (
        <div className="p-4 space-y-3">
          {lodging.length === 0 ? (
            <div className="text-center py-12">
              <Bed className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('lodging.noLodging', 'No lodging added')}
              </p>
            </div>
          ) : (
            lodging.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3 mb-2">
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
                {item.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.address}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{item.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );

  const MembersFooter = () => (
    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {t('sharing.travelers', 'Travelers')}
        </span>
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((member, index) => {
            const gradients = [
              'from-violet-500 to-fuchsia-500',
              'from-blue-500 to-cyan-500',
              'from-emerald-500 to-teal-500',
              'from-orange-500 to-amber-500',
              'from-rose-500 to-pink-500',
            ];
            const gradient = gradients[index % gradients.length];

            return (
              <div
                key={member.id}
                className={`w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}
                title={member.name}
              >
                {member.profile_image ? (
                  <img
                    src={getImageUrl(member.profile_image)}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-medium">
                    {member.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}
          {members.length > 5 && (
            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                +{members.length - 5}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Public view banner */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-center gap-2 text-sm flex-shrink-0">
        <Globe className="w-4 h-4" />
        <span>{t('sharing.publicViewBanner', 'You are viewing a public trip. Some information may be hidden.')}</span>
      </div>

      {/* Mobile layout with map */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Map Container - fixed at top */}
        {hasMapboxToken && (
          <div
            className="absolute top-0 left-0 right-0 z-0 transition-all duration-300 ease-out"
            style={{
              height: `${mobileMapHeight}px`,
              transform: mobileMapVisible ? 'translateY(0)' : `translateY(-${mobileMapHeight - 60}px)`,
              opacity: mobileMapVisible ? 1 : 0.5,
            }}
          >
            <TripMap
              trip={trip}
              activities={activities}
              transportation={transportation}
              lodging={lodging}
              onActivityClick={() => { }}
              compact={true}
            />

            {/* Map toggle button when hidden */}
            {!mobileMapVisible && (
              <button
                onClick={toggleMobileMap}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-lg flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 z-20"
              >
                <Map className="w-4 h-4" />
                {t('trips.showMap', 'Show map')}
              </button>
            )}
          </div>
        )}

        {/* Mobile Content Panel - scrollable, floats over map */}
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="flex-1 overflow-y-auto custom-scrollbar z-10 transition-all duration-300 ease-out"
          style={{
            marginTop: hasMapboxToken && mobileMapVisible ? `${mobileMapHeight - 20}px` : '0',
            borderTopLeftRadius: hasMapboxToken && mobileMapVisible ? '24px' : '0',
            borderTopRightRadius: hasMapboxToken && mobileMapVisible ? '24px' : '0',
            boxShadow: hasMapboxToken && mobileMapVisible ? '0 -4px 20px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <div className="bg-white dark:bg-gray-800 min-h-full">
            {/* Pull indicator when map is visible */}
            {hasMapboxToken && mobileMapVisible && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
            )}

            {/* Map toggle in header when map is hidden */}
            {hasMapboxToken && !mobileMapVisible && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                  onClick={toggleMobileMap}
                  className="inline-flex items-center gap-1.5 text-sm text-accent font-medium"
                >
                  <Map className="w-4 h-4" />
                  {t('trips.map', 'Map')}
                </button>
              </div>
            )}

            <TripHeader />

            <TabNav
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={tabs}
            />

            <div className="min-h-[50vh]">
              <TabContent />
            </div>

            <MembersFooter />
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`${hasMapboxToken ? 'w-[480px] lg:w-[520px]' : 'w-full'
          } bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col min-h-0`}>

          <TripHeader />

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
            <TabContent />
          </div>

          <MembersFooter />
        </div>

        {/* Right Panel - Map */}
        {hasMapboxToken && (
          <div className="flex-1 relative">
            <TripMap
              trip={trip}
              activities={activities}
              transportation={transportation}
              lodging={lodging}
              onActivityClick={() => { }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicTripView;
