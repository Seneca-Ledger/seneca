import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import {
  asHttpsUrl,
  asText,
  downloadOpenverseThumbnail,
  type OpenverseJson,
  type OpenverseResult,
  requestOpenverseJson,
} from '../../common/utils/openverse.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Goal } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import type { SetGoalCoverDto } from './dto/set-goal-cover.dto';
import {
  COVER_CONTENT_TYPES,
  COVER_DIRECTORY,
  COVER_DOWNLOAD_TIMEOUT_MS,
  COVER_MAX_BYTES,
  COVER_SEARCH_PAGE_SIZE,
  COVER_SEARCH_TIMEOUT_MS,
  OPENVERSE_API,
} from './goal-cover.constants';

export interface CoverSearchResult {
  id: string;
  title: string;
  creator: string | null;
  license: string;
  licenseUrl: string | null;
  /** The ready-made credit line Openverse composes; shown verbatim. */
  attribution: string;
  /** The page the image lives on, for the "source" link a CC licence expects. */
  sourceUrl: string | null;
}

export interface CoverSearchPage {
  results: CoverSearchResult[];
  page: number;
  hasMore: boolean;
}

export interface StoredCoverFile {
  body: Buffer;
  contentType: string;
}

type CachedThumbnail = { contentType: string; body: string };

const THUMBNAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A reader's User-Agent is a courtesy Openverse asks for, and it is what lets
 * them tell this traffic apart if it ever misbehaves.
 */
const USER_AGENT = 'Lumio/1.0 (self-hosted personal finance; goal covers)';

/**
 * Pictures for savings goals, searched on Openverse.
 *
 * Two things here are deliberate. Search and thumbnails go through this API
 * rather than straight from the browser, which keeps the page's CSP at
 * `img-src 'self'` and keeps the reader's IP and their search terms away from
 * a third party. And the picked image is copied into the uploads directory
 * instead of being linked: a goal is kept for years, and the Flickr URL behind
 * a CC photo is not.
 */
