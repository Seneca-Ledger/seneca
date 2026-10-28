import { BankName } from '../../entities/statement.entity';

/** Bank names are proper nouns and aren't translated per locale. */
export const BANK_DISPLAY_NAMES: Record<BankName, string> = {
  [BankName.KASPI]: 'Kaspi',
  [BankName.BEREKE_NEW]: 'Bereke Bank',
  [BankName.BEREKE_OLD]: 'Bereke Bank',
  [BankName.HAPOALIM]: 'Bank Hapoalim',
  [BankName.ABSA]: 'Absa Bank',
  [BankName.ALLY]: 'Ally Bank',
  [BankName.ANZ]: 'ANZ',
  [BankName.ATB]: 'ATB Financial',
  [BankName.OTHER]: 'Bank',
};
