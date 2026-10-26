import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Column roles remembered per workspace, import target and header row, so a
 * recurring CSV/XLSX export maps itself on the next import.
 */
export class CreateImportMappingProfiles1787410000000 implements MigrationInterface {
  name = 'CreateImportMappingProfiles1787410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS import_mapping_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        target varchar(32) NOT NULL,
        header_signature varchar(64) NOT NULL,
        mapping jsonb NOT NULL,
        saved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // One row per header row and target: saving is an upsert. The index also
    // serves the lookup the import wizard makes when a file is opened.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_import_mapping_profiles_header"
      ON import_mapping_profiles (workspace_id, target, header_signature)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS import_mapping_profiles');
  }
}
