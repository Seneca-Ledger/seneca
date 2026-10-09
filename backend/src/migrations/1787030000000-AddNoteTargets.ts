import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a note hang off a transaction, a budget, a goal or an invoice, not just
 * a statement or a receipt.
 *
 * A transaction is where a household actually argues about money — "what was
 * this?" — and it is the one place Monarch lets you comment, which its users
 * name as the reason they open it together.
 *
 * Each target keeps its own column and its own foreign key rather than a
 * polymorphic `(type, id)` pair, so deleting the thing takes its discussion
 * with it and nothing has to be swept up by hand. The CHECK keeps exactly one
 * of them set.
 */
export class AddNoteTargets1787030000000 implements MigrationInterface {
  name = 'AddNoteTargets1787030000000';

  private static readonly TARGETS = [
    { column: 'transaction_id', table: 'transactions' },
    { column: 'budget_id', table: 'budgets' },
    { column: 'goal_id', table: 'goals' },
    { column: 'invoice_id', table: 'invoices' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { column, table } of AddNoteTargets1787030000000.TARGETS) {
      await queryRunner.query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS ${column} uuid NULL`);
      await queryRunner.query(`
        ALTER TABLE notes
        ADD CONSTRAINT "FK_notes_${column}"
        FOREIGN KEY (${column}) REFERENCES ${table}(id) ON DELETE CASCADE
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_notes_${column}"
        ON notes (workspace_id, ${column})
      `);
    }

    await queryRunner.query(
      `ALTER TABLE notes DROP CONSTRAINT IF EXISTS "CHK_notes_single_target"`,
    );
    await queryRunner.query(`
      ALTER TABLE notes
      ADD CONSTRAINT "CHK_notes_single_target" CHECK (
        (("statement_id" IS NOT NULL)::int + ("receipt_id" IS NOT NULL)::int
         + ("transaction_id" IS NOT NULL)::int + ("budget_id" IS NOT NULL)::int
         + ("goal_id" IS NOT NULL)::int + ("invoice_id" IS NOT NULL)::int) = 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The notes on the new targets go with their columns; a note has to point
    // at something, and there is nowhere left to move them.
    await queryRunner.query(
      `ALTER TABLE notes DROP CONSTRAINT IF EXISTS "CHK_notes_single_target"`,
    );
    for (const { column } of AddNoteTargets1787030000000.TARGETS) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notes_${column}"`);
      await queryRunner.query(`ALTER TABLE notes DROP CONSTRAINT IF EXISTS "FK_notes_${column}"`);
      await queryRunner.query(`ALTER TABLE notes DROP COLUMN IF EXISTS ${column}`);
    }
    await queryRunner.query(`
      ALTER TABLE notes
      ADD CONSTRAINT "CHK_notes_single_target" CHECK (
        (("statement_id" IS NOT NULL)::int + ("receipt_id" IS NOT NULL)::int) = 1
      )
    `);
  }
}
