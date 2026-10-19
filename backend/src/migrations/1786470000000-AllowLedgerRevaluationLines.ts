import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a revaluation book base-currency-only lines.
 *
 * Revaluing a foreign-currency balance changes what it is worth in the base
 * currency and nothing else: the line carries a base amount and no document
 * amount. The row checks required a document amount on every line, so they
 * now also accept a line with none, as long as it has exactly one base side;
 * the balance trigger restricts such lines to entries whose source is
 * 'fx_revaluation', in a currency other than the base.
 *
 * One live revaluation per workspace and day, so a repeated request cannot
 * book the same adjustment twice.
 */
export class AllowLedgerRevaluationLines1786470000000 implements MigrationInterface {
  name = 'AllowLedgerRevaluationLines1786470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_lines"
        DROP CONSTRAINT IF EXISTS "CHK_journal_lines_one_side",
        DROP CONSTRAINT IF EXISTS "CHK_journal_lines_base_side"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_lines"
        ADD CONSTRAINT "CHK_journal_lines_one_side" CHECK (
          ("debit" = 0) <> ("credit" = 0)
          OR ("debit" = 0 AND "credit" = 0 AND ("base_debit" = 0) <> ("base_credit" = 0))
        ),
        -- The base amount sits on the same side as the document amount, when there is one.
        ADD CONSTRAINT "CHK_journal_lines_base_side" CHECK (
          ("debit" = 0 AND "credit" = 0)
          OR (("base_debit" = 0 OR "debit" > 0) AND ("base_credit" = 0 OR "credit" > 0))
        )
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_assert_entry_balanced"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_entry_id uuid;
        v_entry record;
        v_line_count integer;
        v_debit numeric;
        v_credit numeric;
        v_bad_account uuid;
      BEGIN
        IF TG_TABLE_NAME = 'journal_lines' THEN
          v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END;
        ELSE
          v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
        END IF;

        SELECT "id", "workspace_id", "status", "base_currency", "entry_no", "source"
          INTO v_entry FROM "journal_entries" WHERE "id" = v_entry_id;
        IF NOT FOUND OR v_entry.status = 'draft' THEN
          RETURN NULL;
        END IF;

        SELECT count(*), coalesce(sum("base_debit"), 0), coalesce(sum("base_credit"), 0)
          INTO v_line_count, v_debit, v_credit
          FROM "journal_lines" WHERE "entry_id" = v_entry_id;

