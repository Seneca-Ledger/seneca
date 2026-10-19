import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeyScopesAndAiActor1786760000000 implements MigrationInterface {
  name = 'AddApiKeyScopesAndAiActor1786760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scopes" jsonb`);
    // Outside a transaction block Postgres would need; ADD VALUE is safe to repeat.
    await queryRunner.query(`ALTER TYPE "actor_type_enum" ADD VALUE IF NOT EXISTS 'ai'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "scopes"`);
    // Enum values cannot be removed in place; 'ai' stays, unused.
  }
}
