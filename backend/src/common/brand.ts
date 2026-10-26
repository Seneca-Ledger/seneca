/** Product name shown to people (UI text, e-mails, bot replies, file names). Set APP_NAME in .env to rename. */
export const APP_NAME = process.env.APP_NAME?.trim() || 'Seneca';

/** APP_NAME as a lowercase word for file and folder names: "My Books" → "my-books". */
export const APP_SLUG =
  APP_NAME.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seneca';
