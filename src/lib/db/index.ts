import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '@/lib/env';
import { MIGRATIONS } from './migrations';

declare global {
  // نحتفظ بالاتصال على globalThis كي لا يتكرر مع إعادة التحميل في التطوير
  var __basmaDb: Database.Database | undefined;
}

export function dataDir(): string {
  return path.resolve(process.cwd(), getEnv().DATA_DIR);
}

export function imagesDir(): string {
  return path.join(dataDir(), 'images');
}

function ensureDirs() {
  fs.mkdirSync(imagesDir(), { recursive: true });
}

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`);
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>).map((r) => r.name),
  );
  const insert = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.name, Date.now());
    })();
    console.log(`[db] applied migration ${m.name}`);
  }
}

export function getDb(): Database.Database {
  if (globalThis.__basmaDb) return globalThis.__basmaDb;
  ensureDirs();
  const file = path.join(dataDir(), 'basma.db');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  globalThis.__basmaDb = db;
  return db;
}

export function now(): number {
  return Date.now();
}
