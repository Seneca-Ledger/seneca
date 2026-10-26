import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Bills to pay and amounts to receive carry tags the way receipts already do. */
export class PayableTags1787390000000 implements MigrationInterface {
  name = 'PayableTags1787390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payable_tags" (
        "payable_id" uuid NOT NULL REFERENCES "payables" ("id") ON DELETE CASCADE,
        "tag_id" uuid NOT NULL REFERENCES "tags" ("id") ON DELETE CASCADE,
        CONSTRAINT "PK_payable_tags" PRIMARY KEY ("payable_id", "tag_id")
      )
    `);
    // The primary key covers lookups by bill; this covers "which bills carry
    // this tag" (the list filter, usage counts, deleting a tag).
    await queryRunner.query(`CREATE INDEX "IDX_payable_tags_tag" ON "payable_tags" ("tag_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payable_tags_tag"');
    await queryRunner.query('DROP TABLE IF EXISTS "payable_tags"');
  }
}
