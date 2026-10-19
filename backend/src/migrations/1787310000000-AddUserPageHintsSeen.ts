import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Page hints closed so far, per user: page id → the highest hint version seen.
 * No backfill: every account sees each page's hints once, existing ones too.
 */
export class AddUserPageHintsSeen1787310000000 implements MigrationInterface {
  name = 'AddUserPageHintsSeen1787310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "page_hints_seen" JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "page_hints_seen"
    `);
  }
}
