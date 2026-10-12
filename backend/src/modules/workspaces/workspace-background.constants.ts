/**
 * Searched backgrounds: a wide landscape photo from Openverse, copied into the
 * uploads directory. The bundled set in the frontend stays the default and the
 * fallback when the day's search allowance is gone.
 */

/** Results per search page — the drawer's two-column grid, nine rows deep. */
export const BACKGROUND_SEARCH_PAGE_SIZE = 18;

/** Openverse stops paginating well before this; the cap only bounds the input. */
export const BACKGROUND_SEARCH_MAX_PAGE = 20;

/**
 * A search page is cached for a day. Most people tap the same few suggested
 * terms, and the anonymous allowance is 200 searches a day for the whole
 * deployment.
 */
export const BACKGROUND_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
export const BACKGROUND_THUMBNAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const BACKGROUND_SEARCH_TIMEOUT_MS = 8000;
export const BACKGROUND_DOWNLOAD_TIMEOUT_MS = 15000;

/** Thumbnails are ~25 KB; the ceiling only stops something absurd being cached. */
export const BACKGROUND_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The full-size original can be a 40-megapixel camera file. Anything over this
 * is skipped in favour of the thumbnail rather than pulled into memory.
 */
export const BACKGROUND_ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;

/** Stored width: sharp on a wide card and on a 2x screen, ~300 KB as JPEG. */
export const BACKGROUND_STORED_WIDTH = 1920;

/** Where stored backgrounds live, under the uploads directory. */
export const BACKGROUND_DIRECTORY = 'workspace-backgrounds';

/** The URL prefix the static mount serves them under; also what the column stores. */
export const BACKGROUND_URL_PREFIX = `/uploads/${BACKGROUND_DIRECTORY}`;
