// client/src/components/trips/TripPanelHeader.jsx
import React from 'react';
import { Share2, Edit, Wifi, WifiOff, Download, Wallet, Lightbulb, Camera, Sparkles, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/imageUtils';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const TripPanelHeader = ({
  trip,
  members = [],
  isAvailableOffline = false,
  isSavingOffline = false,
  offlineSavedAt = null, // ISO timestamp of the last snapshot write
  onShare,
  onSaveOffline,
  canEdit = true,
  currentUserId = null,
  onTripChange = null, // (trip) => void, e.g. after archive/unarchive
  // Viewer's own last day ("just my plans" + a custom end date): date range
  // and night count show their trip, not the group's
  endDateOverride = null,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // "Available offline · 2 hours ago" — the snapshot auto-refreshes on every
  // online open, so this is really "how stale could my data be"
  const offlineLabel = isAvailableOffline
    ? offlineSavedAt
      ? `${t('offline.availableOffline', 'Available offline')} · ${dayjs(offlineSavedAt).fromNow()}`
      : t('offline.availableOffline', 'Available offline')
    : t('offline.saveOffline', 'Save offline');

  const isOwner = !!members.find((m) => m.id === currentUserId && m.role === 'owner');
  const tripEnded = trip?.end_date && dayjs(trip.end_date).isBefore(dayjs(), 'day');

  const setArchived = async (archived) => {
    try {
      const res = await tripAPI.setArchived(trip.id, archived);
      onTripChange?.(res.data.trip);
      toast.success(archived
        ? t('trips.archivedToast', 'Trip archived')
        : t('trips.unarchivedToast', 'Trip unarchived'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    }
  };

  const effectiveEnd = endDateOverride || trip?.end_date;

  // Calculate duration
  const getDuration = () => {
    if (!trip?.start_date || !effectiveEnd) return null;
    const nights = dayjs(effectiveEnd).diff(dayjs(trip.start_date), 'day');
    return {
      nights,
      label: nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights'),
    };
  };

  // Format date range
  const formatDateRange = () => {
    if (!trip?.start_date) return '';
    const start = dayjs(trip.start_date).format('MMM D');
    const end = effectiveEnd ? dayjs(effectiveEnd).format('MMM D') : '';
    return end ? `${start} - ${end}` : start;
  };

  // Get owner info
  const owner = members.find(m => m.role === 'owner');
  const duration = getDuration();

  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      {/* Compact header */}
      <div className="p-4 sm:p-5">
        {/* Row 1: Title + icon buttons */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-semibold text-gray-900 dark:text-white truncate">
              {trip?.name || t('trips.untitled', 'Untitled Trip')}
            </h1>
          </div>

          {/* Action buttons - styled like buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">

            <button
              onClick={onShare}
              className="p-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('sharing.share', 'Share')}
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate(`/budgets/${trip?.id}`)}
              className="p-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('budget.title', 'Budget')}
            >
              <Wallet className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate(`/trips/${trip?.id}/brainstorm`)}
              className="p-2 border border-gray-200 dark:border-gray-600 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
              title={t('brainstorm.title', 'Brainstorm')}
            >
              <Lightbulb className="w-4 h-4" />
            </button>

            {canEdit && (
              <button
                onClick={() => navigate(`/trips/${trip?.id}/edit`)}
                className="p-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={t('common.edit', 'Edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Owner + date + duration + offline (desktop) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm">
            {owner && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
                  {owner.profile_image ? (
                    <img
                      src={getImageUrl(owner.profile_image)}
                      alt={owner.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-[10px] font-medium">
                      {owner.name?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 dark:text-gray-400">
                  {owner.name}
                </span>
              </div>
            )}

            <span className="text-gray-300 dark:text-gray-600">•</span>

            <span
              className={endDateOverride
                ? 'text-accent font-medium'
                : 'text-gray-600 dark:text-gray-300 font-medium'}
              title={endDateOverride
                ? t('sharing.personalDatesHint', 'Your dates — you leave before the group')
                : undefined}
            >
              {formatDateRange()}
            </span>

            {duration && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {duration.nights} {duration.label}
                </span>
              </>
            )}

            {/* Recap chip — once the trip is over */}
            {tripEnded && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <button
                  onClick={() => navigate(`/trips/${trip.id}/recap`)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                  title={t('trips.recapOpen', 'Relive this trip')}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('trips.recap', 'Recap')}</span>
                </button>
              </>
            )}

            {/* Photo album chip — only when the trip has one (set in Edit Trip) */}
            {trip?.photo_album_url && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <a
                  href={trip.photo_album_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition-colors"
                  title={t('trips.photoAlbumOpen', 'Open the shared photo album')}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t('trips.photos', 'Photos')}</span>
                </a>
              </>
            )}
          </div>

          {/* Desktop: Offline button inline */}
          <div className="hidden sm:block flex-shrink-0">
            <button
              onClick={onSaveOffline}
              disabled={isSavingOffline}
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${isAvailableOffline
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
                ${isSavingOffline ? 'opacity-50 cursor-wait' : ''}
              `}
            >
              {isSavingOffline ? (
                <Download className="w-3.5 h-3.5 animate-bounce" />
              ) : isAvailableOffline ? (
                <WifiOff className="w-3.5 h-3.5" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              <span>{offlineLabel}</span>
            </button>
          </div>
        </div>

        {/* Archive: suggest once the trip is over; show state when archived */}
        {isOwner && tripEnded && !trip?.archived_at && (
          <div className="mt-3 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 min-w-0">
              <Archive className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{t('trips.archiveSuggest', 'Trip\u2019s over — archive it to tidy your lists?')}</span>
            </span>
            <button
              onClick={() => setArchived(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 flex-shrink-0"
            >
              {t('trips.archive', 'Archive')}
            </button>
          </div>
        )}
        {trip?.archived_at && (
          <div className="mt-3 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40">
            <span className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Archive className="w-4 h-4 flex-shrink-0" />
              {t('trips.archivedBanner', 'This trip is archived')}
            </span>
            {isOwner && (
              <button
                onClick={() => setArchived(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 flex-shrink-0"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                {t('trips.unarchive', 'Unarchive')}
              </button>
            )}
          </div>
        )}

        {/* Mobile: Offline button full width */}
        <div className="sm:hidden mt-3">
          <button
            onClick={onSaveOffline}
            disabled={isSavingOffline}
            className={`
              w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${isAvailableOffline
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${isSavingOffline ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            {isSavingOffline ? (
              <Download className="w-4 h-4 animate-bounce" />
            ) : isAvailableOffline ? (
              <WifiOff className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            <span>{offlineLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripPanelHeader;
