import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The link the client opens.
 *
 * Emailing a PDF attachment tells the sender nothing: it may sit unread in an
 * inbox for three weeks. A hosted page gives the client something to open and
 * the sender the one fact they actually need — whether it was opened at all.
 */
export class AddInvoiceShareLink1786760000000 implements MigrationInterface {
  name = 'AddInvoiceShareLink1786760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "share_token" character varying(64),
        ADD COLUMN IF NOT EXISTS "viewed_at"   timestamptz,
        ADD COLUMN IF NOT EXISTS "view_count"  integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_share_token"
         ON "invoices" ("share_token") WHERE "share_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_share_token"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "share_token",
        DROP COLUMN IF EXISTS "viewed_at",
        DROP COLUMN IF EXISTS "view_count"
    `);
  }
}
