import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a private sale needs before it can be put on a tax return: the day the
 * metal was bought, and whose metal it was.
 *
 * The acquisition day is copied onto the sale rather than read from the lot,
 * because a lot sold out completely is deleted and the sale has to survive it.
 * The owner is filled in only where there is nothing to guess — a workspace
 * with a single member — and stays NULL everywhere else: attributing one
 * person's sale to another is worse than leaving it unanswered.
 */
export class AddDisposalAttribution1786980000000 implements MigrationInterface {
  name = 'AddDisposalAttribution1786980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        ADD COLUMN IF NOT EXISTS "owner_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "metal_sales"
        ADD COLUMN IF NOT EXISTS "acquired_on" date,
        ADD COLUMN IF NOT EXISTS "owner_user_id" uuid
    `);
    for (const [table, constraint] of [
      ['investment_holdings', 'FK_investment_holdings_owner'],
      ['metal_sales', 'FK_metal_sales_owner'],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}"
          ADD CONSTRAINT "${constraint}"
          FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
    }

    // The lot a sale came from still knows when it was bought, while it exists.
    await queryRunner.query(`
      UPDATE "metal_sales" s
      SET "acquired_on" = h."acquired_on"
      FROM "investment_holdings" h
      WHERE h."id" = s."lot_id" AND s."acquired_on" IS NULL AND h."acquired_on" IS NOT NULL
    `);

    // Only where the workspace has exactly one member is the owner not a guess.
    const soleMember = `
      SELECT m."workspace_id", MIN(m."user_id"::text)::uuid AS user_id
      FROM "workspace_members" m
      GROUP BY m."workspace_id"
      HAVING COUNT(*) = 1
    `;
    await queryRunner.query(`
      UPDATE "investment_holdings" h
      SET "owner_user_id" = sole.user_id
      FROM (${soleMember}) sole
      WHERE h."workspace_id" = sole."workspace_id" AND h."owner_user_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "metal_sales" s
      SET "owner_user_id" = sole.user_id
      FROM (${soleMember}) sole
      WHERE s."workspace_id" = sole."workspace_id" AND s."owner_user_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "metal_sales" DROP CONSTRAINT IF EXISTS "FK_metal_sales_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" DROP CONSTRAINT IF EXISTS "FK_investment_holdings_owner"`,
    );
    await queryRunner.query(`
      ALTER TABLE "metal_sales"
        DROP COLUMN IF EXISTS "owner_user_id",
        DROP COLUMN IF EXISTS "acquired_on"
    `);
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "owner_user_id"`,
    );
  }
}
