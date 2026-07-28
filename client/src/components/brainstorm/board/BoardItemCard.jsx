// client/src/components/brainstorm/board/BoardItemCard.jsx
// A single item card in world space. Purely presentational — all gesture
// handling lives in BoardCanvas, which positions this via absolute world
// coordinates inside the transformed layer.

import React from 'react';
import { MapPin, Link2, Lightbulb, StickyNote, Star } from 'lucide-react';
import { getImageUrl } from '../../../utils/imageUtils';

const TYPE_ICONS = {
  place: MapPin,
  link: Link2,
  idea: Lightbulb,
  note: StickyNote,
};

const linkHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const BoardItemCard = ({ item, selected, highlighted, dimmed, lifted }) => {
  const Icon = TYPE_ICONS[item.type] || StickyNote;
  const accent = item.color || null;

  return (
    <div
      className={`board-item-card group/card w-[230px] select-none rounded-xl border bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-shadow
        ${selected
          ? 'border-accent ring-2 ring-accent/60 shadow-md'
          : 'border-gray-200 dark:border-gray-700 hover:shadow-md'}
        ${highlighted ? 'board-item-pulse' : ''}
        ${dimmed ? 'opacity-40' : ''}
        ${lifted ? 'scale-105 shadow-xl ring-2 ring-accent/50' : ''}`}
      style={accent ? { borderColor: accent, borderLeftWidth: 4 } : undefined}
    >
      {/* Image (lazy — hundreds of these can exist on one board) */}
      {item.image_path && (
        <img
          src={getImageUrl(item.image_path)}
          alt=""
          loading="lazy"
          draggable={false}
          className="w-full h-24 object-cover pointer-events-none"
        />
      )}

      <div className="p-2.5">
        <div className="flex items-start gap-1.5">
          <Icon
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            style={{ color: accent || 'var(--tw-prose-body, #9ca3af)' }}
          />
          <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
            {item.title || item.content || item.location_name || item.url || '…'}
          </p>
          {item.priority > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 flex-shrink-0">
              <Star className="w-3 h-3 fill-current" />
              {item.priority}
            </span>
          )}
        </div>

        {item.title && item.content && (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">
            {item.content}
          </p>
        )}

        {item.type === 'place' && item.location_name && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {item.location_name}
          </p>
        )}

        {item.type === 'link' && item.url && (
          <p className="mt-1 text-[10px] text-sky-500 truncate flex items-center gap-1">
            <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
            {linkHost(item.url)}
          </p>
        )}

        {/* Creator */}
        {item.creator_name && (
          <div className="mt-1.5 flex items-center gap-1">
            {item.creator_image ? (
              <img
                src={getImageUrl(item.creator_image)}
                alt=""
                loading="lazy"
                draggable={false}
                className="w-3.5 h-3.5 rounded-full object-cover pointer-events-none"
              />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[8px] text-white">
                {item.creator_name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-[10px] text-gray-400 truncate">{item.creator_name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Cards only re-render when their own data or visual state changes — with
// hundreds of items on a board this memo is what keeps drags smooth.
export default React.memo(BoardItemCard);
