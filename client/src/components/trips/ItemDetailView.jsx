// client/src/components/trips/ItemDetailView.jsx
// Read-only recap of a timeline item (activity / lodging / transport),
// opened by clicking a card. Shows everything the compact cards truncate —
// notes especially — with an Edit button into the wizard. Fills the desktop
// right panel or an 80vh modal on mobile, same shell as ItemWizard.
import React from 'react';
import {
  X, Edit3, Calendar, Clock, MapPin, Ticket, StickyNote, Users, Bed,
  FileText, Plane, Train, Bus, Car, Ship, MoreHorizontal, Coffee, ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { displayTime } from '../../utils/timeFormat';
import { getImageUrl } from '../../utils/imageUtils';
import ParticipantAvatars from './ParticipantAvatars';

const transportIcon = (type, className) => {
  switch (type?.toLowerCase()) {
    case 'flight': return <Plane className={className} />;
    case 'train': return <Train className={className} />;
    case 'bus': return <Bus className={className} />;
    case 'car': return <Car className={className} />;
    case 'ship': case 'ferry': return <Ship className={className} />;
    default: return <MoreHorizontal className={className} />;
  }
};

// Tailwind needs complete class names — same convention as ItemWizard
const COLOR_SCHEMES = {
  activity: {
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconText: 'text-purple-600 dark:text-purple-400',
    btnBg: 'bg-purple-600 hover:bg-purple-700',
  },
  lodging: {
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconText: 'text-green-600 dark:text-green-400',
    btnBg: 'bg-green-600 hover:bg-green-700',
  },
  transport: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400',
    btnBg: 'bg-blue-600 hover:bg-blue-700',
  },
};

const mapsUrl = (query) => query
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  : null;

// One labeled fact; renders nothing when the item doesn't have it
const DetailRow = ({ icon, label, value, href }) => {
  const Icon = icon;
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent hover:underline break-words"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{value}</p>
        )}
      </div>
    </div>
  );
};

const ItemDetailView = ({
  type, // 'activity' | 'lodging' | 'transport'
  item,
  members = [],
  canEdit = false,
  onEdit,
  onClose,
  onDocumentClick, // (referenceType, item) — opens the existing documents view
}) => {
  const { t } = useTranslation();
  const colors = COLOR_SCHEMES[type] || COLOR_SCHEMES.activity;

  if (!item) return null;

  const fmtDate = (d) => (d ? dayjs(d).format('dddd, MMM D, YYYY') : null);
  const fmtDateTime = (date, timeExact, timeText) => {
    if (!date) return null;
    const time = displayTime(timeExact, timeText);
    return time ? `${dayjs(date).format('ddd, MMM D')} · ${time}` : dayjs(date).format('ddd, MMM D');
  };

  const title = type === 'transport'
    ? (item.company || `${item.from_location} → ${item.to_location}`)
    : item.name;

  const headerLabel = type === 'activity'
    ? t('wizard.kindActivity', 'Activity')
    : type === 'lodging'
      ? t('wizard.kindLodging', 'Lodging')
      : t('wizard.kindTransport', 'Transport');

  const TitleIcon = type === 'activity' ? Coffee : type === 'lodging' ? Bed : null;
  const nights = type === 'lodging' && item.check_in && item.check_out
    ? dayjs(item.check_out).diff(dayjs(item.check_in), 'day')
    : null;

  const participants = (item.participant_ids || [])
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white">{headerLabel}</h2>
        </div>

        {canEdit && (
          <button
            onClick={onEdit}
            className={`flex items-center gap-2 px-4 py-2 ${colors.btnBg} text-white rounded-xl text-sm font-medium transition-colors`}
          >
            <Edit3 className="w-4 h-4" />
            {t('common.edit', 'Edit')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-12">
        <div className="w-full max-w-lg mx-auto">
          {/* Banner image */}
          {item.banner_image && (
            <div className="mb-5 rounded-2xl overflow-hidden h-44">
              <img
                src={getImageUrl(item.banner_image)}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Title */}
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.iconBg}`}>
              {type === 'transport'
                ? transportIcon(item.type, `w-6 h-6 ${colors.iconText}`)
                : <TitleIcon className={`w-6 h-6 ${colors.iconText}`} />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-display font-semibold text-gray-900 dark:text-white break-words">
                {title}
              </h3>
              {type === 'transport' && item.company && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                  {item.from_location}
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.to_location}
                </p>
              )}
            </div>
          </div>

          {/* Facts */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-1.5 divide-y divide-gray-100 dark:divide-gray-700 mb-4">
            {type === 'activity' && (
              <>
                <DetailRow icon={Calendar} label={t('activities.date', 'Date')} value={fmtDate(item.date)} />
                <DetailRow
                  icon={Clock}
                  label={t('activities.time', 'Time')}
                  value={displayTime(item.time_exact, item.time)}
                />
                <DetailRow
                  icon={MapPin}
                  label={t('activities.location', 'Location')}
                  value={item.location}
                  href={mapsUrl(item.location)}
                />
              </>
            )}

            {type === 'lodging' && (
              <>
                <DetailRow
                  icon={MapPin}
                  label={t('lodging.address', 'Address')}
                  value={item.address}
                  href={mapsUrl(item.address)}
                />
                <DetailRow icon={Calendar} label={t('lodging.checkIn', 'Check-in')} value={fmtDate(item.check_in)} />
                <DetailRow icon={Calendar} label={t('lodging.checkOut', 'Check-out')} value={fmtDate(item.check_out)} />
                <DetailRow
                  icon={Bed}
                  label={t('lodging.stay', 'Stay')}
                  value={nights != null
                    ? `${nights} ${nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}`
                    : null}
                />
              </>
            )}

            {type === 'transport' && (
              <>
                <DetailRow
                  icon={Calendar}
                  label={t('itemDetail.departure', 'Departure')}
                  value={fmtDateTime(item.departure_date, item.departure_time_exact, item.departure_time)}
                />
                <DetailRow
                  icon={Calendar}
                  label={t('itemDetail.arrival', 'Arrival')}
                  value={fmtDateTime(item.arrival_date, item.arrival_time_exact, item.arrival_time)}
                />
                <DetailRow icon={MapPin} label={t('transportation.from', 'From')} value={item.from_location} />
                <DetailRow icon={MapPin} label={t('transportation.to', 'To')} value={item.to_location} />
              </>
            )}

            <DetailRow
              icon={Ticket}
              label={t('itemDetail.confirmationCode', 'Confirmation code')}
              value={item.confirmation_code}
            />
          </div>

          {/* Notes — the main reason this view exists */}
          {item.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                <StickyNote className="w-3.5 h-3.5" />
                {t('common.notes', 'Notes')}
              </p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {item.notes}
              </p>
            </div>
          )}

          {/* Who takes part — no rows means the whole group */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5" />
              {t('participants.whoGoing', "Who's going?")}
            </p>
            {participants.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <ParticipantAvatars ids={item.participant_ids} members={members} size="sm" maxDisplay={8} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {participants.map((m) => m.name).join(', ')}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('participants.everyone', 'Everyone')}
              </p>
            )}
          </div>

          {/* Documents */}
          {item.has_documents > 0 && (
            <button
              onClick={() => onDocumentClick?.(type, item)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-medium transition-colors"
            >
              <FileText className="w-5 h-5" />
              {t('itemDetail.viewDocuments', 'View documents ({{count}})', { count: item.has_documents })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetailView;
