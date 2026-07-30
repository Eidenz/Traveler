-- Who takes part in a transport / lodging / activity. Rows exist only when a
-- SUBSET of the trip is selected — an item with no rows applies to everyone,
-- which keeps every pre-existing item valid without a backfill.
-- No FK to the item tables (polymorphic); controllers clean rows up on delete.
CREATE TABLE IF NOT EXISTS item_participants (
  item_type TEXT NOT NULL CHECK(item_type IN ('activity', 'lodging', 'transportation')),
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_type, item_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
