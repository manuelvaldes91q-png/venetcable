import { createDatabase } from "@kilocode/app-builder-db";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let _db: SqliteRemoteDatabase<typeof schema> | null = null;

export function getDb(): SqliteRemoteDatabase<typeof schema> {
  if (!_db) {
    _db = createDatabase(schema);
  }
  return _db;
}

export const db = new Proxy({} as SqliteRemoteDatabase<typeof schema>, {
  get(_, prop) {
    const database = getDb();
    const value = Reflect.get(database, prop);
    if (typeof value === "function") {
      return value.bind(database);
    }
    return value;
  },
});
