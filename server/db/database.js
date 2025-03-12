// server/db/database.js
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'travel-companion.db');
const db = sqlite3(dbPath);

/**
 * Initialize database with all required tables
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      // Enable foreign keys
      db.pragma('foreign_keys = ON');

      // Create Users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          profile_image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create Trips table
      db.exec(`
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          location TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          cover_image TEXT,
          owner_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create Trip Members table (for shared trips)
      db.exec(`
        CREATE TABLE IF NOT EXISTS trip_members (
          trip_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (trip_id, user_id),
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create Transportation table
      db.exec(`
        CREATE TABLE IF NOT EXISTS transportation (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER NOT NULL,
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Lodging table
      db.exec(`
        CREATE TABLE IF NOT EXISTS lodging (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          address TEXT,
          check_in TEXT NOT NULL,
          check_out TEXT NOT NULL,
          confirmation_code TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Activities table
      db.exec(`
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT,
          location TEXT,
          confirmation_code TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Documents table (for attachments)
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_type TEXT NOT NULL CHECK(reference_type IN ('trip', 'transportation', 'lodging', 'activity')),
          reference_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          uploaded_by INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
}

module.exports = {
  db,
  initializeDatabase
};