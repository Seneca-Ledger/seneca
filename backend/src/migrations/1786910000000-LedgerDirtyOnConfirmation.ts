import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Only confirmed transactions are booked (`skipReason` returns 'unconfirmed'
 * otherwise), so confirming a row in Review, or taking the confirmation back,
 * has to queue it for the posting worker like any other change to a fact the
 * entry depends on. Adds `is_verified` to the dirty-marking fingerprint of
 * `ledger_mark_transaction_dirty`; the trigger calls the function by name, so
 * replacing the function is enough.
 */
export class LedgerDirtyOnConfirmation1786910000000 implements MigrationInterface {
  name = 'LedgerDirtyOnConfirmation1786910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(markDirtyFunction(true));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(markDirtyFunction(false));
  }
}

/** The function of 1786440000000-AddLedgerSync, with or without `is_verified`. */
function markDirtyFunction(withConfirmation: boolean): string {
  const confirmation = (row: 'NEW' | 'OLD') => (withConfirmation ? `, ${row}."is_verified"` : '');
  return `
      CREATE OR REPLACE FUNCTION "ledger_mark_transaction_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT'
           OR (NEW."workspace_id", NEW."transaction_type", NEW."amount", NEW."debit", NEW."credit",
               NEW."currency", NEW."transaction_date", NEW."tax_amount", NEW."tax_reverse_charge",
               NEW."tax_notional_amount", NEW."is_duplicate", NEW."crypto_wallet_id",
               NEW."category_id", NEW."branch_id", NEW."statement_id", NEW."wallet_id"${confirmation('NEW')})
              IS DISTINCT FROM
              (OLD."workspace_id", OLD."transaction_type", OLD."amount", OLD."debit", OLD."credit",
               OLD."currency", OLD."transaction_date", OLD."tax_amount", OLD."tax_reverse_charge",
               OLD."tax_notional_amount", OLD."is_duplicate", OLD."crypto_wallet_id",
               OLD."category_id", OLD."branch_id", OLD."statement_id", OLD."wallet_id"${confirmation('OLD')})
        THEN
          NEW."ledger_dirty" := true;
          NEW."ledger_error" := NULL;
          NEW."ledger_attempted_at" := NULL;
        END IF;
        RETURN NEW;
      END;
      $$
    `;
}
