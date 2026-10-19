import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A photo behind the content area: a bundled workspace photo or an uploaded
 * image. Null keeps the current flat background, so nothing changes until
 * somebody picks one.
 */
export class AddUserContentBackground1786350000000 implements MigrationInterface {
  name = 'AddUserContentBackground1786350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "content_background" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "content_background_dim" smallint NOT NULL DEFAULT 35
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "content_background_dim",
        DROP COLUMN IF EXISTS "content_background"
    `);
  }
}
