import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the owner of a row hide what it was, without hiding that it happened.
 *
 * A private transaction keeps its date and its amount for everyone: the money
 * left the household's account and every total has to say so. What it hides is
 * the merchant, the purpose and the category — the row reads as "Private".
 *
 * The category is moved rather than masked at read time. Masking per viewer
 * would make a total depend on who is asking, and two such totals differ by
 * exactly the hidden amount — privacy you can recover with a subtraction. With
 * the category really stored as `Private`, nothing anywhere is viewer-dependent
 * except a few text fields on the row, and those cannot leak a number.
 * `private_category_id` keeps the original so turning privacy off restores it.
 */
export class AddPrivateTransactions1787010000000 implements MigrationInterface {
  name = 'AddPrivateTransactions1787010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS private_category_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE transactions
      ADD CONSTRAINT "FK_transactions_private_category"
      FOREIGN KEY (private_category_id) REFERENCES categories(id) ON DELETE SET NULL
    `);

    // One `Private` category per workspace and kind of money, the same shape as
    // the `Uncategorized` fallback.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_private"
      ON categories (workspace_id, type)
      WHERE name = 'Private' AND parent_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Give every private row its own category back before the column that holds
    // it disappears; otherwise the rows stay filed under `Private` forever.
    await queryRunner.query(`
      UPDATE transactions
      SET category_id = private_category_id
      WHERE is_private = true AND private_category_id IS NOT NULL
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_private"`);
    await queryRunner.query(
      `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS "FK_transactions_private_category"`,
    );
    await queryRunner.query('ALTER TABLE transactions DROP COLUMN IF EXISTS private_category_id');
    await queryRunner.query('ALTER TABLE transactions DROP COLUMN IF EXISTS is_private');
  }
}
