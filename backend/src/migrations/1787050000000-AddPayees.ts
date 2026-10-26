import type { MigrationInterface, QueryRunner } from 'typeorm';
import { payeeKeyOf, payeeNameOf } from '../common/utils/payee-key.util';

const BATCH = 1000;

type Row = {
  id: string;
  workspace_id: string;
  counterparty_name: string | null;
  payment_purpose: string | null;
};

/**
 * Payees become things the user can name, merge and instruct, as in YNAB.
 *
 * - `payees`: the name the user sees, and the auto / always / never choice
 *   that `payee_overrides` held (its rows move here, then it is dropped).
 * - `payee_aliases`: which normalised descriptor means which payee. Changing
 *   the payee of a row repoints its descriptor, so the next import follows.
 * - `transactions.payee_id`: the payee of each row; history is read by it, so
 *   merging two payees merges their history.
 *
 * Existing rows are backfilled in batches: `payee_key` (left NULL by
 * 1787040000000) is computed by the same function the app uses, every new
 * key gets a payee named after the first descriptor seen with it, and every
 * row gets its `payee_id`.
 */
export class AddPayees1787050000000 implements MigrationInterface {
  name = 'AddPayees1787050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payees_mode_enum" AS ENUM ('auto', 'always', 'never');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "name" text NOT NULL,
        "mode" "payees_mode_enum" NOT NULL DEFAULT 'auto',
        "category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payees" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payees_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payees_category" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payees_workspace" ON "payees" ("workspace_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payee_aliases" (
        "workspace_id" uuid NOT NULL,
        "payee_key" text NOT NULL,
        "payee_id" uuid NOT NULL,
        CONSTRAINT "PK_payee_aliases" PRIMARY KEY ("workspace_id", "payee_key"),
        CONSTRAINT "FK_payee_aliases_payee" FOREIGN KEY ("payee_id")
          REFERENCES "payees"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payee_aliases_payee" ON "payee_aliases" ("payee_id")`,
    );

    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payee_id" uuid`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_payee"
          FOREIGN KEY ("payee_id") REFERENCES "payees"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    // History is "this payee, newest first"; the list counts rows per payee.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_payee_id"
         ON "transactions" ("workspace_id", "payee_id", "transaction_date" DESC)
         WHERE "payee_id" IS NOT NULL`,
    );

    // Standing instructions move over with their payee.
    const overrides: Array<{
      workspace_id: string;
      payee_key: string;
      display_name: string | null;
      mode: string;
      category_id: string | null;
    }> = await queryRunner.query(
      `SELECT workspace_id, payee_key, display_name, mode::text AS mode, category_id
         FROM "payee_overrides"`,
    );
    for (const override of overrides) {
      const [payee] = await queryRunner.query(
        `INSERT INTO "payees" ("workspace_id", "name", "mode", "category_id")
         VALUES ($1, $2, $3::"payees_mode_enum", $4) RETURNING "id"`,
        [
          override.workspace_id,
          override.display_name ?? override.payee_key,
          override.mode,
          override.category_id,
        ],
      );
      await queryRunner.query(
        `INSERT INTO "payee_aliases" ("workspace_id", "payee_key", "payee_id") VALUES ($1, $2, $3)`,
        [override.workspace_id, override.payee_key, payee.id],
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "payee_overrides"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payee_overrides_mode_enum"`);

    await this.backfill(queryRunner);

    // Audit events name the payee they changed.
    const [entityType] = await queryRunner.query(`
      SELECT udt_name AS type_name FROM information_schema.columns
       WHERE table_name = 'audit_events' AND column_name = 'entity_type' AND data_type = 'USER-DEFINED'
       LIMIT 1
    `);
    if (entityType?.type_name) {
      await queryRunner.query(
        `ALTER TYPE "${entityType.type_name}" ADD VALUE IF NOT EXISTS 'payee'`,
      );
    }
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Row[] = await queryRunner.query(
        `SELECT id, workspace_id, counterparty_name, payment_purpose
           FROM transactions WHERE id > $1 ORDER BY id LIMIT ${BATCH}`,
        [after],
      );
      if (rows.length === 0) {
        return;
      }
      after = rows[rows.length - 1].id;

      const described = rows.map(row => {
        const descriptor = {
          counterpartyName: row.counterparty_name,
          paymentPurpose: row.payment_purpose,
        };
        return {
          id: row.id,
          workspaceId: row.workspace_id,
          name: payeeNameOf(descriptor) ?? '',
          key: payeeKeyOf(descriptor),
        };
      });
      const keyed = described.filter(
        (row): row is typeof row & { key: string } => row.key !== null,
      );
      // A key written before document words were dropped ("invoice") names nobody.
      const unkeyed = described.filter(row => row.key === null).map(row => row.id);
      if (unkeyed.length) {
        await queryRunner.query(
          `UPDATE transactions SET payee_key = NULL WHERE id = ANY($1::uuid[]) AND payee_key IS NOT NULL`,
          [unkeyed],
        );
      }

      // One payee per new key, named after the first descriptor seen with it.
      const firstSeen = new Map<string, { workspaceId: string; key: string; name: string }>();
      for (const row of keyed) {
        const id = `${row.workspaceId}\u0000${row.key}`;
        if (!firstSeen.has(id)) {
          firstSeen.set(id, { workspaceId: row.workspaceId, key: row.key, name: row.name });
        }
      }
      for (const payee of firstSeen.values()) {
        await queryRunner.query(
          `WITH existing AS (
             SELECT 1 FROM payee_aliases WHERE workspace_id = $1 AND payee_key = $2
           ), created AS (
             INSERT INTO payees (workspace_id, name)
             SELECT $1, $3 WHERE NOT EXISTS (SELECT 1 FROM existing)
             RETURNING id
           )
           INSERT INTO payee_aliases (workspace_id, payee_key, payee_id)
           SELECT $1, $2, id FROM created
           ON CONFLICT DO NOTHING`,
          [payee.workspaceId, payee.key, payee.name],
        );
      }

      if (keyed.length) {
        await queryRunner.query(
          `UPDATE transactions t
              SET payee_key = v.key, payee_id = a.payee_id
             FROM unnest($1::uuid[], $2::text[]) AS v(id, key)
             JOIN transactions src ON src.id = v.id
             JOIN payee_aliases a ON a.workspace_id = src.workspace_id AND a.payee_key = v.key
            WHERE t.id = v.id`,
          [keyed.map(row => row.id), keyed.map(row => row.key)],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payee_overrides_mode_enum" AS ENUM ('auto', 'always', 'never');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payee_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "payee_key" text NOT NULL,
        "display_name" text,
        "mode" "payee_overrides_mode_enum" NOT NULL DEFAULT 'auto',
        "category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payee_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payee_overrides_workspace_key" UNIQUE ("workspace_id", "payee_key"),
        CONSTRAINT "FK_payee_overrides_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payee_overrides_category" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payee_overrides_workspace" ON "payee_overrides" ("workspace_id")`,
    );
    // Only payees with an instruction had a row there; names and merges are lost.
    await queryRunner.query(`
      INSERT INTO "payee_overrides" ("workspace_id", "payee_key", "display_name", "mode", "category_id")
      SELECT a."workspace_id", a."payee_key", p."name", p."mode"::text::"payee_overrides_mode_enum", p."category_id"
        FROM "payee_aliases" a JOIN "payees" p ON p."id" = a."payee_id"
       WHERE p."mode" <> 'auto'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_workspace_payee_id"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_payee"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payee_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payee_aliases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payees"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payees_mode_enum"`);
  }
}
