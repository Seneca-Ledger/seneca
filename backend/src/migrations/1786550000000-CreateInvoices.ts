import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoices1786550000000 implements MigrationInterface {
  name = 'CreateInvoices1786550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "invoices_status_enum" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void')
    `);

    await queryRunner.query(`
      CREATE TYPE "invoices_recurrence_interval_enum" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly')
    `);

    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "invoice_number" character varying(40),
        "status" "invoices_status_enum" NOT NULL DEFAULT 'draft',
        "issue_date" date NOT NULL,
        "due_date" date NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'KZT',
        "subtotal" decimal(15,2) NOT NULL DEFAULT 0,
        "tax_total" decimal(15,2) NOT NULL DEFAULT 0,
        "total" decimal(15,2) NOT NULL DEFAULT 0,
        "notes" text,
        "payable_id" uuid,
        "journal_entry_id" uuid,
        "file_data" bytea,
        "file_size" integer,
        "file_hash" character varying(64),
        "is_recurring" boolean NOT NULL DEFAULT false,
        "recurrence_interval" "invoices_recurrence_interval_enum",
        "next_issue_date" date,
        "recurrence_end_date" date,
        "source_recurring_invoice_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_client"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_payable"
      FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_journal_entry"
      FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_source_recurring_invoice"
      FOREIGN KEY ("source_recurring_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_invoices_workspace_invoice_number"
      ON "invoices" ("workspace_id", "invoice_number")
      WHERE "invoice_number" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_workspace_status"
      ON "invoices" ("workspace_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_workspace_client"
      ON "invoices" ("workspace_id", "client_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_workspace_recurring"
      ON "invoices" ("workspace_id", "is_recurring", "next_issue_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_invoices_workspace_recurring"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_invoices_workspace_client"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_invoices_workspace_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_invoices_workspace_invoice_number"');
    await queryRunner.query('DROP TABLE IF EXISTS "invoices"');
    await queryRunner.query('DROP TYPE IF EXISTS "invoices_recurrence_interval_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "invoices_status_enum"');
  }
}
