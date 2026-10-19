import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether spending in a category is help given to others (charity, donations,
 * gifts). Nullable: until the user says, the Stoic advice guesses from the
 * category name, and nothing is written for the guess.
 */
export class AddCategoryHelpsOthers1786610000000 implements MigrationInterface {
  name = 'AddCategoryHelpsOthers1786610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "helps_others" boolean
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP COLUMN IF EXISTS "helps_others"
    `);
  }
}
