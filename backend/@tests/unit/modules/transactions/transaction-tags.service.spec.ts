import { TransactionTagsService } from '@/modules/transactions/services/transaction-tags.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';

const createRepoMock = () =>
  ({
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (entity: unknown) => entity),
  }) as any;

describe('TransactionTagsService', () => {
  const transactionRepo = createRepoMock();
  const tagRepo = createRepoMock();
  let service: TransactionTagsService;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionRepo.save.mockImplementation(async (entity: unknown) => entity);
    service = new TransactionTagsService(transactionRepo, tagRepo);
  });

  it('refuses a transaction from another workspace', async () => {
    transactionRepo.findOne.mockResolvedValue(null);

    await expect(service.setTags('tx-1', 'ws-1', [])).rejects.toBeInstanceOf(NotFoundException);
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('refuses tag ids that do not belong to the workspace', async () => {
    transactionRepo.findOne.mockResolvedValue({ id: 'tx-1', workspaceId: 'ws-1', tags: [] });
    // Only one of the two requested tags is visible inside this workspace.
    tagRepo.find.mockResolvedValue([{ id: 'tag-mine', workspaceId: 'ws-1' }]);

    await expect(
      service.setTags('tx-1', 'ws-1', ['tag-mine', 'tag-of-another-tenant']),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(tagRepo.find).toHaveBeenCalledWith({
      where: { id: In(['tag-mine', 'tag-of-another-tenant']), workspaceId: 'ws-1' },
    });
  });

  it('replaces the tag set and de-duplicates the requested ids', async () => {
    const transaction = { id: 'tx-1', workspaceId: 'ws-1', tags: [{ id: 'old-tag' }] };
    transactionRepo.findOne.mockResolvedValue(transaction);
    tagRepo.find.mockResolvedValue([{ id: 'tag-a', workspaceId: 'ws-1' }]);

    const result = await service.setTags('tx-1', 'ws-1', ['tag-a', 'tag-a']);

    expect(tagRepo.find).toHaveBeenCalledWith({
      where: { id: In(['tag-a']), workspaceId: 'ws-1' },
    });
    expect(result).toEqual([{ id: 'tag-a', workspaceId: 'ws-1' }]);
    expect(transaction.tags).toEqual([{ id: 'tag-a', workspaceId: 'ws-1' }]);
  });

  it('clears every tag on an empty payload without querying tags', async () => {
    const transaction = { id: 'tx-1', workspaceId: 'ws-1', tags: [{ id: 'old-tag' }] };
    transactionRepo.findOne.mockResolvedValue(transaction);

    const result = await service.setTags('tx-1', 'ws-1', []);

    expect(result).toEqual([]);
    expect(transaction.tags).toEqual([]);
    expect(tagRepo.find).not.toHaveBeenCalled();
    expect(transactionRepo.save).toHaveBeenCalled();
  });
});
