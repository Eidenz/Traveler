-- Real group membership for brainstorm items. Until now a "group" was only
-- a decorative rectangle rendered behind items; items now belong to a group,
-- which makes group drags move their members and containment survive
-- reorganisation. NULL = ungrouped, which is what every existing item is —
-- boards render exactly as before.
ALTER TABLE brainstorm_items ADD COLUMN group_id INTEGER REFERENCES brainstorm_groups(id) ON DELETE SET NULL;
