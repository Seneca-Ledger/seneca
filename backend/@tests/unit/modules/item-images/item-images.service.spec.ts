import * as fs from 'node:fs/promises';
import { NotFoundException } from '@nestjs/common';
import { ItemImagesService } from '@/modules/item-images/item-images.service';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  unlink: vi.fn(async () => undefined),
}));

const WORKSPACE = 'workspace-1';
const ME = 'member-1';
const TX = '11111111-1111-4111-8111-111111111111';
const OTHER_TX = '22222222-2222-4222-8222-222222222222';
const BILL = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, unknown>;

/** `where` with In(...) values, matched the way Postgres would. */
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    const list = (value as { _value?: unknown })?._value;
    return Array.isArray(list) ? list.includes(row[key]) : row[key] === value;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    find: vi.fn(async ({ where }: { where: Row }) => rows.filter(row => matches(row, where))),
    findOne: vi.fn(async ({ where }: { where: Row }) => rows.find(row => matches(row, where)) ?? null),
    exists: vi.fn(async ({ where }: { where: Row }) => rows.some(row => matches(row, where))),
    create: vi.fn((row: Row) => row),
    save: vi.fn(async (row: Row) => {
      const saved = { id: row.id ?? `image-${rows.length + 1}`, ...row };
      const index = rows.findIndex(existing => existing.id === saved.id);
      if (index >= 0) rows[index] = saved;
      else rows.push(saved);
      return saved;
    }),
    manager: { query: vi.fn(async () => []) },
    delete: vi.fn(async ({ id }: { id: { _value: string[] } }) => {
      for (const doomed of id._value) rows.splice(rows.findIndex(row => row.id === doomed), 1);
    }),
  };
}

function setup({
  images = [] as Row[],
  transactions = [{ id: TX, workspaceId: WORKSPACE, isPrivate: false, ownerMemberId: ME }] as Row[],
  payables = [] as Row[],
  payments = [] as Row[],
} = {}) {
  const repos = {
    images: table(images),
    transactions: table(transactions),
    payables: table(payables),
    payments: table(payments),
  };
  const source = {
    picture: vi.fn(async () => ({ body: Buffer.from([1]), contentType: 'image/png' })),
    labelOf: vi.fn(async () => 'Example Mini'),
  };
  const service = new ItemImagesService(
    repos.images as any,
    repos.transactions as any,
    repos.payables as any,
    repos.payments as any,
    source as any,
  );
  return { service, repos, source };
}

describe('ItemImagesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers a transaction’s own picture', async () => {
    const { service } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, transactionId: TX, fileName: 'a.png', label: 'Mini' }],
    });

    expect(await service.forTransactions(WORKSPACE, [TX], ME)).toEqual([
      { subjectId: TX, url: '/uploads/item-images/a.png', label: 'Mini' },
    ]);
  });

  it('shows the picture of the bill a transaction settled', async () => {
    const { service } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, payableId: BILL, fileName: 'b.png', label: null }],
      payables: [{ id: BILL, workspaceId: WORKSPACE, linkedTransactionId: TX }],
    });

    expect(await service.forTransactions(WORKSPACE, [TX], ME)).toEqual([
      { subjectId: TX, url: '/uploads/item-images/b.png', label: null },
    ]);
  });

  it('shows a bill the picture of a payment recorded against it', async () => {
    const { service } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, transactionId: TX, fileName: 'c.png', label: null }],
      payables: [{ id: BILL, workspaceId: WORKSPACE, linkedTransactionId: null }],
      payments: [{ workspaceId: WORKSPACE, payableId: BILL, transactionId: TX }],
    });

    expect(await service.forPayables(WORKSPACE, [BILL], ME)).toEqual([
      { subjectId: BILL, url: '/uploads/item-images/c.png', label: null },
    ]);
  });

  it('shows nothing of someone else’s private transaction', async () => {
    const { service } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, transactionId: TX, fileName: 'a.png', label: 'Mini' }],
      transactions: [{ id: TX, workspaceId: WORKSPACE, isPrivate: true, ownerMemberId: 'member-2' }],
      payables: [{ id: BILL, workspaceId: WORKSPACE, linkedTransactionId: TX }],
    });

    expect(await service.forTransactions(WORKSPACE, [TX], ME)).toEqual([]);
    expect(await service.forPayables(WORKSPACE, [BILL], ME)).toEqual([]);
  });

  it('ignores ids of another workspace and anything that is not a uuid', async () => {
    const { service, repos } = setup({
      transactions: [{ id: OTHER_TX, workspaceId: 'workspace-2', isPrivate: false, ownerMemberId: null }],
    });

    expect(await service.forTransactions(WORKSPACE, [OTHER_TX, 'not-an-id'], ME)).toEqual([]);
    expect(repos.transactions.find.mock.calls[0][0].where.workspaceId).toBe(WORKSPACE);
  });

  it('stores a picked picture and replaces the previous file', async () => {
    const { service, repos } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, transactionId: TX, fileName: 'old.png', label: null }],
    });

    const answer = await service.set('transaction', WORKSPACE, TX, 'Q1001', ME);

    expect(answer.subjectId).toBe(TX);
    expect(answer.url).toMatch(/^\/uploads\/item-images\/[0-9a-f-]{36}\.png$/);
    expect(answer.label).toBe('Example Mini');
    expect(repos.images.rows).toHaveLength(1);
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(expect.stringMatching(/old\.png$/));
  });

  it('will not set a picture on a transaction of another workspace', async () => {
    const { service, source } = setup({
      transactions: [{ id: OTHER_TX, workspaceId: 'workspace-2', isPrivate: false, ownerMemberId: null }],
    });

    await expect(service.set('transaction', WORKSPACE, OTHER_TX, 'Q1', ME)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(source.picture).not.toHaveBeenCalled();
  });

  it('removing from a transaction without its own picture removes the bill’s', async () => {
    const { service, repos } = setup({
      images: [{ id: 'i1', workspaceId: WORKSPACE, payableId: BILL, fileName: 'b.png', label: null }],
      payables: [{ id: BILL, workspaceId: WORKSPACE, linkedTransactionId: TX }],
    });

    await service.remove('transaction', WORKSPACE, TX, ME);

    expect(repos.images.rows).toEqual([]);
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(expect.stringMatching(/b\.png$/));
  });

  it('names no vendor for someone else’s private transaction', async () => {
    const { service, repos } = setup({
      transactions: [{ id: TX, workspaceId: WORKSPACE, isPrivate: true, ownerMemberId: 'member-2' }],
    });

    expect(await service.vendorsForTransactions(WORKSPACE, [TX], ME)).toEqual([]);
    expect(repos.images.manager.query).not.toHaveBeenCalled();
  });
});
