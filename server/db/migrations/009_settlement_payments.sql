-- Recorded settlement payments ("A paid B X"). Settlement math nets these
-- against the balances derived from expenses, so marking a transfer as paid
-- shrinks/clears it and drives the settle-up progress bar.
CREATE TABLE IF NOT EXISTS settlement_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  from_user INTEGER NOT NULL,
  to_user INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
  FOREIGN KEY (from_user) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (to_user) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
);
