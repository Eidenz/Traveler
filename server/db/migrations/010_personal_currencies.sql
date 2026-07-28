-- Personal budgets get the same ISO currency treatment as shared ones, plus
-- per-expense currency: a personal expense is either in the trip currency
-- (konbini runs) or the user's home currency (flights booked from home).
-- NULL expense currency_code = the budget's currency.
ALTER TABLE personal_budgets ADD COLUMN currency_code TEXT;
ALTER TABLE personal_expenses ADD COLUMN currency_code TEXT;
