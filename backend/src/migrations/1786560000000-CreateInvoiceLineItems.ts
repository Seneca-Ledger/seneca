import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceLineItems1786560000000 implements MigrationInterface {
  name = 'CreateInvoiceLineItems1786560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoice_line_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoice_id" uuid NOT NULL,
        "description" character varying(500) NOT NULL,
        "quantity" decimal(15,2) NOT NULL DEFAULT 1,
        "unit_price" decimal(15,2) NOT NULL,
        "tax_rate_id" uuid,
        "category_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_line_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "FK_invoice_line_items_invoice"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "FK_invoice_line_items_tax_rate"
      FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "FK_invoice_line_items_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoice_line_items_invoice"
      ON "invoice_line_items" ("invoice_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_invoice_line_items_invoice"');
    await queryRunner.query('DROP TABLE IF EXISTS "invoice_line_items"');
  }
}
