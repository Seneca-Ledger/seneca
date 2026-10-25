import { decodeBody, rejectedFields } from '../../../helpers/schema-body';
import { SplitTransactionBody } from '@/contracts';
import { TransactionsController } from '@/modules/transactions/transactions.controller';

describe('TransactionsController', () => {
  it('parses query params in findAll', async () => {
    const transactionsService = {
      findAll: vi.fn(async () => ({ data: [], total: 0, page: 2, limit: 10 })),
      findOne: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn(),
      remove: vi.fn(),
    };
    const controller = new TransactionsController(transactionsService as any, {} as any);

    const res = await controller.findAll(
      { id: 'u1' } as any,
      'ws-1',
      'member-self',
      {
        statement_id: 's1',
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        type: 'income',
        category_id: 'cat1',
        page: 2,
        limit: 10,
      },
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
      findAll: vi.fn(async () => ({ data: [], total: 0, page: 1, limit: 50 })),
      findOne: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn(),
      remove: vi.fn(),
    };
    const controller = new TransactionsController(transactionsService as any, {} as any);

    await controller.findAll(
      { id: 'u1' } as any,
      'ws-1',
      'member-self',
      { owner: owner as 'me' | 'shared' | undefined },
    );

    expect(transactionsService.findAll).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ owner: expected }),
      'member-self',
    );
  });

  it('bulkUpdate forwards items', async () => {
    const transactionsService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn(async () => [{ id: 't1' }]),
      remove: vi.fn(),
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
      const transactionsService = { getSplitParts: vi.fn(async () => parts) };
      const controller = new TransactionsController(transactionsService as any, {} as any);

      const result = await controller.getSplitParts({ id: 't1' }, 'ws-1');

      expect(result).toBe(parts);
      expect(transactionsService.getSplitParts).toHaveBeenCalledWith('t1', 'ws-1');
    });

    it('split delegates with (id, workspaceId, userId, dto)', async () => {
      const created = [{ id: 'p1' }, { id: 'p2' }];
      const transactionsService = { split: vi.fn(async () => created) };
      const controller = new TransactionsController(transactionsService as any, {} as any);
      const dto = { parts: [{ amount: 60 }, { amount: 40 }] } as any;

      const result = await controller.split({ id: 't1' }, dto, { id: 'u1' } as any, 'ws-1');

      expect(result).toBe(created);
      expect(transactionsService.split).toHaveBeenCalledWith('t1', 'ws-1', 'u1', dto);
    });

    it('unsplit delegates with (id, workspaceId, userId)', async () => {
      const survivor = { id: 't1' };
      const transactionsService = { unsplit: vi.fn(async () => survivor) };
      const controller = new TransactionsController(transactionsService as any, {} as any);

      const result = await controller.unsplit({ id: 't1' }, { id: 'u1' } as any, 'ws-1');

      expect(result).toBe(survivor);
      expect(transactionsService.unsplit).toHaveBeenCalledWith('t1', 'ws-1', 'u1');
    });
  });

  describe('SplitTransactionBody validation', () => {
    it('accepts a valid two-part payload', () => {
      expect(
        rejectedFields(SplitTransactionBody, { parts: [{ amount: 60.5 }, { amount: 39.5 }] }),
      ).toEqual([]);
    });

    it('rejects a payload with a single part', () => {
      const { errors } = decodeBody(SplitTransactionBody, { parts: [{ amount: 100 }] });
      expect(errors).toEqual(['parts: Expected a value with a length of at least 2']);
    });

    it('rejects nested parts whose amount is not a positive number', () => {
      const { errors } = decodeBody(SplitTransactionBody, {
        parts: [{ amount: 'abc' }, { amount: -5 }],
      });
      expect(errors.map(message => message.split(':')[0])).toEqual([
        'parts.0.amount',
        'parts.1.amount',
      ]);
    });
  });
});
