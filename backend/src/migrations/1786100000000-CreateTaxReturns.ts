import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 of the tax jurisdiction engine: the return itself.
 *
 * A draft is recomputed from the transactions on every read. Filing freezes it
 * and writes a line-by-line snapshot, because a return reopened months later
 * must show the figures that were submitted, not what the transactions have
 * become since.
 */
export class CreateTaxReturns1786100000000 implements MigrationInterface {
  name = 'CreateTaxReturns1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_returns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "jurisdiction_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "output_tax" numeric(15,2) NOT NULL DEFAULT 0,
        "input_tax" numeric(15,2) NOT NULL DEFAULT 0,
        "net_payable" numeric(15,2) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL,
        "filed_at" TIMESTAMP WITH TIME ZONE,
        "snapshot" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tax_returns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tax_returns_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        -- RESTRICT, not CASCADE: a filed return is a record of a submission and
        -- must survive any tidy-up of the jurisdiction catalogue.
        CONSTRAINT "FK_tax_returns_jurisdiction"
          FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_tax_returns_period" CHECK ("period_end" >= "period_start")
      )
    `);

    // One return per workspace, jurisdiction and period. Filing the same
    // quarter twice is a mistake, not a feature.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_returns_period"
        ON "tax_returns" ("workspace_id", "jurisdiction_id", "period_start", "period_end")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tax_returns_workspace_period"
        ON "tax_returns" ("workspace_id", "period_start")
    `);

    // A filed return must carry both the moment it was filed and the lines it
    // was built from; a draft must carry neither.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tax_returns"
          ADD CONSTRAINT "CHK_tax_returns_filed_complete"
          CHECK (
            ("status" = 'filed' AND "filed_at" IS NOT NULL AND "snapshot" IS NOT NULL)
            OR ("status" <> 'filed' AND "filed_at" IS NULL AND "snapshot" IS NULL)
          );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_returns"`);
  }
}
