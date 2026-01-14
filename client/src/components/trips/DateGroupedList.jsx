// client/src/components/trips/DateGroupedList.jsx
import React from 'react';
import dayjs from 'dayjs';
import { Plane, Bed, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Transport card component
const TransportCard = ({ item, onClick }) => (
    <div
        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-200"
        onClick={() => onClick?.(item.id)}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.from_location} → {item.to_location}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.departure_time || item.company || item.type}
                    </p>
                </div>
            </div>
            {item.has_documents > 0 && (
                <FileText className="w-4 h-4 text-gray-400" />
            )}
        </div>
    </div>
);

// Lodging card component
const LodgingCard = ({ item, onClick }) => (
    <div
        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-200"
        onClick={() => onClick?.(item.id)}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {dayjs(item.check_in).format('MMM D')} - {dayjs(item.check_out).format('MMM D')}
                    </p>
                </div>
            </div>
            {item.has_documents > 0 && (
                <FileText className="w-4 h-4 text-gray-400" />
            )}
        </div>
    </div>
);

/**
 * DateGroupedList - Groups items by date with timeline-style headers
 * @param {Object} props
 * @param {Array} props.items - Array of items to display
 * @param {string} props.type - 'transport' or 'lodging'
 * @param {Date} props.tripStartDate - Trip start date for day number calculation
 * @param {Function} props.onItemClick - Click handler for items
 */
const DateGroupedList = ({ items, type, tripStartDate, onItemClick }) => {
    const { t } = useTranslation();
    if (!items || items.length === 0) return null;

    // Get the date field based on type
    const getItemDate = (item) => {
        if (type === 'transport') {
            return item.departure_date;
        } else if (type === 'lodging') {
            return item.check_in;
        }
        return item.date;
    };

    // Group items by date
    const groupedItems = items.reduce((groups, item) => {
        const dateStr = dayjs(getItemDate(item)).format('YYYY-MM-DD');
        if (!groups[dateStr]) {
            groups[dateStr] = [];
        }
        groups[dateStr].push(item);
        return groups;
    }, {});

    // Sort dates
    const sortedDates = Object.keys(groupedItems).sort();
    const today = dayjs();
    const tripStart = dayjs(tripStartDate);

    return (
        <div>
            {sortedDates.map((dateStr, index) => {
                const date = dayjs(dateStr);
                const dayNumber = date.diff(tripStart, 'day') + 1;
                const isToday = date.isSame(today, 'day');
                const itemsForDate = groupedItems[dateStr];
                const isLast = index === sortedDates.length - 1;

                return (
                    <div key={dateStr} className="relative">
                        {/* Connector line - always show */}
                        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                        <div className="flex gap-4">
                            {/* Day circle */}
                            <div className={`
                                relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                border-2
                                ${isToday
                                    ? 'bg-accent text-white border-accent ring-4 ring-accent/20'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                                }
                            `}>
                                <span className="text-sm font-semibold">{dayNumber > 0 ? dayNumber : '-'}</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pb-6 overflow-hidden">
                                {/* Date header */}
                                <div className="flex items-center gap-2 mb-3">
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
                                </div>

                                {/* Items */}
                                <div className="space-y-2">
                                    {itemsForDate.map((item) => (
                                        type === 'transport' ? (
                                            <TransportCard
                                                key={item.id}
                                                item={item}
                                                onClick={onItemClick}
                                            />
                                        ) : (
                                            <LodgingCard
                                                key={item.id}
                                                item={item}
                                                onClick={onItemClick}
                                            />
                                        )
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DateGroupedList;
