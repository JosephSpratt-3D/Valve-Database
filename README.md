# Valve Database Viewer

A complete local React/Express application for securely browsing valve configuration and manufacturing history stored in two externally managed SQLite databases. Uploaded source databases are never modified; application state lives separately in `server/data/app.db`.

## Architecture

- **React + TypeScript + Vite** client with protected viewer and role-restricted administration routes.
- **Express + TypeScript** API with Helmet, strict-origin CORS, Zod validation, login throttling, session regeneration, HTTP-only cookies, and session-bound CSRF tokens.
- **SQLite application database** for users, session storage, source metadata, display configuration, audit events, settings, and future photo metadata.
- **Read-only source repositories** for hardware and manufacturing databases. Repository interfaces isolate components from storage and permit a future Supabase implementation.
- **Upload pipeline** uses random temporary names, SQLite integrity and exact-column checks, domain integrity reports, backups, and atomic activation.

## Project tree

```text
client/                 React application
  src/                  routes, UI, API client, styling
server/
  src/db/               application/source database access
  src/repositories/     read-only source repositories
  src/services/         validation, activation, cross-validation
  src/scripts/          exact schemas and demo generator
  src/tests/            integration and security tests
  data/                  ignored local application/source data
shared/types/           shared domain contracts
docs/                   migration documentation
```

## Install and run

Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
# Edit .env before first launch.
npm run demo
npm run dev
```

Development URLs:

- Client: `http://localhost:5173`
- API: `http://localhost:3001/api`

For a production build:

```bash
npm run build
NODE_ENV=production npm start
```

The production server serves `client/dist`; run `npm start` from the repository root.

## Environment variables

| Name | Purpose | Default |
|---|---|---|
| `PORT` | Express port | `3001` |
| `CLIENT_ORIGIN` | Only allowed browser origin | `http://localhost:5173` |
| `SESSION_SECRET` | Cookie-session signing secret; use 32+ random characters | development-only fallback |
| `INITIAL_ADMIN_USERNAME` | First administrator username | none |
| `INITIAL_ADMIN_PASSWORD` | First administrator password (minimum 12 characters) | none |
| `MAX_UPLOAD_MB` | Multipart database size limit | `100` |
| `NODE_ENV` | Set to `production` for secure cookies and static client serving | `development` |
| `DATA_DIR` | Optional data location override, useful for tests/deployment | `server/data` |

### Initial administrator

On the first launch, when `users` is empty, the server creates the administrator from `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`. Credentials are not hard-coded. If the application database already has users, changing these variables does not overwrite them.

## Upload databases

1. Sign in as an administrator.
2. Open **Administration → Databases**.
3. Upload a `.db`, `.sqlite`, or `.sqlite3` file in its corresponding card.
4. Review the integrity, schema, row-count, and data-integrity report.
5. Once both are active, review the cross-database report.

The original filename is display metadata only. The upload is stored at a random temporary path, validated without writes, copied to a staged path, and atomically renamed. A failed upload cannot replace the active source. Previous active files are copied to `server/data/backups/` before replacement.

Generated demonstration sources are written to `server/data/demo/`. Upload `hardware_configurator.db` first and then `manufacturing_log.db`. They include keyed and flat valves, numeric-like selector sorting, repeated manufacturing, a valve without history, unit-bearing fields, and an intentionally different historical model snapshot tied to the correct `valve_id`.

## Tests

```bash
npm test
npm run build
```

The integration suite generates real SQLite databases from the specified schemas and covers validation failures, safe activation, stem joins, cascading selectors, numeric sorting, ID-based history, preserved unit strings and historical differences, authorization, CSRF, password-hash secrecy, and filename containment.

## Known limitations

- Photo storage has a complete metadata schema and reserved local directory, but this version does not expose photo upload UI/API.
- Timestamps are parsed as browser-local time. There is no configurable installation timezone yet; invalid source timestamps remain visible and are labeled invalid.
- Presentation ordering uses explicit integer order values instead of drag-and-drop.
- Source queries open short-lived read-only connections, favoring safe database replacement over connection pooling.
- Backups require administrator-managed retention; automatic pruning is intentionally absent.

## Supabase migration

See [docs/SUPABASE-MIGRATION.md](docs/SUPABASE-MIGRATION.md). The migration replaces repository/service implementations while retaining their contracts, API payloads, stable field keys, and React routes.
