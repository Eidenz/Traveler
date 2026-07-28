// 001_baseline.js
// Folds the original hand-rolled schema plus its 12 boot-time migrations into
// a single baseline. This is a JS migration (not plain SQL) on purpose: it
// must bring BOTH kinds of database to the same state —
//
//   - a fresh install (no tables): the CREATE TABLE statements below carry the
//     full current schema, so the column-adds are no-ops
//   - an existing production database (full schema, user_version 0): the
//     CREATEs are no-ops and the idempotent column-adds/backfills — the exact
//     logic that ran on every boot before the runner existed — top it up
//
// Never edit this file to change the schema; add a new NNN_*.sql migration.

function addColumnIfMissing(db, table, column, definition) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((col) => col.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      profile_image TEXT,
      resetPasswordToken TEXT,
      resetPasswordExpires INTEGER,
      receiveEmails INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      cover_image TEXT,
      owner_id INTEGER NOT NULL,
      public_share_token TEXT,
      is_brainstorm_public INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (trip_id, user_id),
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transportation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      type TEXT NOT NULL,
      company TEXT,
      from_location TEXT NOT NULL,
      to_location TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      departure_time TEXT,
      arrival_date TEXT,
      arrival_time TEXT,
      confirmation_code TEXT,
      notes TEXT,
      banner_image TEXT,
      from_latitude REAL,
      from_longitude REAL,
      to_latitude REAL,
      to_longitude REAL,
      from_location_disabled INTEGER DEFAULT 0,
      to_location_disabled INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lodging (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      confirmation_code TEXT,
      notes TEXT,
      banner_image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT,
      confirmation_code TEXT,
      notes TEXT,
      banner_image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_type TEXT NOT NULL CHECK(reference_type IN ('trip', 'transportation', 'lodging', 'activity')),
      reference_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      is_personal INTEGER DEFAULT 0,
      url TEXT,
      trip_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
      -- Note: Cannot directly reference trip/transportation/etc. due to mixed types
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      is_personal INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      note TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped')),
      collective_status TEXT DEFAULT 'pending' CHECK(collective_status IN ('pending', 'partial', 'complete')),
      updated_by INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists (id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_item_user_status (
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'checked', 'skipped')),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (item_id, user_id),
      FOREIGN KEY (item_id) REFERENCES checklist_items (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT DEFAULT '$',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personal_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT DEFAULT '$',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE (trip_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS personal_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personal_budget_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (personal_budget_id) REFERENCES personal_budgets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brainstorm_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('place', 'note', 'image', 'link', 'idea')),
      title TEXT,
      content TEXT,
      url TEXT,
      image_path TEXT,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      position_x REAL DEFAULT 100,
      position_y REAL DEFAULT 100,
      color TEXT,
      priority INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brainstorm_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      title TEXT,
      color TEXT DEFAULT '#e5e7eb',
      position_x REAL DEFAULT 100,
      position_y REAL DEFAULT 100,
      width REAL DEFAULT 300,
      height REAL DEFAULT 300,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      last_used_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      updater_id INTEGER NOT NULL,
      update_type TEXT NOT NULL CHECK(update_type IN ('activity', 'transportation', 'lodging', 'checklist')),
      update_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (updater_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  // Column top-ups for databases created before each feature landed
  addColumnIfMissing(db, 'users', 'resetPasswordToken', 'TEXT');
  addColumnIfMissing(db, 'users', 'resetPasswordExpires', 'INTEGER');
  addColumnIfMissing(db, 'users', 'receiveEmails', 'INTEGER DEFAULT 1');

  addColumnIfMissing(db, 'trips', 'public_share_token', 'TEXT');
  addColumnIfMissing(db, 'trips', 'is_brainstorm_public', 'INTEGER DEFAULT 0');

  addColumnIfMissing(db, 'transportation', 'banner_image', 'TEXT');
  addColumnIfMissing(db, 'transportation', 'from_latitude', 'REAL');
  addColumnIfMissing(db, 'transportation', 'from_longitude', 'REAL');
  addColumnIfMissing(db, 'transportation', 'to_latitude', 'REAL');
  addColumnIfMissing(db, 'transportation', 'to_longitude', 'REAL');
  addColumnIfMissing(db, 'transportation', 'from_location_disabled', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'transportation', 'to_location_disabled', 'INTEGER DEFAULT 0');

  addColumnIfMissing(db, 'lodging', 'banner_image', 'TEXT');
  addColumnIfMissing(db, 'activities', 'banner_image', 'TEXT');

  addColumnIfMissing(db, 'documents', 'is_personal', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'documents', 'url', 'TEXT');

  addColumnIfMissing(db, 'checklists', 'is_personal', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'brainstorm_items', 'priority', 'INTEGER DEFAULT 0');

  // Repair reference_ids stored as '3.0' (numeric ids sent as JSON numbers
  // were bound as doubles and stringified by the TEXT column). Must run before
  // the trip_id backfill below, which joins on reference_id.
  db.prepare(`
    UPDATE documents
    SET reference_id = CAST(CAST(reference_id AS INTEGER) AS TEXT)
    WHERE reference_id LIKE '%.0' AND reference_id NOT LIKE 'trip_%'
  `).run();

  // documents.trip_id: add + backfill from the referenced entity. The backfill
  // must only run when the column was just added, so the missing-column check
  // doubles as the guard.
  const hasTripId = db
    .prepare('PRAGMA table_info(documents)')
    .all()
    .some((col) => col.name === 'trip_id');
  if (!hasTripId) {
    db.exec(`ALTER TABLE documents ADD COLUMN trip_id TEXT`);
    db.exec(`
      UPDATE documents SET trip_id = reference_id WHERE reference_type = 'trip';
      UPDATE documents SET trip_id = (SELECT trip_id FROM activities WHERE id = documents.reference_id)
        WHERE reference_type = 'activity';
      UPDATE documents SET trip_id = (SELECT trip_id FROM transportation WHERE id = documents.reference_id)
        WHERE reference_type = 'transportation';
      UPDATE documents SET trip_id = (SELECT trip_id FROM lodging WHERE id = documents.reference_id)
        WHERE reference_type = 'lodging';
    `);
  }
}

module.exports = { up };
