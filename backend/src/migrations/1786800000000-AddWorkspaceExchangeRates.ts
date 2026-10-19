import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-entered rates move to their own table, keyed by workspace. They used to
 * be written into the shared provider cache (`exchange_rates`, source 'manual'),
 * where one workspace's rate changed every other workspace's conversions. Those
 * rows cannot be attributed to a workspace, so they are dropped from the cache.
 */
export class AddWorkspaceExchangeRates1786800000000 implements MigrationInterface {
  name = 'AddWorkspaceExchangeRates1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_exchange_rates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "base_currency" character varying(10) NOT NULL,
        "target_currency" character varying(10) NOT NULL,
        "rate" numeric(18,8) NOT NULL,
        "rate_date" date NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_exchange_rates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_exchange_rates_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_workspace_exchange_rates_pair_day"
        ON "workspace_exchange_rates" ("workspace_id", "base_currency", "target_currency", "rate_date")
    `);
    await queryRunner.query(`DELETE FROM "exchange_rates" WHERE "source" = 'manual'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_exchange_rates"`);
  }
}
