import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an invoice's accrual entry use source = 'invoice'. Also adds the index
 * the ledger's counterpart override needs to find, for a given transaction,
 * whether it settles an invoice-sourced receivable rather than booking income.
 */
export class AllowInvoiceJournalEntrySource1786570000000 implements MigrationInterface {
  name = 'AllowInvoiceJournalEntrySource1786570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries" DROP CONSTRAINT "CHK_journal_entries_source"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "CHK_journal_entries_source"
      CHECK ("source" IN ('transaction', 'manual', 'opening_balance', 'fx_revaluation', 'invoice'))
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payables_linked_transaction_source"
      ON "payables" ("linked_transaction_id", "source")
      WHERE "linked_transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payables_linked_transaction_source"');

    await queryRunner.query(`
      ALTER TABLE "journal_entries" DROP CONSTRAINT "CHK_journal_entries_source"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "CHK_journal_entries_source"
      CHECK ("source" IN ('transaction', 'manual', 'opening_balance', 'fx_revaluation'))
    `);
  }
}
