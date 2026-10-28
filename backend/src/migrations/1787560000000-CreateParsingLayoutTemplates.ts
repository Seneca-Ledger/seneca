import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Statement layouts taught per workspace by marking a file the parser could
 * not read: headings, labels and column positions, never a row's content.
 */
export class CreateParsingLayoutTemplates1787560000000 implements MigrationInterface {
  name = 'CreateParsingLayoutTemplates1787560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS parsing_layout_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        signature varchar(64) NOT NULL,
        bank_name varchar(64) NOT NULL,
        template jsonb NOT NULL,
        used_count int NOT NULL DEFAULT 0,
        statement_id uuid REFERENCES statements(id) ON DELETE SET NULL,
        taught_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // Teaching the same layout again replaces it. The index also serves the
    // lookup of a workspace's templates while a statement is parsed.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_parsing_layout_templates_signature"
      ON parsing_layout_templates (workspace_id, signature)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS parsing_layout_templates');
  }
}
