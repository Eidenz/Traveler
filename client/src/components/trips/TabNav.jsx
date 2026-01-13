// client/src/components/trips/TabNav.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

const TabNav = ({
  activeTab,
  onChange,
  tabs = null,
  variant = 'pills',
  className = '',
}) => {
  const { t } = useTranslation();

  const defaultTabs = [
    { id: 'timeline', label: t('trips.timeline', 'Timeline') },
    { id: 'transport', label: t('transportation.title', 'Transport') },
    { id: 'lodging', label: t('lodging.title', 'Lodging') },
    { id: 'activities', label: t('activities.title', 'Activities') },
  ];

  const displayTabs = tabs || defaultTabs;

  if (variant === 'underline') {
    return (
      <div className={`border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${className}`}>
        <div className="flex overflow-x-auto scrollbar-hide">
          {displayTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap
                transition-colors duration-200
                ${activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`
                  ml-2 px-1.5 py-0.5 text-xs rounded-full
                  ${activeTab === tab.id
                    ? 'bg-accent-soft text-accent'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Pills variant (default) - now with horizontal scroll
  return (
    <div className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 ${className}`}>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto scrollbar-hide">
        {displayTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg
              transition-all duration-200 whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-nav dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`
                ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                ${activeTab === tab.id
                  ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNav;
