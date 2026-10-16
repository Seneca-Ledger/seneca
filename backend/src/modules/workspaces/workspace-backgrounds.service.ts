import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { appError } from '../../common/errors/app-error';
import { fetchPublicUrl } from '../../common/utils/egress-url.util';
import {
  asHttpsUrl,
  asText,
  downloadOpenverseThumbnail,
  OPENVERSE_API,
  type OpenverseImage,
  type OpenverseJson,
  type OpenverseResult,
  requestOpenverseJson,
} from '../../common/utils/openverse.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import {
  BACKGROUND_DIRECTORY,
  BACKGROUND_DOWNLOAD_TIMEOUT_MS,
  BACKGROUND_ORIGINAL_MAX_BYTES,
  BACKGROUND_SEARCH_PAGE_SIZE,
  BACKGROUND_SEARCH_TIMEOUT_MS,
  BACKGROUND_SEARCH_TTL_MS,
  BACKGROUND_STORED_WIDTH,
  BACKGROUND_THUMBNAIL_MAX_BYTES,
  BACKGROUND_THUMBNAIL_TTL_MS,
  BACKGROUND_URL_PREFIX,
} from './workspace-background.constants';

export interface BackgroundSearchResult {
  id: string;
  title: string;
  creator: string | null;
  license: string;
  /** The ready-made credit line Openverse composes; shown verbatim. */
  attribution: string;
  sourceUrl: string | null;
}

export interface BackgroundSearchPage {
  results: BackgroundSearchResult[];
  page: number;
  hasMore: boolean;
}

export interface WorkspaceBackground {
  backgroundImage: string | null;
  backgroundAttribution: string | null;
  backgroundSourceUrl: string | null;
}

type CachedThumbnail = { contentType: string; body: string };

/**
 * What a save needs about a photo, remembered from the search that showed it:
 * the credit, the source page and (from a fresh search) the original's URL.
 * Openverse can take 10–30 s to answer, and asking it again at save time made
 * picking a photo fail on a timeout the picker had already sat through once.
 */
type RememberedPhoto = {
  attribution: string;
  sourceUrl: string | null;
  originalUrl: string | null;
};

const USER_AGENT = 'Lumio/1.0 (self-hosted personal finance; workspace backgrounds)';

/**
 * Landscape photos for the workspace card, searched on Openverse.
 *
 * Same shape as goal covers: search and thumbnails go through this API so the
 * page's CSP stays `img-src 'self'` and the reader's IP and search terms stay
 * away from a third party, and the picked photo is copied into uploads rather
 * than hotlinked. The difference is size — a background is shown wide, so the
 * original is fetched and scaled down instead of storing the 600px thumbnail.
 */
@Injectable()
export class WorkspaceBackgroundsService {
  private readonly logger = new Logger(WorkspaceBackgroundsService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly effects: EffectRuntime,
  ) {}

  async search(query: string, page = 1): Promise<BackgroundSearchPage> {
    const term = query.trim().toLowerCase();
    const cacheKey = `workspace-bg-search:v1:${page}:${term}`;
    const cached = await this.readCache<BackgroundSearchPage>(cacheKey);
    if (cached) {
      // Pages cached before photos were remembered: credit and source suffice,
      // the save then stores the (already cached) thumbnail.
      await this.rememberPhotos(cached.results.map(item => ({ item, originalUrl: null })));
      return cached;
    }

    const params = new URLSearchParams({
      q: term,
      page: String(page),
      page_size: String(BACKGROUND_SEARCH_PAGE_SIZE),
      // What makes a search for "lake" come back as wallpaper rather than as
      // diagrams and phone snapshots: photographs, landscape-shaped, large.
      category: 'photograph',
      aspect_ratio: 'wide',
      size: 'large',
      mature: 'false',
      extension: 'jpg,png,webp',
    });

    const payload = await requestOpenverseJson(
      `${OPENVERSE_API}?${params.toString()}`,
      this.openverseOptions(),
    );
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const found = rawResults
      .map((raw: OpenverseResult) => ({
        item: toSearchResult(raw),
        originalUrl: asHttpsUrl(raw.url, 2000),
      }))
      .filter(
        (entry): entry is { item: BackgroundSearchResult; originalUrl: string | null } =>
          entry.item !== null,
      );
    await this.rememberPhotos(found);
    const results = found.map(entry => entry.item);

    const pageCount = typeof payload.page_count === 'number' ? payload.page_count : page;
    const result = { results, page, hasMore: page < pageCount };
    await this.writeCache(cacheKey, result, BACKGROUND_SEARCH_TTL_MS);
    return result;
  }

  /** A search result's thumbnail, cached for a week. */
  async getThumbnail(photoId: string): Promise<OpenverseImage> {
    const cacheKey = `workspace-bg-thumb:v1:${photoId}`;
    const cached = await this.readCache<CachedThumbnail>(cacheKey);
    if (cached) {
      return { body: Buffer.from(cached.body, 'base64'), contentType: cached.contentType };
    }

    const fetched = await downloadOpenverseThumbnail(photoId, {
      ...this.openverseOptions(),
      timeoutMs: BACKGROUND_DOWNLOAD_TIMEOUT_MS,
      maxBytes: BACKGROUND_THUMBNAIL_MAX_BYTES,
    });
    await this.writeCache(
      cacheKey,
      { contentType: fetched.contentType, body: fetched.body.toString('base64') },
      BACKGROUND_THUMBNAIL_TTL_MS,
    );
    return fetched;
  }

