import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyService } from '../../../../src/common/services/idempotency.service';
import { IdempotencyKey } from '../../../../src/entities/idempotency-key.entity';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repository: Repository<IdempotencyKey>;

  const mockRepository = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyKey),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    repository = module.get<Repository<IdempotencyKey>>(getRepositoryToken(IdempotencyKey));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkKey', () => {
    it('should return null if key does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.checkKey('test-key', 'user-id', 'workspace-id');

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          key: 'test-key',
          userId: 'user-id',
          workspaceId: 'workspace-id',
        },
      });
    });

    it('should return null and delete if key is expired', async () => {
      const expiredKey = {
        id: 'key-id',
        key: 'test-key',
        userId: 'user-id',
        workspaceId: 'workspace-id',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        responseData: { data: 'test' },
      };

      mockRepository.findOne.mockResolvedValue(expiredKey);

      const result = await service.checkKey('test-key', 'user-id', 'workspace-id');

      expect(result).toBeNull();
      expect(mockRepository.delete).toHaveBeenCalledWith('key-id');
    });

    it('should return cached response if key exists and is not expired', async () => {
      const validKey = {
        id: 'key-id',
        key: 'test-key',
        userId: 'user-id',
        workspaceId: 'workspace-id',
        expiresAt: new Date(Date.now() + 10000), // Expires in 10 seconds
        responseData: { data: 'test', results: [1, 2, 3] },
      };

      mockRepository.findOne.mockResolvedValue(validKey);

      const result = await service.checkKey('test-key', 'user-id', 'workspace-id');

      expect(result).toEqual({
        data: { data: 'test', results: [1, 2, 3] },
        cached: true,
      });
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle null workspace ID', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.checkKey('test-key', 'user-id', null);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          key: 'test-key',
          userId: 'user-id',
          workspaceId: null,
        },
      });
    });
  });

  describe('storeKey', () => {
    it('should store idempotency key with correct expiration', async () => {
      const responseData = { data: 'test', statementId: '123' };
      const createdKey = {
        key: 'test-key',
        userId: 'user-id',
        workspaceId: 'workspace-id',
        responseHash: expect.any(String),
        responseData,
        expiresAt: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(createdKey);
      mockRepository.save.mockResolvedValue(createdKey);

      await service.storeKey('test-key', 'user-id', 'workspace-id', responseData, 24);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-key',
          userId: 'user-id',
          workspaceId: 'workspace-id',
          responseData,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should set custom TTL', async () => {
      const responseData = { data: 'test' };
      mockRepository.create.mockImplementation(data => data);
      mockRepository.save.mockResolvedValue({});

      await service.storeKey('test-key', 'user-id', 'workspace-id', responseData, 48);

      const createCall = mockRepository.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt;
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should generate consistent hash for same response', async () => {
      const responseData = { data: 'test', id: '123' };
      mockRepository.create.mockImplementation(data => data);
      mockRepository.save.mockResolvedValue({});

      await service.storeKey('key1', 'user-id', 'workspace-id', responseData);
      const hash1 = mockRepository.create.mock.calls[0][0].responseHash;

      await service.storeKey('key2', 'user-id', 'workspace-id', responseData);
      const hash2 = mockRepository.create.mock.calls[1][0].responseHash;

      expect(hash1).toBe(hash2);
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should delete expired keys and return count', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 5 });

      const result = await service.cleanupExpiredKeys();

      expect(result).toBe(5);
      expect(mockRepository.delete).toHaveBeenCalledWith({
        expiresAt: expect.any(Object), // LessThan(new Date())
      });
    });

    it('should handle no expired keys', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.cleanupExpiredKeys();

      expect(result).toBe(0);
    });

    it('should handle null affected count', async () => {
      mockRepository.delete.mockResolvedValue({ affected: null });

      const result = await service.cleanupExpiredKeys();

      expect(result).toBe(0);
    });
  });
});
