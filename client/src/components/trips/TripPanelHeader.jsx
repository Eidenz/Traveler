// client/src/components/trips/TripPanelHeader.jsx
import React from 'react';
import { Share2, Settings, Edit, Wifi, WifiOff, Download, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/imageUtils';
import StatusBadge from '../ui/StatusBadge';
import dayjs from 'dayjs';

const TripPanelHeader = ({
  trip,
  members = [],
  isAvailableOffline = false,
  isSavingOffline = false,
  onShare,
  onSettings,
  onSaveOffline,
  canEdit = true,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Get trip status
  const getTripStatus = () => {
    if (!trip) return 'draft';

    const now = dayjs();
    const start = dayjs(trip.start_date);
    const end = dayjs(trip.end_date);

    if (now.isBefore(start)) return 'upcoming';
    if (now.isAfter(end)) return 'completed';
    return 'active';
  };

  // Calculate duration
  const getDuration = () => {
    if (!trip?.start_date || !trip?.end_date) return null;
    const nights = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day');
    return {
      nights,
      label: nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights'),
    };
  };

  // Format date range
  const formatDateRange = () => {
    if (!trip?.start_date) return '';
    const start = dayjs(trip.start_date).format('MMM D');
    const end = trip.end_date ? dayjs(trip.end_date).format('MMM D') : '';
    return end ? `${start} - ${end}` : start;
  };

  // Get owner info
  const owner = members.find(m => m.role === 'owner');
  const duration = getDuration();

  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      {/* Trip title section */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white truncate">
              {trip?.name || t('trips.untitled', 'Untitled Trip')}
            </h1>
            {owner && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
                  {owner.profile_image ? (
                    <img
                      src={getImageUrl(owner.profile_image)}
                      alt={owner.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xs font-medium">
                      {owner.name?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {owner.name}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onShare}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('sharing.share', 'Share')}</span>
            </button>

            <button
              onClick={() => navigate(`/budgets/${trip?.id}`)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('budget.title', 'Budget')}</span>
            </button>

            {canEdit && (
              <button
                onClick={() => navigate(`/trips/${trip?.id}/edit`)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.edit', 'Edit')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
        {/* Row 1: Date range, status, and duration */}
        <div className="flex items-center justify-between">
          {/* Date range and status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDateRange()}
            </span>
            <StatusBadge status={getTripStatus()} size="sm" />
          </div>

          {/* Duration - visible on all screens */}
          {duration && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span>
                <strong className="text-gray-900 dark:text-white">{duration.nights}</strong> {duration.label}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Offline button - full width on mobile, inline on desktop */}
        <div className="sm:hidden">
          <button
            onClick={onSaveOffline}
            disabled={isSavingOffline}
            className={`
              w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
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
            <span>
              {isAvailableOffline
                ? t('offline.availableOffline', 'Available offline')
                : t('offline.saveOffline', 'Save for offline')
              }
            </span>
          </button>
        </div>

        {/* Desktop: Offline toggle inline */}
        <div className="hidden sm:flex sm:justify-end">
          <button
            onClick={onSaveOffline}
            disabled={isSavingOffline}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium
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
            <span>
              {isAvailableOffline
                ? t('offline.availableOffline', 'Offline')
                : t('offline.saveOffline', 'Save offline')
              }
            </span>
          </button>
        </div>
      </div>

      {/* Progress bar placeholder - could be based on bookings completion */}
      {/* <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Planning progress</span>
            <span className="font-medium text-gray-900">68%</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent to-rose-400 rounded-full" style={{ width: '68%' }} />
          </div>
        </div> */}
    </div>
  );
};

export default TripPanelHeader;
