// client/src/components/realtime/CollaboratorsIndicator.jsx
// Shows avatars of users currently viewing/editing the same trip

import React from 'react';
import { Users } from 'lucide-react';
import { useTripSocket } from '../../contexts/SocketContext';
import { useTranslation } from 'react-i18next';

const CollaboratorsIndicator = ({ tripId }) => {
    const { t } = useTranslation();
    const { isConnected, roomMembers } = useTripSocket(tripId);

    // Don't show if not connected or alone
    if (!isConnected || roomMembers.length <= 1) {
        return null;
    }

    // Current user is included in roomMembers, show others
    const otherMembers = roomMembers.slice(0, 5); // Show max 5

    // Generate initials from name
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
    const getColor = (name) => {
        const colors = [
            'bg-rose-500',
            'bg-amber-500',
            'bg-emerald-500',
            'bg-sky-500',
            'bg-violet-500',
            'bg-pink-500',
            'bg-teal-500',
            'bg-indigo-500'
        ];
        const hash = name?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
        return colors[hash % colors.length];
    };

    return (
        <div className="flex items-center gap-2">
            {/* Connection status dot */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {t('realtime.live', 'Live')}
                </span>
            </div>

            {/* Avatars */}
            <div className="flex items-center -space-x-2">
                {otherMembers.map((member, index) => (
                    <div
                        key={member.userId}
                        className={`w-7 h-7 rounded-full ${getColor(member.userName)} flex items-center justify-center text-white text-xs font-medium ring-2 ring-white dark:ring-gray-800`}
                        style={{ zIndex: otherMembers.length - index }}
                        title={member.userName}
                    >
                        {getInitials(member.userName)}
                    </div>
                ))}

                {roomMembers.length > 5 && (
                    <div
                        className="w-7 h-7 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white text-xs font-medium ring-2 ring-white dark:ring-gray-800"
                        title={t('realtime.moreUsers', '{{count}} more users', { count: roomMembers.length - 5 })}
                    >
                        +{roomMembers.length - 5}
                    </div>
                )}
            </div>

            {/* Count label */}
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                {t('realtime.editing', '{{count}} editing', { count: roomMembers.length })}
            </span>
        </div>
    );
};

export default CollaboratorsIndicator;
