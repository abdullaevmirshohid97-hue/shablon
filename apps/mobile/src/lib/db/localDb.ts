import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('mubosher-offline.db');
  }
  return dbPromise;
}

/**
 * Adds a column if the table doesn't have it yet — SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, and existing installs carry the old schema,
 * so every new column must go through here as well as CREATE TABLE.
 */
async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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
      due_date TEXT,
      description TEXT,
      quantity REAL,
      unit TEXT,
      quantity_kg REAL,
      quantity_dona REAL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'fabrika',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      last_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
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
      unit TEXT,
      kind TEXT NOT NULL DEFAULT 'other'
    );

    CREATE TABLE IF NOT EXISTS cached_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      counterparty_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS cached_transactions_counterparty_idx
      ON cached_transactions (counterparty_id, occurred_at);

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  // Upgrade path for installs created before these columns existed.
  await ensureColumn(db, 'pending_transactions', 'due_date', 'TEXT');
  await ensureColumn(db, 'pending_transactions', 'quantity_kg', 'REAL');
  await ensureColumn(db, 'pending_transactions', 'quantity_dona', 'REAL');
  await ensureColumn(db, 'pending_transactions', 'last_error', 'TEXT');
  await ensureColumn(db, 'pending_transactions', 'attempts', 'INTEGER NOT NULL DEFAULT 0');
  // Set when the server refused the row for good (e.g. RLS: the signed-in
  // user is a manager and may not write) — such rows must stop being retried.
  await ensureColumn(db, 'pending_transactions', 'rejected_at', 'TEXT');
  await ensureColumn(db, 'cached_categories', 'kind', "TEXT NOT NULL DEFAULT 'other'");

  return db;
}

export async function getLocalDb() {
  return openDb();
}
