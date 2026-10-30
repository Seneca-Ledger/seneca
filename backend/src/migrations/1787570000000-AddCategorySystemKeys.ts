import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The default categories as of this migration, with every name each was stored
 * under before (seed 1762010000001, Russian rename 1763400000000). Kept here,
 * not imported, so later changes to the catalog do not change what ran.
 */
const CATALOG: ReadonlyArray<{
  key: string;
  name: string;
  type: 'income' | 'expense';
  aliases?: string[];
}> = [
  { key: 'sales', name: 'Sales', type: 'income', aliases: ['Продажи'] },
  { key: 'services', name: 'Services', type: 'income', aliases: ['Услуги'] },
  {
    key: 'interest_income',
    name: 'Interest income',
    type: 'income',
    aliases: ['Процентный доход'],
  },
  { key: 'other_income', name: 'Other income', type: 'income', aliases: ['Прочий доход'] },
  { key: 'salary', name: 'Salary', type: 'income' },
  { key: 'advertising', name: 'Advertising', type: 'expense', aliases: ['Реклама'] },
  {
    key: 'benefits',
    name: 'Benefits and compensation',
    type: 'expense',
    aliases: ['Benefits', 'Льготы и компенсации'],
  },
  {
    key: 'vehicle',
    name: 'Vehicle expenses',
    type: 'expense',
    aliases: ['Car', 'Автомобильные расходы'],
  },
  { key: 'equipment', name: 'Equipment', type: 'expense', aliases: ['Оборудование'] },
  {
    key: 'fees',
    name: 'Fees and charges',
    type: 'expense',
    aliases: ['Fees', 'Комиссии и сборы'],
  },
  { key: 'home_office', name: 'Home office', type: 'expense', aliases: ['Домашний офис'] },
  { key: 'insurance', name: 'Insurance', type: 'expense', aliases: ['Страхование'] },
  { key: 'interest', name: 'Interest', type: 'expense', aliases: ['Проценты'] },
  { key: 'payroll', name: 'Payroll', type: 'expense', aliases: ['Labor', 'Оплата труда'] },
  {
    key: 'maintenance',
    name: 'Maintenance and repairs',
    type: 'expense',
    aliases: ['Maintenance', 'Обслуживание и ремонт'],
  },
  { key: 'materials', name: 'Materials', type: 'expense', aliases: ['Материалы'] },
  {
    key: 'meals',
    name: 'Meals and entertainment',
    type: 'expense',
    aliases: ['Питание и представительские расходы'],
  },
  {
    key: 'office_supplies',
    name: 'Office supplies',
    type: 'expense',
    aliases: ['Канцелярские товары'],
  },
  {
    key: 'other_expenses',
    name: 'Other expenses',
    type: 'expense',
    aliases: ['Other', 'Прочие расходы'],
  },
  {
    key: 'professional_services',
    name: 'Professional services',
    type: 'expense',
    aliases: ['Профессиональные услуги'],
  },
  { key: 'rent', name: 'Rent', type: 'expense', aliases: ['Аренда'] },
  { key: 'taxes', name: 'Taxes', type: 'expense', aliases: ['Налоги'] },
  { key: 'travel', name: 'Travel', type: 'expense', aliases: ['Командировки'] },
  { key: 'utilities', name: 'Utilities', type: 'expense', aliases: ['Коммунальные услуги'] },
  { key: 'transfers_people', name: 'Transfers to people', type: 'expense' },
  { key: 'cash', name: 'Cash withdrawals', type: 'expense' },
  { key: 'groceries', name: 'Groceries', type: 'expense' },
  { key: 'dining', name: 'Dining out', type: 'expense' },
  { key: 'transport', name: 'Transport', type: 'expense' },
  { key: 'fuel', name: 'Fuel', type: 'expense' },
  { key: 'phone_internet', name: 'Phone and internet', type: 'expense' },
  { key: 'subscriptions', name: 'Subscriptions', type: 'expense' },
  { key: 'shopping', name: 'Shopping', type: 'expense' },
  { key: 'health', name: 'Health', type: 'expense' },
];

/** Added by this migration; `down()` removes the ones nothing uses yet. */
const NEW_KEYS = [
  'salary',
  'transfers_people',
  'cash',
  'groceries',
  'dining',
  'transport',
  'fuel',
  'phone_internet',
  'subscriptions',
  'shopping',
  'health',
];

/**
 * Gives every default category a stable key, so code finds "the fees category"
 * whatever it is called now, and makes sure every workspace has the full
 * default set, including the categories suggestions name.
 */
export class AddCategorySystemKeys1787570000000 implements MigrationInterface {
  name = 'AddCategorySystemKeys1787570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "system_key" varchar(32)`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_system_key"
        ON "categories" ("workspace_id", "system_key") WHERE "system_key" IS NOT NULL
    `);

    for (const { key, name, type, aliases = [] } of CATALOG) {
      const names = [name, ...aliases].map(value => value.toLowerCase());
      // One root category per workspace takes the key: a system one first,
      // then one under the current name, then the oldest. A user's own
      // "Groceries" takes the role rather than getting a twin.
      await queryRunner.query(
        `
          UPDATE "categories" c SET "system_key" = $1::varchar
          FROM (
            SELECT DISTINCT ON (cat."workspace_id") cat."id"
            FROM "categories" cat
            WHERE cat."parent_id" IS NULL
              AND cat."type"::text = $2
              AND cat."system_key" IS NULL
              AND LOWER(cat."name") = ANY($3::text[])
              AND NOT EXISTS (
                SELECT 1 FROM "categories" k
                WHERE k."workspace_id" = cat."workspace_id" AND k."system_key" = $1::varchar
              )
            ORDER BY cat."workspace_id", cat."is_system" DESC,
              (LOWER(cat."name") = $4) DESC, cat."created_at"
          ) pick
          WHERE c."id" = pick."id"
        `,
        [key, type, names, name.toLowerCase()],
      );
      await queryRunner.query(
        `
          INSERT INTO "categories"
            ("workspace_id", "name", "type", "is_system", "source", "is_enabled", "system_key",
             "created_at", "updated_at")
          SELECT w."id", $2::varchar, $3::"category_type_enum", true, 'system', true, $1::varchar,
            NOW(), NOW()
          FROM "workspaces" w
          WHERE NOT EXISTS (
            SELECT 1 FROM "categories" c
            WHERE c."workspace_id" = w."id" AND c."system_key" = $1::varchar
          )
        `,
        [key, name, type],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The new defaults go where nothing points at them yet; one already in use
    // stays as an ordinary category. Older defaults this migration filled into
    // workspaces that lacked them stay too: they cannot be told apart from the
    // ones seeded at creation, and they are what createSystemCategories makes.
    await queryRunner.query(
      `
        DELETE FROM "categories" c
        WHERE c."system_key" = ANY($1::text[])
          AND c."is_system" = true
          AND NOT EXISTS (SELECT 1 FROM "categories" x WHERE x."parent_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "transactions" x WHERE x."category_id" = c."id" OR x."private_category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "statements" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "budgets" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "subscriptions" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "payees" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "custom_tables" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "tax_rules" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "income_tax_line_mappings" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "journal_lines" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "invoice_line_items" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (SELECT 1 FROM "credit_note_line_items" x WHERE x."category_id" = c."id")
          AND NOT EXISTS (
            SELECT 1 FROM "categorization_rules" x WHERE x."result"->>'categoryId' = c."id"::text
          )
      `,
      [NEW_KEYS],
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_system_key"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "system_key"`);
  }
}
