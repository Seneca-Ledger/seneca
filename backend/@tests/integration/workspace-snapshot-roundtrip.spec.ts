/**
 * Integration test — a workspace snapshot survives the round trip, against a real Postgres.
 *
 * A backup collects every workspace table and the documents behind them; a
 * restore rebuilds them as a new workspace. Workspace versions are built on the
 * same two steps, so they must hold for a workspace that has a bit of
 * everything: nested categories, a statement with its file, tagged
 * transactions, a receipt with an attachment, an invoice and a credit note with
 * their lines and PDFs, a posted and a reversed journal entry, budgets, goals,
 * custom tables and payables. The unit specs mock the database; only a real one
 * runs the foreign keys, the ledger triggers and the unique indexes.
 */
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import * as entityIndex from '../../src/entities';
import { User, Workspace, WorkspaceMember } from '../../src/entities';
import { BackupArchiveService } from '../../src/modules/backups/backup-archive.service';
import { BackupDataService } from '../../src/modules/backups/backup-data.service';
import { BackupRestoreService } from '../../src/modules/backups/backup-restore.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_snapshot_roundtrip_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded by hand: TypeORM's glob loader bypasses Jest's transform. */
function loadMigrations(): Function[] {
  const dir = path.resolve(__dirname, '../../src/migrations');
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .sort()
    .flatMap(file =>
      Object.values(require(path.join(dir, file))).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

/**
 * Tables with no workspace column, each with why a snapshot does not need to
 * collect it by workspace. A new table without a workspace column fails the
 * completeness test until it is added here or collected as a child.
 */
const TABLES_WITHOUT_WORKSPACE: Record<string, string> = {
  // The workspace itself travels as the snapshot's `workspace` record.
  workspaces: 'the snapshot record',
  // Children, collected through their parent's ids.
  credit_note_line_items: 'child of credit_notes',
  custom_table_cell_styles: 'child of custom_table_rows',
  custom_table_column_styles: 'child of custom_tables',
  custom_table_columns: 'child of custom_tables',
  custom_table_rows: 'child of custom_tables',
  file_versions: 'child of statements',
  invoice_line_items: 'child of invoices',
  journal_lines: 'child of journal_entries',
  payable_tags: 'join of payables and tags',
  receipt_tags: 'join of receipts and tags',
  statement_tags: 'join of statements and tags',
  transaction_tags: 'join of transactions and tags',
  // Shared reference data, the same for every workspace.
  exchange_rates: 'global reference data',
  parsing_rules: 'global reference data',
  reference_data: 'global reference data',
  tax_jurisdiction_rates: 'global reference data',
  tax_jurisdictions: 'global reference data',
  // Instance-wide settings (the shared Telegram bot), owned by the server admin.
  instance_settings: 'instance setting',
  // A person's sign-in, devices and preferences, not the workspace's books.
  auth_sessions: 'per user',
  email_change_tokens: 'per user',
  notification_preferences: 'per user',
  password_reset_tokens: 'per user',
  push_subscriptions: 'per user',
  telegram_reports: 'per user',
  // Connections to outside services: reconnected, never copied.
  integration_tokens: 'integration',
  open_protocol_settings: 'integration',
  webhook_deliveries: 'integration',
  // Access grants and public links: a copy must not inherit them.
  file_permissions: 'access grant',
  shared_links: 'public link',
};

const PASSWORD = 'correct horse battery staple';

describe('a workspace snapshot survives collect and restore (real Postgres)', () => {
  jest.setTimeout(240_000);

  let dataSource: DataSource;
  let collector: BackupDataService;
  let restorer: BackupRestoreService;
  const archives = new BackupArchiveService();
  let user: User;
  let workspaceId: string;
  const tempFiles: string[] = [];

  const sql = (text: string, params: unknown[] = []) => dataSource.query(text, params);
  const insert = async (table: string, row: Record<string, unknown>): Promise<string> => {
    const id = (row.id as string | undefined) ?? randomUUID();
    const values = { id, ...row };
    const columns = Object.keys(values);
    await sql(
      `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
      Object.values(values),
    );
    return id;
  };
  const writeDocument = (name: string, contents: string): { path: string; sha: string } => {
    const filePath = path.join(resolveUploadsDir(), `roundtrip-${randomUUID()}-${name}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
    tempFiles.push(filePath);
    return { path: filePath, sha: createHash('sha256').update(contents).digest('hex') };
  };

  /** Collect, archive and restore, the way a backup and its restore do. */
  const roundTrip = async (sourceId: string, name: string): Promise<Workspace> => {
    const workspace = await dataSource.getRepository(Workspace).findOneByOrFail({ id: sourceId });
    const snapshot = await collector.collect(sourceId);
    const archive = await archives.create({
      password: PASSWORD,
      workspace: { id: workspace.id, name: workspace.name },
      collections: {
        workspace: [{ id: workspace.id, name: workspace.name, currency: workspace.currency }],
        ...snapshot.collections,
      },
      files: snapshot.files,
    });
    return restorer.restore(archive, PASSWORD, user, name);
  };

  const counts = async (id: string): Promise<Record<string, number>> => {
    const { collections } = await collector.collect(id);
    return Object.fromEntries(
      Object.entries(collections).map(([table, rows]) => [table, rows.length]),
    );
  };

  beforeAll(async () => {
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    collector = new BackupDataService(dataSource, {
      getStatementFileStream: async (statement: { filePath: string; fileName: string }) => ({
        stream: fs.createReadStream(statement.filePath),
        fileName: statement.fileName,
      }),
    } as never);
    restorer = new BackupRestoreService(
      dataSource,
      dataSource.getRepository(Workspace),
      dataSource.getRepository(WorkspaceMember),
      archives,
    );

    workspaceId = await insert('workspaces', { name: 'Keller Design', currency: 'EUR' });
    user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `roundtrip-${randomUUID()}@example.com`,
        passwordHash: 'x',
        name: 'Owner',
        workspaceId,
      }),
    );
    const userId = user.id;
    await insert('workspace_members', { workspace_id: workspaceId, user_id: userId, role: 'owner' });

    // Categories: a parent and a child under it.
    const food = await insert('categories', { workspace_id: workspaceId, user_id: userId, name: 'Food', type: 'expense' });
    const groceries = await insert('categories', {
      workspace_id: workspaceId,
      user_id: userId,
      name: 'Groceries',
      type: 'expense',
      parent_id: food,
    });
    const tag = await insert('tags', { workspace_id: workspaceId, name: 'tax' });
    const wallet = await insert('wallets', { workspace_id: workspaceId, user_id: userId, name: 'Cash', currency: 'EUR' });

    // A statement with its file on disk, two tagged rows on it.
    const statementFile = writeDocument('bank.pdf', '%PDF-1.4 bank statement');
    const statement = await insert('statements', {
      workspace_id: workspaceId,
      user_id: userId,
      file_name: 'bank.pdf',
      file_path: statementFile.path,
      file_type: 'pdf',
      file_size: 24,
      file_hash: statementFile.sha,
      bank_name: 'other',
      currency: 'EUR',
      status: 'completed',
    });
    await sql('INSERT INTO statement_tags (statement_id, tag_id) VALUES ($1, $2)', [statement, tag]);
    const groceriesRow = await insert('transactions', {
      workspace_id: workspaceId,
      statement_id: statement,
      wallet_id: wallet,
      category_id: groceries,
      transaction_date: '2026-10-02',
      counterparty_name: 'Lidl',
      payment_purpose: 'Lidl',
      currency: 'EUR',
      transaction_type: 'expense',
      amount: 42.5,
      debit: 42.5,
      is_verified: true,
    });
    await insert('transactions', {
      workspace_id: workspaceId,
      statement_id: statement,
      transaction_date: '2026-10-03',
      counterparty_name: 'Client GmbH',
      payment_purpose: 'Invoice 1',
      currency: 'EUR',
      transaction_type: 'income',
      amount: 1200,
      credit: 1200,
      is_verified: true,
    });
    await sql('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1, $2)', [groceriesRow, tag]);

    // A receipt with an attachment, linked to its row.
    const receiptFile = writeDocument('lidl.jpg', 'jpeg bytes');
    await insert('receipts', {
      workspace_id: workspaceId,
      user_id: userId,
      subject: 'Lidl',
      sender: 'scan',
      received_at: '2026-10-02T10:00:00Z',
      attachment_paths: [receiptFile.path],
      transaction_id: groceriesRow,
      status: 'approved',
    });

    // An invoice and a credit note, each with a line and its issued PDF.
    const client = await insert('clients', { workspace_id: workspaceId, name: 'Client GmbH', currency: 'EUR' });
    const invoice = await insert('invoices', {
      workspace_id: workspaceId,
      client_id: client,
      invoice_number: 'INV-1',
      status: 'sent',
      issue_date: '2026-10-01',
      due_date: '2026-10-15',
      currency: 'EUR',
      subtotal: 1000,
      tax_total: 200,
      total: 1200,
      file_data: Buffer.from('%PDF-1.4 invoice'),
      file_size: 16,
      share_token: randomUUID(),
    });
    await insert('invoice_line_items', { invoice_id: invoice, description: 'Design', unit_price: 1000, quantity: 1 });
    const creditNote = await insert('credit_notes', {
      workspace_id: workspaceId,
      client_id: client,
      credit_note_number: 'CN-1',
      status: 'issued',
      issue_date: '2026-10-05',
      currency: 'EUR',
      subtotal: 100,
      tax_total: 20,
      total: 120,
      file_data: Buffer.from('%PDF-1.4 credit note'),
    });
    await insert('credit_note_line_items', { credit_note_id: creditNote, description: 'Refund', unit_price: 100, quantity: 1 });

    // Ledger: a posted entry, and one posted then reversed by a second entry.
    const cash = await insert('ledger_accounts', {
      workspace_id: workspaceId,
      code: '1000',
      name: 'Cash',
      account_type: 'asset',
      normal_balance: 'debit',
    });
    const revenue = await insert('ledger_accounts', {
      workspace_id: workspaceId,
      code: '4000',
      name: 'Revenue',
      account_type: 'income',
      normal_balance: 'credit',
    });
    const entry = async (no: number, memo: string, reversalOf?: string): Promise<string> => {
      const id = await insert('journal_entries', {
        workspace_id: workspaceId,
        entry_date: '2026-10-03',
        base_currency: 'EUR',
        memo,
        status: 'draft',
        source: 'manual',
        reversal_of_id: reversalOf ?? null,
      });
      const [debit, credit] = reversalOf ? [revenue, cash] : [cash, revenue];
      for (const [lineNo, account, side] of [
        [1, debit, 'debit'],
        [2, credit, 'credit'],
      ] as const) {
        await insert('journal_lines', {
          entry_id: id,
          line_no: lineNo,
          account_id: account,
          currency: 'EUR',
          debit: side === 'debit' ? 100 : 0,
          credit: side === 'credit' ? 100 : 0,
          base_debit: side === 'debit' ? 100 : 0,
          base_credit: side === 'credit' ? 100 : 0,
          fx_rate: 1,
        });
      }
      await sql(
        "UPDATE journal_entries SET status = 'posted', entry_no = $2, posted_at = now() WHERE id = $1",
        [id, no],
      );
      return id;
    };
    const reversed = await entry(1, 'Sale');
    await entry(2, 'Sale reversed', reversed);
    await sql("UPDATE journal_entries SET status = 'reversed' WHERE id = $1", [reversed]);
    await entry(3, 'Second sale');

    // Plans and tables.
    await insert('budgets', {
      workspace_id: workspaceId,
      category_id: groceries,
      name: 'Groceries',
      limit_amount: 300,
      currency: 'EUR',
      period_type: 'monthly',
      current_period_start: '2026-10-01',
    });
    await insert('goals', { workspace_id: workspaceId, name: 'Laptop', target_amount: 2000, currency: 'EUR' });
    const table = await insert('custom_tables', { workspace_id: workspaceId, user_id: userId, name: 'Projects' });
    await insert('custom_table_columns', { table_id: table, key: 'client', title: 'Client' });
    await insert('custom_table_rows', { table_id: table, row_number: 1, data: { client: 'Client GmbH' } });
    await insert('payables', { workspace_id: workspaceId, vendor: 'Adobe', amount: 60, currency: 'EUR' });
    await insert('payees', { workspace_id: workspaceId, name: 'Lidl' });
  });

  afterAll(async () => {
    for (const file of tempFiles) fs.rmSync(file, { force: true });
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('restores every collected row, twice over, into workspaces of its own', async () => {
    const source = await counts(workspaceId);
    const first = await roundTrip(workspaceId, 'Copy one');
    const second = await roundTrip(workspaceId, 'Copy two');

    for (const copy of [first, second]) {
      expect(await counts(copy.id)).toEqual(source);
    }
    // The snapshot has a bit of everything, or the comparison proves little.
    for (const table of [
      'categories',
      'statements',
      'statement_tags',
      'transactions',
      'transaction_tags',
      'receipts',
      'invoices',
      'invoice_line_items',
      'credit_notes',
      'credit_note_line_items',
      'journal_entries',
      'journal_lines',
      'budgets',
      'goals',
      'custom_table_rows',
      'payables',
    ]) {
      expect(source[table]).toBeGreaterThan(0);
    }
  });

  it('keeps every reference of a restored row inside its own workspace', async () => {
    const copy = await roundTrip(workspaceId, 'Isolation copy');
    // Every single-column foreign key between two workspace tables.
    const keys: Array<{ source: string; column: string; target: string; target_column: string }> =
      await sql(`
        SELECT src.relname AS source, sa.attname AS column, tgt.relname AS target, ta.attname AS target_column
          FROM pg_constraint fk
          JOIN pg_class src ON src.oid = fk.conrelid
          JOIN pg_class tgt ON tgt.oid = fk.confrelid
          JOIN pg_attribute sa ON sa.attrelid = fk.conrelid AND sa.attnum = fk.conkey[1]
          JOIN pg_attribute ta ON ta.attrelid = fk.confrelid AND ta.attnum = fk.confkey[1]
         WHERE fk.contype = 'f' AND array_length(fk.conkey, 1) = 1
           AND sa.attname <> 'workspace_id'
           -- People are global: a user row's workspace_id is their home workspace.
           AND tgt.relname <> 'users'
           AND EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_name = src.relname AND c.column_name = 'workspace_id')
           AND EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_name = tgt.relname AND c.column_name = 'workspace_id')`);
    expect(keys.length).toBeGreaterThan(10);

    const leaks: string[] = [];
    for (const key of keys) {
      const [{ count }] = await sql(
        `SELECT COUNT(*)::int AS count
           FROM "${key.source}" s JOIN "${key.target}" t ON t."${key.target_column}" = s."${key.column}"
          WHERE s.workspace_id = $1 AND t.workspace_id IS DISTINCT FROM $1`,
        [copy.id],
      );
      if (count > 0) leaks.push(`${key.source}.${key.column} -> ${key.target}: ${count}`);
    }
    expect(leaks).toEqual([]);
  });

  it('brings back the ledger as it was booked: numbered, posted and reversed', async () => {
    const copy = await roundTrip(workspaceId, 'Ledger copy');
    const entries: Array<{ status: string; entry_no: string; lines: number }> = await sql(
      `SELECT e.status, e.entry_no::text, COUNT(l.id)::int AS lines
         FROM journal_entries e JOIN journal_lines l ON l.entry_id = e.id
        WHERE e.workspace_id = $1 GROUP BY e.id ORDER BY e.entry_no`,
      [copy.id],
    );
    expect(entries).toEqual([
      { status: 'reversed', entry_no: '1', lines: 2 },
      { status: 'posted', entry_no: '2', lines: 2 },
      { status: 'posted', entry_no: '3', lines: 2 },
    ]);
  });

  it('brings back the documents: the statement file, the attachment and the issued PDFs', async () => {
    const copy = await roundTrip(workspaceId, 'Documents copy');
    const [statement] = await sql('SELECT file_path FROM statements WHERE workspace_id = $1', [copy.id]);
    expect(fs.readFileSync(statement.file_path, 'utf8')).toBe('%PDF-1.4 bank statement');
    const [receipt] = await sql('SELECT attachment_paths FROM receipts WHERE workspace_id = $1', [copy.id]);
    expect(fs.readFileSync(receipt.attachment_paths[0], 'utf8')).toBe('jpeg bytes');
    for (const file of [statement.file_path, receipt.attachment_paths[0]]) tempFiles.push(file);

    const [invoice] = await sql('SELECT file_data, share_token FROM invoices WHERE workspace_id = $1', [copy.id]);
    expect(invoice.file_data?.toString()).toBe('%PDF-1.4 invoice');
    // A public link is unique across workspaces: the copy starts without one.
    expect(invoice.share_token).toBeNull();
    const [creditNote] = await sql('SELECT file_data FROM credit_notes WHERE workspace_id = $1', [copy.id]);
    expect(creditNote.file_data?.toString()).toBe('%PDF-1.4 credit note');
  });

  it('accounts for every table that has no workspace column', () => {
    const unaccounted = dataSource.entityMetadatas
      .filter(metadata => !metadata.columns.some(column => column.propertyName === 'workspaceId'))
      .map(metadata => metadata.tableName)
      .filter(table => !(table in TABLES_WITHOUT_WORKSPACE))
      .sort();
    expect(unaccounted).toEqual([]);
  });
});
