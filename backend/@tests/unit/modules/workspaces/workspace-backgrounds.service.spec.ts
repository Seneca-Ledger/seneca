import * as fs from 'node:fs/promises';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { fetchPublicUrl } from '@/common/utils/egress-url.util';
import { type Workspace, WorkspaceRole } from '@/entities';
import { WorkspaceBackgroundsService } from '@/modules/workspaces/workspace-backgrounds.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined),
}));

jest.mock('@/common/utils/egress-url.util', () => ({
  fetchPublicUrl: jest.fn(),
}));

// sharp is a native module; the pipeline is replaced by one that tags its
// input, so a test can tell which bytes ended up on disk.
jest.mock('sharp', () => ({
  __esModule: true,
  default: (input: Buffer) => {
    const chain = {
      rotate: () => chain,
      resize: () => chain,
      jpeg: () => chain,
      toBuffer: async () => Buffer.concat([Buffer.from('encoded:'), input]),
    };
    return chain;
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedFetchPublicUrl = fetchPublicUrl as jest.MockedFunction<typeof fetchPublicUrl>;

const WORKSPACE_ID = '99999999-8888-7777-6666-555555555555';
const USER_ID = 'user-1';
const PHOTO_ID = '11111111-2222-3333-4444-555555555555';
const ORIGINAL_URL = 'https://cdn.example.test/full/fjord.jpg';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

function imageResponse(bytes: Buffer, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  } as unknown as Response;
}

const DETAIL = {
  id: PHOTO_ID,
  attribution: '"Fjord" by Ann, CC BY 2.0',
  foreign_landing_url: 'https://www.flickr.com/photos/ann/1',
  url: ORIGINAL_URL,
};

function createService(role: WorkspaceRole | null = WorkspaceRole.OWNER) {
  const stored = {
    id: WORKSPACE_ID,
    backgroundImage: 'adrien-olichon.jpg',
    backgroundAttribution: null,
    backgroundSourceUrl: null,
  } as Workspace;
  const workspaceRepository = {
    findOne: jest.fn(async () => stored),
    save: jest.fn(async (data: Workspace) => data),
  } as any;
  const workspaceMemberRepository = {
    findOne: jest.fn(async () => (role ? { workspaceId: WORKSPACE_ID, userId: USER_ID, role } : null)),
  } as any;
  const cacheManager = {
    get: jest.fn(async () => undefined),
    set: jest.fn(async () => undefined),
  } as any;
  const auditService = { createEvent: jest.fn(async () => undefined) } as any;

  return {
    service: new WorkspaceBackgroundsService(
      workspaceRepository,
      workspaceMemberRepository,
      cacheManager,
      auditService,
    ),
    workspaceRepository,
    cacheManager,
    auditService,
  };
}

describe('WorkspaceBackgroundsService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('search', () => {
    it('asks for wide, large photographs so results read as wallpaper', async () => {
      const { service } = createService();
      fetchSpy.mockResolvedValue(jsonResponse({ results: [], page_count: 1 }));

      await service.search('  Mountain Lake ');

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.origin).toBe('https://api.openverse.org');
      expect(url.searchParams.get('q')).toBe('mountain lake');
      expect(url.searchParams.get('category')).toBe('photograph');
      expect(url.searchParams.get('aspect_ratio')).toBe('wide');
      expect(url.searchParams.get('size')).toBe('large');
      expect(url.searchParams.get('mature')).toBe('false');
    });

    it('serves a cached page without spending the upstream allowance', async () => {
      const { service, cacheManager } = createService();
      const page = { results: [], page: 1, hasMore: false };
      cacheManager.get.mockResolvedValueOnce(page);

      await expect(service.search('fjord')).resolves.toEqual(page);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cacheManager.get).toHaveBeenCalledWith('workspace-bg-search:v1:1:fjord');
    });

    it('drops results with no credit line', async () => {
      const { service, cacheManager } = createService();
      fetchSpy.mockResolvedValue(
        jsonResponse({
          page_count: 2,
          results: [{ id: PHOTO_ID, attribution: 'credit' }, { id: 'no-credit' }],
        }),
      );

      const page = await service.search('fjord');

      expect(page.results.map(result => result.id)).toEqual([PHOTO_ID]);
      expect(page.hasMore).toBe(true);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'workspace-bg-search:v1:1:fjord',
        page,
        expect.any(Number),
      );
    });
  });

  describe('setPhoto', () => {
    it('refuses a member who cannot edit workspace settings before calling upstream', async () => {
      const { service, workspaceRepository } = createService(WorkspaceRole.MEMBER);

      await expect(service.setPhoto(WORKSPACE_ID, USER_ID, PHOTO_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(workspaceRepository.save).not.toHaveBeenCalled();
    });

    it('refuses someone outside the workspace', async () => {
      const { service } = createService(null);

      await expect(service.setPhoto(WORKSPACE_ID, USER_ID, PHOTO_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('stores the original, re-encoded, with its credit line', async () => {
      const { service, workspaceRepository, auditService } = createService();
      fetchSpy.mockResolvedValueOnce(jsonResponse(DETAIL));
      mockedFetchPublicUrl.mockResolvedValueOnce(imageResponse(Buffer.from('original')));

      const result = await service.setPhoto(WORKSPACE_ID, USER_ID, PHOTO_ID);

      // The original's host comes from upstream data, so it goes through the egress guard.
      expect(mockedFetchPublicUrl).toHaveBeenCalledWith(ORIGINAL_URL, expect.any(Object));
      expect(result.backgroundImage).toMatch(/^\/uploads\/workspace-backgrounds\/[0-9a-f-]{36}\.jpg$/);
      expect(result.backgroundAttribution).toBe(DETAIL.attribution);
      expect(result.backgroundSourceUrl).toBe(DETAIL.foreign_landing_url);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('workspace-backgrounds'),
        Buffer.from('encoded:original'),
      );
      expect(workspaceRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          diff: expect.objectContaining({
            before: expect.objectContaining({ backgroundImage: 'adrien-olichon.jpg' }),
          }),
        }),
      );
    });

    it('falls back to the thumbnail when the original cannot be fetched', async () => {
      const { service } = createService();
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(DETAIL))
        .mockResolvedValueOnce(imageResponse(Buffer.from('thumb')));
      mockedFetchPublicUrl.mockResolvedValueOnce(imageResponse(Buffer.alloc(0), 404));

      await service.setPhoto(WORKSPACE_ID, USER_ID, PHOTO_ID);

      expect(fetchSpy.mock.calls[1][0]).toBe(`https://api.openverse.org/v1/images/${PHOTO_ID}/thumb/`);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        Buffer.from('encoded:thumb'),
      );
    });

    it('refuses a photo whose credit line is gone, and writes nothing', async () => {
      const { service, workspaceRepository } = createService();
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ...DETAIL, attribution: null }));

      await expect(service.setPhoto(WORKSPACE_ID, USER_ID, PHOTO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
      expect(workspaceRepository.save).not.toHaveBeenCalled();
    });
  });
});
