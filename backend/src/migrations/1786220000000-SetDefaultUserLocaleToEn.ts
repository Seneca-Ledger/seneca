import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * English becomes the fallback locale across the app, so new accounts start in
 * English instead of Russian.
 *
 * Only the column default changes — existing rows keep whatever locale their
 * owner chose. Migrating users who never picked one is a product decision, not
 * a schema change.
 */
export class SetDefaultUserLocaleToEn1786220000000 implements MigrationInterface {
  name = 'SetDefaultUserLocaleToEn1786220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'en'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'ru'`);
  }
}
