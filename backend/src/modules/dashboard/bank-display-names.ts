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
  [BankName.ASSOCIATED]: 'Associated Bank',
  [BankName.ATB]: 'ATB Financial',
  [BankName.AXIS]: 'Axis Bank',
  [BankName.BANCO_DO_BRASIL]: 'Banco do Brasil',
  [BankName.BANK_OF_CHINA]: 'Bank of China (Hong Kong)',
  [BankName.BANK_OF_SCOTLAND]: 'Bank of Scotland',
  [BankName.BARCLAYS]: 'Barclays',
  [BankName.OTHER]: 'Bank',
};