  /**
   * Makes a searched photo the workspace background. Owners and admins only,
   * the same rule as every other workspace setting.
   *
   * The file replaced is left on disk: workspace edits are undoable from the
   * audit log, and an undo restores the old path.
   */
  async setPhoto(
    workspaceId: string,
    userId: string,
    photoId: string,
  ): Promise<WorkspaceBackground> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }
    if (![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(membership.role)) {
      throw new ForbiddenException(appError('WORKSPACE_ADMIN_REQUIRED_TO_EDIT_SETTINGS'));
    }

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    // The credit line and the original's URL: remembered from the search that
    // showed the photo, else asked of Openverse. Unlike a goal cover, a failure
    // here fails the save: without the credit the photo may not be shown at all.
    const remembered = await this.readCache<RememberedPhoto>(photoCacheKey(photoId));
    const detail: OpenverseJson = remembered
      ? {
          attribution: remembered.attribution,
          url: remembered.originalUrl,
          foreign_landing_url: remembered.sourceUrl,
        }
      : await requestOpenverseJson(`${OPENVERSE_API}${photoId}/`, this.openverseOptions());
    const attribution = asText(detail.attribution, 400);
    if (!attribution) {
      throw new NotFoundException('That picture is no longer available');
    }

    const image = await this.fetchStoredImage(photoId, detail);
    const fileName = `${randomUUID()}.jpg`;
    const directory = path.join(resolveUploadsDir(), BACKGROUND_DIRECTORY);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, fileName), image);

    const before = background(workspace);
    workspace.backgroundImage = `${BACKGROUND_URL_PREFIX}/${fileName}`;
    workspace.backgroundAttribution = attribution;
    workspace.backgroundSourceUrl = asHttpsUrl(detail.foreign_landing_url, 500);
    const saved = await this.workspaceRepository.save(workspace);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      diff: { before, after: background(saved) },
    });

    return background(saved);
  }

  /**
   * The original scaled to the stored width, or the thumbnail when the
   * original cannot be had — too big, gone, slow, or not an image. Either way
   * the bytes are re-encoded, so what lands on disk is always a JPEG we made.
   */
  private async fetchStoredImage(photoId: string, detail: OpenverseJson): Promise<Buffer> {
    const originalUrl = asHttpsUrl(detail.url, 2000);
    if (originalUrl) {
      try {
        return await this.encode(await this.downloadOriginal(originalUrl));
      } catch (error) {
        this.logger.warn(
          `Workspace background original unavailable, using thumbnail: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    const thumbnail = await this.getThumbnail(photoId);
    return this.encode(thumbnail.body);
  }

  /**
   * The original lives on whatever host the source uses (Flickr, Wikimedia, a
   * stock site), so this URL comes from upstream data and goes through the
   * egress guard like any other outside-supplied destination.
   */
  private async downloadOriginal(url: string): Promise<Buffer> {
    const response = await fetchPublicUrl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(BACKGROUND_DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > BACKGROUND_ORIGINAL_MAX_BYTES) {
      throw new Error('too_large');
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > BACKGROUND_ORIGINAL_MAX_BYTES) {
      throw new Error('too_large');
    }
    return body;
  }

  private async encode(input: Buffer): Promise<Buffer> {
    // sharp is a CommonJS function export. Without esModuleInterop the dynamic
    // import hands back the function itself, with it a namespace whose
    // `default` is the function — take whichever arrived.
    type SharpFactory = typeof import('sharp');
    const imported = (await import('sharp')) as unknown as SharpFactory | { default: SharpFactory };
    const sharp = typeof imported === 'function' ? imported : imported.default;
    return sharp(input, { limitInputPixels: 120_000_000 })
      .rotate()
      .resize({ width: BACKGROUND_STORED_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  }

  private openverseOptions() {
    return {
      userAgent: USER_AGENT,
      timeoutMs: BACKGROUND_SEARCH_TIMEOUT_MS,
      logger: this.logger,
      label: 'Workspace background',
      allowanceMessage:
        'The image search allowance is used up for now — the bundled backgrounds still work',
      effects: this.effects,
    };
  }

  private async rememberPhotos(
    entries: Array<{ item: BackgroundSearchResult; originalUrl: string | null }>,
  ): Promise<void> {
    await Promise.all(
      entries.map(async ({ item, originalUrl }) => {
        const known = originalUrl
          ? null
          : await this.readCache<RememberedPhoto>(photoCacheKey(item.id));
        await this.writeCache(
          photoCacheKey(item.id),
          {
            attribution: item.attribution,
            sourceUrl: item.sourceUrl,
            // A page from cache has no original URL; keep one a fresh search left.
            originalUrl: originalUrl ?? known?.originalUrl ?? null,
          } satisfies RememberedPhoto,
          BACKGROUND_SEARCH_TTL_MS,
        );
      }),
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

const photoCacheKey = (photoId: string): string => `workspace-bg-photo:v1:${photoId}`;

function toSearchResult(item: OpenverseResult): BackgroundSearchResult | null {
  const id = asText(item.id, 40);
  const attribution = asText(item.attribution, 400);
  // No credit line, no result: it is what makes showing the picture lawful.
  if (!(id && attribution)) {
    return null;
  }
  return {
    id,
    title: asText(item.title, 150) ?? 'Untitled',
    creator: asText(item.creator, 150),
    license: asText(item.license, 20) ?? 'cc',
    attribution,
    sourceUrl: asHttpsUrl(item.foreign_landing_url, 500),
  };
}

function background(workspace: Workspace): WorkspaceBackground {
  return {
    backgroundImage: workspace.backgroundImage,
    backgroundAttribution: workspace.backgroundAttribution,
    backgroundSourceUrl: workspace.backgroundSourceUrl,
  };
}
