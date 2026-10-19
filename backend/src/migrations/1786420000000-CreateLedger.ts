import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Double-entry ledger: chart of accounts, journal entries and their lines.
 *
 * The balance invariant lives in the database, not only in the service: a
 * deferred constraint trigger checks at COMMIT that every booked entry
 * (posted or reversed) has at least two lines and that its base-currency
 * debits equal its base-currency credits. Drafts are exempt — they are
 * assembled one line at a time.
 *
 * Booked entries are immutable here as well: their lines cannot be inserted,
 * changed or deleted, and the entry itself may only move from posted to
 * reversed. Corrections are reversal entries. The only writes let through are
 * the ones foreign keys make on their own (SET NULL on a deleted transaction,
 * category, branch or user, and the cascade when a workspace is deleted).
 *
 * Nothing existing is altered beyond two additive steps: the audit entity enum
 * gains two values, and categories gain a nullable link to their ledger account.
 */
export class CreateLedger1786420000000 implements MigrationInterface {
  name = 'CreateLedger1786420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "parent_id" uuid,
        "code" character varying(40) NOT NULL,
        "name" character varying(255) NOT NULL,
        "account_type" character varying(20) NOT NULL,
        "normal_balance" character varying(6) NOT NULL,
        "currency" character varying(10),
        "is_postable" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "balance_account_id" uuid,
        "wallet_id" uuid,
        "statement_account_key" character varying(255),
        "position" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_ledger_accounts" PRIMARY KEY ("id"),
        -- Target of the composite foreign keys below, which keep a parent in
        -- the same workspace as its child.
        CONSTRAINT "UQ_ledger_accounts_workspace_id" UNIQUE ("workspace_id", "id"),
        CONSTRAINT "FK_ledger_accounts_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        -- NO ACTION rather than RESTRICT: RESTRICT is checked row by row, so the
        -- workspace cascade could trip over a child it has not deleted yet.
        -- NO ACTION waits for the end of the cascade's DELETE on this table.
        CONSTRAINT "FK_ledger_accounts_parent"
          FOREIGN KEY ("workspace_id", "parent_id")
          REFERENCES "ledger_accounts"("workspace_id", "id") ON DELETE NO ACTION,
        CONSTRAINT "FK_ledger_accounts_balance_account"
          FOREIGN KEY ("balance_account_id") REFERENCES "balance_accounts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ledger_accounts_wallet"
          FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_ledger_accounts_type"
          CHECK ("account_type" IN ('asset', 'liability', 'equity', 'income', 'expense')),
        -- Stored for readable balance queries, pinned to the type so a seed
        -- typo cannot flip the sign of an account.
        CONSTRAINT "CHK_ledger_accounts_normal_balance" CHECK (
          ("account_type" IN ('asset', 'expense') AND "normal_balance" = 'debit')
          OR ("account_type" IN ('liability', 'equity', 'income') AND "normal_balance" = 'credit')
        ),
        CONSTRAINT "CHK_ledger_accounts_not_own_parent" CHECK ("parent_id" IS DISTINCT FROM "id")
      )
    `);
    // Partial: a soft-deleted account frees its code.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_accounts_workspace_code"
        ON "ledger_accounts" ("workspace_id", "code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_accounts_statement_key"
        ON "ledger_accounts" ("workspace_id", "statement_account_key")
        WHERE "statement_account_key" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_accounts_wallet"
        ON "ledger_accounts" ("wallet_id") WHERE "wallet_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_accounts_parent" ON "ledger_accounts" ("parent_id")
    `);

    // Postgres sequences are global; entry numbers run per workspace. Numbers
    // are taken under a row lock on this table in the posting transaction.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_counters" (
        "workspace_id" uuid NOT NULL,
        "next_entry_no" bigint NOT NULL DEFAULT 1,
        CONSTRAINT "PK_ledger_counters" PRIMARY KEY ("workspace_id"),
        CONSTRAINT "FK_ledger_counters_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_ledger_counters_positive" CHECK ("next_entry_no" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "entry_no" bigint,
        "entry_date" date NOT NULL,
        "base_currency" character varying(10) NOT NULL,
        "memo" text,
        "status" character varying(12) NOT NULL DEFAULT 'draft',
        "source" character varying(24) NOT NULL,
        "source_transaction_id" uuid,
        "reversal_of_id" uuid,
        "posted_at" TIMESTAMP WITH TIME ZONE,
        "posted_by" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_journal_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_journal_entries_workspace_id" UNIQUE ("workspace_id", "id"),
        -- NULLs never collide, so drafts carry no number and deleting one
        -- leaves no gap in the booked sequence.
        CONSTRAINT "UQ_journal_entries_workspace_entry_no" UNIQUE ("workspace_id", "entry_no"),
        CONSTRAINT "FK_journal_entries_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        -- Transactions are hard-deleted; the entry outlives its source and is
        -- reversed by the posting worker.
        CONSTRAINT "FK_journal_entries_source_transaction"
          FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_journal_entries_reversal_of"
          FOREIGN KEY ("workspace_id", "reversal_of_id")
          REFERENCES "journal_entries"("workspace_id", "id") ON DELETE NO ACTION,
        CONSTRAINT "FK_journal_entries_posted_by"
          FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_journal_entries_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_journal_entries_status"
          CHECK ("status" IN ('draft', 'posted', 'reversed')),
        CONSTRAINT "CHK_journal_entries_source"
          CHECK ("source" IN ('transaction', 'manual', 'opening_balance', 'fx_revaluation')),
        -- A booked entry has its number and its moment; a draft has neither.
        CONSTRAINT "CHK_journal_entries_booking_complete" CHECK (
          ("status" = 'draft') = ("entry_no" IS NULL)
          AND ("status" = 'draft') = ("posted_at" IS NULL)
        ),
        CONSTRAINT "CHK_journal_entries_source_transaction"
          CHECK ("source_transaction_id" IS NULL OR "source" = 'transaction'),
        CONSTRAINT "CHK_journal_entries_not_own_reversal"
          CHECK ("reversal_of_id" IS DISTINCT FROM "id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_journal_entries_workspace_date"
        ON "journal_entries" ("workspace_id", "entry_date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_journal_entries_workspace_status"
        ON "journal_entries" ("workspace_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_journal_entries_source_transaction"
        ON "journal_entries" ("source_transaction_id") WHERE "source_transaction_id" IS NOT NULL
    `);
    // One live entry per transaction. Reversals carry the same source but are
    // excluded, otherwise re-posting (reversal + new entry) would collide.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_journal_entries_live_transaction"
        ON "journal_entries" ("source_transaction_id")
        WHERE "status" = 'posted' AND "source" = 'transaction' AND "reversal_of_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_journal_entries_reversal_of"
        ON "journal_entries" ("reversal_of_id") WHERE "reversal_of_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "line_no" smallint NOT NULL,
        "account_id" uuid NOT NULL,
        "debit" numeric(15,2) NOT NULL DEFAULT 0,
        "credit" numeric(15,2) NOT NULL DEFAULT 0,
        "currency" character varying(10) NOT NULL,
        "base_debit" numeric(15,2) NOT NULL DEFAULT 0,
        "base_credit" numeric(15,2) NOT NULL DEFAULT 0,
        "fx_rate" numeric(18,8) NOT NULL DEFAULT 1,
        "category_id" uuid,
        "branch_id" uuid,
        "memo" text,
        CONSTRAINT "PK_journal_lines" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_journal_lines_entry_line_no" UNIQUE ("entry_id", "line_no"),
        CONSTRAINT "FK_journal_lines_entry"
          FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        -- Deferred to COMMIT: deleting a workspace cascades to its accounts and
        -- to its entries as separate internal statements, and when the accounts
        -- go first an immediate check sees lines that are about to be deleted.
        CONSTRAINT "FK_journal_lines_account"
          FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE NO ACTION
          DEFERRABLE INITIALLY DEFERRED,
        CONSTRAINT "FK_journal_lines_category"
          FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_journal_lines_branch"
          FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_journal_lines_one_side" CHECK (("debit" = 0) <> ("credit" = 0)),
        CONSTRAINT "CHK_journal_lines_non_negative" CHECK (
          "debit" >= 0 AND "credit" >= 0 AND "base_debit" >= 0 AND "base_credit" >= 0
        ),
        -- The base amount sits on the same side as the document amount.
        CONSTRAINT "CHK_journal_lines_base_side" CHECK (
          ("base_debit" = 0 OR "debit" > 0) AND ("base_credit" = 0 OR "credit" > 0)
        ),
        CONSTRAINT "CHK_journal_lines_fx_rate_positive" CHECK ("fx_rate" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_journal_lines_account_entry"
        ON "journal_lines" ("account_id", "entry_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "ledger_account_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_categories_ledger_account"
    `);
    await queryRunner.query(`
      ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_ledger_account"
        FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_categories_ledger_account"
        ON "categories" ("ledger_account_id") WHERE "ledger_account_id" IS NOT NULL
    `);

    // Double-entry invariant, checked at COMMIT for every entry a statement
    // touched. Note: deferred triggers fire on COMMIT, not on RELEASE SAVEPOINT;
    // a test that rolls back its transaction never reaches this check.
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
      DROP TRIGGER IF EXISTS "TRG_journal_lines_balanced" ON "journal_lines"
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER "TRG_journal_lines_balanced"
        AFTER INSERT OR UPDATE OR DELETE ON "journal_lines"
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION "ledger_assert_entry_balanced"()
    `);
    // Also on the entry: promoting a draft to posted touches no line, and
    // would otherwise book whatever the draft held without a check.
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_journal_entries_balanced" ON "journal_entries"
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER "TRG_journal_entries_balanced"
        AFTER INSERT OR UPDATE OF "status" ON "journal_entries"
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION "ledger_assert_entry_balanced"()
    `);

    // Booked lines are frozen. Only the analytics links may change, because
    // deleting a category or branch nulls them through the foreign key. A
    // missing entry means the entry is being deleted by a cascade.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_guard_booked_lines"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_old_status varchar;
        v_new_status varchar;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          SELECT "status" INTO v_old_status FROM "journal_entries" WHERE "id" = OLD.entry_id;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT "status" INTO v_new_status FROM "journal_entries" WHERE "id" = NEW.entry_id;
        END IF;

        IF coalesce(v_old_status, 'draft') = 'draft' AND coalesce(v_new_status, 'draft') = 'draft' THEN
          RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END IF;

        IF TG_OP = 'UPDATE'
           AND (NEW."entry_id", NEW."line_no", NEW."account_id", NEW."debit", NEW."credit",
                NEW."currency", NEW."base_debit", NEW."base_credit", NEW."fx_rate", NEW."memo")
               IS NOT DISTINCT FROM
               (OLD."entry_id", OLD."line_no", OLD."account_id", OLD."debit", OLD."credit",
                OLD."currency", OLD."base_debit", OLD."base_credit", OLD."fx_rate", OLD."memo") THEN
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'lines of a booked journal entry are immutable; post a reversal instead'
          USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_lines_immutable';
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_journal_lines_immutable" ON "journal_lines"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_journal_lines_immutable"
        BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
        FOR EACH ROW EXECUTE FUNCTION "ledger_guard_booked_lines"()
    `);

    // A booked entry may only go posted -> reversed, and lose its links to a
    // deleted transaction or user. Deleting one is refused unless its
    // workspace is already gone, which is the workspace-deletion cascade.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_guard_booked_entries"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."status" = 'draft' THEN
          IF TG_OP = 'UPDATE' AND NEW."status" = 'reversed' THEN
            RAISE EXCEPTION 'a draft journal entry cannot be reversed; post it or delete it'
              USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entries_immutable';
          END IF;
          RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END IF;

        IF TG_OP = 'DELETE' THEN
          IF EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = OLD."workspace_id") THEN
            RAISE EXCEPTION 'journal entry % is booked and cannot be deleted; post a reversal instead',
              OLD."entry_no"
              USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entries_immutable';
          END IF;
          RETURN OLD;
        END IF;

        IF (NEW."workspace_id", NEW."entry_no", NEW."entry_date", NEW."base_currency", NEW."memo",
            NEW."source", NEW."reversal_of_id", NEW."posted_at")
           IS DISTINCT FROM
           (OLD."workspace_id", OLD."entry_no", OLD."entry_date", OLD."base_currency", OLD."memo",
            OLD."source", OLD."reversal_of_id", OLD."posted_at")
           OR NOT (NEW."status" = OLD."status" OR (OLD."status" = 'posted' AND NEW."status" = 'reversed'))
           OR (NEW."source_transaction_id" IS DISTINCT FROM OLD."source_transaction_id"
               AND NEW."source_transaction_id" IS NOT NULL)
           OR (NEW."posted_by" IS DISTINCT FROM OLD."posted_by" AND NEW."posted_by" IS NOT NULL)
           OR (NEW."created_by" IS DISTINCT FROM OLD."created_by" AND NEW."created_by" IS NOT NULL)
        THEN
          RAISE EXCEPTION 'journal entry % is booked; only posted -> reversed is allowed',
            OLD."entry_no"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'TRG_journal_entries_immutable';
        END IF;

        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_journal_entries_immutable" ON "journal_entries"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_journal_entries_immutable"
        BEFORE UPDATE OR DELETE ON "journal_entries"
        FOR EACH ROW EXECUTE FUNCTION "ledger_guard_booked_entries"()
    `);

    await queryRunner.query(
      `ALTER TYPE "entity_type_enum" ADD VALUE IF NOT EXISTS 'ledger_account'`,
    );
    await queryRunner.query(
      `ALTER TYPE "entity_type_enum" ADD VALUE IF NOT EXISTS 'journal_entry'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The two audit enum values stay: Postgres cannot drop an enum value, and
    // audit rows that use them must remain readable.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_ledger_account"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_categories_ledger_account"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "ledger_account_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_counters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_accounts"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_guard_booked_entries"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_guard_booked_lines"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_assert_entry_balanced"()`);
  }
}
