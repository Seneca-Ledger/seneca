import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Words that name a document or the kind of an operation rather than who got
 * the money (payee-key.util.ts as of this migration, copied so later changes
 * do not change what ran).
 */
const GENERIC_WORDS = [
  'invoice',
  'inv',
  'receipt',
  'bill',
  'order',
  'payment',
  'document',
  'tax',
  'number',
  'no',
  'nr',
  'ref',
  'reference',
  'unknown',
  'merchant',
  'rechnung',
  'quittung',
  'beleg',
  'factura',
  'facture',
  'fattura',
  'recibo',
  'faktura',
  'чек',
  'счет',
  'фактура',
  'квитанция',
  'номер',
  'pos',
  'purchase',
  'purchases',
  'debit',
  'credit',
  'card',
  'direct',
  'deposit',
  'deposits',
  'withdrawal',
  'withdrawals',
  'interac',
  'mobile',
  'online',
  'internet',
  'banking',
  'transfer',
  'transfers',
  'sent',
  'received',
  'e',
  'etransfer',
  'bills',
  'payments',
  'loan',
  'abm',
  'atm',
  'cheque',
  'check',
  'preauthorized',
  'pre',
  'authorized',
  'ach',
  'eft',
  'wire',
  'incoming',
  'outgoing',
  'cash',
  'network',
  'fee',
  'fees',
  'service',
  'charge',
  'charges',
  'refund',
  'monthly',
  'maintenance',
  'insurance',
  'premium',
  'recurring',
  'contactless',
  'kartenzahlung',
  'lastschrift',
  'uberweisung',
  'dauerauftrag',
  'gutschrift',
  'покупка',
  'оплата',
  'перевод',
  'пополнение',
  'снятие',
  'наличных',
  'платеж',
  'зачисление',
  'списание',
];

/** `payee_key` made only of generic words. */
const GENERIC = (column: string): string =>
  `NOT EXISTS (SELECT 1 FROM unnest(string_to_array(${column}, ' ')) w WHERE NOT (w = ANY($1::text[])))`;

/**
 * Banks that print only "POS Purchase" or "Direct Debit" made one payee of
 * every shop paid that way, and teaching it a category would file them all
 * alike. Such rows lose the payee (a new import gives them none either), the
 * aliases built on those words go, and so do the payees left with nothing:
 * no rows, no alias, no subscription, no category pinned.
 *
 * Not reversible: the rows are what they were before a payee existed, and a
 * re-import or an edit keys them again under the old rules if it is rolled back.
 */
export class DropOperationOnlyPayees1787580000000 implements MigrationInterface {
  name = 'DropOperationOnlyPayees1787580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "transactions" SET "payee_id" = NULL, "payee_key" = NULL
       WHERE "payee_key" IS NOT NULL AND ${GENERIC('"payee_key"')}`,
      [GENERIC_WORDS],
    );
    // Aliases go with their payee (ON DELETE CASCADE).
    await queryRunner.query(
      `DELETE FROM "payees" p
       WHERE p."id" IN (
           SELECT "payee_id" FROM "payee_aliases"
           GROUP BY "payee_id" HAVING bool_and(${GENERIC('"payee_key"')})
         )
         AND p."category_id" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "transactions" t WHERE t."payee_id" = p."id")
         AND NOT EXISTS (SELECT 1 FROM "subscription_payees" s WHERE s."payee_id" = p."id")`,
      [GENERIC_WORDS],
    );
    await queryRunner.query(`DELETE FROM "payee_aliases" WHERE ${GENERIC('"payee_key"')}`, [
      GENERIC_WORDS,
    ]);
  }

  public async down(): Promise<void> {
    // See the class comment: nothing to restore.
  }
}
