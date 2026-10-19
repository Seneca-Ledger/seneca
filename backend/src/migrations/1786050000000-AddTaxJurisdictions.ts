import type { MigrationInterface, QueryRunner } from 'typeorm';
import { JURISDICTION_SEED } from '../modules/tax/jurisdictions.seed';

/**
 * Phase 1 of the tax jurisdiction engine: global statutory reference data.
 *
 * Both tables are deliberately not workspace-scoped — see the comment on the
 * TaxJurisdiction entity. Seeding lives here rather than in a runtime service
 * because these rows encode law, and law should not be editable by an API call.
 */
export class AddTaxJurisdictions1786050000000 implements MigrationInterface {
  name = 'AddTaxJurisdictions1786050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_jurisdictions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(2) NOT NULL,
        "name" character varying(120) NOT NULL,
        "tax_name" character varying(40) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "scheme" character varying(20) NOT NULL DEFAULT 'vat',
        "is_eu" boolean NOT NULL DEFAULT false,
        "filing_period" character varying(20) NOT NULL DEFAULT 'quarterly',
        "registration_threshold" numeric(15,2),
        "threshold_period" character varying(20),
        CONSTRAINT "PK_tax_jurisdictions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tax_jurisdictions_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_jurisdiction_rates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jurisdiction_id" uuid NOT NULL,
        "code" character varying(40) NOT NULL,
        "name" character varying(120) NOT NULL,
        "rate" numeric(5,2) NOT NULL,
        "kind" character varying(20) NOT NULL DEFAULT 'standard',
        "is_default" boolean NOT NULL DEFAULT false,
        "valid_from" date NOT NULL,
        "valid_to" date,
        CONSTRAINT "PK_tax_jurisdiction_rates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tax_jurisdiction_rates_jurisdiction"
          FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE CASCADE
      )
    `);

    // A rate code may have many versions, but only one per start date.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_jurisdiction_rates_version"
        ON "tax_jurisdiction_rates" ("jurisdiction_id", "code", "valid_from")
    `);

    // Every point-in-time lookup filters on this.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tax_jurisdiction_rates_validity"
        ON "tax_jurisdiction_rates" ("jurisdiction_id", "valid_from", "valid_to")
    `);

    for (const jurisdiction of JURISDICTION_SEED) {
      // ON CONFLICT keeps the migration re-runnable and lets a later migration
      // correct a rate by re-seeding rather than hand-writing UPDATEs.
      const inserted: Array<{ id: string }> = await queryRunner.query(
        `
        INSERT INTO "tax_jurisdictions"
          ("code", "name", "tax_name", "currency", "scheme", "is_eu",
           "filing_period", "registration_threshold", "threshold_period")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("code") DO UPDATE SET
          "name" = EXCLUDED."name",
          "tax_name" = EXCLUDED."tax_name",
          "currency" = EXCLUDED."currency",
          "scheme" = EXCLUDED."scheme",
          "is_eu" = EXCLUDED."is_eu",
          "filing_period" = EXCLUDED."filing_period",
          "registration_threshold" = EXCLUDED."registration_threshold",
          "threshold_period" = EXCLUDED."threshold_period"
        RETURNING "id"
      `,
        [
          jurisdiction.code,
          jurisdiction.name,
          jurisdiction.taxName,
          jurisdiction.currency,
          jurisdiction.scheme,
          jurisdiction.isEu,
          jurisdiction.filingPeriod,
          jurisdiction.registrationThreshold,
          jurisdiction.thresholdPeriod,
        ],
      );

      const jurisdictionId = inserted[0].id;

      for (const rate of jurisdiction.rates) {
        await queryRunner.query(
          `
          INSERT INTO "tax_jurisdiction_rates"
            ("jurisdiction_id", "code", "name", "rate", "kind", "is_default", "valid_from", "valid_to")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT ("jurisdiction_id", "code", "valid_from") DO UPDATE SET
            "name" = EXCLUDED."name",
            "rate" = EXCLUDED."rate",
            "kind" = EXCLUDED."kind",
            "is_default" = EXCLUDED."is_default",
            "valid_to" = EXCLUDED."valid_to"
        `,
          [
            jurisdictionId,
            rate.code,
            rate.name,
            rate.rate,
            rate.kind,
            rate.isDefault,
            rate.validFrom,
            rate.validTo,
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rates cascade from the jurisdictions table.
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_jurisdiction_rates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_jurisdictions"`);
  }
}
