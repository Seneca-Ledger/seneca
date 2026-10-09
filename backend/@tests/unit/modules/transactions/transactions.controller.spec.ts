import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SplitTransactionDto } from '@/modules/transactions/dto/split-transaction.dto';
import { TransactionsController } from '@/modules/transactions/transactions.controller';

describe('TransactionsController', () => {
  it('parses query params in findAll', async () => {
    const transactionsService = {
      findAll: jest.fn(async () => ({ data: [], total: 0, page: 2, limit: 10 })),
      findOne: jest.fn(),
      update: jest.fn(),
      bulkUpdate: jest.fn(),
      remove: jest.fn(),
    };
    const controller = new TransactionsController(transactionsService as any, {} as any);

    const res = await controller.findAll(
      { id: 'u1' } as any,
      'ws-1',
      'member-self',
      's1',
      undefined,
      '2025-01-01',
      undefined,
      '2025-01-31',
      undefined,
      'income',
      'cat1',
      undefined,
      '2',
      '10',
    );

    expect(res).toEqual({ data: [], items: [], total: 0, page: 2, limit: 10 });
    expect(transactionsService.findAll).toHaveBeenCalledWith(
      'ws-1',
      {
        statementId: 's1',
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-01-31'),
        type: 'income',
        categoryId: 'cat1',
        owner: { kind: 'all' },
        page: 2,
        limit: 10,
      },
      'member-self',
    );
  });

  it.each([
    ['me', { kind: 'member', memberId: 'member-self' }],
    ['shared', { kind: 'shared' }],
    ['member-partner', { kind: 'member', memberId: 'member-partner' }],
    [undefined, { kind: 'all' }],
  ])('turns owner=%s into %o', async (owner, expected) => {
    const transactionsService = {
      findAll: jest.fn(async () => ({ data: [], total: 0, page: 1, limit: 50 })),
      findOne: jest.fn(),
      update: jest.fn(),
      bulkUpdate: jest.fn(),
      remove: jest.fn(),
    };
    const controller = new TransactionsController(transactionsService as any, {} as any);

    await controller.findAll(
      { id: 'u1' } as any,
      'ws-1',
      'member-self',
      // statementId ×2, dateFrom ×2, dateTo ×2, type, categoryId ×2, page,
      // limit, currency, convert_to — then owner.
      ...(Array.from({ length: 13 }) as undefined[]),
      owner as string | undefined,
    );

    expect(transactionsService.findAll).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ owner: expected }),
      'member-self',
    );
  });

  it('bulkUpdate forwards items', async () => {
    const transactionsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      bulkUpdate: jest.fn(async () => [{ id: 't1' }]),
      remove: jest.fn(),
    };
    const controller = new TransactionsController(transactionsService as any, {} as any);
    const result = await controller.bulkUpdate(
      { items: [{ id: 't1', updates: { amount: 1 } }] } as any,
      { id: 'u1' } as any,
      'ws-1',
      'member-self',
    );
    expect(result).toEqual([{ id: 't1' }]);
    expect(transactionsService.bulkUpdate).toHaveBeenCalledWith(
      'ws-1',
      'u1',
      [{ id: 't1', updates: { amount: 1 } }],
      'member-self',
    );
  });

  describe('split routes', () => {
    it('getSplitParts delegates with (id, workspaceId)', async () => {
      const parts = [{ id: 'p1' }, { id: 'p2' }];
      const transactionsService = { getSplitParts: jest.fn(async () => parts) };
      const controller = new TransactionsController(transactionsService as any, {} as any);

      const result = await controller.getSplitParts('t1', 'ws-1');

      expect(result).toBe(parts);
      expect(transactionsService.getSplitParts).toHaveBeenCalledWith('t1', 'ws-1');
    });

    it('split delegates with (id, workspaceId, userId, dto)', async () => {
      const created = [{ id: 'p1' }, { id: 'p2' }];
      const transactionsService = { split: jest.fn(async () => created) };
      const controller = new TransactionsController(transactionsService as any, {} as any);
      const dto = { parts: [{ amount: 60 }, { amount: 40 }] } as any;

      const result = await controller.split('t1', dto, { id: 'u1' } as any, 'ws-1');

      expect(result).toBe(created);
      expect(transactionsService.split).toHaveBeenCalledWith('t1', 'ws-1', 'u1', dto);
    });

    it('unsplit delegates with (id, workspaceId, userId)', async () => {
      const survivor = { id: 't1' };
      const transactionsService = { unsplit: jest.fn(async () => survivor) };
      const controller = new TransactionsController(transactionsService as any, {} as any);

      const result = await controller.unsplit('t1', { id: 'u1' } as any, 'ws-1');

      expect(result).toBe(survivor);
      expect(transactionsService.unsplit).toHaveBeenCalledWith('t1', 'ws-1', 'u1');
    });
  });

  describe('SplitTransactionDto validation', () => {
    it('accepts a valid two-part payload', async () => {
      const dto = plainToInstance(SplitTransactionDto, {
        parts: [{ amount: 60.5 }, { amount: 39.5 }],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects a payload with a single part', async () => {
      const dto = plainToInstance(SplitTransactionDto, { parts: [{ amount: 100 }] });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('parts');
      expect(errors[0].constraints).toHaveProperty('arrayMinSize');
    });

    it('rejects nested parts whose amount is not a positive number', async () => {
      const dto = plainToInstance(SplitTransactionDto, {
        parts: [{ amount: 'abc' }, { amount: -5 }],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('parts');
      expect(errors[0].children).toHaveLength(2);
      expect(errors[0].children?.[0].children?.[0].constraints).toHaveProperty('isNumber');
      expect(errors[0].children?.[1].children?.[0].constraints).toHaveProperty('isPositive');
    });
  });
});
