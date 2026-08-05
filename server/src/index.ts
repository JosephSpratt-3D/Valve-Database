import { createApp } from './app.js';
import { ensureInitialAdmin } from './db/app-db.js';
import { config } from './config.js';
await ensureInitialAdmin();
createApp().listen(config.port,()=>console.log(`Valve Database Viewer API listening on http://localhost:${config.port}`));
