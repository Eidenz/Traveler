// client/src/components/trips/TripMembers.jsx
import React from 'react';
import { Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/imageUtils';

const TripMembers = ({
  members = [],
  maxDisplay = 3,
  onManageAccess,
  onAddMember,
  canManage = false,
}) => {
  const { t } = useTranslation();

  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;

  // Generate gradient colors for avatars without images
  const getAvatarGradient = (index) => {
    const gradients = [
      'from-violet-500 to-fuchsia-500',
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-amber-500',
      'from-rose-500 to-pink-500',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {t('sharing.travelers', 'Travelers')}
          </span>
          
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {displayedMembers.map((member, index) => (
              <div
                key={member.id}
                className={`
                  w-7 h-7 rounded-full border-2 border-white dark:border-gray-800
                  flex items-center justify-center overflow-hidden
                  bg-gradient-to-br ${getAvatarGradient(index)}
                  transition-transform hover:scale-110 hover:z-10
                `}
                title={member.name}
              >
                {member.profile_image ? (
                  <img
                    src={getImageUrl(member.profile_image)}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-medium">
                    {member.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
            ))}

            {/* Remaining count */}
            {remainingCount > 0 && (
              <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  +{remainingCount}
                </span>
              </div>
            )}

            {/* Add member button */}
            {canManage && (
              <button
                onClick={onAddMember}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('sharing.inviteMember', 'Invite member')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Manage access link */}
        {canManage && (
          <button
            onClick={onManageAccess}
            className="text-xs text-accent font-medium hover:underline"
          >
            {t('sharing.manageAccess', 'Manage access')}
          </button>
        )}
      </div>
    </div>
  );
};

export default TripMembers;
