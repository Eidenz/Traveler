// client/src/pages/trips/TodayView.jsx
// Mobile-first "what's happening today" view for a trip: today's transports,
// lodging check-in/out and activities in chronological order, the next thing
// highlighted, and big thumb-friendly buttons to each item's documents.
// Reached from the mobile bottom nav while inside a trip.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plane, Bed, MapPin, FileText, Sun, ChevronRight, Loader2, FolderOpen, Compass, UserCheck,
  Moon, WifiOff
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { tripAPI, documentAPI } from '../../services/api';
import { displayTime, effectiveTime } from '../../utils/timeFormat';
import DocumentsModal from '../../components/trips/DocumentsModal';
import ParticipantAvatars from '../../components/trips/ParticipantAvatars';
import useAuthStore from '../../stores/authStore';
import { isOnline } from '../../stores/onlineStore';
import { getTripOffline, getDocumentsForReference } from '../../utils/offlineStorage';

const TodayView = () => {
  const { tripId } = useParams();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [lodgings, setLodgings] = useState([]); // full list, for the sleeping-tonight card
  const [usingOffline, setUsingOffline] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [docsFor, setDocsFor] = useState(null); // { title, documents }
  const [docsLoading, setDocsLoading] = useState(null); // entry key while fetching
  // Same stored preference as the trip detail "Just my plans" toggle
  const [onlyMine, setOnlyMine] = useState(() => localStorage.getItem('onlyMyItems') === '1');
  const toggleOnlyMine = () => {
    setOnlyMine((prev) => {
      localStorage.setItem('onlyMyItems', prev ? '0' : '1');
      return !prev;
    });
  };

  const today = dayjs().format('YYYY-MM-DD');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Online first; fall back to the offline snapshot saved from the trip
      // page (which auto-refreshes on every online open)
      let data = null;
      let snapshot = null;
      if (!isOnline()) {
        snapshot = await getTripOffline(tripId).catch(() => null);
      } else {
        try {
          data = (await tripAPI.getTripById(tripId)).data;
        } catch (error) {
          snapshot = await getTripOffline(tripId).catch(() => null);
          if (!snapshot) throw error;
        }
      }
      if (!data && snapshot) {
        data = {
          trip: snapshot,
          members: snapshot.members || [],
          transportation: snapshot.transportation || [],
          lodging: snapshot.lodging || [],
          activities: snapshot.activities || [],
        };
      }
      if (!data) {
        throw new Error('Offline and no saved snapshot for this trip');
      }
      setUsingOffline(!!snapshot);
      setOfflineSavedAt(snapshot?.offlineSavedAt || null);

      const { trip: t_, transportation, lodging, activities, members: members_ } = data;
      setTrip(t_);
      setMembers(members_ || []);
      setLodgings(lodging);

      const list = [];
      const sameDay = (d) => d && dayjs(d).format('YYYY-MM-DD') === today;

      transportation.forEach((tr) => {
        if (sameDay(tr.departure_date) || sameDay(tr.arrival_date)) {
          list.push({
            key: `transport-${tr.id}`,
            kind: 'transport',
            title: tr.company || `${tr.from_location} → ${tr.to_location}`,
            subtitle: `${tr.from_location} → ${tr.to_location}`,
            timeLabel: displayTime(tr.departure_time_exact, tr.departure_time),
            sortKey: effectiveTime(tr.departure_time_exact, tr.departure_time),
            clock: tr.departure_time_exact,
            hasDocuments: tr.has_documents > 0,
            participantIds: tr.participant_ids,
            reference: { type: 'transportation', id: tr.id },
          });
        }
      });

      lodging.forEach((l) => {
        if (sameDay(l.check_out)) {
          list.push({
            key: `lodging-out-${l.id}`,
            kind: 'lodging',
            title: `${t('lodging.checkOut', 'Check-out')} — ${l.name}`,
            subtitle: l.address,
            timeLabel: t('lodging.checkOut', 'Check-out'),
            sortKey: '10:00', // typical morning checkout — ordering only
            clock: null,
            hasDocuments: l.has_documents > 0,
            participantIds: l.participant_ids,
            reference: { type: 'lodging', id: l.id },
          });
        }
        if (sameDay(l.check_in)) {
          list.push({
            key: `lodging-in-${l.id}`,
            kind: 'lodging',
            title: `${t('lodging.checkIn', 'Check-in')} — ${l.name}`,
            subtitle: l.address,
            timeLabel: t('lodging.checkIn', 'Check-in'),
            sortKey: '15:00', // typical afternoon check-in — ordering only
            clock: null,
            hasDocuments: l.has_documents > 0,
            participantIds: l.participant_ids,
            reference: { type: 'lodging', id: l.id },
          });
        }
      });

      activities.forEach((a) => {
        if (sameDay(a.date)) {
          list.push({
            key: `activity-${a.id}`,
            kind: 'activity',
            title: a.name,
            subtitle: a.location,
            timeLabel: displayTime(a.time_exact, a.time),
            sortKey: effectiveTime(a.time_exact, a.time),
            clock: a.time_exact,
            hasDocuments: a.has_documents > 0,
            participantIds: a.participant_ids,
            reference: { type: 'activity', id: a.id },
          });
        }
      });

      list.sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));
      setEntries(list);
    } catch (error) {
      console.error('Error loading today view:', error);
      toast.error(t('errors.failedFetch', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [tripId, today, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDocuments = async (entry) => {
    try {
      setDocsLoading(entry.key);
      if (usingOffline) {
        const offlineDocs = await getDocumentsForReference(entry.reference.type, entry.reference.id);
        if (!offlineDocs?.length) {
          toast.error(t('documents.notAvailableOffline', 'Documents not available offline'));
          return;
        }
        setDocsFor({ title: entry.title, documents: offlineDocs });
        return;
      }
      const res = await documentAPI.getDocumentsByReference(
        entry.reference.type, entry.reference.id, tripId
      );
      setDocsFor({ title: entry.title, documents: res.data.documents || [] });
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error(t('errors.failedFetch', 'Failed to load data'));
    } finally {
      setDocsLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  const inTrip = trip && today >= trip.start_date && today <= trip.end_date;
  const daysUntil = trip ? dayjs(trip.start_date).diff(dayjs(today), 'day') : 0;
  const dayNumber = trip ? dayjs(today).diff(dayjs(trip.start_date), 'day') + 1 : 0;
  const totalDays = trip ? dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1 : 0;

  // Participant filter: entries with no subset belong to everyone
  const hasSubsetEntries = entries.some((e) => e.participantIds?.length > 0);
  const visibleEntries = onlyMine
    ? entries.filter((e) => !e.participantIds?.length || e.participantIds.includes(user?.id))
    : entries;

  // Where the group sleeps tonight: checked in on/before today, out after today
  const isMineLodging = (l) => !l.participant_ids?.length || l.participant_ids.includes(user?.id);
  const tonightLodgings = lodgings
    .filter((l) => {
      const checkIn = dayjs(l.check_in).format('YYYY-MM-DD');
      const checkOut = dayjs(l.check_out).format('YYYY-MM-DD');
      return checkIn <= today && checkOut > today;
    })
    .filter((l) => (onlyMine ? isMineLodging(l) : true));

  // First clocked entry still ahead of now gets the "next up" treatment
  const nowHM = dayjs().format('HH:mm');
  const nextKey = visibleEntries.find((e) => e.clock && e.clock >= nowHM)?.key;

  const KIND_STYLE = {
    transport: { icon: Plane, chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    lodging: { icon: Bed, chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    activity: { icon: MapPin, chip: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link
            to={`/trips/${tripId}`}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Sun className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-display font-semibold text-gray-900 dark:text-white">
            {t('today.title', 'Today')}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 ml-9">
          {dayjs().format('dddd, MMM D')}
          {inTrip && (
            <span className="text-accent font-medium">
              {' · '}{t('today.dayOf', 'Day {{n}} of {{total}}', { n: dayNumber, total: totalDays })}
            </span>
          )}
          {trip?.name && <span> · {trip.name}</span>}
        </p>

        {/* Offline snapshot notice with freshness */}
        {usingOffline && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('offline.usingOfflineData', 'Using offline data')}</span>
            {offlineSavedAt && (
              <span className="text-amber-600/70 dark:text-amber-400/70">
                · {dayjs(offlineSavedAt).fromNow()}
              </span>
            )}
          </div>
        )}

        {/* Outside the trip range */}
        {!inTrip && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
            <Sun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="font-medium text-gray-900 dark:text-white">
              {daysUntil > 0
                ? t('today.startsIn', 'Trip starts in {{count}} days', { count: daysUntil })
                : t('today.tripOver', 'This trip is over — hope it was great!')}
            </p>
            <Link
              to={`/trips/${tripId}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent"
            >
              {t('today.viewTimeline', 'View the timeline')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Participant filter — same preference as the trip detail toggle */}
        {inTrip && hasSubsetEntries && (
          <div className="flex justify-end mb-3">
            <button
              onClick={toggleOnlyMine}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${onlyMine
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {t('participants.onlyMine', 'Just my plans')}
            </button>
          </div>
        )}

        {/* Today's entries */}
        {inTrip && (
          visibleEntries.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
              <Sun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-medium text-gray-900 dark:text-white">
                {t('today.freeDay', 'Nothing planned — enjoy the free day!')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleEntries.map((entry) => {
                const style = KIND_STYLE[entry.kind];
                const isNext = entry.key === nextKey;
                return (
                  <div
                    key={entry.key}
                    className={`bg-white dark:bg-gray-800 rounded-2xl p-4 ${isNext
                      ? 'ring-2 ring-accent shadow-lg shadow-accent/10'
                      : 'border border-gray-100 dark:border-gray-700'}`}
                  >
                    {isNext && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
                        {t('today.nextUp', 'Next up')}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${style.chip}`}>
                        <style.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{entry.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {entry.timeLabel && <span className="font-medium">{entry.timeLabel}</span>}
                          {entry.timeLabel && entry.subtitle && ' · '}
                          {entry.subtitle}
                        </p>
                      </div>
                      <ParticipantAvatars ids={entry.participantIds} members={members} />
                    </div>

                    {/* Big documents button — boarding passes and bookings are
                        the thing you dig for while standing in a queue */}
                    {entry.hasDocuments && (
                      <button
                        onClick={() => openDocuments(entry)}
                        disabled={docsLoading === entry.key}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-soft text-accent font-medium active:scale-[0.99] transition-transform disabled:opacity-60"
                      >
                        {docsLoading === entry.key
                          ? <Loader2 className="w-5 h-5 animate-spin" />
                          : <FileText className="w-5 h-5" />}
                        {t('today.documents', 'Documents')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Nearby brainstorm ideas */}
        <Link
          to={`/trips/${tripId}/nearby`}
          className="mt-5 w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-accent to-rose-400 text-white shadow-lg shadow-accent/25 active:scale-[0.99] transition-transform"
        >
          <Compass className="w-6 h-6 flex-shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">{t('nearby.title', "What's nearby?")}</span>
            <span className="text-xs text-white/80">
              {t('nearby.entryHint', 'Brainstorm ideas around you, closest first')}
            </span>
          </span>
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        </Link>

        {/* All trip documents */}
        <Link
          to={`/documents/${tripId}`}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 active:scale-[0.99] transition-transform"
        >
          <FolderOpen className="w-5 h-5 text-gray-400" />
          {t('today.allDocuments', 'All trip documents')}
        </Link>

        {/* Sleeping tonight — tap a row to open the address in Google Maps */}
        {inTrip && tonightLodgings.length > 0 && (
          <div className="mt-5 bg-white dark:bg-gray-800 rounded-2xl p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 mb-3">
              <Moon className="w-4 h-4" />
              {t('today.sleepingTonight', 'Sleeping tonight')}
            </p>
            <div className="space-y-1">
              {tonightLodgings.map((l) => {
                const mapsUrl = l.address
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`
                  : null;
                const inner = (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <Bed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{l.name}</p>
                      {l.address && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{l.address}</p>
                      )}
                    </div>
                    <ParticipantAvatars ids={l.participant_ids} members={members} />
                    {mapsUrl && <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                  </>
                );
                return mapsUrl ? (
                  <a
                    key={l.id}
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 rounded-xl active:bg-indigo-50 dark:active:bg-indigo-900/20 transition-colors"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={l.id} className="flex items-center gap-3 p-2">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Read-only documents modal */}
      <DocumentsModal
        isOpen={!!docsFor}
        onClose={() => setDocsFor(null)}
        documents={docsFor?.documents || []}
        tripId={tripId}
        isOfflineMode={usingOffline}
        canEdit={false}
      />
    </div>
  );
};

export default TodayView;
