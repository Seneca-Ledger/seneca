import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Stoic class a user assigned to a category (necessity, work, virtue,
 * leisure). Nullable on purpose: until the user decides, the class is only a
 * suggestion computed from the name, and nothing is written for it.
 */
export class AddCategoryStoicClass1786600000000 implements MigrationInterface {
  name = 'AddCategoryStoicClass1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "stoic_class" varchar(16)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP COLUMN IF EXISTS "stoic_class"
    `);
  }
}
