import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceCounters1786540000000 implements MigrationInterface {
  name = 'CreateInvoiceCounters1786540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoice_counters" (
        "workspace_id" uuid NOT NULL,
        "prefix" character varying(20) NOT NULL DEFAULT 'INV-',
        "next_invoice_no" bigint NOT NULL DEFAULT 1,
        CONSTRAINT "PK_invoice_counters" PRIMARY KEY ("workspace_id"),
        CONSTRAINT "FK_invoice_counters_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_invoice_counters_positive" CHECK ("next_invoice_no" >= 1)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "invoice_counters"');
  }
}
