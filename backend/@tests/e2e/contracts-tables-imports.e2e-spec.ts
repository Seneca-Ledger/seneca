vi.mock('franc', () => ({
  franc: () => 'und',
}));

import {
  CreatedFromSource,
  EntityImportResult,
  EntityImportUndone,
  OkResult,
  ViewPreferenceState,
} from '../../src/contracts';
import { SyncedFromDataEntry } from '../../src/contracts/custom-tables/custom-table-actions';
import {
  DataEntryCustomFieldItem,
  DataEntryCustomFieldList,
  DataEntryItem,
  DataEntryPage,
} from '../../src/contracts/data-entry/data-entry';
import {
  ImportSessionCancelled,
  ImportSessionSummary,
  ParsedDocumentResult,
  StatementImportCommit,
  StatementImportPreview,
} from '../../src/contracts/imports/import-sessions';
import {
  ImportSession,
  ImportSessionMode,
  ImportSessionStatus,
} from '../../src/entities/import-session.entity';
import { type ContractApp, seedManualExpense, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

/**
 * Data entry, entity and statement imports, document parsing and view
 * preferences against their contracts, each with a row in it.
 */
describe('API contracts: data entry and imports (e2e)', () => {
  const email = `contracts-imports-${Date.now()}@example.com`;
  let ctx: ContractApp;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);
  const answer: ContractApp['answer'] = (...args) => ctx.answer(...args);

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Imports Owner');
    await seedManualExpense(ctx, 'ACME Store - Wireless Buds');
  });

  afterAll(async () => {
    if (ctx) {
      await deleteUserByEmail(ctx.dataSource, email);
      await ctx.app.close();
    }
  });

  it('data entry, and tables built from it', async () => {
    const entry = await answer(
      DataEntryItem,
      call('post', '/data-entry', { type: 'cash', date: '2026-10-02', amount: 15.5, note: 'Lunch' }),
    );
    expect(entry.amount).toBe('15.50');
    const page = await answer(DataEntryPage, call('get', '/data-entry?type=cash'));
    expect(page.items.map(item => item.id)).toContain(entry.id);

    const tab = await answer(
      DataEntryCustomFieldItem,
      call('post', '/data-entry/custom-fields', { name: 'Trips' }),
    );
    await answer(DataEntryItem, call('post', '/data-entry', {
      type: 'cash',
      date: '2026-10-03',
      amount: 80,
      customTabId: tab.id,
    }));
    const fields = await answer(DataEntryCustomFieldList, call('get', '/data-entry/custom-fields'));
    expect(fields.items.find(item => item.id === tab.id)?.entriesCount).toBe(1);
    const renamed = await answer(
      DataEntryCustomFieldItem,
      call('patch', `/data-entry/custom-fields/${tab.id}`, { name: 'Travel' }),
    );
    expect(renamed.name).toBe('Travel');

    const byType = await answer(
      CreatedFromSource,
      call('post', '/custom-tables/from-data-entry', { scope: 'type', type: 'cash' }),
    );
    expect(byType.rowsCreated).toBeGreaterThan(0);
    const synced = await answer(
      SyncedFromDataEntry,
      call('post', `/custom-tables/${byType.tableId}/sync-from-data-entry`),
    );
    expect(synced.rowsCreated).toBeGreaterThan(0);
    const byTab = await answer(
      CreatedFromSource,
      call('post', '/custom-tables/from-data-entry-custom-tab', { customTabId: tab.id }),
    );
    expect(byTab.rowsCreated).toBe(1);

    await answer(OkResult, call('delete', `/data-entry/${entry.id}`));
    await answer(OkResult, call('delete', '/data-entry/base-tabs/raw'));
    await answer(OkResult, call('delete', `/data-entry/custom-fields/${tab.id}`));
  });

  it('an entity import undone, and a view preference written', async () => {
    const run = await answer(
      EntityImportResult,
      call('post', '/entity-imports', {
        target: 'payables',
        mapping: { vendor: 0, amount: 1, dueDate: 2 },
        rows: [['Office rent', '1200', '2026-11-01']],
      }),
    );
    const undone = await answer(EntityImportUndone, call('delete', `/entity-imports/${run.batchId}`));
    expect(undone.removed).toBe(1);
    const saved = await answer(
      ViewPreferenceState,
      call('put', '/view-preferences/transactions', { state: { owner: 'me' } }),
    );
    expect(saved.state).toEqual({ owner: 'me' });
  });

  it('statement import preview, commit and session', async () => {
    const statementId = (await call('get', '/storage/files').expect(200)).body[0].id;
    const preview = await answer(
      StatementImportPreview,
      call('get', `/statements/${statementId}/import-preview`),
    );
    expect(preview.importPreview).not.toBeNull();
    await answer(StatementImportCommit, call('post', `/statements/${statementId}/import-commit`, {}));

    const session = await ctx.dataSource.getRepository(ImportSession).save({
      workspaceId: ctx.owner.workspaceId,
      statementId,
      status: ImportSessionStatus.PREVIEW,
      mode: ImportSessionMode.PREVIEW,
      fileHash: 'contract-hash',
      fileName: 'statement.csv',
      fileSize: 120,
      sessionMetadata: {
        totalTransactions: 2,
        newCount: 1,
        matchedCount: 0,
        skippedCount: 0,
        conflictedCount: 1,
        failedCount: 0,
        conflicts: [{ transactionIndex: 1, reason: 'Same amount and day', confidence: 0.9 }],
        warnings: [],
        errors: [],
      },
    });
    const summary = await answer(ImportSessionSummary, call('get', `/import-sessions/${session.id}`));
    expect(summary.conflicts).toHaveLength(1);
    await answer(ImportSessionCancelled, call('post', `/import-sessions/${session.id}/cancel`));
  });

  it('POST /documents/parse', async () => {
    const csv = 'Date,Description,Amount\n2026-10-01,ACME Store - Wireless Buds,49.90\nTotal,,49.90\n';
    const parsed = await answer(
      ParsedDocumentResult,
      call('post', '/documents/parse')
        .field('source', 'upload')
        .attach('file', Buffer.from(csv), { filename: 'receipt.csv', contentType: 'text/csv' }),
    );
    expect(parsed.source).toBe('upload');
  });
});
