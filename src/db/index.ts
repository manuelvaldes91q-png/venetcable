import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DB_PATH || "./data/mikrotik-monitor.db";

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: ReturnType<typeof Database> | null = null;
let _migrated = false;

function ensureDb() {
  if (_db) return _db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _db = drizzle(_sqlite, { schema });

  if (!_migrated) {
    _migrated = true;
    try {
      migrate(_db, { migrationsFolder: "./src/db/migrations" });
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  return _db;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  return ensureDb();
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_, prop) {
    const database = ensureDb();
    const value = Reflect.get(database, prop);
    if (typeof value === "function") {
      return value.bind(database);
    }
    return value;
  },
});
