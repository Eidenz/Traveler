// client/src/pages/trips/TripRecap.jsx
// The trip recap: a scrollable story page for a finished trip — hero, stat
// tiles, the journey map, spend breakdown (with a private "what you spent"
// section computed server-side per viewer), and the trip's artifacts.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, CalendarDays, MapPin, Plane, Bed, Route,
  Lightbulb, CheckSquare, Camera, FileText, Users, Loader2, Scale, User
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { tripAPI } from '../../services/api';
import { hasMapbox } from '../../config/env';
import { getImageUrl } from '../../utils/imageUtils';
import { symbolFor } from '../../utils/currencyUtils';
import TripMap from '../../components/trips/TripMap';

const StatTile = ({ icon, value, label, tint }) => {
  const Icon = icon; // assigned in the body so eslint's no-unused-vars sees the JSX usage
  return (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 text-center">
    <div className={`w-9 h-9 mx-auto mb-2 rounded-xl flex items-center justify-center ${tint}`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-2xl font-display font-bold text-gray-900 dark:text-white leading-none">{value}</p>
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
  );
};

const TripRecap = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [recap, setRecap] = useState(null);
  const [tripData, setTripData] = useState(null); // full itinerary for the map
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [recapRes, tripRes] = await Promise.all([
        tripAPI.getRecap(tripId),
        tripAPI.getTripById(tripId),
      ]);
      setRecap(recapRes.data);
      setTripData(tripRes.data);
    } catch (error) {
      console.error('Error loading recap:', error);
      toast.error(t('errors.failedFetch', 'Failed to load data'));
      navigate(`/trips/${tripId}`);
    } finally {
      setLoading(false);
    }
  }, [tripId, navigate, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading || !recap) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  const { trip, members, days, counts, transport_types, distance_km, places, checklist, shared, personal } = recap;
  const cur = shared?.currency || '$';
  const fmtShared = (n) => `${cur}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const toHome = shared?.conversion
    ? (n) => new Intl.NumberFormat(undefined, {
        style: 'currency', currency: shared.conversion.home_currency_code, maximumFractionDigits: 0,
      }).format(n * shared.conversion.rate)
    : null;
  const personalSymbol = personal?.currency_code ? (symbolFor(personal.currency_code) || '') : '';
  const transportSummary = Object.entries(transport_types)
    .map(([type, n]) => `${n} ${type.toLowerCase()}${n > 1 ? 's' : ''}`)
    .join(' · ');
  const maxCategory = shared ? Math.max(1, ...Object.values(shared.category_totals)) : 1;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="relative h-56 sm:h-72 overflow-hidden">
        {trip.cover_image ? (
          <img src={getImageUrl(trip.cover_image)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        <Link
          to={`/trips/${tripId}`}
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 text-white text-sm font-medium backdrop-blur-sm hover:bg-black/60"
        >
          <ArrowLeft className="w-4 h-4" />
          {trip.name}
        </Link>
        <div className="absolute bottom-16 sm:bottom-4 left-4 right-4">
          <p className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            {t('recap.title', 'Trip recap')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight">
            {trip.name}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            {dayjs(trip.start_date).format('MMM D')} – {dayjs(trip.end_date).format('MMM D, YYYY')}
            {trip.location && <> · {trip.location}</>}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Members */}
        <div className="flex items-center justify-center -mt-12 relative z-10">
          <div className="flex items-center gap-1 px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex -space-x-2">
              {members.slice(0, 6).map((m) => (
                m.profile_image ? (
                  <img key={m.id} src={getImageUrl(m.profile_image)} alt={m.name}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover" />
                ) : (
                  <span key={m.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-semibold">
                    {m.name?.charAt(0)?.toUpperCase()}
                  </span>
                )
              ))}
            </div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
              {t('recap.travelers', '{{count}} travelers', { count: members.length })}
            </span>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={CalendarDays} value={days} label={t('recap.days', 'days')}
            tint="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" />
          <StatTile icon={MapPin} value={counts.activities} label={t('recap.activities', 'activities')}
            tint="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" />
          <StatTile icon={Route} value={distance_km > 0 ? `${distance_km.toLocaleString()} km` : '—'}
            label={t('recap.traveled', 'traveled')}
            tint="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
          <StatTile icon={Bed} value={counts.lodgings} label={t('recap.stays', 'stays')}
            tint="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
        </div>

        {(transportSummary || places.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 space-y-2">
            {transportSummary && (
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-500 flex-shrink-0" />
                {transportSummary}
              </p>
            )}
            {places.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">{places.length}</span>{' '}
                  {t('recap.placesVisited', 'places visited')}:{' '}
                  <span className="text-gray-500 dark:text-gray-400">
                    {places.slice(0, 8).map((p) => p.name).join(', ')}
                    {places.length > 8 && '…'}
                  </span>
                </span>
              </p>
            )}
          </div>
        )}

        {/* The journey map */}
        {hasMapbox && tripData && (
          <div className="h-72 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 relative">
            <TripMap
              trip={tripData.trip}
              activities={tripData.activities}
              transportation={tripData.transportation}
              lodging={tripData.lodging}
              compact
            />
          </div>
        )}

        {/* Shared money */}
        {shared && shared.total_spent > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display font-semibold text-gray-900 dark:text-white">
                {t('recap.groupSpend', 'Group spend')}
              </h2>
              <p className="text-xl font-display font-bold text-gray-900 dark:text-white">
                {fmtShared(shared.total_spent)}
                {toHome && <span className="ml-1 text-sm font-normal text-gray-400">≈ {toHome(shared.total_spent)}</span>}
              </p>
            </div>
            <div className="space-y-2">
              {Object.entries(shared.category_totals)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-gray-500 dark:text-gray-400 capitalize flex-shrink-0">
                      {t(`budget.${category}`, category)}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(amount / maxCategory) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                      {fmtShared(amount)}
                    </span>
                  </div>
                ))}
            </div>
            <p className={`mt-4 flex items-center gap-2 text-sm ${shared.settlement.settled
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'}`}
            >
              <Scale className="w-4 h-4" />
              {shared.settlement.settled
                ? t('recap.settled', 'Fully settled — everyone is even.')
                : t('recap.unsettled', '{{amount}} still to settle', { amount: fmtShared(shared.settlement.remaining) })}
              {!shared.settlement.settled && (
                <Link to={`/budgets/${tripId}`} className="ml-auto text-accent font-medium hover:underline">
                  {t('recap.settleNow', 'Settle up')}
                </Link>
              )}
            </p>
          </div>
        )}

        {/* Your money — private, per viewer */}
        {personal && personal.total > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-gray-400" />
              {t('recap.yourSpend', 'What the trip cost you')}
              <span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-gray-400">
                {t('recap.onlyYou', 'only you see this')}
              </span>
            </h2>
            <p className="text-2xl font-display font-bold text-gray-900 dark:text-white">
              {personalSymbol}{personal.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {personal.home && (
                <span className="ml-2 text-base font-normal text-gray-400">
                  ≈ {new Intl.NumberFormat(undefined, { style: 'currency', currency: personal.home.currency_code, maximumFractionDigits: 0 }).format(personal.home.total)}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('recap.yourSpendDetail', '{{personal}} personal · {{shares}} in shared splits', {
                personal: `${personalSymbol}${personal.personal_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                shares: `${personalSymbol}${personal.shares_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              })}
            </p>
          </div>
        )}

        {/* Artifacts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trip.photo_album_url && (
            <a
              href={trip.photo_album_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-900/15 border border-fuchsia-200 dark:border-fuchsia-800/40 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 transition-colors"
            >
              <Camera className="w-6 h-6 text-fuchsia-500 flex-shrink-0" />
              <span>
                <span className="block font-medium text-gray-900 dark:text-white">{t('recap.photos', 'Photo album')}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('recap.photosHint', 'Relive it in pictures')}</span>
              </span>
            </a>
          )}
          {counts.brainstorm_items > 0 && (
            <Link
              to={`/trips/${tripId}/brainstorm`}
              className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              <Lightbulb className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <span>
                <span className="block font-medium text-gray-900 dark:text-white">
                  {t('recap.ideas', '{{count}} ideas pinned', { count: counts.brainstorm_items })}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('recap.ideasHint', 'The board, as you left it')}
                </span>
              </span>
            </Link>
          )}
          {checklist.total > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40">
              <CheckSquare className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              <span>
                <span className="block font-medium text-gray-900 dark:text-white">
                  {t('recap.checklists', '{{done}}/{{total}} checklist items done', { done: checklist.completed, total: checklist.total })}
                </span>
              </span>
            </div>
          )}
          {counts.documents > 0 && (
            <Link
              to={`/documents/${tripId}`}
              className="flex items-center gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/15 border border-sky-200 dark:border-sky-800/40 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
            >
              <FileText className="w-6 h-6 text-sky-500 flex-shrink-0" />
              <span>
                <span className="block font-medium text-gray-900 dark:text-white">
                  {t('recap.documents', '{{count}} documents kept', { count: counts.documents })}
                </span>
              </span>
            </Link>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 pt-2">
          <Users className="w-3.5 h-3.5" />
          {t('recap.footer', 'Made together. See you on the next one.')}
        </p>
      </div>
    </div>
  );
};

export default TripRecap;
