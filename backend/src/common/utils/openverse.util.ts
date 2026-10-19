import {
  BadGatewayException,
  type HttpException,
  type Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Data, Effect, Schema } from 'effect';
import { HttpClientResponse } from 'effect/http';
import { APP_NAME } from '../brand';
import type { AppServices, EffectRuntime } from '../effect/effect-runtime';
import { contentTypeOf, getWith } from '../effect/http-json';

/**
 * Openverse: the one image search that answers without an API key, so a
 * self-hosted Seneca can search photos out of the box. Anonymous callers get
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

/** The shape an Openverse result has, narrowed to the fields Seneca reads. */
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
  effects: EffectRuntime;
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

/** Openverse answers JSON objects; every field is read leniently by the callers. */
const OpenverseJsonBody = Schema.Record(Schema.String, Schema.Unknown);
export type OpenverseJson = Record<string, unknown>;

/** Why an Openverse request gave nothing usable, before it becomes a response. */
class OpenverseRequestError extends Data.TaggedError('OpenverseRequestError')<{
  readonly reason: 'unavailable' | 'quota' | 'unreadable' | 'missing' | 'format' | 'size';
}> {}

function toException(
  error: OpenverseRequestError,
  action: 'search' | 'download',
  options: OpenverseRequestOptions,
): HttpException {
  switch (error.reason) {
    case 'quota':
      return new ServiceUnavailableException(options.allowanceMessage);
    case 'unavailable':
      return new BadGatewayException(
        action === 'search'
          ? 'Image search is unavailable right now'
          : 'Could not fetch that picture',
      );
    case 'unreadable':
      return new BadGatewayException('Image search returned something unreadable');
    case 'missing':
      return new NotFoundException('That picture is no longer available');
    case 'format':
      return new BadGatewayException(`That picture is in a format ${APP_NAME} does not store`);
    case 'size':
      return new BadGatewayException('That picture is too large to store');
  }
}

function networkFailure(logger: Logger, prefix: string, reason: 'network' | 'timeout') {
  return Effect.suspend(() => {
    logger.warn(`${prefix}: ${reason}`);
    return Effect.fail(new OpenverseRequestError({ reason: 'unavailable' }));
  });
}

/** Runs a request; an OpenverseRequestError becomes the response the picker shows. */
async function run<A>(
  action: 'search' | 'download',
  options: OpenverseRequestOptions,
  effect: Effect.Effect<A, OpenverseRequestError, AppServices>,
): Promise<A> {
  try {
    return await options.effects.run(effect);
  } catch (error) {
    throw error instanceof OpenverseRequestError ? toException(error, action, options) : error;
  }
}

/** Never retried: the anonymous allowance is 200 searches a day. */
export function requestOpenverseJson(
  url: string,
  options: OpenverseRequestOptions,
): Promise<OpenverseJson> {
  const { logger } = options;
  return run(
    'search',
    options,
    getWith(
      url,
      {
        timeout: options.timeoutMs,
        headers: { Accept: 'application/json', 'User-Agent': options.userAgent },
      },
      response =>
        Effect.gen(function* () {
          // Worth its own message: the allowance resets, and the person should
          // be told to wait rather than that the search is broken.
          if (response.status === 429) {
            return yield* new OpenverseRequestError({ reason: 'quota' });
          }
          if (response.status < 200 || response.status >= 300) {
            logger.warn(`Openverse request failed: http_${response.status}`);
            return yield* new OpenverseRequestError({ reason: 'unavailable' });
          }
          return yield* HttpClientResponse.schemaBodyJson(OpenverseJsonBody)(response).pipe(
            Effect.mapError(() => new OpenverseRequestError({ reason: 'unreadable' })),
          );
        }),
    ).pipe(
      Effect.catchTags({
        HttpClientError: () => networkFailure(logger, 'Openverse request failed', 'network'),
        TimeoutError: () => networkFailure(logger, 'Openverse request failed', 'timeout'),
      }),
    ),
  );
}

/**
 * A search result's thumbnail. The id only ever becomes a path segment on a
 * fixed host — callers validate it as a uuid first — so there is no SSRF
 * surface and no need for the egress guard.
 */
export function downloadOpenverseThumbnail(
  photoId: string,
  options: OpenverseDownloadOptions,
): Promise<OpenverseImage> {
  const { logger, label } = options;
  return run(
    'download',
    options,
    getWith(
      `${OPENVERSE_API}${photoId}/thumb/`,
      { timeout: options.timeoutMs, headers: { 'User-Agent': options.userAgent } },
      response =>
        Effect.gen(function* () {
          if (response.status === 404) {
            return yield* new OpenverseRequestError({ reason: 'missing' });
          }
          if (response.status === 429) {
            return yield* new OpenverseRequestError({ reason: 'quota' });
          }
          if (response.status < 200 || response.status >= 300) {
            logger.warn(`${label} download failed: http_${response.status}`);
            return yield* new OpenverseRequestError({ reason: 'unavailable' });
          }
          const contentType = contentTypeOf(response);
          if (!OPENVERSE_CONTENT_TYPES[contentType]) {
            logger.warn(`${label} rejected: content_type_${contentType || 'none'}`);
            return yield* new OpenverseRequestError({ reason: 'format' });
          }
          const body = Buffer.from(yield* response.arrayBuffer);
          if (body.byteLength === 0 || body.byteLength > options.maxBytes) {
            logger.warn(`${label} rejected: size_${body.byteLength}`);
            return yield* new OpenverseRequestError({ reason: 'size' });
          }
          return { body, contentType };
        }),
    ).pipe(
      Effect.catchTags({
        HttpClientError: () => networkFailure(logger, `${label} download failed`, 'network'),
        TimeoutError: () => networkFailure(logger, `${label} download failed`, 'timeout'),
      }),
    ),
  );
}
