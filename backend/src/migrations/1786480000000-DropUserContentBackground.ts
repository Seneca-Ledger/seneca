import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The photo behind the content area was removed from the app, so its two
 * preference columns go too. They held only a picked path and a dim level;
 * down() brings the columns back with their defaults, not the old values.
 */
export class DropUserContentBackground1786480000000 implements MigrationInterface {
  name = 'DropUserContentBackground1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "content_background_dim",
        DROP COLUMN IF EXISTS "content_background"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "content_background" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "content_background_dim" smallint NOT NULL DEFAULT 35
    `);
  }
}
