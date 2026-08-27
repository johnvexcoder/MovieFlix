import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: InstanceType<typeof Database> | null = null;

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
