import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Gmail label name comes from the product name (APP_NAME) when a mailbox is
 * connected, so the column stops carrying the old brand as its default. Rows
 * keep the label they already have: it is the one that exists in their Gmail.
 */
export class DropGmailLabelNameDefault1787330000000 implements MigrationInterface {
  name = 'DropGmailLabelNameDefault1787330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gmail_settings" ALTER COLUMN "label_name" DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gmail_settings" ALTER COLUMN "label_name" SET DEFAULT 'Lumio/Receipts'`,
    );
  }
}
