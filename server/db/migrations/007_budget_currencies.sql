-- Currency-aware budgets: ISO codes for the trip currency and the home
-- currency, plus a small cache for daily exchange rates. The legacy free-text
-- `currency` symbol column stays for display of the trip currency.
ALTER TABLE budgets ADD COLUMN currency_code TEXT;
ALTER TABLE budgets ADD COLUMN home_currency_code TEXT;

CREATE TABLE IF NOT EXISTS currency_rates (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (base, quote)
);
