import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomTableShareStatus } from '../../../src/entities/custom-table-share.entity';
import { CustomTableSharesService } from '../../../src/modules/custom-tables/custom-table-shares.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (v: unknown) => v),
  create: jest.fn((value?: unknown) => value),
  createQueryBuilder: jest.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'a'.repeat(64);

function buildService(share?: Record<string, unknown>) {
  const shareRepository = createRepositoryMock();
  const tableRepository = createRepositoryMock();
  const columnRepository = createRepositoryMock();
  const rowRepository = createRepositoryMock();
  const workspaceMemberRepository = createRepositoryMock();
  const auditService = { createEvent: jest.fn(), createBatchEvents: jest.fn() };

  tableRepository.createQueryBuilder.mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: TABLE_ID, name: 'Отчёт', description: null }),
  });
  tableRepository.findOne.mockResolvedValue({ id: TABLE_ID, name: 'Отчёт', description: null });
  columnRepository.find.mockResolvedValue([
    { key: 'a', title: 'A', type: 'text', position: 0 },
  ]);
  shareRepository.findOne.mockResolvedValue(share ?? null);
  rowRepository.createQueryBuilder.mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(2),
    getMany: jest.fn().mockResolvedValue([
      { id: 'secret-row-id', rowNumber: 1, data: { a: 'x' } },
    ]),
  });

  const service = new CustomTableSharesService(
    shareRepository as never,
    tableRepository as never,
    columnRepository as never,
    rowRepository as never,
    workspaceMemberRepository as never,
    auditService as never,
  );

  return { service, shareRepository, workspaceMemberRepository, auditService };
}

const activeShare = {
  id: 'share-1',
  tableId: TABLE_ID,
  workspaceId: 'ws-1',
  token: TOKEN,
  status: CustomTableShareStatus.ACTIVE,
  expiresAt: new Date(Date.now() + 86_400_000),
  accessCount: 0,
  lastAccessedAt: null,
};

describe('CustomTableSharesService', () => {
  it('refuses to create a share for a member without edit permission', async () => {
    const { service, workspaceMemberRepository } = buildService();
    workspaceMemberRepository.findOne.mockResolvedValue({
      role: 'member',
      permissions: { canEditCustomTables: false },
    });

    await expect(service.createShare('u1', 'ws-1', TABLE_ID, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('issues a long random token and records an audit event', async () => {
    const { service, auditService } = buildService();

    const { token } = await service.createShare('u1', 'ws-1', TABLE_ID, {});

    expect(token).toHaveLength(64);
    // Выдача доступа наружу обязана попадать в аудит.
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ share: 'created' }) }),
    );
  });

  it('always sets an expiry, even when the caller asks for none', async () => {
    const { service } = buildService();

    const { share } = await service.createShare('u1', 'ws-1', TABLE_ID, {});

    expect(share.expiresAt).toBeInstanceOf(Date);
  });

  it('refuses a revoked link', async () => {
    const { service } = buildService({
      ...activeShare,
      status: CustomTableShareStatus.REVOKED,
    });

    await expect(service.getSharedTable(TOKEN)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses and marks an expired link', async () => {
    const { service, shareRepository } = buildService({
      ...activeShare,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.getSharedTable(TOKEN)).rejects.toMatchObject({ response: { code: 'SHARE_LINK_EXPIRED' } });
    expect(shareRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: CustomTableShareStatus.EXPIRED }),
    );
  });

  it('rejects a malformed token without touching the database', async () => {
    const { service, shareRepository } = buildService();

    await expect(service.getSharedTable('short')).rejects.toBeInstanceOf(NotFoundException);
    expect(shareRepository.findOne).not.toHaveBeenCalled();
  });

  it('never exposes row ids through the public link', async () => {
    const { service } = buildService({ ...activeShare });

    const result = await service.getSharedRows(TOKEN, {});

    expect(result.items[0]).toEqual({ rowNumber: 1, data: { a: 'x' } });
    expect(JSON.stringify(result)).not.toContain('secret-row-id');
  });

  it('counts accesses so an owner can see the link was used', async () => {
    const { service, shareRepository } = buildService({ ...activeShare });

    await service.getSharedTable(TOKEN);

    expect(shareRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ accessCount: 1 }),
    );
  });
});
