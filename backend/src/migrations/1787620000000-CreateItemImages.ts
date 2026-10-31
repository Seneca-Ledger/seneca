import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pictures of what a transaction or a bill was for. One per transaction and one
 * per bill; a row belongs to exactly one of them and goes with it.
 */
export class CreateItemImages1787620000000 implements MigrationInterface {
  name = 'CreateItemImages1787620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS item_images (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
        payable_id uuid REFERENCES payables(id) ON DELETE CASCADE,
        file_name varchar(64) NOT NULL,
        label varchar(200),
        wikidata_id varchar(16),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_item_images_one_subject" CHECK (num_nonnulls(transaction_id, payable_id) = 1)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_item_images_transaction"
      ON item_images (transaction_id) WHERE transaction_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_item_images_payable"
      ON item_images (payable_id) WHERE payable_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_item_images_workspace" ON item_images (workspace_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS item_images');
  }
}
