import type { MockInstance, Mocked } from 'vitest';
import * as fs from 'node:fs/promises';
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Goal } from '@/entities';
import { GoalCoversService } from '@/modules/goals/goal-covers.service';
import { EffectRuntime } from '@/common/effect/effect-runtime';

// Replaced wholesale: vi.spyOn does not reach the bindings the service holds
// for a node: builtin, which silently left the real filesystem in play.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  unlink: vi.fn(async () => undefined),
}));

const mocked = fs as Mocked<typeof fs>;

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';
const PHOTO_ID = '11111111-2222-3333-4444-555555555555';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    workspaceId: WORKSPACE_ID,
    name: 'Lisbon workation',
    targetAmount: 1000,
    currency: 'EUR',
    targetDate: null,
    coverPreset: null,
    coverFile: null,
    coverAttribution: null,
    coverSourceUrl: null,
    ...overrides,
  } as Goal;
}

// Real Responses: the HTTP client reads headers and body the standard way.
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function imageResponse(bytes: Buffer, contentType = 'image/jpeg', status = 200): Response {
  return new Response(new Uint8Array(bytes), { status, headers: { 'content-type': contentType } });
}

function createService(stored: Goal = goal()) {
  const goalRepository = {
    findOne: vi.fn(async () => stored),
    save: vi.fn(async (data: Goal) => data),
  } as any;

  // A cache that always misses, so every test exercises the upstream path.
  const cacheManager = {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  } as any;

  const auditService = { createEvent: vi.fn(async () => undefined) } as any;

  return {
    service: new GoalCoversService(goalRepository, cacheManager, auditService, new EffectRuntime()),
    goalRepository,
    cacheManager,
    auditService,
  };
}

