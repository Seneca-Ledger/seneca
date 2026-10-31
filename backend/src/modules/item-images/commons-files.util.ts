/**
 * Reading Wikidata items and Commons `imageinfo` answers: which file an item
 * shows, and where Commons serves its thumbnail. Pure, so the service keeps
 * only the requests.
 */
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/** The only hosts a thumbnail address from Commons may point at. */
const THUMB_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

/**
 * Wikimedia serves thumbnails only at its standard widths. 330px is the one
 * above twice the 160px the hover preview draws.
 */
const THUMB_WIDTH = 330;

/** Commons renders these to a raster thumbnail; others (tif, pdf, gif) are skipped. */
const THUMBABLE = /\.(jpe?g|png|svg|webp)$/i;

type Json = Record<string, unknown>;

/** A file's page title as Commons writes it back: spaces, first letter upper case. */
export function commonsTitle(file: string): string {
  const name = file.trim().replace(/_/g, ' ');
  return `File:${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export function imageInfoUrl(files: string[]): string {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(THUMB_WIDTH),
    titles: files.map(commonsTitle).join('|'),
    format: 'json',
  });
  return `${COMMONS_API}?${params.toString()}`;
}

/** Thumbnail addresses by page title from a Commons `imageinfo` answer, Wikimedia's own hosts only. */
export function thumbUrlsOf(payload: Json): Map<string, string> {
  const urls = new Map<string, string>();
  const pages = (payload.query as { pages?: Record<string, unknown> } | undefined)?.pages;
  for (const page of Object.values(pages ?? {})) {
    const { title, imageinfo } = page as {
      title?: unknown;
      imageinfo?: Array<{ thumburl?: unknown }>;
    };
    const url = imageinfo?.[0]?.thumburl;
    if (typeof title === 'string' && typeof url === 'string' && isUploadUrl(url)) {
      urls.set(title, url);
    }
  }
  return urls;
}

function isUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && THUMB_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** The item's picture (`P18`), when Commons can render it to a raster. */
export function fileOf(entity: Json | undefined): string | null {
  const claims = entity?.claims as Record<string, unknown> | undefined;
  const pictures = Array.isArray(claims?.P18) ? claims.P18 : [];
  for (const claim of pictures) {
    const value = (claim as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue
      ?.value;
    if (typeof value === 'string' && !value.includes('/') && THUMBABLE.test(value)) {
      return value;
    }
  }
  return null;
}

export function textIn(values: unknown, languages: string[]): string | null {
  if (!values || typeof values !== 'object') {
    return null;
  }
  for (const language of languages) {
    const text = (values as Record<string, { value?: unknown }>)[language]?.value;
    if (typeof text === 'string' && text.trim()) {
      return text.trim().slice(0, 200);
    }
  }
  return null;
}
