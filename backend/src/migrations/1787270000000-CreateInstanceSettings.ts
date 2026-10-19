import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Settings of the whole server, starting with the shared Telegram bot token
 * (encrypted like workspace secrets). Only a new table — no existing row changes.
 */
export class CreateInstanceSettings1787270000000 implements MigrationInterface {
  name = 'CreateInstanceSettings1787270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "instance_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" varchar(64) NOT NULL,
        "encrypted_secrets" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "updated_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_instance_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_instance_settings_key" UNIQUE ("key"),
        CONSTRAINT "FK_instance_settings_updated_by" FOREIGN KEY ("updated_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "instance_settings"`);
  }
}
