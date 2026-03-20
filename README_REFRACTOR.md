# Dashboard refactor (first pass)

This package converts the original one-file dashboard into a smaller, AI-friendlier structure:

- `index.html` → app shell only
- `styles/app.css` → all CSS
- `scripts/service-worker-init.js` → service worker bootstrap
- `scripts/firebase.js` → Firebase setup and exports
- `scripts/constants.js` → large static data/constants
- `scripts/app.js` → main application logic

## Why this is a good first pass

It preserves the original app structure while making edits cheaper:

- HTML edits no longer require sending the CSS and JS blob
- Firebase wiring is isolated
- large constant arrays are isolated
- most future UI work can happen in `app.css`
- most future logic work can happen in `app.js`

## Suggested next split

When you want the next pass, split `scripts/app.js` into:

- `scripts/state.js`
- `scripts/storage.js`
- `scripts/renderJournal.js`
- `scripts/renderDashboard.js`
- `scripts/features/journal.js`
- `scripts/features/planner.js`
- `scripts/features/batches.js`

## Deployment note

This folder assumes `manifest.json` and `sw.js` still exist at site root, same as the original file referenced them.


Phase 4:
- Extracted Today, March, and Progress tab render functions into scripts/renderTabs.js
- app.js now uses thin wrappers for those render modules


Phase 5 split:
- Added scripts/renderExtras.js
- Moved CRM and Vault tab render functions into a dedicated module
