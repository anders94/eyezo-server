const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Database path in ~/.local/video-server/database.sqlite
const DB_DIR = path.join(os.homedir(), '.local', 'video-server');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

// Ensure database directory exists
function ensureDatabaseDirectory() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Initialize database connection
function initDatabase() {
  ensureDatabaseDirectory();

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');

  // Create schema
  createSchema(db);

  return db;
}

// Create database schema
function createSchema(db) {
  // Videos table: stores metadata for scanned videos
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT UNIQUE NOT NULL,
      absolute_path TEXT NOT NULL,
      file_size INTEGER,
      modified_time INTEGER,
      duration REAL,
      width INTEGER,
      height INTEGER,
      codec TEXT,
      bitrate INTEGER,
      has_thumbnail INTEGER DEFAULT 0,
      thumbnail_path TEXT,
      last_scanned INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_relative_path ON videos(relative_path);
    CREATE INDEX IF NOT EXISTS idx_videos_modified_time ON videos(modified_time);
  `);

  // Configuration table: stores server settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Initial config values
  db.exec(`
    INSERT OR IGNORE INTO config (key, value) VALUES
      ('video_root_path', ''),
      ('server_version', '1.0.0'),
      ('last_full_scan', '0');
  `);

  // Scan history table: tracks scanning operations
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_type TEXT NOT NULL,
      path TEXT,
      videos_found INTEGER DEFAULT 0,
      thumbnails_generated INTEGER DEFAULT 0,
      duration_seconds REAL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'running'
    );
  `);
}

// Get database instance (singleton)
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

// Close database connection
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
  DB_PATH,
  DB_DIR
};
