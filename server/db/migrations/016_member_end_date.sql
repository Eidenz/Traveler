-- A member's own last day on the trip, for people who leave before the
-- group does. NULL (every pre-existing row) = follows the trip's end_date.
-- Set by the member themselves, always clamped inside the trip's date range.
ALTER TABLE trip_members ADD COLUMN end_date TEXT;
