// server/db/migrate.js
// Minimal migration runner backed by SQLite's built-in PRAGMA user_version.
//
// Migrations live in server/db/migrations/ as NNN_name.sql (executed as-is) or
// NNN_name.js (module exporting { up(db) }). On boot, every migration with a
// version above the database's user_version is applied in order, each inside
// its own transaction that also bumps user_version — so a failed migration
// rolls back completely and the server refuses to start.
//
// Production safety: before applying anything to a non-empty database, a
// backup is taken with db.backup() (correct even under WAL) next to the
// database file. The newest KEEP_BACKUPS backups are retained.

const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const KEEP_BACKUPS = 5;

function loadMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.(sql|js)$/.test(f))
    .sort();

  const seen = new Set();
  return files.map((file) => {
    const version = parseInt(file.slice(0, 3), 10);
    if (version === 0) {
      throw new Error(`Migration version must be >= 1: ${file}`);
    }
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version ${version} (${file})`);
    }
    seen.add(version);
    return { version, file };
  });
}

async function backupDatabase(db, currentVersion) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${db.name}.bak-v${currentVersion}-${stamp}`;
  await db.backup(dest);

  // Prune old backups, newest first by the sortable timestamp in the name
  const dir = path.dirname(db.name);
  const base = path.basename(db.name);
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.bak-`))
    .sort()
    .reverse();
  for (const old of backups.slice(KEEP_BACKUPS)) {
    fs.unlinkSync(path.join(dir, old));
  }

  return dest;
}

async function runMigrations(db) {
  const migrations = loadMigrations();
  const latest = migrations.length ? migrations[migrations.length - 1].version : 0;
  const current = db.pragma('user_version', { simple: true });

  if (current > latest) {
    // Database written by a newer build — leave it alone rather than guess
    console.warn(
      `Database schema version ${current} is newer than this build (${latest}); skipping migrations`
    );
    return;
  }

  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return;

  // Only back up databases that already hold data; a brand-new file has
  // nothing to lose (and pre-migration prod databases sit at user_version 0,
  // so "has a users table" is the reliable signal, not the version number)
  const hasData = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  if (hasData && !db.memory) {
    const dest = await backupDatabase(db, current);
    console.log(`Pre-migration backup written to ${dest}`);
  }

  for (const m of pending) {
    const fullPath = path.join(MIGRATIONS_DIR, m.file);
    const apply = m.file.endsWith('.sql')
      ? () => db.exec(fs.readFileSync(fullPath, 'utf8'))
      : () => require(fullPath).up(db);

    db.transaction(() => {
      apply();
      db.pragma(`user_version = ${m.version}`);
    })();

    console.log(`Applied migration ${m.file}`);
  }
}

module.exports = { runMigrations };
