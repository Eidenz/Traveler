// client/src/components/ui/StatusBadge.jsx
import React from 'react';

const StatusBadge = ({ status, size = 'sm', showDot = true, className = '' }) => {
  const statusConfig = {
    booked: {
      label: 'Booked',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
    },
    confirmed: {
      label: 'Confirmed',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
    },
    pending: {
      label: 'Pending',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      textClass: 'text-amber-700 dark:text-amber-400',
      dotClass: 'bg-amber-500',
    },
    upcoming: {
      label: 'Upcoming',
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      textClass: 'text-blue-700 dark:text-blue-400',
      dotClass: 'bg-blue-500',
    },
    active: {
      label: 'Active',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-700 dark:text-green-400',
      dotClass: 'bg-green-500 animate-pulse',
    },
    completed: {
      label: 'Completed',
      bgClass: 'bg-gray-100 dark:bg-gray-700',
      textClass: 'text-gray-600 dark:text-gray-400',
      dotClass: 'bg-gray-400',
    },
    cancelled: {
      label: 'Cancelled',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      textClass: 'text-red-700 dark:text-red-400',
      dotClass: 'bg-red-500',
    },
    'not-started': {
      label: 'Not started',
      bgClass: 'bg-gray-100 dark:bg-gray-700',
      textClass: 'text-gray-500 dark:text-gray-400',
      dotClass: 'bg-gray-400',
    },
    draft: {
      label: 'Draft',
      bgClass: 'bg-gray-100 dark:bg-gray-700',
      textClass: 'text-gray-500 dark:text-gray-400',
      dotClass: 'bg-gray-400',
    },
    owner: {
      label: 'Owner',
      bgClass: 'bg-accent-soft',
      textClass: 'text-accent',
      dotClass: 'bg-accent',
    },
    editor: {
      label: 'Editor',
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      textClass: 'text-blue-700 dark:text-blue-400',
      dotClass: 'bg-blue-500',
    },
    viewer: {
      label: 'Viewer',
      bgClass: 'bg-gray-100 dark:bg-gray-700',
      textClass: 'text-gray-600 dark:text-gray-400',
      dotClass: 'bg-gray-400',
    },
  };

  const sizes = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgClass}
        ${config.textClass}
        ${sizes[size]}
        ${className}
      `}
    >
      {showDot && (
        <span className={`${dotSizes[size]} rounded-full ${config.dotClass}`} />
      )}
      {config.label}
    </span>
  );
};

export default StatusBadge;
