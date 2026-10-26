import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How a workspace invoices: payment terms, the late fee, and reminders.
 *
 * Reminders are off by default on purpose: the complaint about them in
 * invoicing tools is not that they are missing but that a vendor sent them to
 * someone's clients unasked. The unique index is what stops a reminder going
 * out twice when the scheduler runs again.
 */
export class AddInvoiceSettings1786770000000 implements MigrationInterface {
  name = 'AddInvoiceSettings1786770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_settings" (
        "workspace_id"       uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "reminders_enabled"  boolean NOT NULL DEFAULT false,
        "reminder_offsets"   jsonb NOT NULL DEFAULT '[-3, 0, 7, 14]'::jsonb,
        "payment_terms_days" integer NOT NULL DEFAULT 14,
        "late_fee_percent"   numeric(5,2) NOT NULL DEFAULT 0,
        "updated_at"         timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "reminders_enabled"  boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "payment_terms_days" integer
    `);
    await queryRunner.query(
      `ALTER TABLE "invoice_deliveries" ADD COLUMN IF NOT EXISTS "reminder_offset" integer`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoice_deliveries_reminder"
         ON "invoice_deliveries" ("invoice_id", "reminder_offset")
       WHERE "reminder_offset" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoice_deliveries_reminder"`);
    await queryRunner.query(
      `ALTER TABLE "invoice_deliveries" DROP COLUMN IF EXISTS "reminder_offset"`,
    );
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "reminders_enabled",
        DROP COLUMN IF EXISTS "payment_terms_days"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_settings"`);
  }
}
