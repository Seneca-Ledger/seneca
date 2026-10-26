import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What an EN 16931 e-invoice (XRechnung) needs that a printed invoice did
 * without: the seller's and the buyer's address in parts, the seller's
 * national tax number apart from its VAT id and a contact name, the buyer's
 * reference (BT-10), the delivery date, and a unit of measure per line
 * (UN/ECE Rec 20; C62 = one, the default). Only nullable or defaulted
 * columns are added; the free-form addresses stay as they are.
 */
export class AddEInvoiceIssueFields1787170000000 implements MigrationInterface {
  name = 'AddEInvoiceIssueFields1787170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_business_profiles"
        ADD COLUMN "street" varchar(255),
        ADD COLUMN "postal_code" varchar(16),
        ADD COLUMN "city" varchar(120),
        ADD COLUMN "tax_number" varchar(64),
        ADD COLUMN "contact_name" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "street" varchar(255),
        ADD COLUMN "postal_code" varchar(16),
        ADD COLUMN "city" varchar(120),
        ADD COLUMN "country_code" varchar(2),
        ADD COLUMN "buyer_reference" varchar(255),
        ADD COLUMN "supply_type" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN "buyer_reference" varchar(255),
        ADD COLUMN "delivery_date" date
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_line_items" ADD COLUMN "unit_code" varchar(3) NOT NULL DEFAULT 'C62'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice_line_items" DROP COLUMN "unit_code"`);
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN "delivery_date", DROP COLUMN "buyer_reference"
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN "supply_type", DROP COLUMN "buyer_reference", DROP COLUMN "country_code",
        DROP COLUMN "city", DROP COLUMN "postal_code", DROP COLUMN "street"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_business_profiles"
        DROP COLUMN "contact_name", DROP COLUMN "tax_number", DROP COLUMN "city",
        DROP COLUMN "postal_code", DROP COLUMN "street"
    `);
  }
}
