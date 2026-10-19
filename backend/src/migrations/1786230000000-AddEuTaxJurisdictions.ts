import type { MigrationInterface, QueryRunner } from 'typeorm';
import { JURISDICTION_SEED } from '../modules/tax/jurisdictions.seed';

const NEW_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

/**
 * Phase 2 of the tax jurisdiction engine: the rest of the EU.
 *
 * AddTaxJurisdictions1786050000000 already ran in every deployed database, so
 * its seed loop won't pick up entries appended to JURISDICTION_SEED after the
 * fact — TypeORM never re-executes a migration once recorded. This migration
 * re-runs the same insert against just the new codes.
 */
export class AddEuTaxJurisdictions1786230000000 implements MigrationInterface {
  name = 'AddEuTaxJurisdictions1786230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const jurisdiction of JURISDICTION_SEED) {
      if (!NEW_CODES.has(jurisdiction.code)) {
        continue;
      }

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
    await queryRunner.query(`DELETE FROM "tax_jurisdictions" WHERE "code" = ANY($1)`, [
      Array.from(NEW_CODES),
    ]);
  }
}
