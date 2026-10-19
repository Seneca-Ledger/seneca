import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotes1786300000000 implements MigrationInterface {
  name = 'AddNotes1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Отдельная колонка на каждый тип цели вместо полиморфной пары (type, id):
    // так удаление выписки или чека уносит обсуждение каскадом, а CHECK не даёт
    // создать заметку без цели или сразу с двумя.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "statement_id" uuid,
        "receipt_id" uuid,
        "user_id" uuid,
        "body" text NOT NULL,
        "mentioned_user_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_notes_single_target" CHECK (
          (("statement_id" IS NOT NULL)::int + ("receipt_id" IS NOT NULL)::int) = 1
        ),
        CONSTRAINT "FK_notes_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notes_statement" FOREIGN KEY ("statement_id")
          REFERENCES "statements"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notes_receipt" FOREIGN KEY ("receipt_id")
          REFERENCES "receipts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Горячие запросы — «заметки этого объекта» и счётчики по странице списка.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notes_statement"
        ON "notes" ("workspace_id", "statement_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notes_receipt"
        ON "notes" ("workspace_id", "receipt_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notes_receipt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notes_statement"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notes"`);
  }
}
