// server/utils/timeFields.js

// Canonical clock format for the *_time_exact columns: 24h 'HH:MM'.
// The legacy time columns remain deliberately unvalidated free text.
const EXACT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Normalize an incoming *_time_exact value.
 * Returns 'HH:MM' when valid, null when absent/empty, and the sentinel
 * `false` when present but malformed (caller responds 400).
 */
const normalizeExactTime = (value) => {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  if (v === '') return null;
  return EXACT_TIME_RE.test(v) ? v : false;
};

module.exports = { normalizeExactTime };
