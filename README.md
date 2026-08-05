# Valve Database Viewer

Valve Database Viewer is a browser-only GitHub Pages application for viewing the two known Fusion 360 configurator SQLite schemas. It does not require an application server.

Live site after Pages is enabled:

`https://josephspratt-3d.github.io/Valve-Database/`

## How the GitHub Pages version works

- SQLite runs inside the browser through `sql.js` WebAssembly.
- The public active databases live at `client/public/data/active/`.
- Accounts, display configuration, source metadata, and audit events live in `client/public/data/settings.json`.
- Administrator writes use GitHub's Contents API and create normal commits on `main`.
- The supplied GitHub Actions workflow rebuilds and redeploys Pages after each commit.
- A fine-grained GitHub token is kept only in `sessionStorage`. It is never written into the repository or build output.
- Database bytes are also cached in IndexedDB so an upload works immediately while Pages redeploys.

## Enable GitHub Pages

1. Open the repository on GitHub.
2. Select **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Open **Actions → Deploy GitHub Pages** and run the workflow, or push to `main`.
5. After deployment, open the live URL above—not the repository URL.

The repository URL displays this README by design. The application URL uses the `github.io` domain.

## First-run setup

The committed settings file initially has no users. On the deployed `/login` screen:

1. Enter the first administrator username and a password of at least 12 characters.
2. Enter a fine-grained GitHub personal access token.
3. Submit the form. The application hashes the password and commits the administrator record to `client/public/data/settings.json`.

Create the token at GitHub under **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Restrict it to `JosephSpratt-3D/Valve-Database` and grant:

- **Contents: Read and write**
- **Metadata: Read-only**

The account password hash is public and the client-side login can be bypassed by a knowledgeable visitor. This login is an intentional convenience gate, not secure access control.

## Upload source databases

Sign in as an administrator and open **Databases**. Selecting a database performs browser-side SQLite/schema validation, then commits it to:

- `client/public/data/active/hardware_configurator.db`
- `client/public/data/active/manufacturing_log.db`

The application supports `.db`, `.sqlite`, and `.sqlite3` files up to 50 MB. Because this is a public repository, uploaded databases and settings are publicly downloadable.

Use **Load working demo** to commit both included fictional demo databases. The demo contains keyed and flat valves, multiple sizes/classes, manufacturing history, unit-bearing text, a valve with no history, and an intentional historical model mismatch linked by `valve_id`.

GitHub Pages may take a minute or two to redeploy after a commit. The current browser uses its IndexedDB copy immediately.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Repository writes still target the configured GitHub repository and require a fine-grained token.

Build the exact static site with:

```bash
GITHUB_ACTIONS=true npm run build
npm start
```

## Project layout

```text
.github/workflows/pages.yml       GitHub Pages deployment
client/src/local-backend.ts       Browser SQLite, login, and GitHub API layer
client/src/main.tsx                Viewer and administration interface
client/public/data/settings.json   Repository-local accounts and settings
client/public/data/active/         Active public SQLite databases
client/public/data/demo/           Fictional bundled databases
server/                            Legacy local-server code and schema generator
```

## Important limitations

- The static login does not protect public files or provide real authorization.
- Password hashes and account names are public repository data.
- Anyone with a suitable repository token can write repository contents.
- Settings and database uploads create Git commits and trigger Pages builds.
- GitHub API rate limits and repository file-size limits apply.
- Concurrent administrators can overwrite each other's settings changes.
- HTTP-only sessions, server-side CSRF protection, private database storage, and secure password recovery are impossible on GitHub Pages alone.

The former Express implementation remains in `server/` as a local/private deployment option and provides the exact demo schema generator, but it is not used by the GitHub Pages runtime.
