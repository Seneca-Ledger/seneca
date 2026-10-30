import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a user see every amount with cents instead of whole units on overviews.
 * Defaults to on, so nobody's screen changes until they opt out.
 */
export class AddUserRoundAmounts1787650000000 implements MigrationInterface {
  name = 'AddUserRoundAmounts1787650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "round_amounts" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "round_amounts"
    `);
  }
}
