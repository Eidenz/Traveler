-- Group expense settlement: who paid, and who the expense is split between
-- (equal shares among participants). Both are optional — legacy expenses and
-- purely informational ones simply don't participate in settlement.
ALTER TABLE expenses ADD COLUMN paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS expense_splits (
  expense_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (expense_id, user_id),
  FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
