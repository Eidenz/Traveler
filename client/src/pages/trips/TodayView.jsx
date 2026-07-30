// client/src/pages/trips/TodayView.jsx
// Mobile-first "what's happening today" view for a trip: today's transports,
// lodging check-in/out and activities in chronological order, the next thing
// highlighted, and big thumb-friendly buttons to each item's documents.
// Reached from the mobile bottom nav while inside a trip.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plane, Bed, MapPin, FileText, Sun, ChevronRight, Loader2, FolderOpen, Compass
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { tripAPI, documentAPI } from '../../services/api';
import { displayTime, effectiveTime } from '../../utils/timeFormat';
import DocumentsModal from '../../components/trips/DocumentsModal';

const TodayView = () => {
  const { tripId } = useParams();
  const { t } = useTranslation();

  const [trip, setTrip] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docsFor, setDocsFor] = useState(null); // { title, documents }
  const [docsLoading, setDocsLoading] = useState(null); // entry key while fetching

  const today = dayjs().format('YYYY-MM-DD');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tripAPI.getTripById(tripId);
      const { trip: t_, transportation, lodging, activities } = res.data;
      setTrip(t_);

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

  // First clocked entry still ahead of now gets the "next up" treatment
  const nowHM = dayjs().format('HH:mm');
  const nextKey = entries.find((e) => e.clock && e.clock >= nowHM)?.key;

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

        {/* Today's entries */}
        {inTrip && (
          entries.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
              <Sun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-medium text-gray-900 dark:text-white">
                {t('today.freeDay', 'Nothing planned — enjoy the free day!')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
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
      </div>

      {/* Read-only documents modal */}
      <DocumentsModal
        isOpen={!!docsFor}
        onClose={() => setDocsFor(null)}
        documents={docsFor?.documents || []}
        tripId={tripId}
        canEdit={false}
      />
    </div>
  );
};

export default TodayView;