describe('GoalCoversService', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
    mocked.mkdir.mockResolvedValue(undefined);
    mocked.writeFile.mockResolvedValue(undefined);
    mocked.unlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('search', () => {
    it('asks only for photos it would be allowed to store and show', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>jsonResponse({ results: [], page_count: 1 }));

      await service.search('beach');

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.origin).toBe('https://api.openverse.org');
      expect(url.searchParams.get('q')).toBe('beach');
      expect(url.searchParams.get('license_type')).toBe('commercial');
      expect(url.searchParams.get('mature')).toBe('false');
      expect(url.searchParams.get('extension')).toBe('jpg,png,webp');
    });

    it('drops a result with no credit line, because showing it would be unlawful', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>
        jsonResponse({
          page_count: 1,
          results: [
            { id: PHOTO_ID, title: 'Beach', attribution: '"Beach" by Ann, CC BY 2.0' },
            { id: 'no-credit', title: 'Orphan' },
          ],
        }),
      );

      const page = await service.search('beach');

      expect(page.results).toHaveLength(1);
      expect(page.results[0].id).toBe(PHOTO_ID);
    });

    it('refuses a non-https source link rather than handing the client a javascript: URL', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>
        jsonResponse({
          page_count: 1,
          results: [
            {
              id: PHOTO_ID,
              title: 'Beach',
              attribution: 'credit',
              // biome-ignore lint/suspicious/noExplicitAny: deliberately hostile upstream value
              foreign_landing_url: 'javascript:alert(1)' as any,
              license_url: 'http://example.test/licence',
            },
          ],
        }),
      );

      const page = await service.search('beach');

      expect(page.results[0].sourceUrl).toBeNull();
      // http, not https: dropped for the same reason.
      expect(page.results[0].licenseUrl).toBeNull();
    });

    it('says the allowance is used up rather than that the search is broken', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>jsonResponse({}, 429));

      await expect(service.search('beach')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reports a dead upstream as a gateway failure', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>jsonResponse({}, 500));

      await expect(service.search('beach')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('reports a hasMore page only while pages remain', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async () =>jsonResponse({ results: [], page_count: 3 }));

      await expect(service.search('beach', 3)).resolves.toMatchObject({ hasMore: false });
      await expect(service.search('beach', 2)).resolves.toMatchObject({ hasMore: true });
    });
  });

  describe('setCover', () => {
    it('refuses a request that names both a preset and a photo', async () => {
      const { service } = createService();

      await expect(
        service.setCover('goal-1', WORKSPACE_ID, USER_ID, { preset: 'travel', photoId: PHOTO_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a request that names neither', async () => {
      const { service } = createService();

      await expect(
        service.setCover('goal-1', WORKSPACE_ID, USER_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('scopes the lookup to the workspace, so another tenant cannot be touched', async () => {
      const { service, goalRepository } = createService();

      await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { preset: 'travel' });

      expect(goalRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'goal-1', workspaceId: WORKSPACE_ID },
      });
    });

    it('clears the photo when a preset replaces it, and deletes the orphaned file', async () => {
      const { service, goalRepository } = createService(
        goal({ coverFile: 'old.jpg', coverAttribution: 'old credit' }),
      );

      const saved = await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { preset: 'travel' });

      expect(saved.coverPreset).toBe('travel');
      expect(saved.coverFile).toBeNull();
      expect(saved.coverAttribution).toBeNull();
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old.jpg'));
      // The row is saved before the file is removed, never the other way round.
      const saveOrder = goalRepository.save.mock.invocationCallOrder[0];
      const unlinkOrder = mocked.unlink.mock.invocationCallOrder[0];
      expect(saveOrder).toBeLessThan(unlinkOrder);
    });

    it('stores a photo with the credit line read back from upstream', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async (input: string | URL) =>
        String(input).endsWith('/thumb/')
          ? imageResponse(Buffer.from([0xff, 0xd8, 0xff]))
          : jsonResponse({
              attribution: '"Beach" by Ann is licensed under CC BY 2.0.',
              foreign_landing_url: 'https://www.flickr.com/photos/ann/1',
            }),
      );

      const saved = await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { photoId: PHOTO_ID });

      expect(saved.coverPreset).toBeNull();
      expect(saved.coverFile).toMatch(/\.jpg$/);
      expect(saved.coverAttribution).toBe('"Beach" by Ann is licensed under CC BY 2.0.');
      expect(saved.coverSourceUrl).toBe('https://www.flickr.com/photos/ann/1');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('names the stored file itself, so upstream cannot choose the extension', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async (input: string | URL) =>
        String(input).endsWith('/thumb/')
          ? imageResponse(Buffer.from([0x89, 0x50]), 'image/png')
          : jsonResponse({ attribution: 'credit' }),
      );

      const saved = await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { photoId: PHOTO_ID });

      // The extension comes from the allowlisted content type, not from a name.
      expect(saved.coverFile).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
      );
    });

    it('refuses an SVG, which would run as script on our own origin', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async (input: string | URL) =>
        String(input).endsWith('/thumb/')
          ? imageResponse(Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml')
          : jsonResponse({ attribution: 'credit' }),
      );

      await expect(
        service.setCover('goal-1', WORKSPACE_ID, USER_ID, { photoId: PHOTO_ID }),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('keeps the picture when only the credit line fails to load', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async (input: string | URL) =>
        String(input).endsWith('/thumb/')
          ? imageResponse(Buffer.from([0xff, 0xd8]))
          : jsonResponse({}, 500),
      );

      const saved = await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { photoId: PHOTO_ID });

      expect(saved.coverFile).toMatch(/\.jpg$/);
      expect(saved.coverAttribution).toBeNull();
    });

    it('builds the thumbnail URL from the id as a path segment on the fixed host', async () => {
      const { service } = createService();
      fetchSpy.mockImplementation(async (input: string | URL) =>
        String(input).endsWith('/thumb/')
          ? imageResponse(Buffer.from([0xff]))
          : jsonResponse({ attribution: 'credit' }),
      );

      await service.setCover('goal-1', WORKSPACE_ID, USER_ID, { photoId: PHOTO_ID });

      expect(fetchSpy.mock.calls.map(([input]) => String(input))).toContain(
        `https://api.openverse.org/v1/images/${PHOTO_ID}/thumb/`,
      );
      // No trace headers go to the third party.
      const [, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
      expect(Object.keys(init.headers ?? {})).not.toEqual(
        expect.arrayContaining(['traceparent']),
      );
    });
  });

  describe('clearCover', () => {
    it('empties every cover column and removes the file', async () => {
      const { service } = createService(
        goal({ coverFile: 'kept.jpg', coverAttribution: 'credit', coverSourceUrl: 'https://x.test' }),
      );

      const saved = await service.clearCover('goal-1', WORKSPACE_ID, USER_ID);

      expect(saved.coverPreset).toBeNull();
      expect(saved.coverFile).toBeNull();
      expect(saved.coverAttribution).toBeNull();
      expect(saved.coverSourceUrl).toBeNull();
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('kept.jpg'));
    });
  });

});
