# CVS Controls Valve Database Uploader

The uploader is a portable Windows application that safely synchronizes the live Hardware Configurator and Manufacturing Log SQLite databases to the Valve Database Viewer repository.

## Download

1. Open the repository's **Actions** tab.
2. Select **Build Windows Uploader**.
3. Open the newest successful run.
4. Download `ValveDatabaseUploader-win-x64` from **Artifacts**.
5. Extract the ZIP and run `ValveDatabaseUploader.exe`.

The executable is self-contained. Git, Python, Visual Studio, and the .NET runtime are not required on the database computer. Because the executable is not code-signed, Windows SmartScreen may require **More info → Run anyway** the first time it is opened.

## First-time setup

1. Use **Browse** to select the Hardware Configurator database.
2. Use **Browse** to select the Manufacturing Log database.
3. Select **Validate** for each database.
4. Create a fine-grained GitHub token limited to `JosephSpratt-3D/Valve-Database` with **Contents: Read and write**.
5. Select **Set token**, paste the token, and save it.
6. Select **Test connection**.
7. Select **Sync both now** for the first upload.
8. Leave **Open uploader when I sign in to Windows** enabled and turn on **Automatic sync**.

The token is stored in Windows Credential Manager under `CVSControls.ValveDatabaseUploader.GitHubToken`. It is never written to `config.json` or the repository.

## Local files

Configuration and logs are stored under `%LOCALAPPDATA%\CVS Controls\Valve Database Uploader\`. Both database paths can be changed at any time with the file pickers.

## Safety behavior

- Waits for a database to remain unchanged before automatic upload.
- Uses SQLite's online backup mechanism instead of copying the live file.
- Runs `PRAGMA integrity_check` and exact schema validation.
- Skips unchanged files during automatic checks.
- Limits uploads to 50 MB.
- Refreshes `settings.json` so browsers do not reuse an older cached database.
- Retries when another repository update changes the GitHub file SHA.
- Keeps the source databases read-only and removes temporary snapshots.

Closing the window minimizes the uploader to the notification area while automatic synchronization is enabled. Use the tray icon's **Exit** command to stop it completely.

Automatic startup is enabled by default for new installations. The app registers the current executable under the signed-in user's Windows Startup settings, verifies the registration, repairs it after the executable is moved or replaced, and starts minimized in the notification area after Windows sign-in. The Automation card shows the live registration status.
