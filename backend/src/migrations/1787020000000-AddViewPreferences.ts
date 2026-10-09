import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remembers how each person left each page.
 *
 * Without it every list resets to its defaults on the next load, which is the
 * complaint Monarch users have about theirs: you filter down to your own
 * accounts, come back, and it is showing everybody's again.
 */
export class AddViewPreferences1787020000000 implements MigrationInterface {
  name = 'AddViewPreferences1787020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS view_preferences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scope varchar(64) NOT NULL,
        state jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // One row per person, workspace and page: saving is an upsert, never a pile
    // of rows nobody prunes.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_view_preferences_scope"
      ON view_preferences (user_id, workspace_id, scope)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS view_preferences');
  }
}
