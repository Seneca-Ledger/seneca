/**
 * Product name shown to people. Comes from APP_NAME in the root .env (passed in
 * as NEXT_PUBLIC_APP_NAME) and is baked in at build time, so the translations
 * built by intlayer pick it up too — rebuild or restart the frontend after a change.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Seneca';

/** APP_NAME as a lowercase word for file names and ids: "My Books" → "my-books". */
export const APP_SLUG =
  APP_NAME.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seneca';
