import {
  BadGatewayException,
  type Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Openverse: the one image search that answers without an API key, so a
 * self-hosted Lumio can search photos out of the box. Anonymous callers get
 * 20 searches a minute and 200 a day per IP, and a separate 1000 thumbnails a
 * day. A deployment that outgrows that registers a free client with Openverse.
 */
export const OPENVERSE_API = 'https://api.openverse.org/v1/images/';

/**
 * Rasters only, and never SVG: a stored picture is served back from our own
 * origin, where an SVG's embedded script would run as first-party code.
 */
export const OPENVERSE_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** The shape an Openverse result has, narrowed to the fields Lumio reads. */
export interface OpenverseResult {
  id?: unknown;
  title?: unknown;
  creator?: unknown;
  license?: unknown;
  license_url?: unknown;
  attribution?: unknown;
  foreign_landing_url?: unknown;
  url?: unknown;
}

export interface OpenverseImage {
  body: Buffer;
  contentType: string;
}

export interface OpenverseRequestOptions {
  /** A User-Agent is a courtesy Openverse asks for; it names the feature calling. */
  userAgent: string;
  timeoutMs: number;
  logger: Logger;
  /** Prefix for log lines, e.g. "Goal cover". */
  label: string;
  /** What the person is told on a 429 — where to go while the allowance resets. */
  allowanceMessage: string;
}

export interface OpenverseDownloadOptions extends OpenverseRequestOptions {
  maxBytes: number;
}

export function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Only https, and only what fits the column. The URL goes to the client as a
 * link, so a `javascript:` value from upstream would be a stored XSS on click.
 */
export function asHttpsUrl(value: unknown, max: number): string | null {
  const text = asText(value, max);
  if (!text) {
    return null;
  }
  try {
    return new URL(text).protocol === 'https:' ? text : null;
  } catch {
    return null;
  }
}

function failureKind(error: unknown): string {
  return error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
}

// biome-ignore lint/suspicious/noExplicitAny: upstream JSON, narrowed by the callers
export type OpenverseJson = Record<string, any>;

export async function requestOpenverseJson(
  url: string,
  options: OpenverseRequestOptions,
): Promise<OpenverseJson> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': options.userAgent },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    options.logger.warn(`Openverse request failed: ${failureKind(error)}`);
    throw new BadGatewayException('Image search is unavailable right now');
  }

  // Worth its own message: the allowance resets, and the person should be
  // told to wait rather than that the search is broken.
  if (response.status === 429) {
    throw new ServiceUnavailableException(options.allowanceMessage);
  }
  if (!response.ok) {
    options.logger.warn(`Openverse request failed: http_${response.status}`);
    throw new BadGatewayException('Image search is unavailable right now');
  }

  try {
    return (await response.json()) as OpenverseJson;
  } catch {
    throw new BadGatewayException('Image search returned something unreadable');
  }
}

/**
 * A search result's thumbnail. The id only ever becomes a path segment on a
 * fixed host — callers validate it as a uuid first — so there is no SSRF
 * surface and no need for the egress guard.
 */
export async function downloadOpenverseThumbnail(
  photoId: string,
  options: OpenverseDownloadOptions,
): Promise<OpenverseImage> {
  let response: Response;
  try {
    response = await fetch(`${OPENVERSE_API}${photoId}/thumb/`, {
      headers: { 'User-Agent': options.userAgent },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    options.logger.warn(`${options.label} download failed: ${failureKind(error)}`);
    throw new BadGatewayException('Could not fetch that picture');
  }

  if (response.status === 404) {
    throw new NotFoundException('That picture is no longer available');
  }
  if (response.status === 429) {
    throw new ServiceUnavailableException(options.allowanceMessage);
  }
  if (!response.ok) {
    options.logger.warn(`${options.label} download failed: http_${response.status}`);
    throw new BadGatewayException('Could not fetch that picture');
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!OPENVERSE_CONTENT_TYPES[contentType]) {
    options.logger.warn(`${options.label} rejected: content_type_${contentType || 'none'}`);
    throw new BadGatewayException('That picture is in a format Lumio does not store');
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > options.maxBytes) {
    options.logger.warn(`${options.label} rejected: size_${body.byteLength}`);
    throw new BadGatewayException('That picture is too large to store');
  }

  return { body, contentType };
}
