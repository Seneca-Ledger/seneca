import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The automatic theme is now named for what it does: 'auto' becomes 'system' and follows the
 * operating system. New accounts start with it; accounts that picked light or dark keep it.
 */
export class SystemThemeByDefault1787570000000 implements MigrationInterface {
  name = 'SystemThemeByDefault1787570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "theme_preference" = 'system' WHERE "theme_preference" = 'auto'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "theme_preference" SET DEFAULT 'system'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "theme_preference" = 'auto' WHERE "theme_preference" = 'system'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "theme_preference" SET DEFAULT 'dark'`,
    );
  }
}