        IF v_line_count < 2 THEN
          RAISE EXCEPTION 'journal entry % has % line(s); a booked entry needs at least two',
            v_entry.entry_no, v_line_count
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        IF v_debit <> v_credit THEN
          RAISE EXCEPTION 'journal entry % unbalanced by %', v_entry.entry_no, v_debit - v_credit
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        -- Every line books to a live, postable account of the same workspace,
        -- in the account's currency when the account has one.
        SELECT l."account_id" INTO v_bad_account
          FROM "journal_lines" l
          JOIN "ledger_accounts" a ON a."id" = l."account_id"
         WHERE l."entry_id" = v_entry_id
           AND (a."workspace_id" <> v_entry.workspace_id
                OR NOT a."is_postable"
                OR a."deleted_at" IS NOT NULL
                OR (a."currency" IS NOT NULL AND a."currency" <> l."currency"))
         LIMIT 1;
        IF FOUND THEN
          RAISE EXCEPTION 'journal entry % books to account % which is not postable here',
            v_entry.entry_no, v_bad_account
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        -- A line already in the base currency carries no conversion.
        IF EXISTS (
          SELECT 1 FROM "journal_lines"
           WHERE "entry_id" = v_entry_id
             AND "currency" = v_entry.base_currency
             AND ("fx_rate" <> 1 OR "base_debit" <> "debit" OR "base_credit" <> "credit")
        ) THEN
          RAISE EXCEPTION 'journal entry % converts a line already in base currency %',
            v_entry.entry_no, v_entry.base_currency
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        -- A line with no document amount only adjusts a foreign-currency
        -- balance to a new rate: nothing but a revaluation may book one.
        IF EXISTS (
          SELECT 1 FROM "journal_lines"
           WHERE "entry_id" = v_entry_id AND "debit" = 0 AND "credit" = 0
             AND (v_entry.source <> 'fx_revaluation' OR "currency" = v_entry.base_currency)
        ) THEN
          RAISE EXCEPTION 'journal entry % has a line with no amount outside a revaluation',
            v_entry.entry_no
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_journal_entries_live_revaluation"
        ON "journal_entries" ("workspace_id", "entry_date")
        WHERE "source" = 'fx_revaluation' AND "status" = 'posted' AND "reversal_of_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_journal_entries_live_revaluation"`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_assert_entry_balanced"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_entry_id uuid;
        v_entry record;
        v_line_count integer;
        v_debit numeric;
        v_credit numeric;
        v_bad_account uuid;
      BEGIN
        IF TG_TABLE_NAME = 'journal_lines' THEN
          v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END;
        ELSE
          v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
        END IF;

        SELECT "id", "workspace_id", "status", "base_currency", "entry_no"
          INTO v_entry FROM "journal_entries" WHERE "id" = v_entry_id;
        IF NOT FOUND OR v_entry.status = 'draft' THEN
          RETURN NULL;
        END IF;

        SELECT count(*), coalesce(sum("base_debit"), 0), coalesce(sum("base_credit"), 0)
          INTO v_line_count, v_debit, v_credit
          FROM "journal_lines" WHERE "entry_id" = v_entry_id;

        IF v_line_count < 2 THEN
          RAISE EXCEPTION 'journal entry % has % line(s); a booked entry needs at least two',
            v_entry.entry_no, v_line_count
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        IF v_debit <> v_credit THEN
          RAISE EXCEPTION 'journal entry % unbalanced by %', v_entry.entry_no, v_debit - v_credit
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        -- Every line books to a live, postable account of the same workspace,
        -- in the account's currency when the account has one.
        SELECT l."account_id" INTO v_bad_account
          FROM "journal_lines" l
          JOIN "ledger_accounts" a ON a."id" = l."account_id"
         WHERE l."entry_id" = v_entry_id
           AND (a."workspace_id" <> v_entry.workspace_id
                OR NOT a."is_postable"
                OR a."deleted_at" IS NOT NULL
                OR (a."currency" IS NOT NULL AND a."currency" <> l."currency"))
         LIMIT 1;
        IF FOUND THEN
          RAISE EXCEPTION 'journal entry % books to account % which is not postable here',
            v_entry.entry_no, v_bad_account
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        -- A line already in the base currency carries no conversion.
        IF EXISTS (
          SELECT 1 FROM "journal_lines"
           WHERE "entry_id" = v_entry_id
             AND "currency" = v_entry.base_currency
             AND ("fx_rate" <> 1 OR "base_debit" <> "debit" OR "base_credit" <> "credit")
        ) THEN
          RAISE EXCEPTION 'journal entry % converts a line already in base currency %',
            v_entry.entry_no, v_entry.base_currency
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entry_balanced';
        END IF;

        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_lines"
        DROP CONSTRAINT IF EXISTS "CHK_journal_lines_one_side",
        DROP CONSTRAINT IF EXISTS "CHK_journal_lines_base_side"
    `);
    // Fails if revaluation lines exist: they have to be removed first.
    await queryRunner.query(`
      ALTER TABLE "journal_lines"
        ADD CONSTRAINT "CHK_journal_lines_one_side" CHECK (("debit" = 0) <> ("credit" = 0)),
        ADD CONSTRAINT "CHK_journal_lines_base_side" CHECK (
          ("base_debit" = 0 OR "debit" > 0) AND ("base_credit" = 0 OR "credit" > 0)
        )
    `);
  }
}
