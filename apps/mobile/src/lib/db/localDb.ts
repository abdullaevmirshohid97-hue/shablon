import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('mubosher-offline.db');
  }
  return dbPromise;
}

export async function initLocalDb() {
  const db = await openDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS pending_transactions (
      client_local_id TEXT PRIMARY KEY NOT NULL,
      org_id TEXT NOT NULL,
      counterparty_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      description TEXT,
      quantity REAL,
      unit TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cached_counterparties (
      id TEXT PRIMARY KEY NOT NULL,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      categories TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS cached_categories (
      id TEXT PRIMARY KEY NOT NULL,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT
    );
  `);
  return db;
}

export async function getLocalDb() {
  return openDb();
}
