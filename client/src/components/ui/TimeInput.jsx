// client/src/components/ui/TimeInput.jsx
// Two-mode time input: a clock picker (canonical 24h 'HH:MM', stored in the
// *_time_exact column) or free text ("after lunch", "TBD", stored in the
// legacy time column). The modes are mutually exclusive — committing a value
// in one clears the other — so an item never carries contradictory times.

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TimeInput = ({
  label,
  exactValue = '',
  textValue = '',
  onChange, // ({ exact, text }) — exactly one is non-empty
  focusRingClass = 'focus:ring-blue-500',
}) => {
  const { t } = useTranslation();
  // Initial mode follows whichever value the item has; clock is the default
  const [mode, setMode] = useState(exactValue ? 'clock' : textValue ? 'text' : 'clock');

  // Edit forms load item data asynchronously, so the values can appear after
  // mount — follow them until the user explicitly picks a mode
  const userToggledRef = useRef(false);
  useEffect(() => {
    if (userToggledRef.current) return;
    if (exactValue && !textValue) setMode('clock');
    else if (textValue && !exactValue) setMode('text');
  }, [exactValue, textValue]);

  const inputClass = `w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${focusRingClass}`;

  const modeButton = (target, Icon, title) => (
    <button
      type="button"
      onClick={() => {
        userToggledRef.current = true;
        setMode(target);
      }}
      title={title}
      className={`p-0.5 rounded transition-colors ${mode === target
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
    >
      <Icon className="w-3 h-3" />
    </button>
  );

  return (
    <div>
      {/* Fixed h-5 header so the input aligns with plain-label fields
          (e.g. the date picker next to it) despite the mode toggle */}
      <div className="flex items-center justify-between h-5 mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
          {modeButton('clock', Clock, t('time.clockMode', 'Pick a time'))}
          {modeButton('text', Type, t('time.textMode', 'Free text (e.g. "after lunch")'))}
        </div>
      </div>

      {mode === 'clock' ? (
        <input
          type="time"
          value={exactValue || ''}
          onChange={(e) => onChange({ exact: e.target.value, text: '' })}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={textValue || ''}
          onChange={(e) => onChange({ exact: '', text: e.target.value })}
          placeholder={t('time.textPlaceholder', 'e.g. after lunch, TBD')}
          className={inputClass}
        />
      )}
    </div>
  );
};

export default TimeInput;
