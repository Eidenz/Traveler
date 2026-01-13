// client/src/components/trips/TabNav.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TabNav = ({
  activeTab,
  onChange,
  tabs = null,
  variant = 'pills',
  className = '',
}) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const defaultTabs = [
    { id: 'timeline', label: t('trips.timeline', 'Timeline') },
    { id: 'transport', label: t('transportation.title', 'Transport') },
    { id: 'lodging', label: t('lodging.title', 'Lodging') },
    { id: 'activities', label: t('activities.title', 'Activities') },
  ];

  const displayTabs = tabs || defaultTabs;

  // Check scroll position and update indicators
  const updateScrollIndicators = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // Scroll by a fixed amount
  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 150;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Update indicators on scroll and resize
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollIndicators();
    container.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('resize', updateScrollIndicators);

    return () => {
      container.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators, displayTabs]);

  // Re-check on tabs change
  useEffect(() => {
    updateScrollIndicators();
  }, [displayTabs, updateScrollIndicators]);

  if (variant === 'underline') {
    return (
      <div className={`border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${className}`}>
        <div className="relative">
          {/* Left scroll button */}
          {showLeftScroll && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-white via-white to-transparent dark:from-gray-800 dark:via-gray-800"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto scrollbar-hide"
          >
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

          {/* Right scroll button */}
          {showRightScroll && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-white via-white to-transparent dark:from-gray-800 dark:via-gray-800"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pills variant (default) - with horizontal scroll indicators
  return (
    <div className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 ${className}`}>
      <div className="relative">
        {/* Left scroll indicator */}
        {showLeftScroll && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-r from-gray-100 via-gray-100 to-transparent dark:from-gray-800 dark:via-gray-800 rounded-l-xl"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto scrollbar-hide"
        >
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

        {/* Right scroll indicator */}
        {showRightScroll && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-l from-gray-100 via-gray-100 to-transparent dark:from-gray-800 dark:via-gray-800 rounded-r-xl"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default TabNav;
