// server/db/database.js
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('./migrate');

// Database location — DB_PATH lets tests (and alternative deployments) point
// at a different file instead of the bundled db/data directory
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'data', 'travel-companion.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = sqlite3(dbPath);
db.pragma('foreign_keys = ON');

/**
 * Bring the database schema up to date (see db/migrations/).
 */
async function initializeDatabase() {
  try {
    await runMigrations(db);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

module.exports = {
  db,
  initializeDatabase
};
