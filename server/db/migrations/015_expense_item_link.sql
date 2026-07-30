-- Link a shared expense to the trip item it pays for (same polymorphic
-- reference shape as documents). NULL = a plain unlinked expense, which is
-- what every pre-existing row stays as.
ALTER TABLE expenses ADD COLUMN reference_type TEXT;
ALTER TABLE expenses ADD COLUMN reference_id INTEGER;
