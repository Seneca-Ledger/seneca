import type { MigrationInterface, QueryRunner } from 'typeorm';

const NAME = 'FixCountedRows1787230000000';
/** A row read or posted a few days apart is still the same money. */
const DAYS_APART = 3;

/**
 * Repairs past rows that figures count wrongly once income and spending
 * include rows without a statement (cash payments, approved receipts):
 *
 * 1. an approved receipt was booked with an amount but neither debit nor
 *    credit, so it counted as nothing — the amount goes on its side;
 * 2. a document filed twice (same file, or same name) counts its rows twice —
 *    the first row stays, a repeat (same currency, side, amount and
 *    counterparty, at most three days apart) is flagged a duplicate of it;
 * 3. a receipt booked by hand whose bank or scan row also counts — the later of
 *    the two is flagged a duplicate of the earlier, one pair per row.
 *
 * Flagged rows are kept and wait in Review, where "keep both" undoes a flag.
 * Every changed row is logged with its previous values; `down` restores them.
 */
export class FixCountedRows1787230000000 implements MigrationInterface {
  name = NAME;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transaction_data_fixes" (
        "id" BIGSERIAL PRIMARY KEY,
        "migration" varchar(64) NOT NULL,
        "transaction_id" uuid NOT NULL,
        "previous" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 1. The amount on its side.
    await queryRunner.query(
      `
      WITH fixed AS (
        SELECT t.id, jsonb_build_object('debit', t.debit, 'credit', t.credit) AS previous
        FROM transactions t
        WHERE t.amount IS NOT NULL AND t.amount <> 0 AND t.debit IS NULL AND t.credit IS NULL
      ), logged AS (
        INSERT INTO transaction_data_fixes (migration, transaction_id, previous)
        SELECT $1, id, previous FROM fixed
      )
      UPDATE transactions t
      SET debit = CASE WHEN t.transaction_type = 'income' THEN NULL ELSE ABS(t.amount) END,
          credit = CASE WHEN t.transaction_type = 'income' THEN ABS(t.amount) ELSE NULL END
      FROM fixed WHERE fixed.id = t.id
      `,
      [NAME],
    );

    // 2. A document filed twice: the earliest row of each repeat stays.
    await queryRunner.query(
      `
      WITH counted AS (
        SELECT t.id, t.workspace_id, t.statement_id, t.transaction_date, t.currency, t.created_at,
               COALESCE(t.debit, 0) AS debit, COALESCE(t.credit, 0) AS credit,
               LOWER(TRIM(t.counterparty_name)) AS party, s.file_name, s.file_hash
        FROM transactions t
        JOIN statements s ON s.id = t.statement_id AND s.deleted_at IS NULL
        WHERE t.is_verified AND NOT t.is_duplicate AND t.crypto_wallet_id IS NULL
      ), repeats AS (
        SELECT DISTINCT ON (r.id) r.id, o.id AS original
        FROM counted r
        JOIN counted o
          ON o.workspace_id = r.workspace_id
         AND o.statement_id <> r.statement_id
         AND (o.file_name = r.file_name OR o.file_hash = r.file_hash)
         AND o.currency = r.currency AND o.debit = r.debit AND o.credit = r.credit
         AND o.party = r.party
         AND ABS(o.transaction_date - r.transaction_date) <= ${DAYS_APART}
         AND (o.created_at, o.id) < (r.created_at, r.id)
        ORDER BY r.id, o.created_at, o.id
      ), logged AS (
        INSERT INTO transaction_data_fixes (migration, transaction_id, previous)
        SELECT $1, t.id, jsonb_build_object(
          'is_duplicate', t.is_duplicate, 'duplicate_of_id', t.duplicate_of_id,
          'duplicate_match_type', t.duplicate_match_type)
        FROM transactions t JOIN repeats ON repeats.id = t.id
      )
      UPDATE transactions t
      SET is_duplicate = true, duplicate_of_id = repeats.original, duplicate_match_type = 'same_document'
      FROM repeats WHERE repeats.id = t.id
      `,
      [NAME],
    );

