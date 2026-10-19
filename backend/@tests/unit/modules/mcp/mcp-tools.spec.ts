import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { McpTool, McpToolContext } from '@/modules/mcp/mcp-tool';
import { moneyTools } from '@/modules/mcp/tools/money.tools';
import { planningTools } from '@/modules/mcp/tools/planning.tools';
import { receiptTools } from '@/modules/mcp/tools/receipts.tools';
import { reviewTools } from '@/modules/mcp/tools/review.tools';
import { statementTools } from '@/modules/mcp/tools/statements.tools';
import { taxTools } from '@/modules/mcp/tools/tax.tools';
import { transactionTools } from '@/modules/mcp/tools/transactions.tools';
import { BadRequestException, ConflictException } from '@nestjs/common';

// The uploads directory is read when the file helpers load, so it is fixed before any import.
jest.mock('@/common/utils/uploads.util', () => {
  const dir = require('node:path').join(require('node:os').tmpdir(), 'mcp-tools-spec');
  require('node:fs').mkdirSync(dir, { recursive: true });
  const actual = jest.requireActual('@/common/utils/uploads.util');
  return {
    resolveUploadsDir: () => dir,
    resolveInUploadsDir: (candidate: string, root: string = dir) =>
      actual.resolveInUploadsDir(candidate, root),
  };
});
const uploadsDir = path.join(os.tmpdir(), 'mcp-tools-spec');

const ctx = {
  user: { id: 'user-1', locale: 'de' },
  workspaceId: 'ws-1',
  memberId: 'member-1',
  subject: {},
  auditActor: { actorType: 'integration', actorLabel: 'key' },
} as unknown as McpToolContext;

const tool = (tools: McpTool[], name: string): McpTool => {
  const found = tools.find(candidate => candidate.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

afterAll(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

describe('transaction tools', () => {
  const transactions = { update: jest.fn(), bulkUpdate: jest.fn(), findAll: jest.fn() };
  const tools = transactionTools(transactions as never);

  beforeEach(() => jest.clearAllMocks());

  it('updates one transaction as the caller, seeing it as their member', async () => {
    await tool(tools, 'update_transaction').run(ctx, { id: 't1', comments: 'lunch', categoryId: null });

    expect(transactions.update).toHaveBeenCalledWith(
      't1',
      'ws-1',
      'user-1',
      { comments: 'lunch', categoryId: null },
      null,
      'member-1',
    );
  });

  it('puts many transactions into one category and answers how many changed', async () => {
    transactions.bulkUpdate.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await tool(tools, 'set_transactions_category').run(ctx, {
      transactionIds: ['a', 'b'],
      categoryId: 'c1',
    });

    expect(transactions.bulkUpdate).toHaveBeenCalledWith(
      'ws-1',
      'user-1',
      [
        { id: 'a', updates: { categoryId: 'c1' } },
        { id: 'b', updates: { categoryId: 'c1' } },
      ],
      'member-1',
    );
    expect(result).toEqual({ updated: 2 });
  });

  it('lists with day filters turned into dates and the default page size', async () => {
    await tool(tools, 'list_transactions').run(ctx, { dateFrom: '2026-01-01', type: 'expense' });

    expect(transactions.findAll).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        dateFrom: new Date('2026-01-01'),
        type: 'expense',
        page: 1,
        limit: 50,
      }),
      'member-1',
    );
  });
});

describe('review tools', () => {
  const review = { counts: jest.fn(), list: jest.fn(), approveTransactions: jest.fn() };
  const tools = reviewTools(review as never);

  it('counts the caller’s own queue when asked for “me”', async () => {
    await tool(tools, 'get_review_counts').run(ctx, { reviewer: 'me' });

    expect(review.counts).toHaveBeenCalledWith('ws-1', {
      kind: 'memberOrShared',
      memberId: 'member-1',
    });
  });

  it('lists the queue as the caller sees it', async () => {
    await tool(tools, 'list_review_inbox').run(ctx, { kind: 'receipt', limit: 10 });

    expect(review.list).toHaveBeenCalledWith('ws-1', { kind: 'receipt', limit: 10 }, 'member-1');
  });
});

