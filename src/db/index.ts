import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const rawDbPath = process.env.DATABASE_PATH || process.env.DATABASE_URL || "./data/database.sqlite";
const DATABASE_PATH = rawDbPath.startsWith("file:") ? rawDbPath.replace(/^file:/, "") : rawDbPath;

const dbDir = path.dirname(path.resolve(DATABASE_PATH));
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {}
}

const sqlite = new Database(DATABASE_PATH);

try {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
} catch {}

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
