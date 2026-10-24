import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tags get a page of their own: a description and an optional date (the day
 * of a trip or an event the tag stands for), and receipts can carry tags the
 * way statements and transactions already do. Audit events name the tag they
 * changed.
 */
export class TagDetailsAndReceiptTags1787380000000 implements MigrationInterface {
  name = 'TagDetailsAndReceiptTags1787380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "description" text NULL`);
    await queryRunner.query(`ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "tag_date" date NULL`);

    await queryRunner.query(`
      CREATE TABLE "receipt_tags" (
        "receipt_id" uuid NOT NULL REFERENCES "receipts" ("id") ON DELETE CASCADE,
        "tag_id" uuid NOT NULL REFERENCES "tags" ("id") ON DELETE CASCADE,
        CONSTRAINT "PK_receipt_tags" PRIMARY KEY ("receipt_id", "tag_id")
      )
    `);
    // The primary key covers lookups by receipt; this covers "which receipts
    // carry this tag" (usage counts, deleting a tag).
    await queryRunner.query(`CREATE INDEX "IDX_receipt_tags_tag" ON "receipt_tags" ("tag_id")`);

    const [entityType] = await queryRunner.query(`
      SELECT udt_name AS type_name FROM information_schema.columns
       WHERE table_name = 'audit_events' AND column_name = 'entity_type' AND data_type = 'USER-DEFINED'
       LIMIT 1
    `);
    if (entityType?.type_name) {
      await queryRunner.query(`ALTER TYPE "${entityType.type_name}" ADD VALUE IF NOT EXISTS 'tag'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The 'tag' audit entity type stays: Postgres cannot drop an enum value,
    // and audit events written with it must keep reading.
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_receipt_tags_tag"');
    await queryRunner.query('DROP TABLE IF EXISTS "receipt_tags"');
    await queryRunner.query('ALTER TABLE "tags" DROP COLUMN IF EXISTS "tag_date"');
    await queryRunner.query('ALTER TABLE "tags" DROP COLUMN IF EXISTS "description"');
  }
}
