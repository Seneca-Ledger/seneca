// Pure helpers of the guide screenshot capture: arguments, locales, frame geometry and the
// API answers the browser sees. Kept apart from the browser code so they can be tested.

/** Frame proportions of the guide (FRAME_ASPECT in welcome-tutorial-screens.ts). */
export const FRAME_ASPECT = { hero: 1.55, side: 2.24, pair: 1.55 };

/** Widest each frame is drawn in the guide, in CSS pixels (SIZES in TutorialFragments.tsx). */
export const FRAME_WIDTH = { hero: 660, side: 460, pair: 560 };

/** A screenshot holds at most this many pixels per CSS pixel of its frame. */
export const MAX_FRAME_SCALE = 1.5;

/** `--only=a,b --theme=dark --locale=all --concurrency=4` → an object; bare flags are true. */
export function parseArgs(argv) {
  return Object.fromEntries(
    argv
      .filter(arg => arg.startsWith('--'))
      .map(arg => {
        const [key, ...value] = arg.slice(2).split('=');
        return [key, value.length ? value.join('=') : true];
      }),
  );
}

/** The `locales: [...]` list of frontend/intlayer.config.ts, read as text. */
export function localesFromConfig(source) {
  const list = /locales:\s*\[([^\]]*)\]/.exec(source);
  if (!list) {
    throw new Error('No locales list in the intlayer config');
  }
  return [...list[1].matchAll(/['"]([a-zA-Z-]+)['"]/g)].map(match => match[1]);
}

/** `all`, one locale or a comma list, each checked against the configured locales. */
export function resolveLocales(arg, configured) {
  if (!arg || arg === true) {
    return ['en'];
  }
  if (arg === 'all') {
    return [...configured];
  }
  const wanted = String(arg).split(',').filter(Boolean);
  const unknown = wanted.filter(locale => !configured.includes(locale));
  if (unknown.length) {
    throw new Error(`Unknown locale(s): ${unknown.join(', ')}`);
  }
  return wanted;
}

/** `netWorth` → `net-worth`, as the guide names the files (tutorialScreenUrl). */
export function kebab(stepId) {
  return stepId.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * The page area of a fragment: from the top-left corner of the union of `boxes` (minus
 * `pad`), `width` wide (default: the union's width) and as tall as the frame's proportions
 * allow, kept inside `bounds` when given. Boxes are `{ x, y, right, bottom }` in page pixels.
 */
export function clipFor(boxes, { frame, width, pad = 16, bounds = null }) {
  const x = Math.max(Math.min(...boxes.map(box => box.x)) - pad, bounds?.x ?? 0);
  const y = Math.max(Math.min(...boxes.map(box => box.y)) - pad, bounds?.y ?? 0);
  const wanted = width ?? Math.max(...boxes.map(box => box.right)) + pad - x;
  const right = Math.min(x + wanted, bounds?.right ?? Number.POSITIVE_INFINITY);
  const clipWidth = Math.round(right - x);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: clipWidth,
    height: Math.round(clipWidth / FRAME_ASPECT[frame]),
  };
}

/** Pixel width of the saved image: the capture's own, but no more than the frame needs. */
export function outputWidth(frame, capturedWidth) {
  return Math.min(capturedWidth, Math.round(FRAME_WIDTH[frame] * MAX_FRAME_SCALE));
}

const TIMESTAMP_KEYS = new Set(['createdAt', 'updatedAt']);

/**
 * What the browser is shown of an API answer. The database stamps rows with the real time
 * of the run, so a stamp later than `now` (the demo's anchor) reads as `now`, three hours
 * earlier, and every image shows the same "3 hours ago". Generated avatars are seeded at
 * random per account, so they are dropped for the initials.
 */
export function steadyJson(value, now) {
  if (Array.isArray(value)) {
    return value.map(item => steadyJson(item, now));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const settled = new Date(now.getTime() - 3 * 3_600_000).toISOString();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === 'avatarUrl') {
        return [key, null];
      }
      if (TIMESTAMP_KEYS.has(key) && typeof item === 'string' && Date.parse(item) > now) {
        return [key, settled];
      }
      return [key, steadyJson(item, now)];
    }),
  );
}

/** Runs `task` over `items`, at most `limit` at a time; resolves when all have settled. */
export async function inPool(items, limit, task) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      await task(queue.shift());
    }
  });
  await Promise.all(workers);
}
