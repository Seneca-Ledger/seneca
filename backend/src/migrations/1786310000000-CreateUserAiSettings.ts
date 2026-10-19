import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAiSettings1786310000000 implements MigrationInterface {
  name = 'CreateUserAiSettings1786310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_ai_settings" (
        "id"                uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"           uuid        NOT NULL,
        "workspace_id"      uuid        NOT NULL,
        "config"            jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "encrypted_secrets" jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_ai_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_ai_settings_user_workspace" UNIQUE ("user_id", "workspace_id"),
        CONSTRAINT "FK_user_ai_settings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_ai_settings_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_ai_settings"`);
  }
}
