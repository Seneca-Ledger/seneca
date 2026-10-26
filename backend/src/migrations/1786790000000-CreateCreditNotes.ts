import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Credit notes: the proper way to take money back off an invoice.
 *
 * Until now the only correction was voiding the whole invoice, which is a lie
 * about a document the client already has — and impossible once it is paid. A
 * credit note is its own numbered document, carries its own lines so the tax
 * splits correctly, reverses the revenue in the ledger and is applied to one
 * or more invoices, lowering what the client owes on each.
 */
export class CreateCreditNotes1786790000000 implements MigrationInterface {
  name = 'CreateCreditNotes1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Its own sequence, beside the invoice one: a credit note is not an invoice
    // and the two numberings must not interleave.
    await queryRunner.query(`
      ALTER TABLE "invoice_counters"
        ADD COLUMN IF NOT EXISTS "credit_note_prefix" character varying(20) NOT NULL DEFAULT 'CN-',
        ADD COLUMN IF NOT EXISTS "next_credit_note_no" bigint NOT NULL DEFAULT 1
    `);

    // The reversal entry is its own kind of posting, not an invoice's.
    await queryRunner.query(`
      ALTER TABLE "journal_entries" DROP CONSTRAINT "CHK_journal_entries_source"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "CHK_journal_entries_source"
      CHECK ("source" IN (
        'transaction', 'manual', 'opening_balance', 'fx_revaluation', 'invoice', 'credit_note'
      ))
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "credit_notes_status_enum" AS ENUM ('issued', 'void');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_notes" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"       uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "client_id"          uuid NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
        "credit_note_number" character varying(40),
        "status"             "credit_notes_status_enum" NOT NULL DEFAULT 'issued',
        "issue_date"         date NOT NULL,
        "currency"           character varying(3) NOT NULL,
        "prices_include_tax" boolean NOT NULL DEFAULT false,
        "subtotal"           numeric(15,2) NOT NULL DEFAULT 0,
        "tax_total"          numeric(15,2) NOT NULL DEFAULT 0,
        "total"              numeric(15,2) NOT NULL DEFAULT 0,
        "reason"             text,
        "journal_entry_id"   uuid,
        "file_data"          bytea,
        "file_size"          integer,
        "file_hash"          character varying(64),
        "created_by_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_credit_notes_workspace_client"
         ON "credit_notes" ("workspace_id", "client_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_note_line_items" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE CASCADE,
        "description"    character varying(500) NOT NULL,
        "quantity"       numeric(15,2) NOT NULL DEFAULT 1,
        "unit_price"     numeric(15,2) NOT NULL,
        "tax_rate_id"    uuid REFERENCES "tax_rates"("id") ON DELETE SET NULL,
        "category_id"    uuid REFERENCES "categories"("id") ON DELETE SET NULL,
        "sort_order"     integer NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_credit_note_line_items_note"
         ON "credit_note_line_items" ("credit_note_id", "sort_order")`,
    );

    // One note may cover several invoices, but never the same invoice twice.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_note_applications" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE CASCADE,
        "invoice_id"     uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "workspace_id"   uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "amount"         numeric(15,2) NOT NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_credit_note_applications_note_invoice"
          UNIQUE ("credit_note_id", "invoice_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_credit_note_applications_invoice"
         ON "credit_note_applications" ("invoice_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries" DROP CONSTRAINT "CHK_journal_entries_source"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "CHK_journal_entries_source"
      CHECK ("source" IN ('transaction', 'manual', 'opening_balance', 'fx_revaluation', 'invoice'))
    `);
    await queryRunner.query('DROP TABLE IF EXISTS "credit_note_applications"');
    await queryRunner.query('DROP TABLE IF EXISTS "credit_note_line_items"');
    await queryRunner.query('DROP TABLE IF EXISTS "credit_notes"');
    await queryRunner.query('DROP TYPE IF EXISTS "credit_notes_status_enum"');
    await queryRunner.query(`
      ALTER TABLE "invoice_counters"
        DROP COLUMN IF EXISTS "credit_note_prefix",
        DROP COLUMN IF EXISTS "next_credit_note_no"
    `);
  }
}