    // 3. A hand-booked row and the statement row of the same money: one pair
    //    per row, the closest date first, the later-created row flagged.
    const pairs: Array<{ manual: string; statement_row: string; flag: string; keep: string }> =
      await queryRunner.query(`
        SELECT m.id AS manual, s.id AS statement_row,
               CASE WHEN (m.created_at, m.id) > (s.created_at, s.id) THEN m.id ELSE s.id END AS flag,
               CASE WHEN (m.created_at, m.id) > (s.created_at, s.id) THEN s.id ELSE m.id END AS keep
        FROM transactions m
        JOIN transactions s
          ON s.workspace_id = m.workspace_id
         AND s.statement_id IS NOT NULL
         AND s.is_verified AND NOT s.is_duplicate AND s.crypto_wallet_id IS NULL
         AND s.currency = m.currency
         AND COALESCE(s.debit, 0) = COALESCE(m.debit, 0)
         AND COALESCE(s.credit, 0) = COALESCE(m.credit, 0)
         AND ABS(s.transaction_date - m.transaction_date) <= ${DAYS_APART}
        JOIN statements st ON st.id = s.statement_id AND st.deleted_at IS NULL
        WHERE m.statement_id IS NULL AND m.crypto_wallet_id IS NULL
          AND m.is_verified AND NOT m.is_duplicate
          AND (COALESCE(m.debit, 0) > 0 OR COALESCE(m.credit, 0) > 0)
        ORDER BY ABS(s.transaction_date - m.transaction_date), m.created_at, m.id, s.created_at, s.id
      `);
    const taken = new Set<string>();
    for (const pair of pairs) {
      if (taken.has(pair.manual) || taken.has(pair.statement_row)) {
        continue;
      }
      taken.add(pair.manual);
      taken.add(pair.statement_row);
      await queryRunner.query(
        `
        WITH logged AS (
          INSERT INTO transaction_data_fixes (migration, transaction_id, previous)
          SELECT $1, t.id, jsonb_build_object(
            'is_duplicate', t.is_duplicate, 'duplicate_of_id', t.duplicate_of_id,
            'duplicate_match_type', t.duplicate_match_type)
          FROM transactions t WHERE t.id = $2
        )
        UPDATE transactions
        SET is_duplicate = true, duplicate_of_id = $3, duplicate_match_type = 'manual_entry'
        WHERE id = $2
        `,
        [NAME, pair.flag, pair.keep],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Latest change first, so a row changed twice ends up as it began.
    const fixes: Array<{ transaction_id: string; previous: Record<string, unknown> }> =
      await queryRunner.query(
        'SELECT transaction_id, previous FROM transaction_data_fixes WHERE migration = $1 ORDER BY id DESC',
        [NAME],
      );
    for (const fix of fixes) {
      const columns = Object.keys(fix.previous);
      // Only the columns `up` logs are written back; a log row naming anything else is skipped.
      if (columns.length === 0 || columns.some(column => !(column in COLUMN_TYPES))) {
        continue;
      }
      const assignments = columns.map(
        column => `"${column}" = ($2::jsonb ->> '${column}')::${COLUMN_TYPES[column]}`,
      );
      await queryRunner.query(`UPDATE transactions SET ${assignments.join(', ')} WHERE id = $1`, [
        fix.transaction_id,
        JSON.stringify(fix.previous),
      ]);
    }
    await queryRunner.query('DELETE FROM transaction_data_fixes WHERE migration = $1', [NAME]);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_data_fixes"`);
  }
}

/** The columns `up` logs, with the type each is restored as. */
const COLUMN_TYPES: Record<string, string> = {
  debit: 'numeric',
  credit: 'numeric',
  is_duplicate: 'boolean',
  duplicate_of_id: 'uuid',
  duplicate_match_type: 'varchar',
};
