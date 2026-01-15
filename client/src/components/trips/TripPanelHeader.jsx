// client/src/components/trips/TripPanelHeader.jsx
import React from 'react';
import { Share2, Settings, Edit, Wifi, WifiOff, Download, Wallet, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/imageUtils';
import StatusBadge from '../ui/StatusBadge';
import dayjs from 'dayjs';
import { useSocket } from '../../contexts/SocketContext';

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
  const { isConnected, roomMembers } = useSocket();

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

  // Generate initials from name for avatars
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate consistent color from name
  const getAvatarColor = (name) => {
    const colors = [
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
      'from-emerald-500 to-teal-500',
      'from-sky-500 to-blue-500',
      'from-violet-500 to-purple-500',
      'from-pink-500 to-rose-500',
    ];
    const hash = name?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
    return colors[hash % colors.length];
  };

  // Filter out current user from room members for display
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const otherCollaborators = roomMembers.filter(m => m.userId !== currentUser?.id).slice(0, 4);

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
            {/* Live collaborators indicator */}
            {isConnected && otherCollaborators.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {t('realtime.live', 'Live')}
                  </span>
                </div>
                <div className="flex -space-x-2">
                  {otherCollaborators.map((collaborator, idx) => (
                    <div
                      key={collaborator.userId}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(collaborator.userName)} flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-white dark:ring-gray-800`}
                      style={{ zIndex: otherCollaborators.length - idx }}
                      title={collaborator.userName}
                    >
                      {getInitials(collaborator.userName)}
                    </div>
                  ))}
                  {roomMembers.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-white dark:ring-gray-800">
                      +{roomMembers.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}

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

            <span className="text-gray-600 dark:text-gray-300 font-medium">
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
              <span>
                {isAvailableOffline
                  ? t('offline.availableOffline', 'Available offline')
                  : t('offline.saveOffline', 'Save offline')
                }
              </span>
            </button>
          </div>
        </div>

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
            <span>
              {isAvailableOffline
                ? t('offline.availableOffline', 'Available offline')
                : t('offline.saveOffline', 'Save for offline')
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripPanelHeader;
