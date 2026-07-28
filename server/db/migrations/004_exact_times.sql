-- Canonical clock times ('HH:MM', 24h) alongside the legacy free-text time
-- fields. The old columns stay untouched free text ("after lunch", "TBD",
-- or whatever legacy format was typed); consumers display the exact value
-- when set and fall back to the text. The two are mutually exclusive on
-- save (the client clears one when setting the other).
ALTER TABLE transportation ADD COLUMN departure_time_exact TEXT;
ALTER TABLE transportation ADD COLUMN arrival_time_exact TEXT;
ALTER TABLE activities ADD COLUMN time_exact TEXT;
