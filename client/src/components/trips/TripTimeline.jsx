// client/src/components/trips/TripTimeline.jsx
import React, { useState } from 'react';
import {
  Plus, MapPin, Clock, Calendar, Ticket, FileText,
  ChevronDown, ChevronRight, Plane, Bed, Coffee
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Activity card component
const ActivityCard = ({ activity, onClick, onDocumentClick, canEdit }) => {
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onClick?.(activity)}
      className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-accent/30 transition-all duration-200 overflow-hidden"
    >
      <div className="flex gap-3">
        {/* Time badge */}
        {activity.time && (
          <div className="flex-shrink-0 w-14 text-center">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {activity.time}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-accent transition-colors">
            {activity.name}
          </h4>

          {activity.location && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{activity.location}</span>
            </p>
          )}

          {activity.confirmation_code && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
              <Ticket className="w-3 h-3" />
              {activity.confirmation_code}
            </p>
          )}
        </div>

        {/* Document indicator */}
        {activity.has_documents > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDocumentClick?.('activity', activity);
            }}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1.5 border border-amber-200 dark:border-amber-800"
          >
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {activity.has_documents}
            </span>
          </button>
        )}
      </div>

      {/* Banner image if exists */}
      {activity.banner_image && (
        <div className="mt-2 rounded-lg overflow-hidden h-20">
          <img
            src={activity.banner_image}
            alt={activity.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
};

// Transport mini card
const TransportMini = ({ transport, onClick, onDocumentClick }) => (
  <div
    onClick={() => onClick?.(transport)}
    className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors overflow-hidden"
  >
    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
      <Plane className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {transport.from_location} → {transport.to_location}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {transport.departure_time || transport.type || 'Transport'}
      </p>
    </div>
    {transport.has_documents > 0 && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDocumentClick?.('transport', transport);
        }}
        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1 border border-amber-200 dark:border-amber-800"
      >
        <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {transport.has_documents}
        </span>
      </button>
    )}
  </div>
);

// Lodging mini card
const LodgingMini = ({ lodging, onClick, onDocumentClick }) => {
  const nights = dayjs(lodging.check_out).diff(dayjs(lodging.check_in), 'day');

  return (
    <div
      onClick={() => onClick?.(lodging)}
      className="flex items-center gap-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors overflow-hidden"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
        <Bed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {lodging.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
      </div>
      {lodging.has_documents > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDocumentClick?.('lodging', lodging);
          }}
          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1 border border-amber-200 dark:border-amber-800"
        >
          <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {lodging.has_documents}
          </span>
        </button>
      )}
    </div>
  );
};

// Timeline icon button component for transport/lodging indicators
const TimelineIcon = ({ type, items, onClick, tooltip }) => {
  const isTransport = type === 'transport';
  const isCheckout = type === 'checkout';
  const isCheckin = type === 'lodging';
  const count = Array.isArray(items) ? items.length : (items ? 1 : 0);

  if (count === 0) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (Array.isArray(items)) {
      // For multiple items, click the first one (or show a picker)
      onClick?.(items[0]);
    } else {
      onClick?.(items);
    }
  };

  // Determine colors based on type
  const getStyles = () => {
    if (isTransport) {
      return 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60';
    }
    if (isCheckout) {
      return 'bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60';
    }
    // Check-in (lodging)
    return 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60';
  };

  const getIconColor = () => {
    if (isTransport) return 'text-blue-600 dark:text-blue-400';
    if (isCheckout) return 'text-orange-600 dark:text-orange-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getBadgeColor = () => {
    if (isTransport) return 'bg-blue-500 text-white';
    if (isCheckout) return 'bg-orange-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  return (
    <button
      onClick={handleClick}
      className={`
        relative flex items-center justify-center w-7 h-7 rounded-full
        transition-all duration-200 group
        hover:scale-110 hover:shadow-md
        ${getStyles()}
      `}
      title={tooltip}
    >
      {isTransport ? (
        <Plane className={`w-3.5 h-3.5 ${getIconColor()}`} />
      ) : (
        <Bed className={`w-3.5 h-3.5 ${getIconColor()}`} />
      )}
      {/* Count badge for multiple items */}
      {count > 1 && (
        <span className={`
          absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full
          flex items-center justify-center
          ${getBadgeColor()}
        `}>
          {count}
        </span>
      )}
    </button>
  );
};

