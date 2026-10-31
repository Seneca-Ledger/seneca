import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What became of each suggested category once a person decided: accepted as it
 * was, or changed. Counts only, no descriptor or amount: the real precision of
 * each suggestion source (scripts/suggestion-report.ts). Not workspace data to
 * back up or restore, so it has no entity.
 */
export class CreateCategorySuggestionOutcomes1787590000000 implements MigrationInterface {
  name = 'CreateCategorySuggestionOutcomes1787590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "category_suggestion_outcomes" (
        "id" bigserial PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "source" varchar(16) NOT NULL,
        "outcome" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_category_suggestion_outcomes_workspace"
        ON "category_suggestion_outcomes" ("workspace_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "category_suggestion_outcomes"`);
  }
}
