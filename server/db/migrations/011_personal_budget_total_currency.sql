-- The personal budget's total can be denominated in a different currency
-- than the trip currency (e.g. a €5000 envelope for a JPY trip).
-- NULL = the budget's trip currency, as before.
ALTER TABLE personal_budgets ADD COLUMN total_currency_code TEXT;
