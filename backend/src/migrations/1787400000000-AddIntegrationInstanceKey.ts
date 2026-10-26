import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A workspace could hold only one integration per provider. That is right for
 * cloud storage and mail, and wrong for bank data: Enable Banking's free tier
 * gives an application access only to the accounts of the person who linked
 * them, so two people sharing a workspace need one connection each.
 *
 * `instance_key` names the instance. NULL keeps the old meaning — the single
 * connection of that provider — so every existing row and every integration
 * that should stay unique is unaffected. The index coalesces NULL to '' because
 * Postgres treats NULLs in a unique index as distinct, which would otherwise
 * drop the guarantee instead of preserving it.
 */
export class AddIntegrationInstanceKey1787400000000 implements MigrationInterface {
  name = 'AddIntegrationInstanceKey1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "instance_key" varchar(64)
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_integrations_workspace_provider"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_integrations_workspace_provider_instance"
      ON "integrations" ("workspace_id", "provider", (COALESCE("instance_key", '')))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_integrations_workspace_provider_instance"`);
    // Only restorable while at most one row per (workspace, provider) remains.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_integrations_workspace_provider"
      ON "integrations" ("workspace_id", "provider")
    `);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN IF EXISTS "instance_key"`);
  }
}
