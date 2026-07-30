// client/src/pages/trips/NearbyIdeas.jsx
// Location-based recommendations from the brainstorm board: every card with
// coordinates, sorted by distance from where you're standing. Each one can
// be marked done or passed — for just you or the whole group (a chooser pops
// on tap). Done/dismissed items collapse into their own sections with undo,
// and group "done" feeds the recap stats.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Compass, MapPin, Navigation, Check, X, Loader2,
  RefreshCw, ChevronDown, Undo2, User, Users, LocateOff, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { brainstormAPI } from '../../services/api';

const EARTH_RADIUS_KM = 6371;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

const fmtDistance = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;

const mapsUrl = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const NearbyIdeas = () => {
  const { tripId } = useParams();
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(null); // {lat, lng}
  const [geoState, setGeoState] = useState('locating'); // locating | ok | denied | unavailable
  const [scopePrompt, setScopePrompt] = useState(null); // { item, status }
  const [showDone, setShowDone] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  // Filters: how far you're willing to go + closest-first vs top picks.
  // The slider walks discrete, human steps; the last stop is "any distance".
  const RADIUS_STEPS = [0.5, 1, 2, 5, 10, 20, 50, Infinity];
  const [radiusKm, setRadiusKm] = useState(() => {
    const raw = localStorage.getItem('nearbyRadiusKm');
    if (raw === 'Infinity') return Infinity;
    const saved = parseFloat(raw);
    return Number.isFinite(saved) ? saved : 10;
  });
  const [sortMode, setSortMode] = useState(
    () => localStorage.getItem('nearbySortMode') === 'priority' ? 'priority' : 'distance'
  );
  const pickRadius = (km) => {
    setRadiusKm(km);
    localStorage.setItem('nearbyRadiusKm', String(km));
  };
  const pickSort = (mode) => {
    setSortMode(mode);
    localStorage.setItem('nearbySortMode', mode);
  };

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unavailable');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState('ok');
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const res = await brainstormAPI.getBrainstormItems(tripId);
        setItems(res.data.items || []);
      } catch (error) {
        console.error('Error loading ideas:', error);
        toast.error(t('errors.failedFetch', 'Failed to load data'));
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [tripId, t]);

  const applyStatus = async (item, status, scope) => {
    setBusy(true);
    try {
      const res = await brainstormAPI.setItemStatus(item.id, status, scope, tripId);
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.item : i)));
      setScopePrompt(null);
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Located cards, distance-sorted when we know where you are
  const located = items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({
      ...i,
      distance_km: position ? haversineKm(position.lat, position.lng, i.latitude, i.longitude) : null,
    }))
    .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

  const isDone = (i) => !!i.done_at || i.my_status === 'done';
  const isHidden = (i) => !isDone(i) && (!!i.dismissed_at || i.my_status === 'dismissed');
  const allActive = located.filter((i) => !isDone(i) && !isHidden(i));
  const doneList = located.filter(isDone);
  const hiddenList = located.filter(isHidden);

  // Radius applies only when we know where you are; "Top picks" sorts by
  // priority stars first, distance as the tiebreaker
  const withinRadius = position && Number.isFinite(radiusKm)
    ? allActive.filter((i) => i.distance_km != null && i.distance_km <= radiusKm)
    : allActive;
  const beyondCount = allActive.length - withinRadius.length;
  const active = sortMode === 'priority'
    ? [...withinRadius].sort((a, b) =>
        (b.priority || 0) - (a.priority || 0) ||
        (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
    : withinRadius;

  const StatusChips = ({ item }) => (
    <span className="flex items-center gap-1 flex-shrink-0">
      {(item.done_at || item.dismissed_at) && (
        <button
          disabled={busy}
          onClick={() => applyStatus(item, null, 'group')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
          title={t('nearby.undoGroup', 'Undo for the group')}
        >
          <Users className="w-2.5 h-2.5" />
          <Undo2 className="w-2.5 h-2.5" />
        </button>
      )}
      {item.my_status && (
        <button
          disabled={busy}
          onClick={() => applyStatus(item, null, 'me')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
          title={t('nearby.undoMe', 'Undo for me')}
        >
          <User className="w-2.5 h-2.5" />
          <Undo2 className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );

  const IdeaCard = ({ item, muted = false }) => (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 ${muted ? 'opacity-70' : ''}`}
      style={item.color ? { borderLeftWidth: 4, borderLeftColor: item.color } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white">
            {item.title || item.location_name || '…'}
          </p>
          {item.content && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{item.content}</p>
          )}
          <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {item.location_name || `${item.latitude.toFixed(3)}, ${item.longitude.toFixed(3)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {item.distance_km != null && (
            <span className="text-sm font-semibold text-accent whitespace-nowrap">
              {fmtDistance(item.distance_km)}
            </span>
          )}
          {item.priority > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
              <Star className="w-3 h-3 fill-current" />
              {item.priority}
            </span>
          )}
          <StatusChips item={item} />
        </div>
      </div>

      {!muted && (
        <div className="mt-3 flex gap-2">
          <a
            href={mapsUrl(item.latitude, item.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent-soft text-accent text-sm font-medium active:scale-[0.98]"
          >
            <Navigation className="w-4 h-4" />
            {t('nearby.maps', 'Maps')}
          </a>
          <button
            disabled={busy}
            onClick={() => setScopePrompt({ item, status: 'done' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 text-sm font-medium active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {t('nearby.done', 'Done')}
          </button>
          <button
            disabled={busy}
            onClick={() => setScopePrompt({ item, status: 'dismissed' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium active:scale-[0.98] disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            {t('nearby.pass', 'Pass')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link
            to={`/trips/${tripId}/today`}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Compass className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-display font-semibold text-gray-900 dark:text-white">
            {t('nearby.title', "What's nearby?")}
          </h1>
          <button
            onClick={locate}
            className="ml-auto p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t('nearby.refresh', 'Refresh location')}
          >
            <RefreshCw className={`w-4 h-4 ${geoState === 'locating' ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 ml-9">
          {t('nearby.subtitle', 'Ideas from your brainstorm, closest first')}
        </p>

        {/* Filters: radius slider + sort */}
        <div className="mb-4 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">
              {Number.isFinite(radiusKm)
                ? `≤ ${radiusKm} km`
                : t('nearby.anyDistance', 'Any distance')}
            </span>
            <input
              type="range"
              min={0}
              max={RADIUS_STEPS.length - 1}
              step={1}
              value={Math.max(0, RADIUS_STEPS.findIndex((v) => v === radiusKm))}
              onChange={(e) => pickRadius(RADIUS_STEPS[Number(e.target.value)])}
              className="flex-1 accent-accent"
              aria-label={t('nearby.radiusLabel', 'Maximum distance')}
            />
            <button
              onClick={() => pickSort(sortMode === 'distance' ? 'priority' : 'distance')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0"
            >
              {sortMode === 'priority'
                ? (<><Star className="w-3 h-3 text-amber-500 fill-current" />{t('nearby.topPicks', 'Top picks')}</>)
                : (<><Navigation className="w-3 h-3" />{t('nearby.closest', 'Closest')}</>)}
            </button>
          </div>
        </div>

        {/* Geolocation state */}
        {geoState === 'denied' && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <LocateOff className="w-4 h-4 flex-shrink-0" />
            {t('nearby.denied', 'Location denied — showing ideas unsorted. Allow location access to sort by distance.')}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : located.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
            <Compass className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('nearby.empty', 'No located ideas on the board yet — pin some places in the brainstorm!')}
            </p>
          </div>
        ) : (
          <>
            {/* Active recommendations */}
            {active.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
                {beyondCount > 0 ? (
                  <>
                    <Compass className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('nearby.noneInRadius', 'Nothing within {{km}} km.', { km: radiusKm })}
                    </p>
                  </>
                ) : (
                  <>
                    <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('nearby.allHandled', 'Every located idea is done or passed. Impressive.')}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((item) => <IdeaCard key={item.id} item={item} />)}
              </div>
            )}

            {/* Ideas beyond the radius */}
            {beyondCount > 0 && (
              <button
                onClick={() => pickRadius(Infinity)}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 hover:text-accent"
              >
                {t('nearby.beyond', '{{count}} more beyond {{km}} km — show all', { count: beyondCount, km: radiusKm })}
              </button>
            )}

            {/* Done */}
            {doneList.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowDone(!showDone)}
                  className="w-full flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  <Check className="w-4 h-4 text-emerald-500" />
                  {t('nearby.doneSection', 'Done')} ({doneList.length})
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showDone ? 'rotate-180' : ''}`} />
                </button>
                {showDone && (
                  <div className="mt-3 space-y-3">
                    {doneList.map((item) => <IdeaCard key={item.id} item={item} muted />)}
                  </div>
                )}
              </div>
            )}

            {/* Passed / hidden */}
            {hiddenList.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className="w-full flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  <X className="w-4 h-4 text-gray-400" />
                  {t('nearby.hiddenSection', 'Passed')} ({hiddenList.length})
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showHidden ? 'rotate-180' : ''}`} />
                </button>
                {showHidden && (
                  <div className="mt-3 space-y-3">
                    {hiddenList.map((item) => <IdeaCard key={item.id} item={item} muted />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Scope chooser */}
      {scopePrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setScopePrompt(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">
              {scopePrompt.status === 'done'
                ? t('nearby.markDoneTitle', 'Mark as done')
                : t('nearby.passTitle', 'Pass on this')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-4">
              {scopePrompt.item.title || scopePrompt.item.location_name}
            </p>
            <div className="space-y-2">
              <button
                disabled={busy}
                onClick={() => applyStatus(scopePrompt.item, scopePrompt.status, 'me')}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left disabled:opacity-50"
              >
                <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-white">
                    {t('nearby.justMe', 'Just me')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('nearby.justMeHint', 'Others still see it recommended')}
                  </span>
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() => applyStatus(scopePrompt.item, scopePrompt.status, 'group')}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-accent-soft hover:bg-accent/20 text-left disabled:opacity-50"
              >
                <Users className="w-5 h-5 text-accent flex-shrink-0" />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-white">
                    {t('nearby.wholeGroup', 'Whole group')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {scopePrompt.status === 'done'
                      ? t('nearby.wholeGroupDoneHint', 'Counts in the trip recap')
                      : t('nearby.wholeGroupPassHint', 'Hidden for everyone')}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyIdeas;
