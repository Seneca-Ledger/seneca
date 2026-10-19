import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A discount or surcharge per invoice line, as a percentage of quantity ×
 * unit price: negative is a discount (EN 16931 line allowance, BG-27),
 * positive a surcharge (line charge, BG-28). Credit note lines carry it too,
 * and the unit of measure invoice lines already have. Only nullable or
 * defaulted columns are added.
 */
export class AddLineAdjustments1787180000000 implements MigrationInterface {
  name = 'AddLineAdjustments1787180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_line_items"
        ADD COLUMN "adjustment_percent" decimal(7,2),
        ADD CONSTRAINT "CHK_invoice_line_items_adjustment"
          CHECK ("adjustment_percent" IS NULL OR ("adjustment_percent" >= -100 AND "adjustment_percent" <= 1000))
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_note_line_items"
        ADD COLUMN "adjustment_percent" decimal(7,2),
        ADD COLUMN "unit_code" varchar(3) NOT NULL DEFAULT 'C62',
        ADD CONSTRAINT "CHK_credit_note_line_items_adjustment"
          CHECK ("adjustment_percent" IS NULL OR ("adjustment_percent" >= -100 AND "adjustment_percent" <= 1000))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "credit_note_line_items"
        DROP CONSTRAINT "CHK_credit_note_line_items_adjustment",
        DROP COLUMN "unit_code",
        DROP COLUMN "adjustment_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_line_items"
        DROP CONSTRAINT "CHK_invoice_line_items_adjustment",
        DROP COLUMN "adjustment_percent"
    `);
  }
}
