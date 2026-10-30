import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadGatewayException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Effect, Schema } from 'effect';
import { APP_NAME } from '../../common/brand';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import {
  contentTypeOf,
  describeHttpFailure,
  getJson,
  getWith,
} from '../../common/effect/http-json';
import { appError } from '../../common/errors/app-error';
import type { ItemImageCandidate, ItemImageSearchResults } from '../../contracts';
import { commonsTitle, fileOf, imageInfoUrl, textIn, thumbUrlsOf } from './commons-files.util';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
/** Rasters only, and never SVG: the stored file is served from our own origin. */
export const ITEM_IMAGE_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const SEARCH_LIMIT = 8;
const RESULT_LIMIT = 6;
/** "Mac Mini M4" has no item of its own; "Mac Mini" does. */
const MAX_DROPPED_WORDS = 2;
/** Each term tried is two or three requests; the picker waits for all of them. */
const MAX_TERMS = 5;
const TIMEOUT = '6 seconds';
const MAX_BYTES = 512 * 1024;
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const PICTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Wikimedia asks every client to name itself. */
const USER_AGENT = `${APP_NAME}/1.0 (https://github.com/stoic-budget/stoic-budget; self-hosted personal finance)`;
/** Commons answers a burst of thumbnails with 429 and says how long to wait. */
const MAX_RETRY_AFTER_MS = 3000;

const Json = Schema.Record(Schema.String, Schema.Unknown);
type Json = Record<string, unknown>;

export interface ItemPicture {
  body: Buffer;
  contentType: string;
}

type CachedPicture = { contentType: string; body: string };

/**
 * Pictures of things people buy and sell, from Wikidata items and the Commons
 * file each one names (`P18`). No key, free licences, and the product shots are
 * often on a clean background — the Mac mini item carries a drawing of the M4.
 *
 * Only the words of the search leave the server, never an amount or a payee,
 * and only when the person asks: the client opens the search, nothing runs on
 * its own.
 */
