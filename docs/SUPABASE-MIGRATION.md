# Supabase migration plan

The current application deliberately keeps storage concerns behind repositories and services. The React application calls only the Express API, so a migration does not require rewriting viewer or administration components.

## Replacement map

| Local implementation | Supabase implementation | Migration responsibility |
|---|---|---|
| `LocalAuthService` / local user-session routes | `SupabaseAuthService` | Users, roles, login/logout, session verification |
| `SQLiteValveRepository` | `SupabaseValveRepository` | Cascading selectors and valve/stem detail |
| `SQLiteManufacturingRepository` | `SupabaseManufacturingRepository` | ID-based history and latest summary |
| `SQLiteDisplaySettingsRepository` / app-db queries | `SupabaseDisplaySettingsRepository` | Sections, stable field keys, formatting settings |
| `LocalPhotoStorageService` contract | `SupabaseStorageService` | Object storage plus photo metadata |

## Data model

Import the two known source schemas into separate PostgreSQL schemas such as `configurator` and `manufacturing`. Keep application tables in `public` or an `app` schema. Preserve `valves.valve_id` as the authoritative key. Convert manufacturing `valve_id` cautiously during migration, retain the original source text if traceability requires it, and never rebuild the relationship from descriptive identity fields.

PostgreSQL numeric types are stricter than SQLite dynamic typing. Profile `universal_adapters` and all dimensional columns before choosing `numeric` precision. Manufacturing dimensions must remain text because they include source units.

## Authentication and authorization

Move accounts to Supabase Auth and store application roles in a profile/claims table. Recreate the current authorization policy with Row Level Security:

- authenticated users can read valve and manufacturing data;
- only administrators can manage users, display settings, imports, and audit data;
- storage policies scope photo writes to administrators and reads to authenticated users.

Do not mix the existing password hashes into public tables. Use a controlled account-invitation or password-reset migration.

## Repository implementation

Keep the current method signatures and response shapes. Implement each Supabase repository using the server SDK, parameterized filters, and explicit selected columns. Put the manufacturing column allowlist in server code just as the SQLite implementation does. A PostgreSQL view or RPC may implement the conditional keyed/flat join and manufacturing cross-validation efficiently.

Select the implementation through server configuration or dependency injection:

```ts
const valveRepository: ValveRepository = storage === 'supabase'
  ? new SupabaseValveRepository(client)
  : new SQLiteValveRepository();
```

The API route handlers and client remain unchanged.

## Display settings and audit data

Copy stable `field_key` values unchanged. They are application identities and must not depend on database column display names. Preserve section/field ordering, visibility, highlighting, units, decimal places, and help text. Move audit writes to a server-side function so clients cannot forge actor identity or timestamps.

## Photos

Create a private bucket, store objects under `{valve_id}/{random-name}`, and keep metadata in a relational table. Validate valve existence through `SupabaseValveRepository` before issuing an upload. Use signed URLs or authenticated downloads rather than a public bucket.

## Cutover

1. Provision a staging project and create schemas, indexes, RLS policies, and service roles.
2. Import source and application data, preserving valve IDs and source text.
3. Run row counts, unmatched-ID counts, identity mismatch counts, and repository contract tests against both implementations.
4. Exercise login, every role boundary, display configuration, and photo access.
5. Freeze local writes, perform the final delta import, switch repository configuration, and retain local databases as read-only rollback artifacts.

Supabase synchronization is intentionally outside the local version. Treat the migration as a controlled cutover, not bidirectional sync.
