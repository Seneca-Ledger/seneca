import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Credit for a workspace background found through the photo search.
 *
 * The picture itself is copied into the uploads directory and its path goes
 * into the existing `background_image` column, so only the credit is new: a
 * CC-BY image may not be shown without naming its author and licence.
 *
 * Nullable, no backfill — bundled backgrounds need no credit line.
 */
export class AddWorkspaceBackgroundCredit1787200000000 implements MigrationInterface {
  name = 'AddWorkspaceBackgroundCredit1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "background_attribution" character varying(400),
        ADD COLUMN IF NOT EXISTS "background_source_url" character varying(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        DROP COLUMN IF EXISTS "background_source_url",
        DROP COLUMN IF EXISTS "background_attribution"
    `);
  }
}
