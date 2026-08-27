import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: InstanceType<typeof Database> | null = null;

function initTables(sqliteInstance: InstanceType<typeof Database>) {
  sqliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_temp INTEGER NOT NULL DEFAULT 0,
      duration_hours INTEGER,
      expires_at TEXT,
      created_by_admin_id TEXT REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      avatar_url TEXT,
      pin_hash TEXT,
      is_main_profile INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      overview TEXT,
      genres TEXT,
      rating REAL,
      maturity_rating TEXT,
      duration_minutes INTEGER,
      backdrop_url TEXT,
      poster_url TEXT,
      trailer_url TEXT,
      tmdb_id INTEGER,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_codec TEXT,
      file_container TEXT,
      file_duration_seconds INTEGER,
      file_bitrate INTEGER,
      video_codec TEXT,
      video_width INTEGER,
      video_height INTEGER,
      audio_codec TEXT,
      thumbnail_path TEXT,
      backdrop_path TEXT,
      poster_path TEXT,
      needs_transcode INTEGER NOT NULL DEFAULT 0,
      scan_id TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL REFERENCES media(id),
      season_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      poster_url TEXT,
      poster_path TEXT,
      tmdb_id INTEGER,
      year INTEGER,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL REFERENCES media(id),
      season_id TEXT NOT NULL REFERENCES seasons(id),
      episode_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      duration_minutes INTEGER,
      still_url TEXT,
      still_path TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_codec TEXT,
      file_container TEXT,
      file_duration_seconds INTEGER,
      video_codec TEXT,
      video_width INTEGER,
      video_height INTEGER,
      audio_codec TEXT,
      tmdb_id INTEGER,
      thumbnail_path TEXT,
      needs_transcode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      media_id TEXT NOT NULL REFERENCES media(id),
      episode_id TEXT REFERENCES episodes(id),
      position_seconds INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      percent REAL NOT NULL DEFAULT 0,
      last_watched TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id),
      language TEXT DEFAULT 'en',
      autoplay_next INTEGER DEFAULT 1,
      default_quality TEXT DEFAULT 'auto',
      subtitle_enabled INTEGER DEFAULT 0,
      subtitle_language TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      media_found INTEGER DEFAULT 0,
      media_added INTEGER DEFAULT 0,
      media_updated INTEGER DEFAULT 0,
      media_skipped INTEGER DEFAULT 0,
      errors TEXT,
      started_at TEXT NOT NULL DEFAULT '',
      completed_at TEXT,
      triggered_by TEXT NOT NULL DEFAULT 'auto'
    );

    CREATE TABLE IF NOT EXISTS library_config (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_scan_at TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL REFERENCES profiles(id),
      accountId TEXT NOT NULL REFERENCES accounts(id),
      fingerprint TEXT NOT NULL,
      ipSubnet TEXT NOT NULL,
      userAgent TEXT,
      accessToken TEXT,
      refreshTokenHash TEXT,
      tokenVersion INTEGER NOT NULL DEFAULT 1,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT ''
    );
  `);

  // Ensure default admin exists
  try {
    const adminCount = sqliteInstance.prepare("SELECT count(*) as count FROM admins").get() as { count: number };
    if (adminCount.count === 0) {
      const adminId = uuidv4();
      const adminHash = bcrypt.hashSync("admin123", 10);
      sqliteInstance.prepare("INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
        adminId,
        "admin",
        adminHash,
        new Date().toISOString()
      );
      console.log("👑 Initialized default admin account: admin / admin123");
    }
  } catch (err) {
    console.error("Admin bootstrap error:", err);
  }

  // Ensure default libraries exist
  try {
    const libCount = sqliteInstance.prepare("SELECT count(*) as count FROM library_config").get() as { count: number };
    if (libCount.count === 0) {
      const now = new Date().toISOString();
      sqliteInstance.prepare("INSERT INTO library_config (id, path, type, enabled, created_at) VALUES (?, ?, ?, ?, ?)").run(
        uuidv4(),
        "/media/movies",
        "movies",
        1,
        now
      );
      sqliteInstance.prepare("INSERT INTO library_config (id, path, type, enabled, created_at) VALUES (?, ?, ?, ?, ?)").run(
        uuidv4(),
        "/media/series",
        "series",
        1,
        now
      );
    }
  } catch {}
}

function getDbInstance() {
  if (!_db) {
    const rawDbPath = process.env.DATABASE_PATH || process.env.DATABASE_URL || "./data/database.sqlite";
    const DATABASE_PATH = rawDbPath.startsWith("file:") ? rawDbPath.replace(/^file:/, "") : rawDbPath;

    const dbDir = path.dirname(path.resolve(DATABASE_PATH));
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch {}
    }

    _sqlite = new Database(DATABASE_PATH);

    try {
      _sqlite.pragma("journal_mode = WAL");
      _sqlite.pragma("foreign_keys = ON");
    } catch {}

    // Bootstrap tables and admin automatically
    initTables(_sqlite);

    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
    const instance = getDbInstance();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export type DatabaseType = typeof db;
