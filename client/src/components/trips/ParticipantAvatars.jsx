// client/src/components/trips/ParticipantAvatars.jsx
// Tiny stacked avatars showing who takes part in an item. Only rendered when
// the item targets a subset of the trip — participant_ids is empty when an
// item applies to everyone, and callers skip rendering in that case.
import React from 'react';
import { getImageUrl } from '../../utils/imageUtils';

const GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
];

// Keyed by user id so a member keeps the same color on every card
const gradientFor = (id) => GRADIENTS[Math.abs(id) % GRADIENTS.length];

const SIZES = {
  xs: { avatar: 'w-5 h-5', text: 'text-[9px]', overlap: '-space-x-1.5' },
  sm: { avatar: 'w-6 h-6', text: 'text-[10px]', overlap: '-space-x-1.5' },
};

const ParticipantAvatars = ({ ids = [], members = [], size = 'xs', maxDisplay = 4 }) => {
  if (!ids || ids.length === 0) return null;

  const participants = ids
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);
  if (participants.length === 0) return null;

  const shown = participants.slice(0, maxDisplay);
  const remaining = participants.length - shown.length;
  const s = SIZES[size] || SIZES.xs;

  return (
    <div className={`flex ${s.overlap} flex-shrink-0`} title={participants.map((m) => m.name).join(', ')}>
      {shown.map((member) => (
        <div
          key={member.id}
          className={`${s.avatar} rounded-full border border-white dark:border-gray-800 flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradientFor(member.id)}`}
        >
          {member.profile_image ? (
            <img
              src={getImageUrl(member.profile_image)}
              alt={member.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`text-white ${s.text} font-medium`}>
              {member.name?.charAt(0)?.toUpperCase()}
            </span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${s.avatar} rounded-full border border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center`}>
          <span className={`${s.text} font-medium text-gray-600 dark:text-gray-300`}>
            +{remaining}
          </span>
        </div>
      )}
    </div>
  );
};

export default ParticipantAvatars;
