-- Per-user home currency (ISO code) for budget conversions. Each member sees
-- shared-budget amounts converted to *their* currency; the budget-level
-- home_currency_code remains only as a fallback for users who set none.
ALTER TABLE users ADD COLUMN home_currency_code TEXT;
