import Database from 'better-sqlite3';
import { appDb } from './app-db.js';
import type { DatabaseSourceType } from '../../../shared/types/index.js';

export function activePath(type: DatabaseSourceType): string | null {
  const row = appDb.prepare('SELECT active_file_path FROM database_sources WHERE source_type=?').get(type) as {active_file_path:string|null}|undefined;
  return row?.active_file_path || null;
}
export function openSource(type: DatabaseSourceType): Database.Database {
  const file = activePath(type);
  if (!file) throw Object.assign(new Error(`${type} database is not active`), { status: 503 });
  const db = new Database(file, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  return db;
}
export function withSource<T>(type: DatabaseSourceType, fn:(db:Database.Database)=>T):T {
  const db = openSource(type); try { return fn(db); } finally { db.close(); }
}
