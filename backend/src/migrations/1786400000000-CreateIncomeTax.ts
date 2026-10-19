import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Income-tax declaration drafts.
 *
 * Four tables: who files (profile), which category goes to which form line
 * (confirmed mappings only), the finalized drafts, and the record of which
 * disclaimer revision each user accepted. Nothing existing is altered.
 */
export class CreateIncomeTax1786400000000 implements MigrationInterface {
  name = 'CreateIncomeTax1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "income_tax_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "tax_year" smallint NOT NULL,
        "taxpayer_type" character varying(20) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_income_tax_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_income_tax_profiles_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_income_tax_profiles_type"
          CHECK ("taxpayer_type" IN ('self_employed', 'employee', 'company'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_income_tax_profiles_year"
        ON "income_tax_profiles" ("workspace_id", "tax_year")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "income_tax_line_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "form_key" character varying(64) NOT NULL,
        "category_id" uuid NOT NULL,
        "line_key" character varying(64) NOT NULL,
        "confirmed_by" uuid,
        "confirmed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_income_tax_line_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_income_tax_line_mappings_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_income_tax_line_mappings_category"
          FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_income_tax_line_mappings_user"
          FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_income_tax_line_mappings_category"
        ON "income_tax_line_mappings" ("workspace_id", "form_key", "category_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "income_tax_returns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "jurisdiction_id" uuid NOT NULL,
        "tax_year" smallint NOT NULL,
        "form_key" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "finalized_at" TIMESTAMP WITH TIME ZONE,
        "finalized_by" uuid,
        "snapshot" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_income_tax_returns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_income_tax_returns_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        -- RESTRICT: a finalized draft records what the user filed and must
        -- survive any tidy-up of the jurisdiction catalogue.
        CONSTRAINT "FK_income_tax_returns_jurisdiction"
          FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_income_tax_returns_user"
          FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL,
        -- A finalized draft carries its moment and its snapshot; a reopened one neither.
        CONSTRAINT "CHK_income_tax_returns_finalized_complete" CHECK (
          ("status" = 'finalized' AND "finalized_at" IS NOT NULL AND "snapshot" IS NOT NULL)
          OR ("status" = 'draft' AND "finalized_at" IS NULL AND "snapshot" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_income_tax_returns_year"
        ON "income_tax_returns" ("workspace_id", "tax_year", "form_key")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "income_tax_disclaimer_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "version" character varying(20) NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_income_tax_disclaimer_acceptances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_income_tax_disclaimer_acceptances_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_income_tax_disclaimer_acceptances_version"
        ON "income_tax_disclaimer_acceptances" ("user_id", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "income_tax_disclaimer_acceptances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "income_tax_returns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "income_tax_line_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "income_tax_profiles"`);
  }
}
