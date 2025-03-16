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
  return new Promise(async (resolve, reject) => {
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
          id TEXT PRIMARY KEY,
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

      // Create Transportation table with banner_image field
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
          banner_image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Lodging table with banner_image field
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
          banner_image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Activities table with banner_image field
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
          banner_image TEXT,
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

      // Create Checklists table
      db.exec(`
        CREATE TABLE IF NOT EXISTS checklists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_by INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create Checklist Items table
      db.exec(`
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
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS checklist_item_user_status (
          item_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'checked', 'skipped')),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (item_id, user_id),
          FOREIGN KEY (item_id) REFERENCES checklist_items (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Run migrations for existing databases
      await runFieldMigrations();

      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
}

/**
 * Run migrations that add fields to existing tables if they don't exist
 */
async function runFieldMigrations() {
  try {
    // Check and add banner_image field to transportation table if it doesn't exist
    migrateField('transportation', 'banner_image');
    
    // Check and add banner_image field to lodging table if it doesn't exist
    migrateField('lodging', 'banner_image');
    
    // Check and add banner_image field to activities table if it doesn't exist
    migrateField('activities', 'banner_image');
    
    console.log('Field migrations completed');
  } catch (error) {
    console.error('Error running field migrations:', error);
  }
}

/**
 * Helper function to migrate a field to a table if it doesn't exist
 * @param {string} tableName - Name of the table
 * @param {string} fieldName - Name of the field to add
 */
function migrateField(tableName, fieldName) {
  try {
    // First check if the field already exists in the table
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const fieldExists = tableInfo.some(column => column.name === fieldName);
    
    if (!fieldExists) {
      console.log(`Adding ${fieldName} field to ${tableName} table`);
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${fieldName} TEXT;`);
    } else {
      console.log(`Field ${fieldName} already exists in ${tableName} table`);
    }
  } catch (error) {
    console.error(`Error migrating field ${fieldName} to ${tableName}:`, error);
    throw error;
  }
}

module.exports = {
  db,
  initializeDatabase
};