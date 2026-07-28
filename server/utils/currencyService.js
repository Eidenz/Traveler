// server/utils/currencyService.js
// Daily exchange rates via frankfurter.app (ECB data, no API key), cached in
// the currency_rates table for 24h. Returns the freshest known rate — a
// stale cached rate beats no rate when the fetch fails (travel wifi…).

const { db } = require('../db/database');

const RATE_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Z]{3}$/;

const isValidCode = (code) => typeof code === 'string' && CODE_RE.test(code);

/**
 * Rate to multiply an amount in `base` by to get `quote`.
 * Returns { rate, fetched_at } or null when unavailable.
 */
const getRate = async (base, quote) => {
  if (!isValidCode(base) || !isValidCode(quote)) return null;
  if (base === quote) return { rate: 1, fetched_at: Date.now() };

  const cached = db.prepare(
    'SELECT rate, fetched_at FROM currency_rates WHERE base = ? AND quote = ?'
  ).get(base, quote);

  if (cached && Date.now() - cached.fetched_at < RATE_TTL_MS) return cached;

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}&to=${quote}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`rate fetch ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[quote];
    if (typeof rate !== 'number') throw new Error('rate missing in response');

    db.prepare(`
      INSERT INTO currency_rates (base, quote, rate, fetched_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(base, quote) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at
    `).run(base, quote, rate, Date.now());

    return { rate, fetched_at: Date.now() };
  } catch (error) {
    console.error(`Currency rate fetch failed (${base}->${quote}):`, error.message);
    return cached || null; // stale beats nothing
  }
};

module.exports = { getRate, isValidCode };