// Multiple transport picker dropdown
const TransportPicker = ({ transports, onSelect, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]">
      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        {t('transport.selectTransport', 'Select transport')}
      </div>
      {transports.map((transport, index) => (
        <button
          key={transport.id || index}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(transport);
            onClose();
          }}
          className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
        >
          <Plane className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {transport.from_location} → {transport.to_location}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {transport.departure_time || transport.type || 'Transport'}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

// Day group component
const DayGroup = ({
  date,
  dayNumber,
  activities,
  transports = [],
  lodging,
  lodgingCheckout,
  isToday,
  isPast,
  onActivityClick,
  onTransportClick,
  onLodgingClick,
  onAddActivity,
  onDocumentClick,
  canEdit
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const hasContent = activities.length > 0;
  const hasTransports = transports.length > 0;
  const hasLodging = !!lodging;
  const hasLodgingCheckout = !!lodgingCheckout;
  const hasAnyContent = hasContent || hasTransports || hasLodging || hasLodgingCheckout;

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="flex gap-4">
        {/* Day circle */}
        <div className={`
          relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
          transition-all duration-300 border-2
          ${isToday
            ? 'bg-accent text-white border-accent ring-4 ring-accent/20'
            : isPast
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
          }
        `}>
          <span className="text-sm font-semibold">{dayNumber}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-6 overflow-hidden">
          {/* Date header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 mb-3 group"
          >
            <h3 className={`
              font-medium
              ${isToday
                ? 'text-accent'
                : 'text-gray-900 dark:text-white'
              }
            `}>
              {dayjs(date).format('dddd, MMM D')}
            </h3>
            {isToday && (
              <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full">
                {t('common.today', 'Today')}
              </span>
            )}
            {hasAnyContent && (
              <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}
          </button>

          {isExpanded && (
            <div className="space-y-2">
              {/* Lodging checkout (orange) - show first */}
              {hasLodgingCheckout && (
                <div
                  onClick={() => onLodgingClick?.(lodgingCheckout)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
                    <Bed className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    {t('lodging.checkOut', 'Check-out')}:
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {lodgingCheckout.name}
                  </span>
                </div>
              )}

              {/* Transports */}
              {transports.map(transport => (
                <TransportMini
                  key={transport.id}
                  transport={transport}
                  onClick={onTransportClick}
                  onDocumentClick={onDocumentClick}
                />
              ))}

              {/* Lodging check-in (green) */}
              {hasLodging && (
                <LodgingMini
                  lodging={lodging}
                  onClick={onLodgingClick}
                  onDocumentClick={onDocumentClick}
                />
              )}

              {/* Activities */}
              {activities.map(activity => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onClick={onActivityClick}
                  onDocumentClick={onDocumentClick}
                  canEdit={canEdit}
                />
              ))}

              {/* Add activity button */}
              {canEdit && (
                <button
                  onClick={() => onAddActivity?.(date)}
                  className="w-full p-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('activities.add', 'Add activity')}
                </button>
              )}
            </div>
          )}

          {/* Collapsed state */}
          {!isExpanded && hasAnyContent && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activities.length > 0 && `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
              {activities.length > 0 && (hasTransports || hasLodging || hasLodgingCheckout) && ' • '}
              {hasTransports && `${transports.length} transport${transports.length > 1 ? 's' : ''}`}
              {hasTransports && (hasLodging || hasLodgingCheckout) && ', '}
              {hasLodging && t('lodging.checkIn', 'Check-in')}
              {hasLodging && hasLodgingCheckout && ', '}
              {hasLodgingCheckout && t('lodging.checkOut', 'Check-out')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TripTimeline = ({
  trip,
  transportation = [],
  lodging = [],
  activities = [],
  onTransportClick,
  onLodgingClick,
  onActivityClick,
  onAddActivity,
  onDocumentClick,
  canEdit = true,
}) => {
  const { t } = useTranslation();

  if (!trip) return null;

  // Generate array of days for the trip
  const getDays = () => {
    const days = [];
    const start = dayjs(trip.start_date);
    const end = dayjs(trip.end_date);
    const today = dayjs();

    let current = start;
    let dayNumber = 1;

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');

      // Get activities for this day
      const dayActivities = activities.filter(a =>
        dayjs(a.date).format('YYYY-MM-DD') === dateStr
      );

      // Get all transports departing this day (supports multiple)
      const dayTransports = transportation.filter(t =>
        dayjs(t.departure_date).format('YYYY-MM-DD') === dateStr
      );

      // Get lodging checking in this day
      const dayLodging = lodging.find(l =>
        dayjs(l.check_in).format('YYYY-MM-DD') === dateStr
      );

      // Get lodging checking out this day
      const dayLodgingCheckout = lodging.find(l =>
        dayjs(l.check_out).format('YYYY-MM-DD') === dateStr
      );

      days.push({
        date: current.toDate(),
        dayNumber,
        activities: dayActivities,
        transports: dayTransports,
        lodging: dayLodging,
        lodgingCheckout: dayLodgingCheckout,
        isToday: current.isSame(today, 'day'),
        isPast: current.isBefore(today, 'day'),
      });

      current = current.add(1, 'day');
      dayNumber++;
    }

    return days;
  };

  const days = getDays();

  return (
    <div className="p-6">
      {/* Trip header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-white truncate">
            {trip.location || trip.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D, YYYY')}
            <span className="mx-1">•</span>
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {days.map((day, index) => (
          <DayGroup
            key={day.date.toISOString()}
            {...day}
            onActivityClick={onActivityClick}
            onTransportClick={onTransportClick}
            onLodgingClick={onLodgingClick}
            onAddActivity={onAddActivity}
            onDocumentClick={onDocumentClick}
            canEdit={canEdit}
          />
        ))}

        {/* End marker */}
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🏁</span>
          </div>
          <div className="pt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('trips.tripEnds', 'Trip ends')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripTimeline;
