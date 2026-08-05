import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
export const config = {
  port: Number(process.env.PORT || 3001),
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'development-only-change-this-secret-now',
  initialAdminUsername: process.env.INITIAL_ADMIN_USERNAME,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 100) * 1024 * 1024,
  production: process.env.NODE_ENV === 'production'
};
export const paths = {
  dataDir: DATA_DIR,
  appDb: path.join(DATA_DIR, 'app.db'), active: path.join(DATA_DIR, 'active'),
  backups: path.join(DATA_DIR, 'backups'), temporary: path.join(DATA_DIR, 'temporary'), photos: path.join(DATA_DIR, 'photos')
};
