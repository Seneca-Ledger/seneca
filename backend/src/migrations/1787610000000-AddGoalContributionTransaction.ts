import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal contribution can mirror a transaction: income counted toward the goal,
 * an expense taken out of it. Deleting the transaction drops the movement. A
 * goal's cost line can name the transaction that paid it.
 */
export class AddGoalContributionTransaction1787610000000 implements MigrationInterface {
  name = 'AddGoalContributionTransaction1787610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE goal_contributions
      ADD COLUMN IF NOT EXISTS transaction_id uuid
        REFERENCES transactions(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_goal_contributions_transaction"
      ON goal_contributions (transaction_id) WHERE transaction_id IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE goal_items
      ADD COLUMN IF NOT EXISTS transaction_id uuid
        REFERENCES transactions(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_goal_items_transaction"
      ON goal_items (transaction_id) WHERE transaction_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_goal_items_transaction"');
    await queryRunner.query('ALTER TABLE goal_items DROP COLUMN IF EXISTS transaction_id');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_goal_contributions_transaction"');
    await queryRunner.query('ALTER TABLE goal_contributions DROP COLUMN IF EXISTS transaction_id');
  }
}
