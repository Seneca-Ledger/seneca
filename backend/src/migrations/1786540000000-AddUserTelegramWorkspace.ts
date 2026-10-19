import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Telegram bot answers for the workspace the chat was connected in
 * (goals, net worth, reports, uploaded statements). Existing links have none
 * recorded and keep falling back to the user's registration workspace.
 */
export class AddUserTelegramWorkspace1786540000000 implements MigrationInterface {
  name = 'AddUserTelegramWorkspace1786540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_workspace_id" uuid NULL',
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_telegram_workspace"
      FOREIGN KEY ("telegram_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_telegram_workspace"',
    );
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "telegram_workspace_id"');
  }
}
