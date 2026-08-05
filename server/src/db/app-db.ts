import fs from 'node:fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config, paths } from '../config.js';

for (const dir of [paths.active, paths.backups, paths.temporary, paths.photos]) fs.mkdirSync(dir, { recursive: true });
export const appDb = new Database(paths.appDb);
appDb.pragma('journal_mode = WAL');
appDb.pragma('foreign_keys = ON');
appDb.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')), is_active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS database_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_type TEXT NOT NULL UNIQUE CHECK(source_type IN ('hardware_configurator','manufacturing_log')), active_file_path TEXT, original_file_name TEXT, file_size_bytes INTEGER, uploaded_at TEXT, uploaded_by INTEGER, validation_status TEXT, validation_message TEXT, integrity_check_result TEXT, record_count INTEGER, schema_fingerprint TEXT, FOREIGN KEY(uploaded_by) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS display_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, section_key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, sort_order INTEGER NOT NULL, is_visible INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS display_fields (id INTEGER PRIMARY KEY AUTOINCREMENT, field_key TEXT NOT NULL UNIQUE, section_key TEXT NOT NULL, label TEXT NOT NULL, sort_order INTEGER NOT NULL, is_visible INTEGER NOT NULL DEFAULT 1, is_highlighted INTEGER NOT NULL DEFAULT 0, unit TEXT, decimal_places INTEGER, help_text TEXT);
CREATE TABLE IF NOT EXISTS application_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details TEXT, ip_address TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS valve_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, valve_id INTEGER NOT NULL, stored_file_name TEXT NOT NULL, original_file_name TEXT, caption TEXT, photo_type TEXT, is_primary INTEGER NOT NULL DEFAULT 0, uploaded_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(uploaded_by) REFERENCES users(id));
`);
const sections = [['identification','Identification',10],['keyed','Keyed Stem',20],['flat','Flat Stem',30],['manufacturing','Manufacturing Summary',40]] as const;
const fields: Array<[string,string,string,number]> = [
 ['valve.valve_id','identification','Valve ID',10],['valve.valve_brand','identification','Brand',20],['valve.valve_size','identification','Size',30],['valve.valve_class','identification','Class',40],['valve.valve_model_number','identification','Model Number',50],['valve.valve_port','identification','Port',60],['valve.stem_type','identification','Stem Type',70],['valve.description','identification','Description',80],
 ['keyed.stem_diameter','keyed','Stem Diameter',10],['keyed.stem_height','keyed','Stem Height',20],['keyed.key_qty','keyed','Key Quantity',30],['keyed.key_width','keyed','Key Width',40],['keyed.key_cross','keyed','Key Cross',50],['keyed.valve_bhc','keyed','Valve Bolt-hole Circle',60],['keyed.valve_hole_dia','keyed','Valve Hole Diameter',70],['keyed.valve_hole_qty','keyed','Valve Hole Quantity',80],['keyed.valve_start_angle','keyed','Valve Start Angle',90],
 ['flat.stem_height','flat','Stem Height',10],['flat.flat_width','flat','Flat Width',20],['flat.flat_depth','flat','Flat Depth',30],['flat.valve_bhc','flat','Valve Bolt-hole Circle',40],['flat.valve_hole_dia','flat','Valve Hole Diameter',50],['flat.valve_hole_qty','flat','Valve Hole Quantity',60],['flat.valve_start_angle','flat','Valve Start Angle',70],['flat.packing_flange','flat','Packing Flange',80],['flat.packing_flange_width','flat','Packing-flange Width',90],['flat.packing_flange_length','flat','Packing-flange Length',100],['flat.packing_flange_angle','flat','Packing-flange Angle',110],['flat.dia_reduction','flat','Diameter Reduction',120],['flat.dia_reduction_value','flat','Diameter-reduction Value',130],['flat.stem_thread','flat','Stem Thread',140],['flat.stem_thread_dia','flat','Stem-thread Diameter',150],['flat.stem_thread_depth','flat','Stem-thread Depth',160],['flat.u_bolt','flat','U-bolt',170],['flat.u_bolt_valve_width','flat','U-bolt Valve Width',180],['flat.u_bolt_valve_length','flat','U-bolt Valve Length',190],['flat.valve_pattern_type','flat','Valve Pattern Type',200],['flat.valve_grid_x_distance','flat','Grid X Distance',210],['flat.valve_grid_y_distance','flat','Grid Y Distance',220]
];
const insertSection = appDb.prepare('INSERT OR IGNORE INTO display_sections(section_key,label,sort_order) VALUES (?,?,?)');
const insertField = appDb.prepare('INSERT OR IGNORE INTO display_fields(field_key,section_key,label,sort_order) VALUES (?,?,?,?)');
appDb.transaction(() => { sections.forEach(s => insertSection.run(...s)); fields.forEach(f => insertField.run(...f)); })();

export async function ensureInitialAdmin() {
  const count = (appDb.prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n;
  if (!count && config.initialAdminUsername && config.initialAdminPassword) {
    if (config.initialAdminPassword.length < 12) throw new Error('INITIAL_ADMIN_PASSWORD must be at least 12 characters');
    const hash = await bcrypt.hash(config.initialAdminPassword, 12);
    appDb.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'admin')").run(config.initialAdminUsername, hash);
  }
}
export function audit(userId:number|null, action:string, entityType?:string, entityId?:string, details?:unknown, ip?:string) {
  appDb.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details,ip_address) VALUES (?,?,?,?,?,?)').run(userId,action,entityType||null,entityId||null,details ? JSON.stringify(details):null,ip||null);
}
