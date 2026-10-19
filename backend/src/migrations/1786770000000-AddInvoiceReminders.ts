import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceReminders1786770000000 implements MigrationInterface {
  name = 'AddInvoiceReminders1786770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reminder_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_reminder_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "last_reminder_at"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "reminder_count"`);
  }
}