describe('receipt tools', () => {
  const receipts = { approve: jest.fn(), findOne: jest.fn() };
  const tools = receiptTools(receipts as never);

  it('attaches a receipt to the bank row it names', async () => {
    receipts.approve.mockResolvedValue({
      receipt: { id: 'r1', status: 'approved' },
      transaction: { id: 't1' },
      attached: true,
    });

    const result = await tool(tools, 'approve_receipt').run(ctx, { id: 'r1', transactionId: 't1' });

    expect(receipts.approve).toHaveBeenCalledWith('r1', 'ws-1', 'user-1', { attachTo: 't1' });
    expect(result).toEqual({ receiptId: 'r1', status: 'approved', transactionId: 't1', attached: true });
  });

  it('refuses a receipt that is not in the workspace', async () => {
    receipts.findOne.mockResolvedValue(null);

    await expect(tool(tools, 'get_receipt').run(ctx, { id: 'r9' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('tax tools', () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({ id: `row-${i}` }));
  const taxPack = { yearReport: jest.fn(async () => ({ year: 2025, rows, categories: [] })) };
  const tools = taxTools({ deadlines: {} as never, taxPack: taxPack as never });

  it('leaves the rows out of the year report unless asked, and caps them', async () => {
    const without = (await tool(tools, 'get_tax_year_report').run(ctx, { year: 2025 })) as {
      rows: unknown[];
    };
    const withRows = (await tool(tools, 'get_tax_year_report').run(ctx, {
      year: 2025,
      includeRows: true,
    })) as { rows: unknown[] };

    expect(taxPack.yearReport).toHaveBeenCalledWith('ws-1', 2025, 'member-1');
    expect(without.rows).toEqual([]);
    expect(withRows.rows).toHaveLength(200);
  });
});

describe('planning and money tools', () => {
  it('reads budgets for the periods around a given day', async () => {
    const budgets = { findAll: jest.fn() };
    const tools = planningTools({
      budgets: budgets as never,
      stoicLedger: {} as never,
      goals: {} as never,
      forecast: {} as never,
    });

    await tool(tools, 'list_budgets').run(ctx, { date: '2026-03-15' });

    const [, at] = budgets.findAll.mock.calls[0];
    expect(at).toBeInstanceOf(Date);
    expect((at as Date).getDate()).toBe(15);
  });

  it('sums receivables when asked for money owed to the workspace', async () => {
    const payables = { getSummary: jest.fn() };
    const tools = moneyTools({
      netWorth: {} as never,
      wallets: {} as never,
      invoices: {} as never,
      invoiceAgeing: {} as never,
      payables: payables as never,
    });

    await tool(tools, 'get_payables_summary').run(ctx, { direction: 'receivable' });

    expect(payables.getSummary).toHaveBeenCalledWith('ws-1', 'receivable');
  });
});

describe('upload tools', () => {
  const statements = { create: jest.fn() };
  const tools = statementTools(statements as never, {} as never);
  const csv = Buffer.from('date,amount,description\n2026-01-02,-5.00,Coffee\n').toString('base64');

  beforeEach(() => jest.clearAllMocks());

  it('writes the file, validates it and creates the statement as the caller', async () => {
    statements.create.mockResolvedValue({ id: 's1', status: 'uploaded', fileName: 'bank.csv' });

    const result = await tool(tools, 'upload_statement').run(ctx, {
      fileName: 'bank.csv',
      fileBase64: csv,
    });

    const [user, workspaceId, file] = statements.create.mock.calls[0];
    expect(user).toBe(ctx.user);
    expect(workspaceId).toBe('ws-1');
    expect(file).toMatchObject({ originalname: 'bank.csv', mimetype: 'text/csv' });
    expect(fs.existsSync(file.path)).toBe(true);
    expect(result).toEqual({ id: 's1', status: 'uploaded', fileName: 'bank.csv' });
  });

  it('removes the file when the statement is refused', async () => {
    statements.create.mockRejectedValue(new ConflictException('duplicate'));

    await expect(
      tool(tools, 'upload_statement').run(ctx, { fileName: 'bank.csv', fileBase64: csv }),
    ).rejects.toThrow(ConflictException);

    const [, , file] = statements.create.mock.calls[0];
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('refuses content that is not base64', async () => {
    await expect(
      tool(tools, 'upload_statement').run(ctx, { fileName: 'bank.csv', fileBase64: 'not base64!' }),
    ).rejects.toThrow(BadRequestException);
    expect(statements.create).not.toHaveBeenCalled();
  });
});
