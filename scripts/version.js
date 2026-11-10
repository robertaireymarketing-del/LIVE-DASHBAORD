// Build stamp shown at the top of the Home page, so you can tell at a glance
// whether the phone is running the latest deploy.
// Netlify's build command (netlify.toml) replaces __BUILD__ on every deploy with
// the deploy time (UK) and the short commit id. Locally it stays "dev".
const RAW = '__BUILD__';
export const BUILD = RAW.startsWith('__') ? 'dev' : RAW;
