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
          resetPasswordToken TEXT,
          resetPasswordExpires INTEGER,
          receiveEmails INTEGER DEFAULT 1, -- Added for email preferences (1 = true, 0 = false)
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
          trip_id TEXT NOT NULL,
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Lodging table with banner_image field
      db.exec(`
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
        )
      `);

      // Create Activities table with banner_image field
      db.exec(`
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
        )
      `);

      // Create Documents table (for attachments)
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_type TEXT NOT NULL CHECK(reference_type IN ('trip', 'transportation', 'lodging', 'activity')),
          reference_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          uploaded_by INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
          -- Note: Cannot directly reference trip/transportation/etc. due to mixed types
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

      // Create Budgets table
      db.exec(`
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT NOT NULL,
          total_amount REAL NOT NULL,
          currency TEXT DEFAULT '$',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        )
      `);

      // Create Expenses table
      db.exec(`
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
        )
      `);

      // Create Personal Budgets table
      db.exec(`
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
        )
      `);

      // Create Personal Expenses table
      db.exec(`
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
        )
      `);


      // Run migrations for existing databases
      await runFieldMigrations();
      await runPasswordResetMigration();
      await runEmailPreferenceMigration(); // Add email preference migration
      await runPublicShareMigration(); // Add public share token migration
      await runPersonalDocumentsMigration(); // Add personal documents migration

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
    migrateField('transportation', 'banner_image', 'TEXT');
    migrateField('lodging', 'banner_image', 'TEXT');
    migrateField('activities', 'banner_image', 'TEXT');
    console.log('Field migrations completed');
  } catch (error) {
    console.error('Error running field migrations:', error);
  }
}

/**
 * Migration for password reset fields
 */
async function runPasswordResetMigration() {
  try {
    migrateField('users', 'resetPasswordToken', 'TEXT');
    migrateField('users', 'resetPasswordExpires', 'INTEGER');
    console.log('Password reset field migration completed');
  } catch (error) {
    console.error('Error running password reset migration:', error);
  }
}

/**
 * Migration for email preference field
 */
async function runEmailPreferenceMigration() {
  try {
    migrateField('users', 'receiveEmails', 'INTEGER DEFAULT 1');
    console.log('Email preference field migration completed');
  } catch (error) {
    console.error('Error running email preference migration:', error);
  }
}

/**
 * Migration for public share token field
 */
async function runPublicShareMigration() {
  try {
    migrateField('trips', 'public_share_token', 'TEXT');
    console.log('Public share token field migration completed');
  } catch (error) {
    console.error('Error running public share token migration:', error);
  }
}

/**
 * Migration for personal documents field
 */
async function runPersonalDocumentsMigration() {
  try {
    migrateField('documents', 'is_personal', 'INTEGER DEFAULT 0');
    console.log('Personal documents field migration completed');
  } catch (error) {
    console.error('Error running personal documents migration:', error);
  }
}



/**
 * Helper function to migrate a field to a table if it doesn't exist
 * @param {string} tableName - Name of the table
 * @param {string} fieldName - Name of the field to add
 * @param {string} fieldDefinition - Data type and constraints (e.g., TEXT, INTEGER DEFAULT 1)
 */
function migrateField(tableName, fieldName, fieldDefinition) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const fieldExists = tableInfo.some(column => column.name === fieldName);

    if (!fieldExists) {
      console.log(`Adding ${fieldName} field to ${tableName} table`);
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${fieldDefinition};`);
    } else {
      // console.log(`Field ${fieldName} already exists in ${tableName} table`);
    }
  } catch (error) {
    console.error(`Error migrating field ${fieldName} to ${tableName}:`, error);
    throw error;
  }
}

// --- Ensure trip_id columns are TEXT if they weren't before ---
function ensureTripIdIsText(tableName) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const tripIdColumn = tableInfo.find(column => column.name === 'trip_id');

    if (tripIdColumn && tripIdColumn.type !== 'TEXT') {
      console.warn(`Attempting to migrate ${tableName}.trip_id to TEXT. This might require manual data migration if there are foreign key constraints or existing data issues.`);
      console.warn(`Manual migration might be needed for ${tableName}.trip_id column type.`);
    } else if (!tripIdColumn) {
      console.warn(`Column trip_id not found in ${tableName}. Ensure schema is correct.`);
    }
  } catch (error) {
    console.error(`Error checking/migrating trip_id column type for ${tableName}:`, error);
  }
}

module.exports = {
  db,
  initializeDatabase
};