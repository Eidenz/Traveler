-- Archived trips: hidden from default lists, excluded from reminder emails,
-- still fully editable (archiving is organization, not preservation).
ALTER TABLE trips ADD COLUMN archived_at TIMESTAMP;
