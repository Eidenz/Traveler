// client/src/utils/timeFormat.js
// Display of canonical clock times ('HH:MM', 24h) per the user's 12h/24h
// preference. The preference is device-local (localStorage): 'auto' follows
// the browser locale, '12h'/'24h' force a format. Free-text times (the
// legacy columns and anything typed in text mode) are always shown verbatim.

const STORAGE_KEY = 'timeFormat'; // '12h' | '24h'; absent = auto

export const getTimeFormatPreference = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === '12h' || stored === '24h' ? stored : 'auto';
};

export const setTimeFormatPreference = (value) => {
  if (value === '12h' || value === '24h') {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

const uses12h = () => {
  const pref = getTimeFormatPreference();
  if (pref === '12h') return true;
  if (pref === '24h') return false;
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
      .resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
};

/** 'HH:MM' -> '2:05 PM' (12h pref) or '14:05' (24h pref). */
export const formatClock = (hhmm) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || '';
  if (!uses12h()) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/**
 * The single precedence rule for item times: the exact clock value (rendered
 * per preference) wins; otherwise the free text is shown verbatim.
 */
export const displayTime = (exact, text) => (exact ? formatClock(exact) : (text || ''));

/**
 * Chronological-ish comparator for two items' times. Canonical 'HH:MM'
 * values compare correctly; free text sorts after clocked times within the
 * same day (letters > digits), which pushes vague times ("after lunch")
 * toward the end — matching the server's ORDER BY on the same expression.
 */
export const effectiveTime = (exact, text) => exact || text || '';