@Injectable()
export class GoalCoversService {
  private readonly logger = new Logger(GoalCoversService.name);

  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
  ) {}

  async search(query: string, page = 1): Promise<CoverSearchPage> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      page_size: String(COVER_SEARCH_PAGE_SIZE),
      // Commercially licensed only. It is the stricter pool, and it keeps a
      // self-hoster who bills clients through Lumio out of a licence question
      // they never asked to be in.
      license_type: 'commercial',
      // The picker is a plain search box pointed at the open web; this is what
      // keeps flagged material out of it.
      mature: 'false',
      // Formats the stored-cover allowlist accepts, so the search cannot offer
      // something the save step would then refuse.
      extension: 'jpg,png,webp',
    });

    const payload = await this.requestJson(`${OPENVERSE_API}?${params.toString()}`);
    const rawResults = Array.isArray(payload.results) ? payload.results : [];

    const results = rawResults
      .map((item: OpenverseResult) => this.toSearchResult(item))
      .filter((item): item is CoverSearchResult => item !== null);

    const pageCount = typeof payload.page_count === 'number' ? payload.page_count : page;
    return { results, page, hasMore: page < pageCount };
  }

  /**
   * The upstream thumbnail, cached for a week.
   *
   * The id only ever becomes a path segment on a fixed host — it is validated
   * as a uuid by the DTO before it gets here — so there is no SSRF surface and
   * no need for the egress guard.
   */
  async getThumbnail(photoId: string): Promise<StoredCoverFile> {
    const cacheKey = `goal-cover-thumb:v1:${photoId}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return { body: Buffer.from(cached.body, 'base64'), contentType: cached.contentType };
    }

    const fetched = await this.downloadThumbnail(photoId);
    await this.writeCache(
      cacheKey,
      { contentType: fetched.contentType, body: fetched.body.toString('base64') },
      THUMBNAIL_TTL_MS,
    );
    return fetched;
  }

  /** Sets the goal's cover, replacing whatever was there. */
  async setCover(
    goalId: string,
    workspaceId: string,
    userId: string,
    dto: SetGoalCoverDto,
  ): Promise<Goal> {
    const hasPreset = Boolean(dto.preset);
    const hasPhoto = Boolean(dto.photoId);
    if (hasPreset === hasPhoto) {
      throw new BadRequestException('Send exactly one of preset or photoId');
    }

    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');
    const previous = coverSnapshot(goal);
    const replacedFile = goal.coverFile;

    if (hasPreset) {
      goal.coverPreset = dto.preset as string;
      goal.coverFile = null;
      goal.coverAttribution = null;
      goal.coverSourceUrl = null;
    } else {
      const photoId = dto.photoId as string;
      // The credit line has to come from the search result, and the search
      // result is not in this request — so it is read back from Openverse
      // alongside the bytes. A photo may not be shown without it.
      const [image, detail] = await Promise.all([
        this.getThumbnail(photoId),
        this.fetchImageDetail(photoId),
      ]);

      const fileName = await this.writeCoverFile(image);
      goal.coverPreset = null;
      goal.coverFile = fileName;
      goal.coverAttribution = detail.attribution;
      goal.coverSourceUrl = detail.sourceUrl;
    }

    const saved = await this.goalRepository.save(goal);
    // Only after the row points at the new file: deleting first would leave the
    // goal pointing at a file that is already gone if the save fails.
    await this.deleteCoverFile(replacedFile, saved.coverFile);
    await this.audit(workspaceId, userId, saved.id, previous, coverSnapshot(saved));
    return saved;
  }

  async clearCover(goalId: string, workspaceId: string, userId: string): Promise<Goal> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');
    const previous = coverSnapshot(goal);
    const removedFile = goal.coverFile;

    goal.coverPreset = null;
    goal.coverFile = null;
    goal.coverAttribution = null;
    goal.coverSourceUrl = null;

    const saved = await this.goalRepository.save(goal);
    await this.deleteCoverFile(removedFile, null);
    await this.audit(workspaceId, userId, saved.id, previous, coverSnapshot(saved));
    return saved;
  }

  private toSearchResult(item: OpenverseResult): CoverSearchResult | null {
    const id = asText(item.id, 40);
    const attribution = asText(item.attribution, 400);
    // No credit line, no result: it is the one field that makes showing the
    // picture lawful, and there is no sensible way to compose it here.
    if (!(id && attribution)) {
      return null;
    }

    return {
      id,
      title: asText(item.title, 150) ?? 'Untitled',
      creator: asText(item.creator, 150),
      license: asText(item.license, 20) ?? 'cc',
      licenseUrl: asHttpsUrl(item.license_url, 300),
      attribution,
      sourceUrl: asHttpsUrl(item.foreign_landing_url, 500),
    };
  }

  private async fetchImageDetail(
    photoId: string,
  ): Promise<{ attribution: string | null; sourceUrl: string | null }> {
    try {
      const payload = await this.requestJson(`${OPENVERSE_API}${photoId}/`);
      return {
        attribution: asText(payload.attribution, 400),
        sourceUrl: asHttpsUrl(payload.foreign_landing_url, 500),
      };
    } catch (error) {
      // The picture is already downloaded at this point. Losing the credit line
      // is worth reporting, not worth failing the save over — the client shows
      // the licence notice it got from the search either way.
      this.logger.warn(
        `Goal cover attribution unavailable: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      return { attribution: null, sourceUrl: null };
    }
  }

  private requestJson(url: string): Promise<OpenverseJson> {
    return requestOpenverseJson(url, this.openverseOptions());
  }

  private downloadThumbnail(photoId: string): Promise<StoredCoverFile> {
    return downloadOpenverseThumbnail(photoId, {
      ...this.openverseOptions(),
      timeoutMs: COVER_DOWNLOAD_TIMEOUT_MS,
      maxBytes: COVER_MAX_BYTES,
    });
  }

  private openverseOptions() {
    return {
      userAgent: USER_AGENT,
      timeoutMs: COVER_SEARCH_TIMEOUT_MS,
      logger: this.logger,
      label: 'Goal cover',
      allowanceMessage:
        'The image search allowance is used up for now — the bundled covers still work',
    };
  }

  private async writeCoverFile(image: StoredCoverFile): Promise<string> {
    const directory = this.coverDirectory();
    await fs.mkdir(directory, { recursive: true });

    // A fresh random name, never anything derived from upstream: the extension
    // comes from the allowlisted content type, and the stem cannot be steered.
    const fileName = `${randomUUID()}${COVER_CONTENT_TYPES[image.contentType]}`;
    await fs.writeFile(path.join(directory, fileName), image.body);
    return fileName;
  }

  private async deleteCoverFile(fileName: string | null, keep: string | null): Promise<void> {
    if (!fileName || fileName === keep) {
      return;
    }
    try {
      await fs.unlink(this.coverPath(fileName));
    } catch {
      // Already gone, or the volume is read-only. An orphaned file is not worth
      // failing a cover change over.
    }
  }

  private coverDirectory(): string {
    return path.join(resolveUploadsDir(), COVER_DIRECTORY);
  }

  /** basename strips any traversal a malformed stored value could carry. */
  private coverPath(fileName: string): string {
    return path.join(this.coverDirectory(), path.basename(fileName));
  }

  private async readCache(key: string): Promise<CachedThumbnail | null> {
    try {
      return (await this.cacheManager.get<CachedThumbnail>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: CachedThumbnail, ttlMs: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch {
      // A cache outage only costs a repeated upstream request.
    }
  }

  private async audit(
    workspaceId: string,
    userId: string,
    goalId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.GOAL,
        entityId: goalId,
        action: AuditAction.UPDATE,
        diff: { before, after },
      });
    } catch (error) {
      this.logger.warn(
        `Goal cover audit failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}

function coverSnapshot(goal: Goal): Record<string, unknown> {
  return {
    coverPreset: goal.coverPreset,
    coverFile: goal.coverFile,
    coverAttribution: goal.coverAttribution,
  };
}
