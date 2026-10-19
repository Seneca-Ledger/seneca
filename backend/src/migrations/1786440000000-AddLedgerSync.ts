import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps the ledger in step with transactions.
 *
 * `transactions.ledger_dirty` marks a row the posting worker still has to
 * (re)book. It is set by database triggers, not by application code, because
 * the facts an entry depends on change through paths no entity subscriber
 * sees: bulk `update()` calls, foreign-key actions (a deleted category nulls
 * `category_id`), and edits to the statement or category a row points at. A
 * trigger fires in the same transaction as the write, so the flag cannot be lost.
 *
 * The column defaults to true: every existing row starts out queued, and the
 * whole history is booked the moment a workspace switches its ledger on.
 * Rows are only ever cleared by the worker, in the transaction that posts them.
 */
export class AddLedgerSync1786440000000 implements MigrationInterface {
  name = 'AddLedgerSync1786440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "ledger_dirty" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "ledger_posted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "ledger_error" text,
        ADD COLUMN IF NOT EXISTS "ledger_attempted_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_ledger_dirty"
        ON "transactions" ("workspace_id") WHERE "ledger_dirty"
    `);

    // The column list is the posting fingerprint of LedgerPostingService: every
    // fact an entry is built from. Anything else (comments, tags, enrichment)
    // can change without touching the ledger.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_transaction_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT'
           OR (NEW."workspace_id", NEW."transaction_type", NEW."amount", NEW."debit", NEW."credit",
               NEW."currency", NEW."transaction_date", NEW."tax_amount", NEW."tax_reverse_charge",
               NEW."tax_notional_amount", NEW."is_duplicate", NEW."crypto_wallet_id",
               NEW."category_id", NEW."branch_id", NEW."statement_id", NEW."wallet_id")
              IS DISTINCT FROM
              (OLD."workspace_id", OLD."transaction_type", OLD."amount", OLD."debit", OLD."credit",
               OLD."currency", OLD."transaction_date", OLD."tax_amount", OLD."tax_reverse_charge",
               OLD."tax_notional_amount", OLD."is_duplicate", OLD."crypto_wallet_id",
               OLD."category_id", OLD."branch_id", OLD."statement_id", OLD."wallet_id")
        THEN
          NEW."ledger_dirty" := true;
          NEW."ledger_error" := NULL;
          NEW."ledger_attempted_at" := NULL;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_transactions_ledger_dirty" ON "transactions"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_transactions_ledger_dirty"
        BEFORE INSERT OR UPDATE ON "transactions"
        FOR EACH ROW EXECUTE FUNCTION "ledger_mark_transaction_dirty"()
    `);

    // A statement's bank, account, currency and trash state decide the cash
    // account of every row on it; its opening balance hangs off it too.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_statement_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE "transactions"
           SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
         WHERE "statement_id" = NEW."id";
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_statements_ledger_dirty" ON "statements"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_statements_ledger_dirty"
        AFTER UPDATE ON "statements"
        FOR EACH ROW
        WHEN (
          (NEW."deleted_at", NEW."bank_name", NEW."account_number", NEW."currency",
           NEW."balance_start", NEW."statement_date_from")
          IS DISTINCT FROM
          (OLD."deleted_at", OLD."bank_name", OLD."account_number", OLD."currency",
           OLD."balance_start", OLD."statement_date_from")
        )
        EXECUTE FUNCTION "ledger_mark_statement_dirty"()
    `);

    // A category's account link and its place in the tree decide the income
    // or expense account of its rows and of every descendant's rows.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_category_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE "transactions"
           SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
         WHERE "category_id" IN (
           WITH RECURSIVE subtree AS (
             SELECT NEW."id" AS "id", 0 AS "depth"
             UNION ALL
             SELECT c."id", s."depth" + 1
               FROM "categories" c JOIN subtree s ON c."parent_id" = s."id"
              WHERE s."depth" < 10
           )
           SELECT "id" FROM subtree
         );
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_categories_ledger_dirty" ON "categories"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_categories_ledger_dirty"
        AFTER UPDATE ON "categories"
        FOR EACH ROW
        WHEN (
          (NEW."parent_id", NEW."ledger_account_id") IS DISTINCT FROM (OLD."parent_id", OLD."ledger_account_id")
        )
        EXECUTE FUNCTION "ledger_mark_category_dirty"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_categories_ledger_dirty" ON "categories"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_statements_ledger_dirty" ON "statements"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_transactions_ledger_dirty" ON "transactions"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_category_dirty"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_statement_dirty"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_transaction_dirty"()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_ledger_dirty"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "ledger_attempted_at",
        DROP COLUMN IF EXISTS "ledger_error",
        DROP COLUMN IF EXISTS "ledger_posted_at",
        DROP COLUMN IF EXISTS "ledger_dirty"
    `);
  }
}
