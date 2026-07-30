-- Field status for brainstorm ideas, in two scopes:
--  - group facts on the item ("we did this" / "we're skipping this"),
--    with who recorded them
--  - per-user rows for personal "done for me" / "I'll pass" that don't
--    affect the rest of the group
-- Both feed the nearby-recommendations view and the recap stats.
ALTER TABLE brainstorm_items ADD COLUMN done_at TIMESTAMP;
ALTER TABLE brainstorm_items ADD COLUMN done_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE brainstorm_items ADD COLUMN dismissed_at TIMESTAMP;
ALTER TABLE brainstorm_items ADD COLUMN dismissed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS brainstorm_item_user_status (
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('done', 'dismissed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, user_id),
  FOREIGN KEY (item_id) REFERENCES brainstorm_items (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
