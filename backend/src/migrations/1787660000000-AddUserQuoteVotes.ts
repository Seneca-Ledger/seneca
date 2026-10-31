import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thumbs on daily quotes, keyed by catalogue id (1 up, -1 down), so the quote
 * of the day leans towards what the reader liked. Empty for everyone at first.
 */
export class AddUserQuoteVotes1787660000000 implements MigrationInterface {
  name = 'AddUserQuoteVotes1787660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "quote_votes" JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "quote_votes"
    `);
  }
}