@Injectable()
export class WikidataImagesService {
  private readonly logger = new Logger(WikidataImagesService.name);
  /** Downloads run one at a time: a grid of previews at once is what Commons throttles. */
  private downloads: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly effects: EffectRuntime,
  ) {}

  async search(query: string, lang = 'en'): Promise<ItemImageSearchResults> {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const languages = lang === 'en' ? ['en'] : [lang, 'en'];
    const cacheKey = `item-image-search:v1:${hash(`${languages.join('|')}:${words.join(' ').toLowerCase()}`)}`;
    const cached = await this.readCache<ItemImageSearchResults>(cacheKey);
    if (cached) {
      return cached;
    }

    let answer: ItemImageSearchResults = { query: words.join(' '), results: [] };
    for (const term of searchTerms(words)) {
      const ids = await this.searchIds(term, languages);
      const found = ids.length > 0 ? await this.withPictures(ids, languages) : [];
      if (found.length > 0) {
        const shown = found.slice(0, RESULT_LIMIT);
        await this.rememberThumbs(shown);
        answer = { query: term, results: shown.map(({ file: _file, ...result }) => result) };
        break;
      }
    }
    await this.writeCache(cacheKey, answer, SEARCH_TTL_MS);
    return answer;
  }

  /** The item's picture as a thumbnail, cached for a week. */
  async picture(wikidataId: string): Promise<ItemPicture> {
    const cacheKey = `item-image-picture:v1:${wikidataId}`;
    const cached = await this.readCache<CachedPicture>(cacheKey);
    if (cached) {
      return { body: Buffer.from(cached.body, 'base64'), contentType: cached.contentType };
    }
    const picture = await this.download(
      (await this.readCache<string>(thumbKey(wikidataId))) ?? (await this.thumbUrl(wikidataId)),
    );
    await this.writeCache(
      cacheKey,
      { contentType: picture.contentType, body: picture.body.toString('base64') },
      PICTURE_TTL_MS,
    );
    return picture;
  }

  /** What Wikidata calls the item, for the stored picture's caption. */
  async labelOf(wikidataId: string, lang = 'en'): Promise<string | null> {
    const entities = await this.entities([wikidataId], lang === 'en' ? ['en'] : [lang, 'en']);
    return textIn(entities[wikidataId]?.labels, [lang, 'en']);
  }

  private async searchIds(term: string, languages: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const language of languages) {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: term,
        language,
        uselang: language,
        type: 'item',
        limit: String(SEARCH_LIMIT),
        format: 'json',
      });
      const payload = await this.requestJson(`${WIKIDATA_API}?${params.toString()}`);
      const found = Array.isArray(payload.search) ? payload.search : [];
      for (const item of found) {
        const id = (item as Json)?.id;
        if (typeof id === 'string' && /^Q\d+$/.test(id) && !ids.includes(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }

  /** The found items that have a picture, in search order. */
  private async withPictures(ids: string[], languages: string[]): Promise<Candidate[]> {
    const entities = await this.entities(ids, languages);
    return ids.flatMap(id => {
      const entity = entities[id];
      const label = textIn(entity?.labels, languages);
      const file = fileOf(entity);
      if (!(file && label)) {
        return [];
      }
      return [{ id, label, description: textIn(entity?.descriptions, languages), file }];
    });
  }

  /**
   * The thumbnails of a page of results, asked of Commons in one request while
   * the search is answered, so the previews the picker then loads each cost one
   * download and no API call. A miss here only means the preview asks itself.
   */
  private async rememberThumbs(candidates: Candidate[]): Promise<void> {
    try {
      const urls = thumbUrlsOf(await this.requestJson(imageInfoUrl(candidates.map(c => c.file))));
      await Promise.all(
        candidates.map(({ id, file }) => {
          const url = urls.get(commonsTitle(file));
          return url ? this.writeCache(thumbKey(id), url, PICTURE_TTL_MS) : undefined;
        }),
      );
    } catch {
      // The previews fall back to asking one by one.
    }
  }

  private async entities(ids: string[], languages: string[]): Promise<Record<string, Json>> {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|descriptions|claims',
      languages: languages.join('|'),
      format: 'json',
    });
    const payload = await this.requestJson(`${WIKIDATA_API}?${params.toString()}`);
    const entities = payload.entities;
    return entities && typeof entities === 'object' ? (entities as Record<string, Json>) : {};
  }

  /**
   * The item's thumbnail, as Commons names it. Asked rather than built from the
   * file name: a thumbnail nobody has asked for yet is a 429 when fetched
   * directly, while this asks Commons to render it first.
   */
  private async thumbUrl(wikidataId: string): Promise<string> {
    const file = fileOf((await this.entities([wikidataId], ['en']))[wikidataId]);
    const url = file
      ? thumbUrlsOf(await this.requestJson(imageInfoUrl([file]))).get(commonsTitle(file))
      : undefined;
    if (!url) {
      throw new NotFoundException(appError('ITEM_IMAGE_NOT_FOUND'));
    }
    return url;
  }

  /** Two retries on 429/5xx: Wikidata has no daily allowance to protect. */
  private async requestJson(url: string): Promise<Json> {
    const answer = await this.effects.run(
      getJson(url, Json, { timeout: TIMEOUT, headers: { 'User-Agent': USER_AGENT } }).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            this.logger.warn(`Wikidata request failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
    if (!answer) {
      throw new BadGatewayException(appError('ITEM_IMAGES_UNAVAILABLE'));
    }
    return answer;
  }

  /** One at a time, and once more after the wait Commons names when it says 429. */
  private download(url: string): Promise<ItemPicture> {
    const next = this.downloads.then(async () => {
      const first = await this.fetchPicture(url);
      if (typeof first !== 'number') {
        return first;
      }
      await new Promise(resolve => setTimeout(resolve, first));
      const second = await this.fetchPicture(url);
      return typeof second === 'number' ? null : second;
    });
    this.downloads = next.catch(() => undefined);
    return next.then(picture => {
      if (!picture) {
        throw new BadGatewayException(appError('ITEM_IMAGES_UNAVAILABLE'));
      }
      return picture;
    });
  }

  /**
   * The picture, null when there is none to use, or how long to wait on a 429.
   * The URL comes from Commons and is checked to be on a Wikimedia media host.
   */
  private fetchPicture(url: string): Promise<ItemPicture | number | null> {
    const logger = this.logger;
    return this.effects.run(
      getWith(url, { timeout: TIMEOUT, headers: { 'User-Agent': USER_AGENT } }, response =>
        Effect.gen(function* () {
          if (response.status === 429) {
            const seconds = Number(response.headers['retry-after']);
            return Math.min(Number.isFinite(seconds) ? seconds * 1000 : 1000, MAX_RETRY_AFTER_MS);
          }
          if (response.status < 200 || response.status >= 300) {
            logger.warn(`Item picture download failed: http_${response.status}`);
            return null;
          }
          const contentType = contentTypeOf(response);
          if (!ITEM_IMAGE_CONTENT_TYPES[contentType]) {
            logger.warn(`Item picture rejected: content_type_${contentType || 'none'}`);
            return null;
          }
          const body = Buffer.from(yield* response.arrayBuffer);
          if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
            logger.warn(`Item picture rejected: size_${body.byteLength}`);
            return null;
          }
          return { body, contentType };
        }),
      ).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            logger.warn(`Item picture download failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      return (await this.cacheManager.get<T>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch {
      // A cache outage only costs a repeated upstream request.
    }
  }
}

type Candidate = ItemImageCandidate & { file: string };

const thumbKey = (wikidataId: string): string => `item-image-thumb:v1:${wikidataId}`;

/**
 * What to ask for, in order: the whole note; then shorter from the end while
 * two words are left, which keeps a model's name ("Mac Mini M4" → "Mac Mini");
 * then single words from the last, where the thing itself usually is
 * ("ACME armchair" → "armchair", not the brand).
 */
export function searchTerms(words: string[]): string[] {
  const terms = [words.join(' ')];
  for (let drop = 1; drop <= MAX_DROPPED_WORDS && words.length - drop >= 2; drop++) {
    terms.push(words.slice(0, words.length - drop).join(' '));
  }
  if (words.length > 1) {
    for (const word of [...words].reverse()) {
      if (word.length >= 3 && !terms.includes(word)) {
        terms.push(word);
      }
    }
  }
  return terms.slice(0, MAX_TERMS);
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
