import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Queues a workspace's opening balances for re-booking when a wallet changes.
 *
 * Opening balances were only refreshed when a sync posted a transaction,
 * which is enough for statements (their edits re-queue their rows) but not
 * for wallets: changing a wallet's opening balance, currency or active state
 * touches no transaction. The trigger raises a per-workspace flag instead,
 * in the same transaction as the write; the sync worker clears it before it
 * re-books the openings, and raises it again, with the time of the attempt,
 * when one of them could not be booked (a missing rate), to retry later.
 *
 * Defaults to true so every workspace refreshes its openings once, picking up
 * the wallets that had none booked before.
 */
export class AddLedgerOpeningsDirty1786450000000 implements MigrationInterface {
  name = 'AddLedgerOpeningsDirty1786450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "ledger_openings_dirty" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "ledger_openings_attempted_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_openings_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        -- A change is worth retrying at once, even after a failed attempt.
        UPDATE "workspaces"
           SET "ledger_openings_dirty" = true, "ledger_openings_attempted_at" = NULL
         WHERE "id" IN (
           CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."workspace_id" END,
           CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW."workspace_id" END
         )
           AND ("ledger_openings_dirty" = false OR "ledger_openings_attempted_at" IS NOT NULL);
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings" ON "wallets"`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_wallets_ledger_openings"
        AFTER INSERT OR DELETE ON "wallets"
        FOR EACH ROW EXECUTE FUNCTION "ledger_mark_openings_dirty"()
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings_update" ON "wallets"`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_wallets_ledger_openings_update"
        AFTER UPDATE ON "wallets"
        FOR EACH ROW
        WHEN (
          (NEW."workspace_id", NEW."initial_balance", NEW."currency", NEW."is_active")
          IS DISTINCT FROM
          (OLD."workspace_id", OLD."initial_balance", OLD."currency", OLD."is_active")
        )
        EXECUTE FUNCTION "ledger_mark_openings_dirty"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings_update" ON "wallets"`,
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings" ON "wallets"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_openings_dirty"()`);
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        DROP COLUMN IF EXISTS "ledger_openings_attempted_at",
        DROP COLUMN IF EXISTS "ledger_openings_dirty"
    `);
  }
}
