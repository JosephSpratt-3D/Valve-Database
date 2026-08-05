# GitHub Pages operations

The application is deployed by `.github/workflows/pages.yml`. It builds `client/dist` and uploads that directory as the Pages artifact.

## Repository configuration

`client/public/data/app-config.json` identifies the owner, repository, branch, and writable data paths. Update it if the repository is transferred or renamed. Also update the production `base` in `client/vite.config.ts` when the repository name changes.

## Administrator token

Use a fine-grained token limited to this repository with `Contents: Read and write`. The application calls:

- `GET /user` to verify the token;
- `GET /repos/{owner}/{repo}/contents/{path}` to find the current blob SHA;
- `PUT /repos/{owner}/{repo}/contents/{path}` to create commits.

The token is held in browser `localStorage` until the site's browser data is cleared or the token is rejected. An administrator is prompted again when a repository write is attempted without a saved token.

## Deployment timing

A database upload creates one commit for the database and another for source metadata. Loading both demo databases creates four commits. The workflow concurrency group cancels superseded builds, so the last commit produces the deployed state.

The uploader retains the current database in IndexedDB using the committed blob SHA. This makes the viewer immediately usable before the Pages build finishes.

## Recovery

All changes are normal Git commits. To recover settings or a database, restore the desired file version through GitHub and commit it to `main`. Do not place access tokens in any repository file.
