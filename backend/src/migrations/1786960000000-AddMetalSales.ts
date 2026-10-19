import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sales of physical metal. A sale keeps what it was sold for and the cost it
 * carried away, so the realized result survives the lot it came from: selling
 * a lot out completely deletes the lot, and `lot_id` goes NULL rather than
 * taking the sale with it.
 */
export class AddMetalSales1786960000000 implements MigrationInterface {
  name = 'AddMetalSales1786960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "metal_sales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "lot_id" uuid,
        "metal" "investment_metal_enum" NOT NULL,
        "lot_name" character varying(255) NOT NULL,
        "quantity" numeric(24,8) NOT NULL,
        "fine_ounces" numeric(24,8) NOT NULL,
        "proceeds" numeric(20,6) NOT NULL DEFAULT 0,
        "proceeds_currency" character varying(10) NOT NULL,
        "cost_basis" numeric(20,6),
        "cost_currency" character varying(10),
        "sold_on" date NOT NULL,
        "counterparty" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_metal_sales" PRIMARY KEY ("id"),
        CONSTRAINT "FK_metal_sales_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_metal_sales_lot"
          FOREIGN KEY ("lot_id") REFERENCES "investment_holdings"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_metal_sales_workspace_sold_on"
      ON "metal_sales" ("workspace_id", "sold_on")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_metal_sales_workspace_sold_on"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "metal_sales"`);
  }
}
