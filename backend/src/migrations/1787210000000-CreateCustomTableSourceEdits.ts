import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Edits a custom table filled from Lumio data makes to the app records.
 *
 * Cells of such tables now write back to the transaction, invoice, … they show.
 * "Restore to default" has to undo that, and the table itself never kept the
 * values it replaced: each row here holds one record's writable fields before
 * the table's first edit, and as the table last left them — a restore skips a
 * field whose current value differs from that, because the app changed it since.
 * One snapshot per record, since its fields are coupled (amount sign and type).
 */
export class CreateCustomTableSourceEdits1787210000000 implements MigrationInterface {
  name = 'CreateCustomTableSourceEdits1787210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_table_source_edits" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"   uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "table_id"       uuid NOT NULL REFERENCES "custom_tables"("id") ON DELETE CASCADE,
        "source_kind"    character varying(32) NOT NULL,
        "source_key"     character varying(255) NOT NULL,
        "original_values" jsonb NOT NULL,
        "written_values"  jsonb NOT NULL,
        "meta"           jsonb,
        "user_id"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    // One snapshot per record per table: the first original is kept.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_custom_table_source_edits_record"
        ON "custom_table_source_edits" ("table_id", "source_key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_custom_table_source_edits_workspace"
        ON "custom_table_source_edits" ("workspace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_table_source_edits"`);
  }
}
