import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New accounts start in the dark theme. Accounts that already exist keep the preference they
 * have: the column only changes its default.
 */
export class DarkThemeByDefault1787340000000 implements MigrationInterface {
  name = 'DarkThemeByDefault1787340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "theme_preference" SET DEFAULT 'dark'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "theme_preference" SET DEFAULT 'auto'`,
    );
  }
}
