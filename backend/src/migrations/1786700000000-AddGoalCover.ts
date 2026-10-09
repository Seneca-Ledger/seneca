import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A picture for a savings goal, so the list reads as the things being saved
 * for rather than as a row of amounts.
 *
 * Two kinds of cover share these columns and exactly one is ever set:
 * `cover_preset` names a bundled gradient-and-icon tile drawn by the client,
 * `cover_file` names a photo copied into the uploads directory. The photo is
 * copied rather than hotlinked because a goal outlives the stock-photo URL it
 * came from, and the attribution columns travel with it: a CC-BY image may not
 * be shown without naming its author and licence.
 *
 * All nullable, no backfill — goals that existed before this keep no cover.
 */
export class AddGoalCover1786700000000 implements MigrationInterface {
  name = 'AddGoalCover1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goals"
        ADD COLUMN IF NOT EXISTS "cover_preset" character varying(40),
        ADD COLUMN IF NOT EXISTS "cover_file" character varying(120),
        ADD COLUMN IF NOT EXISTS "cover_attribution" character varying(400),
        ADD COLUMN IF NOT EXISTS "cover_source_url" character varying(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goals"
        DROP COLUMN IF EXISTS "cover_source_url",
        DROP COLUMN IF EXISTS "cover_attribution",
        DROP COLUMN IF EXISTS "cover_file",
        DROP COLUMN IF EXISTS "cover_preset"
    `);
  }
}
